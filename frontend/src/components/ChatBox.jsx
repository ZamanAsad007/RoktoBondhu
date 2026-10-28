import React, { useState, useEffect, useRef } from 'react';
import { api, tokenStorage } from '../api/client';
import { Shield, Phone, Send, AlertTriangle, CheckCircle2, Lock, X } from 'lucide-react';

export default function ChatBox({ matchId, initialThreadId, currentUser, onClose }) {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [error, setError] = useState(null);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, partnerTyping]);

  // Load thread and messages
  useEffect(() => {
    let isMounted = true;

    async function loadChat() {
      try {
        setLoading(true);
        setError(null);
        let fetchedThread = null;
        if (initialThreadId) {
          const res = await api.getChatThread(initialThreadId);
          fetchedThread = res.data;
        } else if (matchId) {
          const res = await api.getChatThreadByMatch(matchId);
          fetchedThread = res.data;
        }

        if (isMounted && fetchedThread) {
          setThread(fetchedThread);
          const msgRes = await api.getChatMessages(fetchedThread.id);
          setMessages(msgRes.data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load conversation');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadChat();

    return () => {
      isMounted = false;
    };
  }, [matchId, initialThreadId]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!thread?.id) return;

    const token = tokenStorage.getAccessToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?token=${encodeURIComponent(token)}&threadId=${encodeURIComponent(thread.id)}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'chat.message' && data.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            setPartnerTyping(false);
          } else if (data.type === 'chat.typing') {
            if (data.userId !== currentUser?.id) {
              setPartnerTyping(data.isTyping);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              if (data.isTyping) {
                typingTimeoutRef.current = setTimeout(() => {
                  setPartnerTyping(false);
                }, 3000);
              }
            }
          } else if (data.type === 'chat.phone_unlocked') {
            setThread((prev) => ({
              ...prev,
              phone_shared_by_donor: true,
              phone_shared_by_requester: true,
              donor_phone: data.donorPhone || prev.donor_phone,
              requester_phone: data.requesterPhone || prev.requester_phone,
            }));
          } else if (data.type === 'chat.thread_closed') {
            setThread((prev) => ({
              ...prev,
              status: 'CLOSED',
              closed_reason: data.reason,
            }));
          }
        } catch (e) {
          console.error('[ChatBox] WS message parse error:', e);
        }
      };

      ws.onerror = (e) => {
        console.warn('[ChatBox] WS error, running in fallback mode');
      };
    } catch (e) {
      console.warn('[ChatBox] WS init failed', e);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [thread?.id, currentUser?.id]);

  // Send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || sending || !thread || thread.status === 'CLOSED') return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await api.sendChatMessage(thread.id, text);
      const newMsg = res.data;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Reset typing
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'typing', threadId: thread.id, isTyping: false }));
      }
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Handle typing debounce
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (socketRef.current?.readyState === WebSocket.OPEN && thread) {
      socketRef.current.send(JSON.stringify({ type: 'typing', threadId: thread.id, isTyping: true }));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'typing', threadId: thread.id, isTyping: false }));
        }
      }, 2000);
    }
  };

  // Bilateral phone sharing
  const handleSharePhone = async () => {
    if (!thread || thread.status === 'CLOSED') return;
    try {
      const res = await api.shareChatPhone(thread.id);
      const isDonor = currentUser?.id === thread.donor_id;
      setThread((prev) => ({
        ...prev,
        phone_shared_by_donor: isDonor ? true : prev.phone_shared_by_donor,
        phone_shared_by_requester: !isDonor ? true : prev.phone_shared_by_requester,
        ...(res.data?.phonesUnlocked ? { phones_unlocked: true } : {}),
      }));
    } catch (err) {
      setError(err.message || 'Failed to share phone number');
    }
  };

  // Block & Report User
  const handleBlockUser = async () => {
    if (!thread) return;
    try {
      await api.blockChatUser(thread.id, blockReason || 'User reported in chat');
      setThread((prev) => ({
        ...prev,
        status: 'CLOSED',
        closed_reason: 'USER_BLOCKED',
      }));
      setBlockModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to block user');
    }
  };

  const isDonor = currentUser?.id === thread?.donor_id;
  const myPhoneShared = isDonor ? thread?.phone_shared_by_donor : thread?.phone_shared_by_requester;
  const phonesUnlocked = thread?.phone_shared_by_donor && thread?.phone_shared_by_requester;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-600 border-t-transparent mb-3" />
        <p className="text-slate-600 font-medium">Connecting to secure chat...</p>
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-red-200 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 font-medium mb-4">{error}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  const partnerName = isDonor ? thread?.requester_name : thread?.donor_name;
  const partnerRole = isDonor ? 'Blood Requester' : 'Volunteer Donor';

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col h-[560px] max-w-xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center font-bold text-lg">
            {partnerName ? partnerName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-base leading-tight">{partnerName}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                {partnerRole}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-400" />
              Masked Privacy Mode Active
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setBlockModalOpen(true)}
            title="Report & Block"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
          >
            <AlertTriangle className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close chat"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Privacy & Phone Sharing Banner */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
        {phonesUnlocked ? (
          <div className="flex items-center space-x-2 text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>
              Contact Unlocked: {isDonor ? `Requester: ${thread.requester_phone}` : `Donor: ${thread.donor_phone}`}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2 text-slate-600">
              <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span>Phone numbers masked for safety.</span>
            </div>
            {myPhoneShared ? (
              <span className="text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded">
                Waiting for {partnerName}...
              </span>
            ) : (
              <button
                onClick={handleSharePhone}
                className="flex items-center space-x-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded shadow-sm transition"
              >
                <Phone className="h-3 w-3" />
                <span>Share Contact Number</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/50">
        {messages.map((msg) => {
          if (msg.is_system) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-center max-w-sm">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isMe = msg.sender_id === currentUser?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  isMe
                    ? 'bg-red-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                }`}
              >
                <p className="break-words leading-relaxed">{msg.content}</p>
                <span
                  className={`block text-[10px] mt-1 text-right ${
                    isMe ? 'text-red-200' : 'text-slate-400'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {partnerTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl px-3 py-1.5 text-xs text-slate-500 italic flex items-center space-x-1">
              <span>{partnerName} is typing</span>
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Thread Closed Banner or Input Box */}
      {thread?.status === 'CLOSED' ? (
        <div className="bg-slate-200 text-slate-700 text-center py-3 text-xs font-semibold uppercase tracking-wider border-t border-slate-300">
          This chat has been closed ({thread.closed_reason || 'TERMINATED'})
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={`Message ${partnerName || ''}...`}
            className="flex-1 bg-slate-50 border border-slate-300 focus:border-red-500 focus:bg-white rounded-xl px-4 py-2 text-sm focus:outline-none transition"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-xl shadow-sm transition flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}

      {/* Block & Report Modal */}
      {blockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h4 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Report & Block Participant
            </h4>
            <p className="text-xs text-slate-600 mb-4">
              Blocking this user will permanently close this chat thread and log a safety report for admin review.
            </p>
            <textarea
              rows={3}
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Reason for blocking (e.g. offensive language, suspected fraud)..."
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setBlockModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBlockUser}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
