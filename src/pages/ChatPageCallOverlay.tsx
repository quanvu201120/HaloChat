import { X, Phone, Video, Mic, MicOff, Camera, VideoOff, RefreshCw } from 'lucide-react';
import { formatDuration } from './ChatPage.helpers';
import type { CallUiState } from './ChatPage.types';

type ChatPageCallOverlayProps = {
  callState: CallUiState;
  callDurationSeconds: number;
  isCallMicEnabled: boolean;
  isCallCameraEnabled: boolean;
  isSwitchingCamera: boolean;
  isMobileDevice: boolean;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  handleEndCall: () => void;
  handleRejectCall: () => void;
  handleAcceptCall: () => void;
  handleToggleCallMic: () => void;
  handleToggleCallCamera: () => void;
  handleSwitchCallCamera: () => void;
};

export default function ChatPageCallOverlay({
  callState,
  callDurationSeconds,
  isCallMicEnabled,
  isCallCameraEnabled,
  isSwitchingCamera,
  isMobileDevice,
  remoteVideoRef,
  localVideoRef,
  remoteAudioRef,
  handleEndCall,
  handleRejectCall,
  handleAcceptCall,
  handleToggleCallMic,
  handleToggleCallCamera,
  handleSwitchCallCamera,
}: ChatPageCallOverlayProps) {
  return (
    <div className="call-overlay">
      <div className={`call-panel ${callState.callType}`}>
        <div className="call-panel-header">
          <div>
            <div className="call-panel-title">
              {callState.callType === 'video' ? 'Video call' : 'Cuộc gọi thoại'}
            </div>
            <div className="call-panel-subtitle">
              {callState.status === 'incoming'
                ? `${callState.peerName} đang gọi`
                : callState.status === 'calling'
                  ? `Đang gọi ${callState.peerName}`
                  : callState.status === 'active'
                    ? `Đang kết nối với ${callState.peerName}`
                    : `Đang thiết lập với ${callState.peerName}`}
            </div>
            {callState.status === 'active' && (
              <div className="call-panel-subtitle">
                {formatDuration(callDurationSeconds)}
              </div>
            )}
          </div>
          {callState.status !== 'incoming' && (
            <button className="call-close-btn" onClick={() => void handleEndCall()} title="Kết thúc">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="call-media">
          {callState.callType === 'video' ? (
            <>
              <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />
              <video
                ref={localVideoRef}
                className={`call-local-video${!isCallCameraEnabled ? ' off' : ''}`}
                autoPlay
                muted
                playsInline
              />
            </>
          ) : (
            <div className="call-audio-avatar">
              {callState.peerAvatarUrl ? (
                <img src={callState.peerAvatarUrl} alt={callState.peerName} />
              ) : (
                <>
                  <Phone size={38} />
                  <span>{callState.peerName.slice(0, 2).toUpperCase()}</span>
                </>
              )}
            </div>
          )}
          {callState.callType === 'audio' && <audio ref={remoteAudioRef} autoPlay />}
        </div>

        <div className="call-actions">
          {callState.status === 'incoming' ? (
            <>
              <button className="call-action-btn reject" onClick={() => void handleRejectCall()}>
                <X size={20} />
              </button>
              <button className="call-action-btn accept" onClick={() => void handleAcceptCall()}>
                {callState.callType === 'video' ? <Video size={20} /> : <Phone size={20} />}
              </button>
            </>
          ) : (
            <>
              <button
                className={`call-action-btn toggle${!isCallMicEnabled ? ' off' : ''}`}
                onClick={handleToggleCallMic}
                title={isCallMicEnabled ? 'Tắt mic' : 'Bật mic'}
              >
                {isCallMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button className="call-action-btn reject" onClick={() => void handleEndCall()}>
                <X size={20} />
              </button>
              {callState.callType === 'video' && (
                <>
                  <button
                    className={`call-action-btn toggle${!isCallCameraEnabled ? ' off' : ''}`}
                    onClick={handleToggleCallCamera}
                    title={isCallCameraEnabled ? 'Tắt camera' : 'Bật camera'}
                  >
                    {isCallCameraEnabled ? <Camera size={20} /> : <VideoOff size={20} />}
                  </button>
                  {isMobileDevice && (
                    <button
                      className="call-action-btn toggle"
                      onClick={() => void handleSwitchCallCamera()}
                      title="Đổi camera"
                      disabled={isSwitchingCamera}
                    >
                      <RefreshCw size={20} />
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
