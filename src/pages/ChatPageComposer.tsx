import { X, Send, Square, Plus, Paperclip, Image, Video, Mic, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { formatDuration } from './ChatPage.helpers';

type ChatPageComposerProps = {
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  emojiPickerRef: React.RefObject<HTMLDivElement | null>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => void;
  isRecordingVoice: boolean;
  recordingDuration: number;
  cancelVoiceRecording: () => void;
  stopVoiceRecording: () => void;
  startVoiceRecording: () => void;
  showMediaMenu: boolean;
  setShowMediaMenu: React.Dispatch<React.SetStateAction<boolean>>;
  isTempConversation: boolean;
  editingMessageId: string | null;
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  handleComposerChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isMuted: boolean;
  showHighlightMenu: boolean;
  setShowHighlightMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setSuppressHighlightTriggerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  insertHighlightToken: () => void;
  handleSend: () => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
  activeConversationId: string;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
};

export default function ChatPageComposer({
  imageInputRef,
  videoInputRef,
  fileInputRef,
  inputRef,
  emojiPickerRef,
  handleFileChange,
  isRecordingVoice,
  recordingDuration,
  cancelVoiceRecording,
  stopVoiceRecording,
  startVoiceRecording,
  showMediaMenu,
  setShowMediaMenu,
  isTempConversation,
  editingMessageId,
  text,
  setText,
  handleComposerChange,
  isMuted,
  showHighlightMenu,
  setShowHighlightMenu,
  setSuppressHighlightTriggerIndex,
  insertHighlightToken,
  handleSend,
  showEmojiPicker,
  setShowEmojiPicker,
  activeConversationId,
  startTyping,
  stopTyping,
}: ChatPageComposerProps) {
  return (
      <div className="composer">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(event) => handleFileChange(event, 'image')}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          style={{ display: 'none' }}
          onChange={(event) => handleFileChange(event, 'video')}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
          style={{ display: 'none' }}
          onChange={(event) => handleFileChange(event, 'file')}
        />

        {isRecordingVoice ? (
          <div className="voice-recording-overlay">
            <button className="icon-btn cancel-voice-btn" onClick={cancelVoiceRecording} title="Hủy">
              <X size={24} />
            </button>
            <div className="voice-recording-pill">
              <button className="voice-stop-btn" onClick={stopVoiceRecording} title="Dừng và xem trước">
                <Square size={20} fill="currentColor" />
              </button>
              <span className="voice-timer">{formatDuration(recordingDuration)}</span>
            </div>
            <button className="icon-btn send-voice-btn" onClick={() => {
              stopVoiceRecording();
            }} title="Xong">
              <Send size={24} />
            </button>
          </div>
        ) : (
          <>
            <div className="composer-media-actions">
              <button
                className={`icon-btn mobile-plus-btn${showMediaMenu ? ' active' : ''}`}
                title="Đính kèm"
                onClick={() => setShowMediaMenu((prev) => !prev)}
                disabled={isTempConversation}
              >
                <Plus size={24} />
              </button>

              {showMediaMenu && (
                <div className="media-actions-backdrop" onClick={() => setShowMediaMenu(false)} />
              )}

              <div className={`media-actions-menu${showMediaMenu ? ' open' : ''}`}>
                <button className="icon-btn" title="Đính kèm file" onClick={() => { fileInputRef.current?.click(); setShowMediaMenu(false); }}>
                  <Paperclip size={24} />
                </button>
                <button className="icon-btn" title="Gửi ảnh" onClick={() => { imageInputRef.current?.click(); setShowMediaMenu(false); }}>
                  <Image size={24} />
                </button>
                <button className="icon-btn" title="Gửi video" onClick={() => { videoInputRef.current?.click(); setShowMediaMenu(false); }}>
                  <Video size={24} />
                </button>
                <button
                  className="icon-btn"
                  title="Ghi âm"
                  onClick={() => { startVoiceRecording(); setShowMediaMenu(false); }}
                >
                  <Mic size={24} />
                </button>
              </div>
            </div>
            <input
              ref={inputRef}
              className="composer-input"
              placeholder={isTempConversation ? 'Đang khởi tạo...' : editingMessageId ? 'Chỉnh sửa tin nhắn...' : 'Nhập tin nhắn...'}
              value={text}
              onChange={handleComposerChange}
              onKeyDown={(event) => {
                if (event.key === '@' && !isMuted && !isTempConversation) {
                  requestAnimationFrame(() => setShowHighlightMenu(true));
                }
                if (event.key === 'Escape' && showHighlightMenu) {
                  event.preventDefault();
                  event.stopPropagation();
                  const cursor = inputRef.current?.selectionStart ?? text.length;
                  const beforeCursor = text.slice(0, cursor);
                  const triggerIndex = beforeCursor.lastIndexOf('@');
                  setSuppressHighlightTriggerIndex(triggerIndex >= 0 ? triggerIndex : null);
                  setShowHighlightMenu(false);
                  return;
                }
                if (event.key === 'Tab' && showHighlightMenu) {
                  event.preventDefault();
                  insertHighlightToken();
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              onBlur={() => {
                if (activeConversationId) stopTyping(activeConversationId);
                setTimeout(() => setShowHighlightMenu(false), 120);
              }}
              disabled={isTempConversation}
            />
            {showHighlightMenu && (
              <div className="highlight-menu">
                <button type="button" className="highlight-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={insertHighlightToken}>
                  <strong>@[[  ]]</strong>
                  <span>Nổi bật đoạn này</span>
                </button>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <button
                className={`icon-btn${showEmojiPicker ? ' active' : ''}`}
                title="Emoji"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!showEmojiPicker) {
                    inputRef.current?.blur();
                  }
                  setShowEmojiPicker((prev) => !prev);
                }}
                disabled={isTempConversation}
              >
                <Smile size={24} />
              </button>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  style={{ position: 'absolute', bottom: '100%', right: 0, zIndex: 50, marginBottom: '8px' }}
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      setText((prev) => prev + emojiData.emoji);
                      if (activeConversationId) startTyping(activeConversationId);
                    }}
                    lazyLoadEmojis={true}
                    searchPlaceHolder="Tìm kiếm Emoji..."
                    autoFocusSearch={false}
                  />
                </div>
              )}
            </div>
            <button
              className={`composer-send${text.trim() ? ' active' : ''}`}
              onClick={handleSend}
              disabled={!text.trim() || isTempConversation}
              title={editingMessageId ? 'Lưu thay đổi' : 'Gửi'}
            >
              <Send size={24} />
            </button>
          </>
        )}
      </div>
  );
}
