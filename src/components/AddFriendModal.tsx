import { useState, useEffect, useRef } from 'react';
import { X, UserPlus, UserMinus, UserCheck, MessageSquare, Unlock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRelationships } from '../hooks/useRelationships';
import { usersApi, parseError } from '../services/api';
import { useAuthStore as useAuth } from '../store/authStore';
import { useToast } from '../context/ToastContext';
import { useChatStore as useChat } from '../store/chatStore';
import { conversationsApi } from '../services/conversations';
import ConfirmModal from './ConfirmModal';
import { UI_LIMITS } from '../constants/limits';
import { UI_MESSAGES } from '../constants/messages';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  _id: string;
  name?: string;
  email: string;
  phone?: string;
  avatar?: string | { url: string };
}

export default function AddFriendModal({ isOpen, onClose }: Props) {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { conversations, refetchConversations } = useChat();
  
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userToUnblock, setUserToUnblock] = useState<SearchResult | null>(null);
  
  const {
    friends,
    sentRequests,
    receivedRequests,
    blockedUsers,
    sendRequest,
    isSendingRequest,
    rejectOrRemove,
    isRejectingOrRemoving,
    accept,
    isAccepting,
    unblock,
    isUnblocking
  } = useRelationships();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setResult(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  const isContactQuery = (query: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{9,15}$/;
    return emailRegex.test(query) || phoneRegex.test(query);
  };

  const performSearch = async (query: string) => {
    const localFound = [friends, sentRequests, receivedRequests, blockedUsers]
      .flat()
      .find((u: any) => (u.name || '').toLowerCase().includes(query.toLowerCase()));

    if (!isContactQuery(query)) {
      if (localFound) {
        setResult({
          ...localFound,
          avatar: typeof localFound.avatar === 'string'
            ? localFound.avatar
            : localFound.avatar?.url
              ? { url: localFound.avatar.url }
              : undefined,
        });
      } else {
        setResult(null);
      }
      return;
    }

    setIsSearching(true);
    setResult(null);
    try {
      const res = await usersApi.search(query);
      setResult(res.data?.data || res.data);
    } catch (err: any) {
      //empty catch block
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setResult(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(trimmed);
    }, UI_LIMITS.FRIEND_SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = search.trim();
    if (!trimmed) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    performSearch(trimmed);
  };

  const getRelationshipState = (userId: string) => {
    if (userId === currentUser?._id) return 'self';
    
    const friend = friends.find(f => f._id === userId);
    if (friend) return { type: 'friend', relationshipId: friend.relationshipId };
    
    const sent = sentRequests.find(r => r._id === userId);
    if (sent) return { type: 'sent', relationshipId: sent.relationshipId };
    
    const received = receivedRequests.find(r => r._id === userId);
    if (received) return { type: 'received', relationshipId: received.relationshipId };
    
    const blocked = blockedUsers.find(r => r._id === userId);
    if (blocked) return { type: 'blocked', relationshipId: blocked.relationshipId };
    
    return 'none';
  };

  const handleMessage = async (userId: string) => {
    setIsNavigating(true);
    try {
      const existingConv = conversations.find(c => 
        !c.isGroup && c.users && c.users.some(u => u._id === userId)
      );
      if (existingConv) {
        onClose();
        navigate(`/chat/${existingConv._id}`);
        return;
      }
      
      const res = await conversationsApi.create({ users: [userId] });
      const conv = res.data?.data ?? res.data;
      await refetchConversations();
      onClose();
      navigate(`/chat/${conv._id}`);
    } catch (err) {
      toast.error(parseError(err) || UI_MESSAGES.friends.openChatFailed);
    } finally {
      setIsNavigating(false);
    }
  };

  const renderAction = () => {
    if (!result) return null;
    
    const relState = getRelationshipState(result._id);
    
    if (relState === 'self') {
      return <span className="text-muted text-sm">Bạn</span>;
    }
    
    if (typeof relState !== 'string') {
      if (relState.type === 'friend') {
        return (
          <button 
            className="btn btn-secondary add-friend-action-btn" 
            onClick={() => handleMessage(result._id)}
            disabled={isNavigating}
          >
            <MessageSquare size={16} /> Nhắn tin
          </button>
        );
      }
      
      if (relState.type === 'sent') {
        return (
          <button 
            className="btn btn-danger add-friend-action-btn" 
            onClick={() => rejectOrRemove({ relationshipId: relState.relationshipId, targetUserId: result._id })}
            disabled={isRejectingOrRemoving}
          >
            <UserMinus size={16} /> Thu hồi
          </button>
        );
      }
      
      if (relState.type === 'received') {
        return (
          <button 
            className="btn btn-primary add-friend-action-btn" 
            onClick={() => accept({ relationshipId: relState.relationshipId, targetUserId: result._id })}
            disabled={isAccepting}
          >
            <UserCheck size={16} /> Chấp nhận
          </button>
        );
      }

      if (relState.type === 'blocked') {
        return (
          <button 
            className="btn btn-secondary add-friend-action-btn" 
            onClick={() => setUserToUnblock(result)}
            disabled={isUnblocking}
          >
            <Unlock size={16} /> Bỏ chặn
          </button>
        );
      }
    }
    
    return (
          <button 
            className="btn btn-primary add-friend-action-btn" 
            onClick={async () => {
              try {
                await sendRequest({ targetUserId: result._id });
            toast.success(UI_MESSAGES.friends.sendRequestSuccess);
              } catch (err) {
            toast.error(parseError(err) || UI_MESSAGES.friends.sendRequestFailed);
              }
            }}
            disabled={isSendingRequest}
      >
        <UserPlus size={16} /> Thêm bạn
      </button>
    );
  };

  const getAvatarUrl = (user: SearchResult) => {
    if (!user.avatar) return null;
    if (typeof user.avatar === 'string') return user.avatar;
    return user.avatar.url;
  };

  return (
    <>
      <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="modal-overlay" 
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="modal" 
            style={{ maxWidth: 400 }} 
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="modal-header">
              <span className="modal-title">{UI_MESSAGES.friends.title}</span>
              <button className="icon-btn" onClick={onClose}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSearch} className="form-group mb-4">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="form-input"
                    placeholder={UI_MESSAGES.friends.searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </div>
              </form>

              {isSearching ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  {UI_MESSAGES.friends.searchLoading}
                </div>
              ) : result ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: '50%', 
                      background: 'var(--accent-primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '16px',
                      overflow: 'hidden'
                    }}>
                      {getAvatarUrl(result) ? (
                        <img src={getAvatarUrl(result)!} alt={result.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (result.name || 'U').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.name || 'Người dùng'}</div>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {renderAction()}
                  </div>
                </div>
              ) : search && !isSearching && (
                 <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                   {UI_MESSAGES.friends.notFoundBySearch}
                 </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <ConfirmModal
      isOpen={!!userToUnblock}
      onCancel={() => setUserToUnblock(null)}
      onConfirm={async () => {
        if (userToUnblock) {
          try {
            await unblock({ targetUserId: userToUnblock._id });
            toast.success(UI_MESSAGES.friends.unblockSuccess);
            setUserToUnblock(null);
          } catch (err) {
            toast.error(parseError(err) || UI_MESSAGES.friends.unblockFailed);
          }
        }
      }}
      title={UI_MESSAGES.friends.unblockTitle}
      message={`Bạn có chắc chắn muốn bỏ chặn ${userToUnblock?.name || 'người dùng này'} không? Họ sẽ có thể tìm thấy và nhắn tin cho bạn.`}
      confirmText={UI_MESSAGES.friends.unblockConfirmLabel}
      cancelText={UI_MESSAGES.friends.cancel}
      isDanger={true}
    />
    </>
  );
}
