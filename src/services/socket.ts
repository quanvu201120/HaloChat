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

export type CallType = 'audio' | 'video';
export type CallEndReason = 'user_hangup' | 'callee_reject' | 'timeout' | 'network_lost' | 'error';

export type CallSessionDescription = {
  type: 'offer' | 'answer';
  sdp: string;
};

export type CallIceCandidate = {
  candidate: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
};

export type CallAckData = {
  callId: string;
  conversationId: string;
  callToken?: string;
};

export type CallHeartbeatData = {
  refreshed: boolean;
};

export type CallSyncData = {
  hasActiveCall: boolean;
  callId?: string;
  callerId?: string;
  calleeId?: string;
  conversationId?: string;
  callType?: CallType;
  callToken?: string;
  createdAt?: string;
};

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
    startHeartbeat();
  });

  socket.on('disconnect', (reason) => {
    stopHeartbeat();
  });

  socket.on('connect_error', (err) => {
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
export class SocketAckError extends Error {
  retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

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
      else reject(new SocketAckError(ack?.message || ack?.error || 'Failed to join conversation', ack?.retryAfterSeconds));
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

/**
 * Gửi một sự kiện call qua socket và chờ ACK từ backend.
 * Dùng chung cho start/accept/reject/end/heartbeat/signaling để giữ logic nhất quán.
 */
function emitCallEvent<T>(event: string, payload: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }

    socket.emit(event, payload, (ack: any) => {
      if (ack?.ok) resolve(ack?.data as T);
      else reject(new Error(ack?.message || ack?.error || `Failed to emit ${event}`));
    });
  });
}

/**
 * Khởi tạo một cuộc gọi mới từ caller.
 */
export function startCallSocket(payload: {
  calleeId: string;
  conversationId: string;
  callType: CallType;
}) {
  return emitCallEvent<CallAckData>('call:start', payload);
}

/**
 * Chấp nhận cuộc gọi đang chờ.
 */
export function acceptCallSocket(callId: string) {
  return emitCallEvent<CallAckData>('call:accept', { callId });
}

/**
 * Từ chối cuộc gọi đang chờ.
 */
export function rejectCallSocket(callId: string) {
  return emitCallEvent<CallAckData>('call:reject', { callId });
}

/**
 * Kết thúc cuộc gọi đang active với lý do cụ thể.
 */
export function endCallSocket(callId: string, endReason: CallEndReason) {
  return emitCallEvent<CallAckData>('call:end', { callId, endReason });
}

/**
 * Gia hạn heartbeat cho cuộc gọi đã accept để backend biết call vẫn còn sống.
 */
export function sendCallHeartbeatSocket(payload: {
  callId: string;
}) {
  return emitCallEvent<CallHeartbeatData>('call:heartbeat', payload);
}

/**
 * Sync lại cuộc gọi đang ring sau khi socket reconnect.
 */
export function syncCallSocket() {
  return emitCallEvent<CallSyncData>('call:sync', {});
}

/**
 * Chuyển SDP offer sang đầu còn lại của cuộc gọi.
 */
export function sendCallOfferSocket(payload: {
  callId: string;
  conversationId: string;
  callToken: string;
  offer: CallSessionDescription;
}) {
  return emitCallEvent<{ forwarded: boolean }>('call:offer', payload);
}

/**
 * Chuyển SDP answer sang đầu còn lại của cuộc gọi.
 */
export function sendCallAnswerSocket(payload: {
  callId: string;
  conversationId: string;
  callToken: string;
  answer: CallSessionDescription;
}) {
  return emitCallEvent<{ forwarded: boolean }>('call:answer', payload);
}

/**
 * Chuyển ICE candidate sang đầu còn lại của cuộc gọi.
 */
export function sendCallIceCandidateSocket(payload: {
  callId: string;
  conversationId: string;
  callToken: string;
  candidate: CallIceCandidate;
}) {
  return emitCallEvent<{ forwarded: boolean }>('call:ice-candidate', payload);
}
