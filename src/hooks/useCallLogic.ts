/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { NavigateFunction, Location } from 'react-router-dom';
import {
  getSocket,
  startCallSocket,
  acceptCallSocket,
  rejectCallSocket,
  endCallSocket,
  sendCallHeartbeatSocket,
  sendCallOfferSocket,
  sendCallAnswerSocket,
  sendCallIceCandidateSocket,
  type CallIceCandidate,
  type CallSessionDescription,
  type CallType,
} from '../services/socket';
import { api } from '../services/api';
import type { Conversation, ConversationUser } from '../services/conversations';
import { normalizeId } from '../utils/chat';
import { getDeviceCategoryFromUserAgent } from '../utils/device';
import { startCallTone as startSharedCallTone, stopCallTone as stopSharedCallTone } from '../utils/callTone';
import {
  getUserMediaCompat,
  WEBRTC_FALLBACK_ICE_SERVERS,
  PENDING_CALL_ID_PREFIX,
} from '../pages/ChatPage.helpers';
import type { CallUiState, IncomingCallRouteState } from '../pages/ChatPage.types';

type CallToast = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  info: (msg: string) => void;
};

type UseCallLogicParams = {
  activeConversationId: string;
  conv: Conversation | null;
  otherUser: ConversationUser | null | undefined;
  currentUserId: string;
  isFriend: boolean;
  socket: ReturnType<typeof getSocket>;
  toast: CallToast;
  navigate: NavigateFunction;
  location: Location;
};

let cachedWebrtcIceServers: RTCIceServer[] = WEBRTC_FALLBACK_ICE_SERVERS;
let loadingWebrtcIceServersPromise: Promise<RTCIceServer[]> | null = null;

/**
 * Lấy ICE servers ngay trước khi tạo/renegotiate RTCPeerConnection (không cache
 * dài hạn ở FE) vì credential có TTL và backend tự xoay vòng theo `webrtc-config.service.ts`.
 */
async function fetchWebrtcIceServers(): Promise<RTCIceServer[]> {
  if (loadingWebrtcIceServersPromise) return loadingWebrtcIceServersPromise;

  loadingWebrtcIceServersPromise = api.get('/realtime/webrtc/ice-servers')
    .then((res) => {
      const servers = res.data?.iceServers;
      if (Array.isArray(servers) && servers.length > 0) {
        cachedWebrtcIceServers = servers;
        return servers;
      }
      return cachedWebrtcIceServers;
    })
    .catch(() => cachedWebrtcIceServers)
    .finally(() => {
      loadingWebrtcIceServersPromise = null;
    });

  return loadingWebrtcIceServersPromise;
}

