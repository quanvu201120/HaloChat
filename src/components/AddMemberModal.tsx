import { useState, useEffect, useMemo } from 'react';
import { X, UserPlus, Check, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAvailableUsers } from '../hooks/useAvailableUsers';
import { conversationsApi } from '../services/conversations';
import { useAuthStore as useAuth } from '../store/authStore';
import { useToast } from '../context/ToastContext';
import { type Conversation } from '../services/conversations';

interface UserResult {
  _id: string;
  name?: string;
  email: string;
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

  const [search] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const { users: allAvailableUsers, isLoading: isSearching, refetch } = useAvailableUsers();



  const allUsers = useMemo(() => {
     return allAvailableUsers.filter(u => u._id !== user?._id && !currentMembers.includes(u._id));
  }, [allAvailableUsers, user?._id, currentMembers]);

  // Tìm kiếm local
  useEffect(() => {
    if (!search.trim()) {
      setResults(allUsers);
      return;
    }
    const q = search.toLowerCase();
    setResults(allUsers.filter(u => 
      (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    ));
  }, [search, allUsers]);

  const toggleSelect = (u: UserResult) => {
    setSelected((prev) => {
      if (prev.find((s) => s._id === u._id)) return prev.filter((s) => s._id !== u._id);
      return [...prev, u];
    });
  };

  const handleAddMembers = async () => {
    if (selected.length === 0) {
      toast.error('Chọn ít nhất 1 người dùng để thêm');
      return;
    }

    setIsAdding(true);
    try {
       const userIds = selected.map((u) => u._id);
      const res = await conversationsApi.addMembers(conversationId, userIds);
      const updatedConv = res.data?.data ?? (res.data as any);
      toast.success('Đã thêm thành viên vào nhóm!');
      onSuccess(updatedConv);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thêm được thành viên');
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
            Thêm thành viên
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="icon-btn" title="Làm mới danh sách" onClick={() => refetch()}>
              <RefreshCcw size={16} className={isSearching ? 'rotating' : ''} />
            </button>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="modal-body">
          {/* Search */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Chọn người dùng
              {isSearching && <div className="loading-spinner" style={{ width: 14, height: 14 }} />}
            </label>
          </div>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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

          {/* Results */}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
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
          {results.length === 0 && !isSearching && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Không tìm thấy người dùng nào
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
