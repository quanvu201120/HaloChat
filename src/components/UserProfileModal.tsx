import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, User, Eye, EyeOff, Ban, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useChatStore as useChat } from '../store/chatStore';
import { useRelationships } from '../hooks/useRelationships';
import { conversationsApi } from '../services/conversations';
import { parseError } from '../services/api';
import { formatDateOnlyVN } from '../utils/date';
import type { RelationshipUser } from '../hooks/useRelationships';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: RelationshipUser | null;
}

export default function UserProfileModal({ isOpen, onClose, user }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { conversations, refetchConversations } = useChat();
  const { unfriend, block } = useRelationships();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  // Reset showPhone state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setShowPhone(false);
    }
  }, [isOpen, user]);

  if (!user) return null;

  const handleMessage = async () => {
    setIsLoading(true);
    try {
      const existingConv = conversations.find(c => 
        !c.isGroup && c.users?.some((p: any) => p._id === user._id)
      );

      if (existingConv) {
        onClose();
        navigate(`/chat/${existingConv._id}`);
        return;
      }

      const res = await conversationsApi.create({ users: [user._id] });
      const conv = res.data?.data ?? res.data;
      await refetchConversations();
      onClose();
      navigate(`/chat/${conv._id}`);
    } catch (err) {
      toast.error(parseError(err) || 'Không thể tạo cuộc trò chuyện');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!user.relationshipId) return;
    if (!window.confirm(`Bạn có chắc chắn muốn hủy kết bạn với ${user.name}?`)) return;
    
    setIsLoading(true);
    try {
      await unfriend({ relationshipId: user.relationshipId, targetUserId: user._id });
      toast.success('Đã hủy kết bạn');
      onClose();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn chặn ${user.name}?`)) return;
    
    setIsLoading(true);
    try {
      await block({ targetUserId: user._id });
      toast.success('Đã chặn người dùng');
      onClose();
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const dobFormatted = user.dateOfBirth ? formatDateOnlyVN(user.dateOfBirth) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" 
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="w-full max-w-[360px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl mx-4 relative" 
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Cover Image as Avatar */}
            <div className="relative w-full h-[160px] bg-gray-100 flex items-center justify-center overflow-hidden">
              {user.avatar?.url ? (
                <img src={user.avatar.url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={64} className="text-gray-400" strokeWidth={1.5} />
              )}
            </div>

            {/* Basic Info and Message Button */}
            <div className="pt-5 px-4 pb-6 flex flex-col items-center">
              <h2 className="text-[20px] font-bold text-gray-900 mb-4 text-center">
                {user.name || 'Chưa đặt tên'}
              </h2>
              
              <button 
                className="w-full max-w-[280px] flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-[15px] bg-[#E5EFFF] text-[#005AE0] hover:bg-[#D6E6FF] transition-all disabled:opacity-70"
                onClick={handleMessage}
                disabled={isLoading}
              >
                {isLoading ? <div className="loading-spinner w-4 h-4 border-2 border-[#005ae0] border-t-transparent mr-2" /> : <MessageSquare size={18} strokeWidth={2} />}
                Nhắn tin
              </button>
            </div>

            {/* Thick Divider */}
            <div className="h-2 w-full bg-gray-50"></div>

            {/* Personal Info */}
            <div className="p-4">
              <h3 className="text-[15px] font-bold text-gray-900 mb-4">Thông tin cá nhân</h3>
              
              <div className="flex flex-col gap-4">
                {user.gender && (
                  <div className="flex text-[14px]">
                    <div className="w-[100px] text-gray-500">Giới tính</div>
                    <div className="flex-1 text-gray-900 font-medium">
                      {user.gender === 'male' ? 'Nam' : user.gender === 'female' ? 'Nữ' : 'Khác'}
                    </div>
                  </div>
                )}
                
                {dobFormatted && (
                  <div className="flex text-[14px]">
                    <div className="w-[100px] text-gray-500">Ngày sinh</div>
                    <div className="flex-1 text-gray-900 font-medium">{dobFormatted}</div>
                  </div>
                )}

                {user.relationshipId && (
                  <div className="flex items-center text-[14px]">
                    <div className="w-[100px] text-gray-500">Điện thoại</div>
                    <div className="flex-1 text-gray-900 font-medium flex items-center gap-2">
                      {!user.phone ? (
                        <span className="text-gray-400 font-normal italic">Chưa cập nhật</span>
                      ) : (
                        <>
                          {showPhone ? user.phone : '**********'}
                          <button 
                            onClick={() => setShowPhone(!showPhone)}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-md transition-colors"
                            title={showPhone ? "Ẩn số điện thoại" : "Hiện số điện thoại"}
                          >
                            {showPhone ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons in a sleek Settings-like card */}
            <div className="px-4 pb-6 pt-2">
              <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                <button 
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-100 disabled:opacity-50"
                  onClick={handleBlock}
                  disabled={isLoading}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200/60 flex items-center justify-center shrink-0">
                    <Ban size={16} className="text-gray-700" strokeWidth={2} />
                  </div>
                  <span className="text-[15px] font-medium text-gray-800">Chặn người này</span>
                </button>
                
                <button 
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors disabled:opacity-50"
                  onClick={handleUnfriend}
                  disabled={isLoading}
                >
                  <div className="w-8 h-8 rounded-full bg-red-100/60 flex items-center justify-center shrink-0">
                    <Trash2 size={16} className="text-red-500" strokeWidth={2} />
                  </div>
                  <span className="text-[15px] font-medium text-red-500">Hủy kết bạn</span>
                </button>
              </div>
            </div>
            
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
