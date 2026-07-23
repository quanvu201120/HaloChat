import { type Message } from '../services/messages';
import { type CallType } from '../services/socket';

export type LocalMessage = Message & {
  _error?: boolean;
};

export type CallUiState = {
  callId: string;
  conversationId: string;
  callToken?: string;
  callType: CallType;
  direction: 'incoming' | 'outgoing';
  status: 'incoming' | 'calling' | 'connecting' | 'active';
  peerName: string;
  peerId: string;
  peerAvatarUrl?: string;
};

export type IncomingCallRouteState = {
  incomingCall?: {
    callId: string;
    callerId?: string;
    calleeId: string;
    conversationId: string;
    callType: CallType;
    callToken?: string;
  };
};
