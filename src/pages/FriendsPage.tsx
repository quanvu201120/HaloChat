import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, ChevronDown, MoreHorizontal, Check, ChevronLeft } from 'lucide-react';
import { useRelationships } from '../hooks/useRelationships';
import { conversationsApi } from '../services/conversations';
import { useChatStore as useChat } from '../store/chatStore';
import { useAuthStore as useAuth } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
export default function FriendsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    confirmText?: string;
    action: () => Promise<void> | void;
  } | null>(null);

  const { friends, sentRequests, receivedRequests, blockedUsers, isLoading, unfriend, block, unblock, accept, rejectOrRemove } = useRelationships();
  const { conversations, refetchConversations, mergeConversation, setConversations } = useChat();
  const { user } = useAuth();
  const toast = useToast();

  const currentTab = location.pathname;
  let currentList = friends;
  let title = 'Danh sách bạn bè';
  let emptyMessage = 'Chưa có bạn bè nào';

  if (currentTab === '/requests') {
    currentList = receivedRequests;
    title = 'Lời mời kết bạn';
    emptyMessage = 'Không có lời mời kết bạn nào';
  } else if (currentTab === '/sent-requests') {
    currentList = sentRequests;
    title = 'Đã gửi lời mời';
    emptyMessage = 'Chưa gửi lời mời nào';
  } else if (currentTab === '/blocked') {
    currentList = blockedUsers;
    title = 'Tài khoản đã chặn';
    emptyMessage = 'Bạn chưa chặn ai';
  }

  const { groupedFriends, totalFriends } = useMemo(() => {
    let filteredFriends = [...currentList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredFriends = filteredFriends.filter(f => (f.name || f.email || '').toLowerCase().includes(q));
    }
    
    // Sort alphabetically by name
    filteredFriends.sort((a, b) => {
      const nameA = (a.name || a.email || '').toLowerCase();
      const nameB = (b.name || b.email || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    // Group by first letter
    const grouped: Record<string, any[]> = {};
    filteredFriends.forEach(f => {
      const name = f.name || f.email || '';
      let firstLetter = name.charAt(0).toUpperCase();
      // Handle non-alphabetic characters
      if (!/[A-Z]/.test(firstLetter)) {
        firstLetter = '#';
      }
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(f);
    });

    return { groupedFriends: grouped, totalFriends: filteredFriends.length };
  }, [currentList, searchQuery, sortOrder]);

  const handleAction = async (action: string, friend: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(null);
    const friendName = friend.name || friend.email;

    if (action === 'info') {
      let tempId: string | null = null;
      try {
        const existingConv = conversations.find(c => 
          !c.isGroup && 
          c.users.some(u => u._id === friend._id)
        );

        if (existingConv) {
          navigate(`/chat/${existingConv._id}`);
          return;
        }

        // Optimistic UI
        tempId = `temp_${Date.now()}_${friend._id}`;
        const tempConv: any = {
          _id: tempId,
          isGroup: false,
          users: [
            { _id: user?._id, name: user?.name, email: user?.email, avatar: user?.avatar },
            { _id: friend._id, name: friend.name, email: friend.email, avatar: friend.avatar }
          ],
          updatedAt: new Date().toISOString(),
          isOptimistic: true
        };
        
        mergeConversation(tempConv);
        navigate(`/chat/${tempId}`);

        // API call in background
        const payload = { users: [friend._id] };
        const res = await conversationsApi.create(payload);
        const conv = res.data?.data ?? res.data;
        
        if (conv?._id) {
          // Merge real conversation first so sidebar doesn't lose the item
          mergeConversation(conv);
          // Navigate to real ID
          navigate(`/chat/${conv._id}`, { replace: true });
        }

        // Remove temp and silently refetch to prevent skeleton flashes
        setConversations(prev => prev.filter(c => c._id !== tempId));
        await refetchConversations({ silent: true });
      } catch (err: any) {
        if (tempId) setConversations(prev => prev.filter(c => c._id !== tempId));
        toast.error(err.response?.data?.message || 'Không thể mở cuộc trò chuyện');
        navigate('/friends', { replace: true });
      }
    } else if (action === 'unfriend') {
      setConfirmAction({
        title: 'Xóa bạn',
        message: `Bạn có chắc chắn muốn xóa ${friendName} khỏi danh sách bạn bè?`,
        isDanger: true,
        confirmText: 'Xóa bạn',
        action: async () => {
          try {
            await unfriend({ relationshipId: friend.relationshipId, targetUserId: friend._id });
            toast.success('Đã xóa khỏi danh sách bạn bè');
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
          }
        }
      });
    } else if (action === 'block') {
      setConfirmAction({
        title: 'Chặn người dùng',
        message: `Bạn có chắc chắn muốn chặn ${friendName}? Họ sẽ không thể nhắn tin hay xem thông tin của bạn nữa.`,
        isDanger: true,
        confirmText: 'Chặn',
        action: async () => {
          try {
            await block({ targetUserId: friend._id });
            toast.success('Đã chặn người dùng');
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
          }
        }
      });
    } else if (action === 'unblock') {
      setConfirmAction({
        title: 'Bỏ chặn',
        message: `Bạn có muốn bỏ chặn ${friendName} không?`,
        isDanger: false,
        confirmText: 'Bỏ chặn',
        action: async () => {
          try {
            await unblock({ targetUserId: friend._id });
            toast.success('Đã bỏ chặn người dùng');
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
          }
        }
      });
    } else if (action === 'accept') {
      setConfirmAction({
        title: 'Chấp nhận kết bạn',
        message: `Bạn có muốn chấp nhận lời mời kết bạn từ ${friendName}?`,
        isDanger: false,
        confirmText: 'Chấp nhận',
        action: async () => {
          try {
            await accept({ relationshipId: friend.relationshipId, targetUserId: friend._id });
            toast.success('Đã chấp nhận lời mời kết bạn');
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
            throw err;
          }
        }
      });
    } else if (action === 'reject') {
      setConfirmAction({
        title: 'Từ chối lời mời',
        message: `Bạn có chắc chắn muốn từ chối lời mời kết bạn từ ${friendName}?`,
        isDanger: true,
        confirmText: 'Từ chối',
        action: async () => {
          try {
            await rejectOrRemove({ relationshipId: friend.relationshipId, targetUserId: friend._id });
            toast.success('Đã từ chối lời mời kết bạn');
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
            throw err;
          }
        }
      });
    } else if (action === 'cancel') {
      setConfirmAction({
        title: 'Thu hồi lời mời',
        message: `Bạn có chắc chắn muốn thu hồi lời mời kết bạn đã gửi đến ${friendName}?`,
        isDanger: true,
        confirmText: 'Thu hồi',
        action: async () => {
          try {
            await rejectOrRemove({ relationshipId: friend.relationshipId, targetUserId: friend._id });
            toast.success('Đã thu hồi lời mời kết bạn');
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
            throw err;
          }
        }
      });
    }
  };

  return (
    <div 
      className="flex flex-col flex-1 w-full bg-transparent"
      onClick={() => { setActiveDropdown(null); setIsSortDropdownOpen(false); }}
    >
      <div className="flex flex-col flex-1 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <style>
        {`
          .friend-row {
            transition: background-color 0.2s ease;
          }
          .friend-row:hover {
            background-color: var(--bg-secondary);
          }
          .friend-row-more {
            opacity: 0;
            transition: opacity 0.2s ease;
          }
          .friend-row:hover .friend-row-more,
          .friend-row-more:focus {
            opacity: 1;
          }
          .custom-dropdown-btn:hover {
            background-color: var(--bg-secondary);
          }
          .custom-dropdown-btn.danger:hover {
            background-color: rgba(220, 38, 38, 0.1);
          }
        `}
      </style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {location.pathname === '/blocked' && (
          <button 
            className="icon-btn mobile-back-btn" 
            onClick={() => navigate('/')}
            title="Quay lại"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{title} ({totalFriends})</span>
      </div>

      {/* Main content area */}
      <div className="p-2 md:p-4" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* White Card */}
        <div className="p-3 md:p-4" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border)', overflowY: 'auto' }}>
            {/* Filters row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input 
                  type="text"
                  placeholder="Tìm kiếm" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 16px 10px 42px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'transparent', outline: 'none', fontSize: '14px', color: 'var(--text-primary)' }}
                />
              </div>
              {/* Sort */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsSortDropdownOpen(!isSortDropdownOpen); setActiveDropdown(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: isSortDropdownOpen ? '1px solid #3b82f6' : '1px solid var(--border)', backgroundColor: 'transparent', fontSize: '14px', fontWeight: 500, color: isSortDropdownOpen ? '#3b82f6' : 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}
                >
                  <ArrowUpDown size={16} /> {sortOrder === 'asc' ? 'Tên (A-Z)' : 'Tên (Z-A)'} <ChevronDown size={16} />
                </button>
                
                {isSortDropdownOpen && (
                  <div 
                    style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                      backgroundColor: 'var(--bg-card)', borderRadius: '8px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 50,
                      minWidth: '200px', padding: '8px 0',
                      border: '1px solid var(--border)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      className="custom-dropdown-btn"
                      style={{ width: '100%', textAlign: 'left', padding: '12px 16px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', outline: 'none' }}
                      onClick={() => { setSortOrder('asc'); setIsSortDropdownOpen(false); }}
                    >
                      <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                        {sortOrder === 'asc' && <Check size={16} color="#3b82f6" />}
                      </div>
                      Tên (A-Z)
                    </button>
                    <button 
                      className="custom-dropdown-btn"
                      style={{ width: '100%', textAlign: 'left', padding: '12px 16px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', outline: 'none' }}
                      onClick={() => { setSortOrder('desc'); setIsSortDropdownOpen(false); }}
                    >
                      <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                        {sortOrder === 'desc' && <Check size={16} color="#3b82f6" />}
                      </div>
                      Tên (Z-A)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* List */}
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}>
                <div className="loading-spinner" />
              </div>
            ) : totalFriends === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '60px', fontSize: '15px' }}>
                {searchQuery ? 'Không tìm thấy người nào phù hợp' : emptyMessage}
              </div>
            ) : (
              Object.keys(groupedFriends).sort((a, b) => sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)).map(letter => (
                <div key={letter} style={{ marginBottom: '32px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', fontSize: '16px' }}>
                    {letter}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {groupedFriends[letter].map((friend: any) => (
                      <div 
                        key={friend._id} 
                        className="friend-row"
                        style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        {/* Avatar */}
                        <div 
                          style={{ 
                            width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                            backgroundColor: 'var(--accent-primary)',
                            backgroundImage: friend.avatar?.url ? `url(${friend.avatar.url})` : 'none',
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 600, fontSize: '18px'
                          }}
                        >
                          {!friend.avatar?.url && (friend.name || friend.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Name */}
                        <div style={{ 
                          flex: 1, 
                          fontWeight: 500, 
                          fontSize: '15px', 
                          color: friend.isDisabled ? 'var(--error)' : 'var(--text-primary)',
                          fontStyle: friend.isDisabled ? 'italic' : 'normal'
                        }}>
                          {friend.name || friend.email}
                        </div>

                        {/* 3 Dots */}
                        <button 
                          className="friend-row-more"
                          style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(activeDropdown === friend._id ? null : friend._id);
                          }}
                        >
                          <MoreHorizontal size={20} style={{ color: '#6b7280' }} />
                        </button>

                        {/* Dropdown Menu */}
                        {activeDropdown === friend._id && (
                          <div 
                            style={{
                              position: 'absolute', right: '16px', top: '100%', marginTop: '-8px',
                              backgroundColor: 'var(--bg-card)', borderRadius: '8px',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 50,
                              minWidth: '200px', padding: '8px 0',
                              border: '1px solid var(--border)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              className="custom-dropdown-btn"
                              style={{ width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', transition: 'background-color 0.2s' }}
                              onClick={(e) => handleAction('info', friend, e)}
                            >
                              Nhắn tin
                            </button>
                            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }} />
                            
                            {currentTab === '/friends' && (
                              <>
                                <button 
                                  className="custom-dropdown-btn"
                                  style={{ width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', transition: 'background-color 0.2s' }}
                                  onClick={(e) => handleAction('block', friend, e)}
                                >
                                  Chặn người này
                                </button>
                                <button 
                                  className="custom-dropdown-btn danger"
                                  style={{ width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)', transition: 'background-color 0.2s' }}
                                  onClick={(e) => handleAction('unfriend', friend, e)}
                                >
                                  Xóa bạn
                                </button>
                              </>
                            )}

                            {currentTab === '/requests' && (
                              <>
                                <button 
                                  className="custom-dropdown-btn"
                                  style={{ width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3b82f6', transition: 'background-color 0.2s' }}
                                  onClick={(e) => handleAction('accept', friend, e)}
                                >
                                  Chấp nhận
                                </button>
                                <button 
                                  className="custom-dropdown-btn danger"
                                  style={{ width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)', transition: 'background-color 0.2s' }}
                                  onClick={(e) => handleAction('reject', friend, e)}
                                >
                                  Từ chối
                                </button>
                              </>
                            )}

                            {currentTab === '/sent-requests' && (
                              <button 
                                className="custom-dropdown-btn danger"
                                style={{ width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)', transition: 'background-color 0.2s' }}
                                onClick={(e) => handleAction('cancel', friend, e)}
                              >
                                Thu hồi lời mời
                              </button>
                            )}

                            {currentTab === '/blocked' && (
                              <button 
                                className="custom-dropdown-btn"
                                style={{ width: '100%', textAlign: 'left', padding: '12px 20px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3b82f6', transition: 'background-color 0.2s' }}
                                onClick={(e) => handleAction('unblock', friend, e)}
                              >
                                Bỏ chặn
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
        </div>
      </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        isDanger={confirmAction?.isDanger}
        confirmText={confirmAction?.confirmText}
        onConfirm={confirmAction?.action || (() => {})}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
