const chatRepository = require('../repositories/chatRepository');
const matchRepository = require('../repositories/matchRepository');
const bloodRequestRepository = require('../repositories/bloodRequestRepository');
const chatFilter = require('../domain/chatFilter');
const sseService = require('./sseService');

// Lazy-loaded websocket broadcaster to prevent circular dependency
let chatWsModule = null;
function getChatWs() {
  if (!chatWsModule) {
    try {
      chatWsModule = require('./chatWebSocket');
    } catch (e) {
      // ws not initialized yet
    }
  }
  return chatWsModule;
}

class ChatService {
  /**
   * Helper to mask phone in user view if phones are not unlocked
   */
  maskPhoneDisplay(phone) {
    if (!phone || typeof phone !== 'string') return null;
    if (phone.length < 7) return '*******';
    return phone.slice(0, 3) + '****' + phone.slice(-3);
  }

  /**
   * Get or create thread for a match
   */
  async getThreadForMatch(matchId, currentUser) {
    const match = await matchRepository.findById(matchId);
    if (!match) {
      const err = new Error('Match invitation not found');
      err.statusCode = 404;
      throw err;
    }

    const request = await bloodRequestRepository.findById(match.request_id);
    if (!request) {
      const err = new Error('Associated blood request not found');
      err.statusCode = 404;
      throw err;
    }

    const isDonor = match.donor_id === currentUser.id;
    const isRequester = request.requester_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isDonor && !isRequester && !isAdmin) {
      const err = new Error('Forbidden: You are not a participant in this match conversation');
      err.statusCode = 403;
      throw err;
    }

    // Only allow chat if match is ACCEPTED or DONATED
    if (match.status !== 'ACCEPTED' && match.status !== 'DONATED' && !isAdmin) {
      const err = new Error('Chat is only available for accepted match invitations');
      err.statusCode = 400;
      throw err;
    }

    let thread = await chatRepository.getThreadByMatchId(matchId);
    if (!thread) {
      const newThread = await chatRepository.createThread({
        requestId: match.request_id,
        matchId: match.id,
        requesterId: request.requester_id,
        donorId: match.donor_id,
      });
      thread = await chatRepository.getThreadById(newThread.id);
    }

    const phonesUnlocked = thread.phone_shared_by_donor && thread.phone_shared_by_requester;
    if (!phonesUnlocked && !isAdmin) {
      thread.requester_phone = this.maskPhoneDisplay(thread.requester_phone);
      thread.donor_phone = this.maskPhoneDisplay(thread.donor_phone);
    }

