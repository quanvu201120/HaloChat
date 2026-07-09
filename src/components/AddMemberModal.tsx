import { useState, useEffect, useMemo, useRef } from 'react';
import { X, UserPlus, Check, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRelationships } from '../hooks/useRelationships';
import { conversationsApi } from '../services/conversations';
import { usersApi } from '../services/api';
import { useAuthStore as useAuth } from '../store/authStore';
import { useToast } from '../context/ToastContext';
import { type Conversation } from '../services/conversations';
import { UI_LIMITS } from '../constants/limits';
import { UI_MESSAGES } from '../constants/messages';

interface UserResult {
  _id: string;
  name?: string;
  email: string;
  phone?: string;
  image?: string;
}

interface Props {
  isOpen: boolean;
  conversationId: string;
  currentMembers: string[];
  onClose: () => void;
  onSuccess: (updatedConv: Conversation) => void;
}

export default function AddMemberModal({ isOpen, conversationId, currentMembers, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const [serverResult, setServerResult] = useState<UserResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { friends, refetch: refetchFriends, isLoading: isFriendsLoading } = useRelationships();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValidSearch = (query: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{9,15}$/;
    return emailRegex.test(query) || phoneRegex.test(query);
  };

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelected([]);
      setServerResult(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setServerResult(null);
      return;
    }

    if (!isValidSearch(trimmed)) {
      setServerResult(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const localFound = friends.find(u => u.email === trimmed || u.phone === trimmed);
      if (localFound) {
        setServerResult(null);
        return;
      }

      setIsSearching(true);
      try {
        const res = await usersApi.search(trimmed);
        const u = res.data?.data || res.data;
        if (u && u._id !== user?._id && !currentMembers.includes(u._id)) {
          setServerResult(u);
        } else {
          setServerResult(null);
        }
      } catch {
        setServerResult(null);
      } finally {
        setIsSearching(false);
      }
    }, UI_LIMITS.SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, friends, user?._id, currentMembers]);

  const allUsers = useMemo(() => {
     return friends.filter(u => u._id !== user?._id && !currentMembers.includes(u._id));
  }, [friends, user?._id, currentMembers]);

  const localResults = useMemo(() => {
    if (!search.trim()) return allUsers;
    const q = search.toLowerCase();
    return allUsers.filter(u => 
      (u.name || '').toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  }, [search, allUsers]);

  const results = useMemo(() => {
    const combined = [...localResults];
    if (serverResult && !combined.find((u) => u._id === serverResult._id)) {
      combined.push(serverResult as any);
    }
    return combined;
  }, [localResults, serverResult]);

  const toggleSelect = (u: UserResult) => {
    setSelected((prev) => {
      if (prev.find((s) => s._id === u._id)) return prev.filter((s) => s._id !== u._id);
      return [...prev, u];
    });
  };

  const handleAddMembers = async () => {
    if (selected.length === 0) {
      toast.error(UI_MESSAGES.conversations.selectAtLeastOneUser);
      return;
    }

    setIsAdding(true);
    try {
      const userIds = selected.map((u) => u._id);
      const res = await conversationsApi.addMembers(conversationId, userIds);
      const updatedConv = res.data?.data ?? (res.data as any);
      toast.success(UI_MESSAGES.conversations.addMembersSuccess);
      onSuccess(updatedConv);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || UI_MESSAGES.conversations.addMembersFailed);
    } finally {
      setIsAdding(false);
    }
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
            style={{ maxWidth: 480 }} 
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="modal-header">
              <span className="modal-title">
                {UI_MESSAGES.conversations.addMembersTitle}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="icon-btn" title="Làm mới danh sách" onClick={() => refetchFriends()}>
                  <RefreshCcw size={16} className={isFriendsLoading ? 'rotating' : ''} />
                </button>
                <button className="icon-btn" onClick={onClose}><X size={18} /></button>
              </div>
            </div>

            <div className="modal-body">
              {/* Search */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <input
                  className="form-input"
                  placeholder={UI_MESSAGES.conversations.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Selected chips */}
              {selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {selected.map((u) => (
                    <span
                      key={u._id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)',
                        border: '1px solid rgba(99,102,241,0.25)', borderRadius: '20px',
                        padding: '3px 10px', fontSize: '12px', fontWeight: 600,
                      }}
                    >
                      {u.name || u.email}
                      <button
                        onClick={() => toggleSelect(u)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Status */}
              {isSearching && (
                <div style={{ textAlign: 'center', padding: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Đang tìm kiếm...
                </div>
              )}

              {!isSearching && results.length === 0 && search.trim() !== '' && (
                <div style={{ textAlign: 'center', padding: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Không tìm thấy người dùng phù hợp.
                </div>
              )}

              {/* Results */}
              {!isSearching && results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                  {results.map((u) => {
                    const isSelected = !!selected.find((s) => s._id === u._id);
                    return (
                      <button
                        key={u._id}
                        onClick={() => toggleSelect(u)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                          border: 'none', background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                          cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)',
                        }}
                      >
                        <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '12px', flexShrink: 0 }}>
                          {(u.name || u.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {u.name || u.email || 'Chưa đặt tên'}
                          </div>
                        </div>
                        {isSelected && <Check size={16} color="var(--accent-primary)" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {results.length === 0 && !isSearching && search.trim() === '' && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Không có người dùng nào để thêm
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
              <button
                className="btn btn-primary"
                onClick={handleAddMembers}
                disabled={isAdding || selected.length === 0}
              >
                {isAdding
                  ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang thêm...</>
                  : <><UserPlus size={14} /> Thêm thành viên</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

