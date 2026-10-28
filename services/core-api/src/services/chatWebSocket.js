const { WebSocketServer } = require('ws');
const url = require('url');
const { verifyAccessToken } = require('../utils/token');
const userRepository = require('../repositories/userRepository');

let wss = null;
const threadRooms = new Map(); // threadId -> Set<WebSocket>

/**
 * Broadcast payload to all connected sockets in a thread
 */
function broadcastToThread(threadId, data, excludeSocket = null) {
  const sockets = threadRooms.get(String(threadId));
  if (!sockets || sockets.size === 0) return;

  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  for (const client of sockets) {
    if (client !== excludeSocket && client.readyState === 1 /* OPEN */) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('[ChatWebSocket] Error sending message to socket:', err.message);
      }
    }
  }
}

/**
 * Remove socket from all joined threads
 */
function removeSocketFromAllThreads(ws) {
  if (!ws.threads) return;
  for (const threadId of ws.threads) {
    const set = threadRooms.get(threadId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        threadRooms.delete(threadId);
      }
    }
  }
  ws.threads.clear();
}

/**
 * Initialize Chat WebSocket Gateway
 */
function initChatWebSocket(httpServer) {
  wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/chat',
  });

  wss.on('connection', async (ws, req) => {
    ws.threads = new Set();

    try {
      const parsedUrl = url.parse(req.url, true);
      const token = parsedUrl.query.token;

      if (!token) {
        ws.close(4001, 'Unauthorized: Missing token');
        return;
      }

      const decoded = verifyAccessToken(token);
      const user = await userRepository.findById(decoded.id);

      if (!user || user.is_blocked) {
        ws.close(4001, 'Unauthorized: Invalid user or blocked');
        return;
      }

      ws.user = { id: user.id, name: user.name, role: user.role };

      // If threadId is provided in query parameter, auto-join
      if (parsedUrl.query.threadId) {
        const threadId = String(parsedUrl.query.threadId);
        ws.threads.add(threadId);
        if (!threadRooms.has(threadId)) {
          threadRooms.set(threadId, new Set());
        }
        threadRooms.get(threadId).add(ws);
      }

      // Send connected ack
      ws.send(JSON.stringify({ type: 'connected', user: ws.user }));

      // Handle incoming messages
      ws.on('message', (messageText) => {
        try {
          const data = JSON.parse(messageText.toString());

          switch (data.type) {
            case 'join': {
              if (data.threadId) {
                const tId = String(data.threadId);
                ws.threads.add(tId);
                if (!threadRooms.has(tId)) {
                  threadRooms.set(tId, new Set());
                }
                threadRooms.get(tId).add(ws);
                ws.send(JSON.stringify({ type: 'joined', threadId: tId }));
              }
              break;
            }

            case 'leave': {
              if (data.threadId) {
                const tId = String(data.threadId);
                ws.threads.delete(tId);
                const set = threadRooms.get(tId);
                if (set) {
                  set.delete(ws);
                  if (set.size === 0) threadRooms.delete(tId);
                }
                ws.send(JSON.stringify({ type: 'left', threadId: tId }));
              }
              break;
            }

            case 'typing': {
              if (data.threadId) {
                broadcastToThread(
                  String(data.threadId),
                  {
                    type: 'chat.typing',
                    threadId: data.threadId,
                    userId: ws.user.id,
                    userName: ws.user.name,
                    isTyping: Boolean(data.isTyping),
                  },
                  ws
                );
              }
              break;
            }

            case 'ping': {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              break;
            }

            default:
              break;
          }
        } catch (parseErr) {
          console.error('[ChatWebSocket] Message parsing error:', parseErr.message);
        }
      });

      ws.on('close', () => {
        removeSocketFromAllThreads(ws);
      });

      ws.on('error', (err) => {
        console.error('[ChatWebSocket] Socket error:', err.message);
        removeSocketFromAllThreads(ws);
      });
    } catch (err) {
      console.error('[ChatWebSocket] Connection error:', err.message);
      ws.close(4001, 'Unauthorized');
    }
  });

  return wss;
}

function closeChatWebSocket() {
  if (wss) {
    wss.close();
    wss = null;
    threadRooms.clear();
  }
}

module.exports = {
  initChatWebSocket,
  closeChatWebSocket,
  broadcastToThread,
};
