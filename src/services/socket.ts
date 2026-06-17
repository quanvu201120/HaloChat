/**
 * Socket service cho HaloChat.
 * Theo HALOCHAT_FLOW.md:
 *  - socket chỉ connect sau khi có session hợp lệ (có accessToken)
 *  - không join tất cả room ngay từ đầu
 *  - chỉ join room khi user mở conversation
 *  - text message ưu tiên optimistic UI qua socket
 *  - heartbeat mỗi 50s để duy trì online presence
 */

import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from './api';

let socket: Socket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;

  socket = io(API_ORIGIN, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] connected:', socket?.id);
    startHeartbeat();
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] disconnected:', reason);
    stopHeartbeat();
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] connect error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  stopHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  // Redis presence TTL = 120s -> heartbeat mỗi 50s để tránh trễ nhịp
  heartbeatTimer = setInterval(() => {
    socket?.emit('user:heartbeat');
  }, 50_000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/** Join một conversation room khi user mở chat.
 * Trả về Promise resolve khi ack thành công.
 */
export function joinConversation(conversationId: string): Promise<{
  conversationId: string;
  roomName?: string;
  joined?: boolean;
  membersOnline?: string[];
}> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }
    socket.emit('chat:join-conversation', { conversationId }, (ack: any) => {
      if (ack?.ok) resolve(ack?.data ?? { conversationId });
      else reject(new Error(ack?.message || ack?.error || 'Failed to join conversation'));
    });
  });
}

/** Gửi text message qua socket (dùng cho optimistic UI).
 * Theo app-flow.md: socket tạo được text message như HTTP.
 */
export function sendTextMessage(
  conversationId: string,
  content: string,
  replyTo?: string,
  callback?: (ack: any) => void
) {
  socket?.emit('chat:create-message', { conversationId, content, replyTo }, callback);
}

export function updateTextMessage(
  conversationId: string,
  messageId: string,
  content: string,
  callback?: (ack: any) => void
) {
  socket?.emit('chat:update-message', { conversationId, messageId, content }, callback);
}

export function revokeMessage(
  conversationId: string,
  messageId: string,
  callback?: (ack: any) => void
) {
  socket?.emit('chat:delete-message', { conversationId, messageId }, callback);
}

export function startTyping(conversationId: string) {
  socket?.emit('chat:typing-start', { conversationId });
}

export function stopTyping(conversationId: string) {
  socket?.emit('chat:typing-stop', { conversationId });
}

export function markReadSocket(
  conversationId: string,
  messageId: string,
  callback?: (ack: any) => void
) {
  socket?.emit('chat:mark-read', { conversationId, messageId }, callback);
}
