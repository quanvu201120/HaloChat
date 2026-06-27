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

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setResult(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  const isValidSearch = (query: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{9,15}$/;
    return emailRegex.test(query) || phoneRegex.test(query);
  };

  const performSearch = async (query: string) => {
    const checkLocal = (users: any[]) => users.find(u => u.email === query || u.phone === query);
    
    let localFound = checkLocal(friends) || checkLocal(sentRequests) || checkLocal(receivedRequests) || checkLocal(blockedUsers);
    if (localFound) {
      setResult(localFound);
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

    if (!isValidSearch(trimmed)) {
      setResult(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(trimmed);
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = search.trim();
    if (!trimmed) return;
    
    if (!isValidSearch(trimmed)) {
      toast.error('Vui lòng nhập email hoặc số điện thoại hợp lệ');
      return;
    }

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
      toast.error(parseError(err) || 'Lỗi khi mở đoạn chat');
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
            className="btn btn-secondary" 
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
            className="btn btn-danger" 
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
            className="btn btn-primary" 
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
            className="btn btn-secondary" 
            onClick={() => unblock({ targetUserId: result._id })}
            disabled={isUnblocking}
          >
            <Unlock size={16} /> Bỏ chặn
          </button>
        );
      }
    }
    
    return (
      <button 
        className="btn btn-primary" 
        onClick={async () => {
          try {
            await sendRequest({ targetUserId: result._id });
            toast.success('Đã gửi yêu cầu kết bạn');
          } catch (err) {
            toast.error(parseError(err) || 'Không thể gửi yêu cầu');
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
              <span className="modal-title">Thêm bạn bè</span>
              <button className="icon-btn" onClick={onClose}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSearch} className="form-group mb-4">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="form-input"
                    placeholder="Nhập email hoặc số điện thoại..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </div>
              </form>

              {isSearching ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  Đang tìm kiếm...
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                        (result.name || result.email || 'U').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{result.name || 'Người dùng'}</div>
                    </div>
                  </div>
                  <div>
                    {renderAction()}
                  </div>
                </div>
              ) : search && !isSearching && (
                 <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                   {!isValidSearch(search.trim()) ? 'Email hoặc số điện thoại chưa hợp lệ' : 'Không tìm thấy người dùng phù hợp'}
                 </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
