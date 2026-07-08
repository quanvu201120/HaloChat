import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, UserPlus, Users, Check, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRelationships } from '../hooks/useRelationships';
import { conversationsApi } from '../services/conversations';
import { parseError, usersApi } from '../services/api';
import { useAuthStore as useAuth } from '../store/authStore';
import { useChatStore as useChat } from '../store/chatStore';
import { useToast } from '../context/ToastContext';

interface UserResult {
  _id: string;
  name?: string;
  email: string;
  phone?: string;
  image?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateConversationModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { refetchConversations } = useChat();
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [serverResult, setServerResult] = useState<UserResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { friends } = useRelationships();
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
      setGroupName('');
      setServerResult(null);
      setIsSearching(false);
      setTab('direct');
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
        if (u && u._id !== user?._id) {
          setServerResult(u);
        }
      } catch {
        setServerResult(null);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, friends, user?._id]);

  const localResults = useMemo(() => {
    if (!search.trim()) return friends;
    const q = search.toLowerCase();
    return friends.filter((u) => 
      (u.name || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  }, [search, friends]);

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
      if (tab === 'direct') return [u];
      return [...prev, u];
    });
  };

  const handleCreate = async () => {
    if (selected.length === 0) {
      toast.error('Chọn ít nhất 1 người dùng');
      return;
    }
    if (tab === 'group' && !groupName.trim()) {
      toast.error('Nhập tên nhóm');
      return;
    }
    if (tab === 'group' && selected.length < 2) {
      toast.error('Nhóm cần ít nhất 2 thành viên (ngoài bạn)');
      return;
    }

    setIsCreating(true);
    try {
      const userIds = selected.map((u) => u._id).filter(Boolean);
      if (userIds.length !== selected.length) {
        toast.error('Danh sách người dùng không hợp lệ');
        return;
      }
      const payload =
        tab === 'group'
          ? { users: userIds, name: groupName.trim(), isGroup: true }
          : { users: userIds };

      const res = await conversationsApi.create(payload);
      const conv = res.data?.data ?? res.data;
      await refetchConversations();
      onClose();
      if (conv?._id) navigate(`/chat/${conv._id}`);
    } catch (err: unknown) {
      toast.error(parseError(err) || 'Không tạo được cuộc trò chuyện');
    } finally {
      setIsCreating(false);
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
            <div className="modal-header">
          <span className="modal-title">{tab === 'direct' ? 'Chat với bạn bè' : 'Tạo nhóm chat'}</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['direct', 'group'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected([]); }}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13.5px',
                fontWeight: 600,
                color: tab === t ? 'var(--accent-primary)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {t === 'direct' ? <><UserPlus size={15} /></> : <><Users size={15} /> </>}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {tab === 'group' && (
            <div className="form-group">
              <label className="form-label">Tên nhóm *</label>
              <input
                className="form-input"
                placeholder="Ví dụ: Nhóm chat vui vẻ"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <input
              className="form-input"
              placeholder="Tìm theo tên, email hoặc số điện thoại"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {selected.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selected.map((u) => (
                <span
                  key={u._id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(99,102,241,0.12)',
                    color: 'var(--accent-primary)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
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

          {!isSearching && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {results.map((u) => {
                const isSelected = !!selected.find((s) => s._id === u._id);
                return (
                  <button
                    key={u._id}
                    onClick={() => toggleSelect(u)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'var(--transition)',
                    }}
                  >
                    <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '12px', flexShrink: 0 }}>
                      {(u.name || u.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {u.name || u.email || 'Chua dat ten'}
                      </div>
                    </div>
                    {isSelected && <Check size={16} color="var(--accent-primary)" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={isCreating || selected.length === 0}>
            {isCreating
              ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang tạo...</>
              : tab === 'group' ? <><Users size={14} /> Tạo nhóm</> : <><UserPlus size={14} /> Bắt đầu chat</>}
          </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
