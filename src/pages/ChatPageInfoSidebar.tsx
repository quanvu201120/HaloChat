/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  X, Camera, Trash2, Edit2, Check, Pencil, UserPlus, UserMinus, Crown, UserX, UserCheck,
  ChevronDown, ChevronRight, Search, Image, Video, FileText, Download, History, ShieldOff, LogOut,
} from 'lucide-react';
import { MediaResourceTypeEnum, type MediaResponse, mediaApi } from '../services/media';
import { type Conversation } from '../services/conversations';
import { api } from '../services/api';
import { UI_MESSAGES } from '../constants/messages';
import { UI_LIMITS } from '../constants/limits';
import { getUserRestrictionState } from './ChatPage.helpers';

type ChatPageInfoSidebarProps = {
  showInfo: boolean;
  setShowInfo: React.Dispatch<React.SetStateAction<boolean>>;
  conv: Conversation | null;
  convName: string;
  currentUserId: string;
  isGroupAdmin: boolean;
  isTargetUserDisabled: boolean;
  isBlocked: boolean;
  iBlockedThem: boolean;
  headerAvatarUrl: string | null | undefined;
  otherUser: any;
  blockedUserIds: Set<string>;
  isLoadingConv: boolean;
  isLoadingRelationships: boolean;
  isUploadingAvatar: boolean;
  editingGroupName: boolean;
  setEditingGroupName: React.Dispatch<React.SetStateAction<boolean>>;
  groupNameInput: string;
  setGroupNameInput: React.Dispatch<React.SetStateAction<string>>;
  isGroupAvatarMenuOpen: boolean;
  setIsGroupAvatarMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  groupAvatarMenuRef: React.RefObject<HTMLDivElement | null>;
  groupAvatarInputRef: React.RefObject<HTMLInputElement | null>;
  isMembersExpanded: boolean;
  setIsMembersExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  memberSearchQuery: string;
  setMemberSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  isImagesExpanded: boolean;
  setIsImagesExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isVideosExpanded: boolean;
  setIsVideosExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isFilesExpanded: boolean;
  setIsFilesExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarMedia: Partial<Record<MediaResourceTypeEnum, MediaResponse[]>>;
  isLoadingSidebarMedia: Partial<Record<MediaResourceTypeEnum, boolean>>;
  fetchSidebarMedia: (type: MediaResourceTypeEnum, isLoadMore?: boolean, forceRefetch?: boolean) => void;
  setLightboxMedias: React.Dispatch<React.SetStateAction<MediaResponse[] | null>>;
  setLightboxIndex: React.Dispatch<React.SetStateAction<number>>;
  setSelectedGroupMedia: React.Dispatch<React.SetStateAction<{ url: string; type: 'image' | 'video' } | null>>;
  handleUploadGroupAvatar: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteGroupAvatar: () => void;
  handleUpdateGroupName: () => void;
  handleShowUserProfile: (userObj: any) => void;
  handleChangeAdmin: (memberId: string, memberName: string) => void;
  handleRemoveMember: (memberId: string, memberName: string) => void;
  setShowAddMemberModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleHideHistory: () => void;
  handleDisbandGroup: () => void;
  handleLeaveGroup: () => void;
  handleBlockRequest: () => void;
  handleUnblockRequest: () => void;
  toast: { success: (msg: string) => void; error: (msg: string) => void };
};

// Preview video trong sidebar chỉ là thumbnail TĨNH — KHÔNG xin vé chủ động.
// Vé chỉ được xin khi người dùng click mở lightbox (nơi mới thật sự phát video),
// tránh mỗi video cuộn vào tầm nhìn lại bắn một request `/media/:id/url` thừa.
function SidebarVideoPreview({ media }: { media: MediaResponse }) {
  if (media.thumbUrl) {
    return <img src={media.thumbUrl} alt="thumb" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />;
  }

  if (!media.url) return null;

  // Không có thumbnail → dùng khung hình đầu của video làm poster (URL sidebar vừa
  // fetch nên còn tươi). Lỗi tải cũng không sao: icon Video phủ bên trên vẫn báo đây là video.
  return (
    <video preload="metadata" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}>
      <source src={media.url} type={media.mimeType || 'video/mp4'} />
    </video>
  );
}