export function useCallLogic({
  activeConversationId,
  conv,
  otherUser,
  currentUserId,
  isFriend,
  socket,
  toast,
  navigate,
  location,
}: UseCallLogicParams) {
  const [callState, setCallState] = useState<CallUiState | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isCallMicEnabled, setIsCallMicEnabled] = useState(true);
  const [isCallCameraEnabled, setIsCallCameraEnabled] = useState(true);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const callTokenRef = useRef<string>('');
  const pendingOutgoingCallIdRef = useRef<string>('');
  const callHeartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webrtcIceServersRef = useRef<RTCIceServer[]>(cachedWebrtcIceServers);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callLocalStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isMobileDevice = getDeviceCategoryFromUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '') === 'mobile';

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localCallStream;
    }
  }, [localCallStream]);

  useEffect(() => {
    for (const video of [remoteVideoRef.current, localVideoRef.current]) {
      if (!video) continue;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.disablePictureInPicture = true;
    }
  }, []);

  useEffect(() => {
    if (!localCallStream) return;

    setIsCallMicEnabled(localCallStream.getAudioTracks()[0]?.enabled ?? true);
    setIsCallCameraEnabled(localCallStream.getVideoTracks()[0]?.enabled ?? true);
  }, [localCallStream]);

  useEffect(() => {
    callTokenRef.current = callState?.callToken || '';
  }, [callState?.callToken]);

  const stopCallTone = useCallback(() => stopSharedCallTone(), []);
  const startCallTone = useCallback((mode: 'incoming' | 'outgoing') => startSharedCallTone(mode), []);

  const cleanupCall = useCallback(() => {
    stopCallTone();
    pendingOutgoingCallIdRef.current = '';
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    callLocalStreamRef.current?.getTracks().forEach((track) => track.stop());
    callLocalStreamRef.current = null;
    pendingIceCandidatesRef.current = [];
    setRemoteStream(null);
    setLocalCallStream(null);
    setCallState(null);
    setCallStartedAt(null);
    setCallDurationSeconds(0);
    setIsCallMicEnabled(true);
    setIsCallCameraEnabled(true);
    setIsSwitchingCamera(false);
  }, [stopCallTone]);

  const getCallMedia = useCallback(async (callType: CallType) => {
    if (callLocalStreamRef.current) return callLocalStreamRef.current;

    const stream = await getUserMediaCompat({
      audio: true,
      video: callType === 'video',
    });
    callLocalStreamRef.current = stream;
    setLocalCallStream(stream);
    setIsCallMicEnabled(stream.getAudioTracks()[0]?.enabled ?? true);
    setIsCallCameraEnabled(stream.getVideoTracks()[0]?.enabled ?? true);
    return stream;
  }, []);

  const handleToggleCallMic = useCallback(() => {
    const audioTrack = callLocalStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsCallMicEnabled(audioTrack.enabled);
  }, []);

  const handleToggleCallCamera = useCallback(() => {
    const videoTrack = callLocalStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setIsCallCameraEnabled(videoTrack.enabled);
  }, []);

  const handleSwitchCallCamera = useCallback(async () => {
    if (!callState || callState.callType !== 'video' || !isMobileDevice || isSwitchingCamera) return;

    const currentStream = callLocalStreamRef.current;
    const currentVideoTrack = currentStream?.getVideoTracks()[0];
    if (!currentStream || !currentVideoTrack) return;

    const currentFacingMode = currentVideoTrack.getSettings().facingMode;
    const nextFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

    setIsSwitchingCamera(true);
    try {
      const videoStream = await getUserMediaCompat({
        audio: false,
        video: { facingMode: { ideal: nextFacingMode } },
      });
      const nextVideoTrack = videoStream.getVideoTracks()[0];
      if (!nextVideoTrack) {
        throw new Error('Không thể đổi camera.');
      }

      nextVideoTrack.enabled = isCallCameraEnabled;
      const nextStream = new MediaStream([
        ...currentStream.getAudioTracks(),
        nextVideoTrack,
      ]);

      const sender = peerConnectionRef.current?.getSenders().find((item) => item.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(nextVideoTrack);
      }

      currentVideoTrack.stop();
      callLocalStreamRef.current = nextStream;
      setLocalCallStream(nextStream);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đổi camera.');
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [callState, isCallCameraEnabled, isMobileDevice, isSwitchingCamera, toast]);

  const flushPendingIceCandidates = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection?.remoteDescription) return;

    const candidates = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];
    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(candidate);
    }
  }, []);

  const ensurePeerConnection = useCallback((callId: string, conversationId: string, stream: MediaStream) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const peerConnection = new RTCPeerConnection({ iceServers: webrtcIceServersRef.current });
    peerConnectionRef.current = peerConnection;

    const markCallActive = () => {
      setCallState((prev) => {
        if (!prev || prev.callId !== callId || prev.status === 'active') return prev;
        return { ...prev, status: 'active' };
      });
      setCallStartedAt((prev) => prev ?? Date.now());
    };

    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

    peerConnection.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) {
        setRemoteStream(incomingStream);
        markCallActive();
      }
    };

    peerConnection.onicecandidate = (event) => {
      const candidate = event.candidate?.toJSON() as CallIceCandidate | undefined;
      if (!candidate) return;
      const callToken = callTokenRef.current;
      if (!callToken) return;
      void sendCallIceCandidateSocket({ callId, conversationId, callToken, candidate }).catch(() => {});
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`[webrtc] connectionState -> ${state}`);
      if (state === 'connected') {
        markCallActive();
      }
      // 'disconnected' có thể chỉ là tạm thời (vd. đang restartIce() để đổi TURN credential
      // mới) và tự phục hồi — chỉ coi 'failed' là rớt kết nối thật để tránh cắt cuộc gọi nhầm.
      if (state === 'failed') {
        if (callState?.callId === callId) {
          void endCallSocket(callId, 'network_lost').catch(() => {});
        }
        cleanupCall();
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log(`[webrtc] iceConnectionState -> ${state}`);
      if (state === 'connected') {
        markCallActive();
      }
      if (state === 'failed') {
        if (callState?.callId === callId) {
          void endCallSocket(callId, 'network_lost').catch(() => {});
        }
        cleanupCall();
      }
    };

    return peerConnection;
  }, [callState?.callId, cleanupCall]);

  useEffect(() => {
    if (!callState || callState.status !== 'active' || !callStartedAt) {
      setCallDurationSeconds(0);
      return;
    }

    const updateDuration = () => {
      setCallDurationSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
    };

    updateDuration();
    const timer = setInterval(updateDuration, 1000);
    return () => clearInterval(timer);
  }, [callStartedAt, callState?.status, callState?.callId]);

  /**
   * Bắt đầu cuộc gọi mới từ chat hiện tại.
   * Chỉ cho phép chat 1-1 và chỉ khi không có cuộc gọi active nào khác.
   */
  const handleStartCall = useCallback(async (callType: CallType) => {
    if (!activeConversationId || !otherUser || !conv || conv.isGroup) {
      toast.warning('Chỉ hỗ trợ gọi 1-1 ở phiên bản này.');
      return;
    }
    if (!isFriend) {
      toast.warning('Chỉ có thể gọi khi hai bên là bạn bè.');
      return;
    }
    if (!socket?.connected) {
      toast.error('Socket chưa sẵn sàng, vui lòng thử lại.');
      return;
    }
    if (callState) {
      toast.warning('Bạn đang có một cuộc gọi khác.');
      return;
    }

    const pendingCallId = PENDING_CALL_ID_PREFIX + Date.now();
    pendingOutgoingCallIdRef.current = pendingCallId;
    setCallState({
      callId: pendingCallId,
      conversationId: activeConversationId,
      callType,
      direction: 'outgoing',
      status: 'calling',
      peerName: otherUser.name || otherUser.email || 'Người dùng',
      peerId: otherUser._id,
      peerAvatarUrl: otherUser.avatar?.url || '',
    });
    startCallTone('outgoing');

    try {
      const stream = await getCallMedia(callType);
      if (pendingOutgoingCallIdRef.current !== pendingCallId) {
        cleanupCall();
        return;
      }

      const ack = await startCallSocket({
        calleeId: otherUser._id,
        conversationId: activeConversationId,
        callType,
      });
      if (pendingOutgoingCallIdRef.current !== pendingCallId) {
        await endCallSocket(ack.callId, 'user_hangup').catch(() => undefined);
        cleanupCall();
        return;
      }

      webrtcIceServersRef.current = await fetchWebrtcIceServers();
      ensurePeerConnection(ack.callId, activeConversationId, stream);
      pendingOutgoingCallIdRef.current = '';
      setCallState((prev) => {
        if (!prev || prev.callId !== pendingCallId) return prev;
        return {
          ...prev,
          callId: ack.callId,
          conversationId: activeConversationId,
          callToken: ack.callToken,
        };
      });
    } catch (error) {
      pendingOutgoingCallIdRef.current = '';
      cleanupCall();
      toast.error(error instanceof Error ? error.message : 'Không thể bắt đầu cuộc gọi.');
    }
  }, [activeConversationId, callState, cleanupCall, conv, ensurePeerConnection, getCallMedia, isFriend, otherUser, socket?.connected, startCallTone, toast]);

  /**
   * Chấp nhận cuộc gọi incoming và chuyển sang giai đoạn kết nối WebRTC.
   */
  const handleAcceptCall = useCallback(async () => {
    if (!callState || callState.status !== 'incoming') return;

    try {
      stopCallTone();
      const stream = await getCallMedia(callState.callType);
      await acceptCallSocket(callState.callId);
      webrtcIceServersRef.current = await fetchWebrtcIceServers();
      ensurePeerConnection(callState.callId, callState.conversationId, stream);
      setCallState((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
    } catch (error) {
      cleanupCall();
      toast.error(error instanceof Error ? error.message : 'Không thể nhận cuộc gọi.');
    }
  }, [callState, cleanupCall, ensurePeerConnection, getCallMedia, stopCallTone, toast]);

  /**
   * Từ chối cuộc gọi incoming hoặc dừng call đang chờ/kết nối.
   */
  const handleRejectCall = useCallback(async () => {
    if (!callState) return;
    try {
      if (callState.status === 'incoming') {
        await rejectCallSocket(callState.callId);
      } else {
        await endCallSocket(callState.callId, 'user_hangup');
      }
    } catch {
      // UI vẫn cần đóng cuộc gọi dù ack thất bại.
    } finally {
      cleanupCall();
    }
  }, [callState, cleanupCall]);

  /**
   * Chủ động kết thúc cuộc gọi đang chạy từ phía người dùng hiện tại.
   */
  const handleEndCall = useCallback(async () => {
    if (!callState) return;
    if (callState.callId.startsWith(PENDING_CALL_ID_PREFIX)) {
      pendingOutgoingCallIdRef.current = '';
      cleanupCall();
      return;
    }
    try {
      await endCallSocket(callState.callId, 'user_hangup');
    } catch {
      // UI vẫn cần dọn media local nếu server không ack kịp.
    } finally {
      cleanupCall();
    }
  }, [callState, cleanupCall]);

  /**
   * Dừng timer heartbeat của call hiện tại để tránh ping tiếp sau khi call đã đóng.
   */
  const stopCallHeartbeat = useCallback(() => {
    if (callHeartbeatTimerRef.current) {
      clearInterval(callHeartbeatTimerRef.current);
      callHeartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * Bắt đầu ping heartbeat định kỳ cho call đã accept.
   * FE chỉ bật timer này ở phía callee sau khi cuộc gọi chuyển khỏi trạng thái incoming.
   */
  const startCallHeartbeat = useCallback(() => {
    stopCallHeartbeat();

    if (!callState || callState.direction !== 'incoming' || callState.status === 'incoming') {
      return;
    }

    const ping = () => {
      void sendCallHeartbeatSocket({
        callId: callState.callId,
      }).catch(() => {});
    };

    ping();
    callHeartbeatTimerRef.current = setInterval(ping, 25_000);
  }, [callState, stopCallHeartbeat]);
  useEffect(() => {
    const incomingCall = (location.state as IncomingCallRouteState | null)?.incomingCall;
    if (!incomingCall || callState) return;

    const conversationId = normalizeId(incomingCall.conversationId);
    if (!conversationId || conversationId !== activeConversationId) return;
    if (incomingCall.calleeId !== currentUserId) return;

    const callerId = normalizeId(incomingCall.callerId) || conv?.users.find((member) => member._id !== currentUserId)?._id || '';
    const caller = conv?.users.find((member) => member._id === callerId);
    setCallState({
      callId: incomingCall.callId,
      conversationId,
      callToken: incomingCall.callToken,
      callType: incomingCall.callType,
      direction: 'incoming',
      status: 'incoming',
      peerName: caller?.name || caller?.email || 'Người gọi',
      peerId: callerId,
      peerAvatarUrl: caller?.avatar?.url || '',
    });
    startCallTone('incoming');
    navigate(`/chat/${conversationId}`, { replace: true, state: null });
  }, [activeConversationId, callState, conv?.users, currentUserId, location.state, navigate, startCallTone]);

  useEffect(() => {
    if (!callState || callState.direction !== 'incoming') {
      stopCallHeartbeat();
      return;
    }

    if (callState.status === 'incoming') {
      stopCallHeartbeat();
      return;
    }

    startCallHeartbeat();
    return () => stopCallHeartbeat();
  }, [callState, startCallHeartbeat, stopCallHeartbeat]);

  useEffect(() => {
    if (!activeConversationId || !socket) return;

    const onIncomingCall = (data: {
      callId: string;
      callerId: string;
      calleeId: string;
      conversationId: string;
      callType: CallType;
      callToken?: string;
    }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (data.calleeId !== currentUserId) return;
      if (callState) return;

      const caller = conv?.users.find((member) => member._id === data.callerId);
      setCallState({
        callId: data.callId,
        conversationId: data.conversationId,
        callToken: data.callToken,
        callType: data.callType,
        direction: 'incoming',
        status: 'incoming',
        peerName: caller?.name || caller?.email || 'Người gọi',
        peerId: data.callerId,
        peerAvatarUrl: caller?.avatar?.url || '',
      });
      startCallTone('incoming');
    };

      const onCallAccepted = async (data: { callId: string; conversationId: string; callToken?: string; acceptedBySocketId?: string }) => {
        if (!callState || data.callId !== callState.callId) return;
        try {
          if (callState.direction === 'incoming' && data.acceptedBySocketId && getSocket()?.id !== data.acceptedBySocketId) {
            cleanupCall();
            return;
          }

          stopCallTone();
          const stream = callLocalStreamRef.current || await getCallMedia(callState.callType);
          const callToken = data.callToken || callTokenRef.current || callState.callToken;
          if (!callToken) throw new Error('Missing call token');
          webrtcIceServersRef.current = await fetchWebrtcIceServers();
          const peerConnection = ensurePeerConnection(data.callId, data.conversationId, stream);
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          if (!offer.sdp) throw new Error('Invalid call offer');

          await sendCallOfferSocket({
            callId: data.callId,
            conversationId: data.conversationId,
            callToken,
            offer: { type: 'offer', sdp: offer.sdp },
          });
          setCallState((prev) => (prev ? { ...prev, callToken, status: 'connecting' } : prev));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Không thể tạo kết nối cuộc gọi.');
          cleanupCall();
        }
      };

    const onCallRejected = (data: { callId: string }) => {
      if (callState?.callId !== data.callId) return;
      toast.info('Cuộc gọi đã bị từ chối.');
      cleanupCall();
    };

    const onCallEnded = (data: { callId: string }) => {
      if (callState?.callId !== data.callId) return;
      cleanupCall();
    };

    const onCallClose = (data: {
      callId: string;
      acceptedBySocketId?: string;
      reason?: 'accepted' | 'rejected' | 'ended';
    }) => {
      if (callState?.callId !== data.callId) return;
      if (data.acceptedBySocketId && getSocket()?.id === data.acceptedBySocketId) return;
      cleanupCall();
    };

    const onCallOffer = async (data: {
      callId: string;
      conversationId: string;
      fromUserId: string;
      offer: CallSessionDescription;
    }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (!callState || data.callId !== callState.callId || data.fromUserId === currentUserId) return;

      try {
        const stream = callLocalStreamRef.current || await getCallMedia(callState.callType);
        const callToken = callTokenRef.current || callState.callToken;
        if (!callToken) throw new Error('Missing call token');
        if (!peerConnectionRef.current) {
          webrtcIceServersRef.current = await fetchWebrtcIceServers();
        }
        const peerConnection = ensurePeerConnection(data.callId, data.conversationId, stream);
        await peerConnection.setRemoteDescription(data.offer);
        await flushPendingIceCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        if (!answer.sdp) throw new Error('Invalid call answer');

        await sendCallAnswerSocket({
          callId: data.callId,
          conversationId: data.conversationId,
          callToken,
          answer: { type: 'answer', sdp: answer.sdp },
        });
        // Renegotiation (vd. sau restartIce()) có thể tới khi call đã 'active' — giữ nguyên
        // trạng thái đó, chỉ chuyển sang 'connecting' cho lần thiết lập kết nối đầu tiên.
        setCallState((prev) => (prev && prev.status !== 'active' ? { ...prev, status: 'connecting' } : prev));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể trả lời kết nối cuộc gọi.');
        cleanupCall();
      }
    };

      const onCallAnswer = async (data: {
        callId: string;
        conversationId: string;
        fromUserId: string;
        answer: CallSessionDescription;
      }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (!callState || data.callId !== callState.callId || data.fromUserId === currentUserId) return;
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;

        try {
          await peerConnection.setRemoteDescription(data.answer);
          await flushPendingIceCandidates();
          setCallState((prev) => (prev && prev.status !== 'active' ? { ...prev, status: 'connecting' } : prev));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể nhận kết nối cuộc gọi.');
        cleanupCall();
      }
    };

      const onCallIceCandidate = async (data: {
        callId: string;
        conversationId: string;
        fromUserId: string;
        candidate: CallIceCandidate;
      }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (!callState || data.callId !== callState.callId || data.fromUserId === currentUserId) return;

      const candidate = data.candidate as RTCIceCandidateInit;
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection?.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await peerConnection.addIceCandidate(candidate);
      } catch {
        pendingIceCandidatesRef.current.push(candidate);
      }
    };

    const onIceServersUpdated = async (data: { iceServers: RTCIceServer[] }) => {
      const oldIceServers = webrtcIceServersRef.current;
      console.log('[webrtc] ice-servers-updated received. old =', oldIceServers, 'new =', data.iceServers);

      cachedWebrtcIceServers = data.iceServers;
      webrtcIceServersRef.current = data.iceServers;

      const peerConnection = peerConnectionRef.current;
      if (!peerConnection || !callState) {
        console.log('[webrtc] no active peer connection, new ICE servers will be used on next call.');
        return;
      }

      try {
        peerConnection.setConfiguration({ iceServers: data.iceServers });
        console.log('[webrtc] setConfiguration() applied with rotated ICE servers.');

        // Chỉ bên khởi tạo (caller) mới chủ động restartIce() + tạo offer mới để tránh
        // "offer collision" khi cả 2 bên cùng renegotiate. Bên nhận sẽ tự ICE-restart
        // khi nhận offer mới qua onCallOffer/onCallAnswer hiện có.
        if (callState.direction === 'outgoing') {
          const callToken = callTokenRef.current || callState.callToken;
          if (!callToken) {
            console.log('[webrtc] skip renegotiation: missing callToken.');
            return;
          }

          console.log('[webrtc] restartIce() called, creating renegotiation offer...');
          peerConnection.restartIce();
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          if (!offer.sdp) throw new Error('Invalid renegotiation offer');

          await sendCallOfferSocket({
            callId: callState.callId,
            conversationId: callState.conversationId,
            callToken,
            offer: { type: 'offer', sdp: offer.sdp },
          });
          console.log('[webrtc] renegotiation offer sent.');
        }
      } catch (error) {
        console.log('[webrtc] ICE servers rotation/renegotiation failed:', error);
      }
    };

    socket.on('call:incoming', onIncomingCall);
    socket.on('call:accepted', onCallAccepted);
    socket.on('call:rejected', onCallRejected);
    socket.on('call:ended', onCallEnded);
    socket.on('call:close', onCallClose);
    socket.on('call:offer', onCallOffer);
    socket.on('call:answer', onCallAnswer);
    socket.on('call:ice-candidate', onCallIceCandidate);
    socket.on('webrtc:ice-servers-updated', onIceServersUpdated);

    return () => {
      socket.off('call:incoming', onIncomingCall);
      socket.off('call:accepted', onCallAccepted);
      socket.off('call:rejected', onCallRejected);
      socket.off('call:ended', onCallEnded);
      socket.off('call:close', onCallClose);
      socket.off('call:offer', onCallOffer);
      socket.off('call:answer', onCallAnswer);
      socket.off('call:ice-candidate', onCallIceCandidate);
      socket.off('webrtc:ice-servers-updated', onIceServersUpdated);
    };
  }, [
    activeConversationId,
    callState,
    cleanupCall,
    conv?.users,
    currentUserId,
    ensurePeerConnection,
    flushPendingIceCandidates,
    getCallMedia,
    getSocket,
    socket,
    startCallTone,
    stopCallTone,
    toast,
  ]);

  useEffect(() => () => stopCallHeartbeat(), [stopCallHeartbeat]);

  useEffect(() => cleanupCall, [activeConversationId, cleanupCall]);

  return {
    callState,
    callDurationSeconds,
    isCallMicEnabled,
    isCallCameraEnabled,
    isSwitchingCamera,
    isMobileDevice,
    remoteVideoRef,
    localVideoRef,
    remoteAudioRef,
    handleStartCall,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
    handleToggleCallMic,
    handleToggleCallCamera,
    handleSwitchCallCamera,
  };
}