    return thread;
  }

  /**
   * Get thread by ID with permission check
   */
  async getThreadById(threadId, currentUser) {
    const thread = await chatRepository.getThreadById(threadId);
    if (!thread) {
      const err = new Error('Chat thread not found');
      err.statusCode = 404;
      throw err;
    }

    const isDonor = thread.donor_id === currentUser.id;
    const isRequester = thread.requester_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isDonor && !isRequester && !isAdmin) {
      const err = new Error('Forbidden: You do not have access to this chat thread');
      err.statusCode = 403;
      throw err;
    }

    const phonesUnlocked = thread.phone_shared_by_donor && thread.phone_shared_by_requester;
    if (!phonesUnlocked && !isAdmin) {
      thread.requester_phone = this.maskPhoneDisplay(thread.requester_phone);
      thread.donor_phone = this.maskPhoneDisplay(thread.donor_phone);
    }

    return thread;
  }

  /**
   * Get messages for thread
   */
  async getMessages(threadId, currentUser, limit = 100) {
    const thread = await chatRepository.getThreadById(threadId);
    if (!thread) {
      const err = new Error('Chat thread not found');
      err.statusCode = 404;
      throw err;
    }

    const isDonor = thread.donor_id === currentUser.id;
    const isRequester = thread.requester_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isDonor && !isRequester && !isAdmin) {
      const err = new Error('Forbidden: You do not have access to these messages');
      err.statusCode = 403;
      throw err;
    }

    const phonesUnlocked = thread.phone_shared_by_donor && thread.phone_shared_by_requester;
    const rawMessages = await chatRepository.getMessages(threadId, limit);

    return rawMessages.map((msg) => {
      if (!phonesUnlocked && !isAdmin && !msg.is_system) {
        return {
          ...msg,
          content: chatFilter.maskPhoneNumbers(msg.content),
        };
      }
      return msg;
    });
  }

  /**
   * Send a chat message
   */
  async sendMessage({ threadId, currentUser, content }) {
    if (!content || !content.trim()) {
      const err = new Error('Message content cannot be empty');
      err.statusCode = 400;
      throw err;
    }

    const thread = await chatRepository.getThreadById(threadId);
    if (!thread) {
      const err = new Error('Chat thread not found');
      err.statusCode = 404;
      throw err;
    }

    const isDonor = thread.donor_id === currentUser.id;
    const isRequester = thread.requester_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isDonor && !isRequester && !isAdmin) {
      const err = new Error('Forbidden: You are not a participant of this chat thread');
      err.statusCode = 403;
      throw err;
    }

    if (thread.status === 'CLOSED') {
      const err = new Error('Chat thread is closed');
      err.statusCode = 400;
      throw err;
    }

    const isBlocked = await chatRepository.isUserBlocked(threadId, currentUser.id);
    if (isBlocked) {
      const err = new Error('This conversation has been closed or blocked');
      err.statusCode = 403;
      throw err;
    }

    const phonesUnlocked = thread.phone_shared_by_donor && thread.phone_shared_by_requester;
    const sanitizedContent = chatFilter.sanitizeChatMessage(content.trim(), phonesUnlocked || isAdmin);

    const saved = await chatRepository.saveMessage({
      threadId,
      senderId: currentUser.id,
      content: sanitizedContent,
      isSystem: false,
    });

    const enrichedMessage = {
      ...saved,
      sender_name: currentUser.name,
    };

    // Broadcast in real-time via WebSocket
    const ws = getChatWs();
    if (ws && typeof ws.broadcastToThread === 'function') {
      ws.broadcastToThread(threadId, {
        type: 'chat.message',
        message: enrichedMessage,
      });
    }

    // Broadcast SSE notification event to recipient
    const recipientId = currentUser.id === thread.donor_id ? thread.requester_id : thread.donor_id;
    sseService
      .publishEvent(
        'chat.message',
        {
          threadId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          content: enrichedMessage.content,
        },
        { targetUserIds: [recipientId] }
      )
      .catch((err) => console.error('[ChatService] SSE publish error:', err.message));

    return enrichedMessage;
  }

  /**
   * Share phone agreement
   */
  async sharePhone({ threadId, currentUser }) {
    const thread = await chatRepository.getThreadById(threadId);
    if (!thread) {
      const err = new Error('Chat thread not found');
      err.statusCode = 404;
      throw err;
    }

    if (thread.status === 'CLOSED') {
      const err = new Error('Cannot share contact details on a closed thread');
      err.statusCode = 400;
      throw err;
    }

    const isDonor = thread.donor_id === currentUser.id;
    const isRequester = thread.requester_id === currentUser.id;

    if (!isDonor && !isRequester) {
      const err = new Error('Forbidden: Only donors or requesters can agree to share phone numbers');
      err.statusCode = 403;
      throw err;
    }

    const result = await chatRepository.sharePhone({ threadId, userId: currentUser.id });

    // If phones unlocked now, broadcast WebSocket event
    if (result.phonesUnlocked) {
      const ws = getChatWs();
      if (ws && typeof ws.broadcastToThread === 'function') {
        ws.broadcastToThread(threadId, {
          type: 'chat.phone_unlocked',
          threadId,
          donorPhone: thread.donor_phone,
          requesterPhone: thread.requester_phone,
        });
      }
    }

    return result;
  }

  /**
   * Block and report participant
   */
  async blockUser({ threadId, currentUser, reason }) {
    const thread = await chatRepository.getThreadById(threadId);
    if (!thread) {
      const err = new Error('Chat thread not found');
      err.statusCode = 404;
      throw err;
    }

    const isDonor = thread.donor_id === currentUser.id;
    const isRequester = thread.requester_id === currentUser.id;

    if (!isDonor && !isRequester) {
      const err = new Error('Forbidden: You are not a participant in this chat thread');
      err.statusCode = 403;
      throw err;
    }

    const blockedUserId = isDonor ? thread.requester_id : thread.donor_id;

    const closedThread = await chatRepository.blockUser({
      threadId,
      blockedBy: currentUser.id,
      blockedUserId,
      reason: reason || 'User reported and blocked',
    });

    const ws = getChatWs();
    if (ws && typeof ws.broadcastToThread === 'function') {
      ws.broadcastToThread(threadId, {
        type: 'chat.thread_closed',
        threadId,
        reason: 'USER_BLOCKED',
      });
    }

    return closedThread;
  }

  /**
   * Auto-close threads when blood request completes/cancels
   */
  async autoCloseThreadsForRequest(requestId, reason = 'REQUEST_FULFILLED') {
    const closed = await chatRepository.closeThreadsForRequest(requestId, reason);
    const ws = getChatWs();
    if (ws && typeof ws.broadcastToThread === 'function') {
      for (const t of closed) {
        ws.broadcastToThread(t.id, {
          type: 'chat.thread_closed',
          threadId: t.id,
          reason,
        });
      }
    }
    return closed;
  }

  /**
   * Purge old messages (7 days retention on closed threads)
   */
  async purgeRetention(days = 7) {
    return chatRepository.purgeOldMessages(days);
  }
}

module.exports = new ChatService();