export default function ChatPageInfoSidebar({
  showInfo,
  setShowInfo,
  conv,
  convName,
  currentUserId,
  isGroupAdmin,
  isTargetUserDisabled,
  isBlocked,
  iBlockedThem,
  headerAvatarUrl,
  otherUser,
  blockedUserIds,
  isLoadingConv,
  isLoadingRelationships,
  isUploadingAvatar,
  editingGroupName,
  setEditingGroupName,
  groupNameInput,
  setGroupNameInput,
  isGroupAvatarMenuOpen,
  setIsGroupAvatarMenuOpen,
  groupAvatarMenuRef,
  groupAvatarInputRef,
  isMembersExpanded,
  setIsMembersExpanded,
  memberSearchQuery,
  setMemberSearchQuery,
  isImagesExpanded,
  setIsImagesExpanded,
  isVideosExpanded,
  setIsVideosExpanded,
  isFilesExpanded,
  setIsFilesExpanded,
  sidebarMedia,
  isLoadingSidebarMedia,
  fetchSidebarMedia,
  setLightboxMedias,
  setLightboxIndex,
  setSelectedGroupMedia,
  handleUploadGroupAvatar,
  handleDeleteGroupAvatar,
  handleUpdateGroupName,
  handleShowUserProfile,
  handleChangeAdmin,
  handleRemoveMember,
  setShowAddMemberModal,
  handleHideHistory,
  handleDisbandGroup,
  handleLeaveGroup,
  handleBlockRequest,
  handleUnblockRequest,
  toast,
}: ChatPageInfoSidebarProps) {
  return (
    <>
      {showInfo && (
        <div
          className="info-sidebar-backdrop"
          onClick={() => setShowInfo(false)}
        />
      )}
      <div className={`info-sidebar${showInfo ? ' open' : ''}`}>
        <div className="info-sidebar-header">
          <span>Thông tin hội thoại</span>
          <button className="icon-btn" onClick={() => setShowInfo(false)} title="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="info-sidebar-body">
          {/* Hidden file input for avatar */}
          {isGroupAdmin && (
            <input
              ref={groupAvatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadGroupAvatar}
            />
          )}

          {/* Avatar & Name */}
          <div className="info-sidebar-profile">
            <div className="info-sidebar-avatar-wrap">
              <div
                className="info-sidebar-avatar"
                style={{ cursor: conv?.avatar?.url ? 'pointer' : 'default', ...(isTargetUserDisabled ? { background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' } : ((conv?.avatar?.url || headerAvatarUrl) ? { background: 'none' } : {})) }}
                onClick={() => {
                  if (conv?.avatar?.url) {
                    setSelectedGroupMedia({ url: conv.avatar.url, type: 'image' });
                  }
                }}
              >
                {isTargetUserDisabled ? (
                  <UserX size={36} style={{ color: 'var(--text-muted)' }} />
                ) : conv?.avatar?.url ? (
                  <img src={conv.avatar.url} alt={convName} />
                ) : headerAvatarUrl ? (
                  <img src={headerAvatarUrl} alt={convName} />
                ) : (
                  <span>{convName.slice(0, 2).toUpperCase()}</span>
                )}

                {isUploadingAvatar && (
                  <div className="info-avatar-uploading">
                    <div className="loading-spinner" style={{ width: 20, height: 20 }} />
                  </div>
                )}
              </div>

              {isGroupAdmin && conv?.isGroup && (
                <div
                  ref={groupAvatarMenuRef}
                  style={{
                    position: 'absolute', bottom: -5, right: -5,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (conv?.avatar?.url) {
                      setIsGroupAvatarMenuOpen(!isGroupAvatarMenuOpen);
                    } else {
                      groupAvatarInputRef.current?.click();
                    }
                  }}
                >
                  <div style={{
                    background: 'var(--accent-primary)',
                    borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#fff', border: '2px solid var(--bg-primary)',
                    cursor: 'pointer'
                  }} title={conv?.avatar?.url ? "Tùy chọn" : "Đổi ảnh đại diện nhóm"}>
                    {isUploadingAvatar ? <div className="loading-spinner" style={{ width: 14, height: 14, borderColor: 'white', borderTopColor: 'transparent' }} /> : (conv?.avatar?.url ? <Edit2 size={13} /> : <Camera size={14} />)}
                  </div>

                  {isGroupAvatarMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      zIndex: 10,
                      minWidth: '120px',
                      animation: 'fadeIn 0.2s ease-out'
                    }}>
                      <button
                        className="dropdown-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', borderRadius: '4px', color: 'var(--text-primary)' }}
                        onClick={(e) => { e.stopPropagation(); setIsGroupAvatarMenuOpen(false); groupAvatarInputRef.current?.click(); }}
                      >
                        <Camera size={14} /> Chọn mới
                      </button>
                      <button
                        className="dropdown-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', borderRadius: '4px' }}
                        onClick={(e) => { e.stopPropagation(); setIsGroupAvatarMenuOpen(false); handleDeleteGroupAvatar(); }}
                        disabled={isUploadingAvatar}
                      >
                        <Trash2 size={14} /> Xóa ảnh
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Group name - editable for admin */}
            {conv?.isGroup ? (
              editingGroupName ? (
                <div className="info-name-edit">
                  <div className="info-name-input-wrap">
                    <span className="info-name-counter">
                      {groupNameInput.length}/{UI_LIMITS.GROUP_NAME_MAX_LENGTH}
                    </span>
                    <input
                      className="info-name-input"
                      value={groupNameInput}
                      onChange={(e) => setGroupNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateGroupName();
                        if (e.key === 'Escape') setEditingGroupName(false);
                      }}
                      autoFocus
                      maxLength={UI_LIMITS.GROUP_NAME_MAX_LENGTH}
                    />
                  </div>
                  <div className="info-name-edit-actions">
                    <button className="icon-btn" onClick={handleUpdateGroupName} title="Lưu">
                      <Check size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => setEditingGroupName(false)} title="Hủy">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="info-sidebar-name-row">
                  <div className="info-sidebar-name">{convName}</div>
                  {isGroupAdmin && (
                    <button
                      className="icon-btn info-edit-name-btn"
                      title="Đổi tên nhóm"
                      onClick={() => {
                        setGroupNameInput(conv.name || '');
                        setEditingGroupName(true);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              )
            ) : (
              <div
                className={isTargetUserDisabled || isBlocked ? 'info-sidebar-name' : 'info-sidebar-name clickable'}
                onClick={isTargetUserDisabled || isBlocked ? undefined : () => handleShowUserProfile(otherUser || (conv && conv.users.find((u) => u._id === currentUserId)))}
                title={isTargetUserDisabled || isBlocked ? undefined : 'Xem thông tin'}
                style={{ cursor: isTargetUserDisabled || isBlocked ? 'default' : 'pointer' }}
              >
                {convName}
              </div>
            )}

            {conv?.isGroup && (
              <div className="info-sidebar-sub">{conv.users.length} thành viên</div>
            )}
          </div>

          {/* Members section */}
          {conv?.isGroup && (
            <div className="info-sidebar-section">
              <div
                className="info-sidebar-section-title"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
                onClick={() => setIsMembersExpanded(!isMembersExpanded)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Thành viên trong đoạn chat</span>
                  {isMembersExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                {isGroupAdmin && (
                  <button
                    className="icon-btn"
                    title="Thêm thành viên"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddMemberModal(true);
                    }}
                  >
                    <UserPlus size={16} />
                  </button>
                )}
              </div>
              {isMembersExpanded && (
                <>
                  <div style={{ padding: '8px 20px 4px' }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-light)' }}>
                      <Search size={14} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Tìm thành viên..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                  <div className="info-sidebar-members">
                  {conv.users.filter(member => {
                    if (!memberSearchQuery) return true;
                    const name = (member.name || '').toLowerCase();
                    return name.includes(memberSearchQuery.toLowerCase());
                  }).map((member) => {
                  const avatar = typeof member.avatar === 'object' && member.avatar?.url
                    ? member.avatar.url
                    : typeof member.avatar === 'string' ? member.avatar : null;
                  const displayName = member.name || 'Người dùng';
                  const isMemberAdmin = conv.adminGroupId === member._id;
                  const memberRestriction = getUserRestrictionState(member);
                  const hasMemberBadges = Boolean(memberRestriction.badgeLabel || member._id === currentUserId || isMemberAdmin);
                  const isMemberHidden = member.isDisabled || blockedUserIds.has(member._id);
                  const canOpenMemberProfile = memberRestriction.kind !== 'disable' && !isMemberHidden;
                  const canTransferAdmin = memberRestriction.kind === null && !isMemberHidden;
                  return (
                    <div key={member._id} className={`info-sidebar-member${canOpenMemberProfile ? '' : ' disabled'}`}>
                      <div
                        className="info-sidebar-member-avatar"
                        style={memberRestriction.kind === 'disable' || isMemberHidden
                          ? { background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }
                          : {}}
                      >
                        {memberRestriction.kind === 'disable' || isMemberHidden
                          ? <UserX size={18} />
                          : avatar
                            ? <img src={avatar} alt={displayName} />
                            : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div className="info-sidebar-member-info">
                        {hasMemberBadges && (
                          <div className="info-sidebar-member-badges">
                          {memberRestriction.badgeLabel && (
                            <span
                              className={`info-sidebar-member-mini-badge ${memberRestriction.kind === 'ban' ? 'badge-error' : ''}`}
                              style={memberRestriction.kind === 'disable'
                                ? { background: 'rgba(107,114,128,0.10)', color: 'var(--text-muted)', border: '1px solid rgba(107,114,128,0.20)' }
                                : undefined}
                            >
                              {memberRestriction.badgeLabel}
                            </span>
                          )}
                          {member._id === currentUserId && <span className="info-badge-me">Bạn</span>}
                          {isMemberAdmin && <span className="info-sidebar-member-admin-badge" aria-label="Quản trị viên"><Crown size={12} /></span>}
                          </div>
                        )}
                        <div
                          className={canOpenMemberProfile ? 'info-sidebar-member-name clickable' : 'info-sidebar-member-name info-sidebar-member-name-disabled'}
                          onClick={canOpenMemberProfile ? () => handleShowUserProfile(member) : undefined}
                          title={member.isDisabled ? undefined : displayName}
                          style={{ cursor: canOpenMemberProfile ? 'pointer' : 'default' }}
                        >
                          <span className="info-sidebar-member-name-text">{displayName}</span>
                          {memberRestriction.badgeLabel && (
                            <span
                              className={`info-sidebar-member-mini-badge ${memberRestriction.kind === 'ban' ? 'badge-error' : ''}`}
                              style={memberRestriction.kind === 'disable'
                                ? { background: 'rgba(107,114,128,0.10)', color: 'var(--text-muted)', border: '1px solid rgba(107,114,128,0.20)' }
                                : undefined}
                            >
                              {memberRestriction.badgeLabel}
                            </span>
                          )}
                          {member._id === currentUserId && <span className="info-badge-me">Bạn</span>}
                          {isMemberAdmin && <Crown size={14} className="text-warning" style={{ color: 'var(--warning)', marginLeft: '4px' }} aria-label="Quản trị viên" />}
                        </div>
                      </div>
                      {isGroupAdmin && !isMemberAdmin && (
                        <div className="info-sidebar-member-actions">
                          <button
                            className="icon-btn info-member-more"
                            title="Chuyển quyền quản trị viên"
                            onClick={canTransferAdmin ? () => handleChangeAdmin(member._id, displayName) : undefined}
                            disabled={!canTransferAdmin}
                            style={{ opacity: canTransferAdmin ? 1 : 0.4, cursor: canTransferAdmin ? 'pointer' : 'not-allowed' }}
                          >
                            <Crown size={16} className="text-warning" style={{ color: 'var(--warning)' }} />
                          </button>
                          <button
                            className="icon-btn info-member-more"
                            title="Xóa khỏi nhóm"
                            onClick={() => handleRemoveMember(member._id, displayName)}
                          >
                            <UserMinus size={16} className="text-error" style={{ color: 'var(--error)' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
              )}
            </div>
          )}

          {/* Images section */}
          <div className="info-sidebar-section">
            <div
              className="info-sidebar-section-title"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              onClick={() => setIsImagesExpanded(!isImagesExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Hình ảnh</span>
                {isImagesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <Image size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>
            {isImagesExpanded && (
              <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {isLoadingSidebarMedia[MediaResourceTypeEnum.IMAGE] && !sidebarMedia[MediaResourceTypeEnum.IMAGE]?.length ? (
                  <div style={{ textAlign: 'center' }}>Đang tải...</div>
                ) : sidebarMedia[MediaResourceTypeEnum.IMAGE]?.length ? (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '2px',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        paddingRight: '2px'
                      }}
                      onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                          fetchSidebarMedia(MediaResourceTypeEnum.IMAGE, true);
                        }
                      }}
                    >
                      {sidebarMedia[MediaResourceTypeEnum.IMAGE]!.map((media, idx) => (
                        <div
                          key={media._id}
                          onClick={() => {
                            setLightboxMedias(sidebarMedia[MediaResourceTypeEnum.IMAGE]!);
                            setLightboxIndex(idx);
                          }}
                          style={{ position: 'relative', width: '100%', paddingBottom: '100%', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}
                        >
                          <img src={media.thumbUrl || media.url} alt="img" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                    {isLoadingSidebarMedia[MediaResourceTypeEnum.IMAGE] && (
                      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px' }}>Đang tải thêm...</div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>Chưa có hình ảnh nào</div>
                )}
              </div>
            )}
          </div>

          {/* Videos section */}
          <div className="info-sidebar-section">
            <div
              className="info-sidebar-section-title"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              onClick={() => setIsVideosExpanded(!isVideosExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Video</span>
                {isVideosExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <Video size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>
            {isVideosExpanded && (
              <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {isLoadingSidebarMedia[MediaResourceTypeEnum.VIDEO] && !sidebarMedia[MediaResourceTypeEnum.VIDEO]?.length ? (
                  <div style={{ textAlign: 'center' }}>Đang tải...</div>
                ) : sidebarMedia[MediaResourceTypeEnum.VIDEO]?.length ? (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '2px',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        paddingRight: '2px'
                      }}
                      onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                          fetchSidebarMedia(MediaResourceTypeEnum.VIDEO, true);
                        }
                      }}
                    >
                      {sidebarMedia[MediaResourceTypeEnum.VIDEO]!.map((media, idx) => (
                        <div
                          key={media._id}
                          onClick={() => {
                            setLightboxMedias(sidebarMedia[MediaResourceTypeEnum.VIDEO]!);
                            setLightboxIndex(idx);
                          }}
                          style={{ position: 'relative', width: '100%', paddingBottom: '100%', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}
                        >
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', zIndex: 1 }}>
                            <Video size={20} />
                          </div>
                          <SidebarVideoPreview media={media} />
                        </div>
                      ))}
                    </div>
                    {isLoadingSidebarMedia[MediaResourceTypeEnum.VIDEO] && (
                      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px' }}>Đang tải thêm...</div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>Chưa có video nào</div>
                )}
              </div>
            )}
          </div>

          {/* Files section */}
          <div className="info-sidebar-section">
            <div
              className="info-sidebar-section-title"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              onClick={() => setIsFilesExpanded(!isFilesExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>File</span>
                {isFilesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>
            {isFilesExpanded && (
              <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {isLoadingSidebarMedia[MediaResourceTypeEnum.FILE] && !sidebarMedia[MediaResourceTypeEnum.FILE]?.length ? (
                  <div style={{ textAlign: 'center' }}>Đang tải...</div>
                ) : sidebarMedia[MediaResourceTypeEnum.FILE]?.length ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        paddingRight: '4px'
                      }}
                      onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                          fetchSidebarMedia(MediaResourceTypeEnum.FILE, true);
                        }
                      }}
                    >
                      {sidebarMedia[MediaResourceTypeEnum.FILE]!.map((media) => (
                        <div key={media._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <FileText size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                              {media.fileName || 'Tài liệu'}
                            </div>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!media.url) return;
                              try {
                                const isR2Media = Boolean(media.provider === 'r2' || (media.objectKey && media._id));
                                let blob: Blob;

                                if (isR2Media) {
                                  const response = await api.get(`/media/${media._id}/download`, {
                                    responseType: 'blob',
                                  });
                                  blob = response.data instanceof Blob
                                    ? response.data
                                    : new Blob([response.data], { type: media.mimeType || 'application/octet-stream' });
                                } else {
                                  // Cloudinary/URL thường: nếu media có hạn (expiresAt) thì xin URL mới trước khi tải.
                                  let downloadUrl = media.url;
                                  if (media.expiresAt) {
                                    const res = await mediaApi.getUrl(media._id);
                                    const payload = (res.data as any)?.data ?? res.data;
                                    downloadUrl = payload?.url || media.url;
                                  }
                                  const response = await fetch(downloadUrl);
                                  blob = await response.blob();
                                }

                                const blobUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = media.fileName || 'download';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                window.URL.revokeObjectURL(blobUrl);
                              } catch (err: any) {
                                console.error('Download error:', err);
                                if (err.response?.data instanceof Blob) {
                                  const text = await err.response.data.text();
                                  toast.error(`${UI_MESSAGES.chat.backendDownloadErrorPrefix}${text}`);
                                } else {
                                  toast.error(`${UI_MESSAGES.chat.downloadErrorPrefix}${err.message || UI_MESSAGES.chat.downloadFailedFallback}`);
                                }
                              }
                            }}
                            title="Tải xuống"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0, color: 'var(--text-secondary)' }}
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {isLoadingSidebarMedia[MediaResourceTypeEnum.FILE] && (
                      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px' }}>Đang tải thêm...</div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>Chưa có file nào</div>
                )}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          {(!isLoadingConv && !isLoadingRelationships) && (
            <div className="info-sidebar-danger-zone">
              <button
              className="info-danger-btn leave"
              style={{ marginBottom: '8px' }}
              onClick={handleHideHistory}
            >
              <History size={16} />
              <span>Xóa lịch sử chat</span>
            </button>

            {conv?.isGroup ? (
              isGroupAdmin ? (
                <button className="info-danger-btn disband" onClick={handleDisbandGroup}>
                  <ShieldOff size={16} />
                  <span>Giải tán nhóm</span>
                </button>
              ) : (
                <button className="info-danger-btn leave" onClick={handleLeaveGroup}>
                  <LogOut size={16} />
                  <span>Rời nhóm</span>
                </button>
              )
            ) : iBlockedThem ? (
              <button
                className="info-danger-btn"
                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                onClick={handleUnblockRequest}
              >
                <UserCheck size={16} />
                <span>Bỏ chặn</span>
              </button>
            ) : !isBlocked ? (
              <button
                className="info-danger-btn disband"
                onClick={handleBlockRequest}
              >
                <UserX size={16} />
                <span>Chặn</span>
              </button>
            ) : null}
          </div>
          )}
        </div>
      </div>
    </>
  );
}
