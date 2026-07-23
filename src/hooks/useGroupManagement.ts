import {
  conversationsApi, normalizeConversation, type Conversation,
} from '../services/conversations';
import { UI_MESSAGES } from '../constants/messages';

type ConfirmAction = {
  title: string;
  message: string;
  action: () => void;
  isDanger?: boolean;
  confirmText?: string;
  countdown?: number;
} | null;

type UseGroupManagementParams = {
  activeConversationId: string;
  conv: Conversation | null;
  currentUserId: string;
  groupNameInput: string;
  setConv: React.Dispatch<React.SetStateAction<Conversation | null>>;
  setEditingGroupName: React.Dispatch<React.SetStateAction<boolean>>;
  setIsUploadingAvatar: React.Dispatch<React.SetStateAction<boolean>>;
  setConfirmAction: React.Dispatch<React.SetStateAction<ConfirmAction>>;
  groupAvatarInputRef: React.RefObject<HTMLInputElement | null>;
  isLeavingOrDisbandingRef: React.RefObject<boolean>;
  toast: { success: (msg: string) => void; error: (msg: string) => void };
  navigate: (to: string, options?: { replace?: boolean }) => void;
  refetchConversations: (options?: { silent?: boolean }) => Promise<unknown> | void;
};

export function useGroupManagement({
  activeConversationId,
  conv,
  currentUserId,
  groupNameInput,
  setConv,
  setEditingGroupName,
  setIsUploadingAvatar,
  setConfirmAction,
  groupAvatarInputRef,
  isLeavingOrDisbandingRef,
  toast,
  navigate,
  refetchConversations,
}: UseGroupManagementParams) {
  // ===== Group Management Handlers =====
  const isGroupAdmin = !!(conv?.isGroup && conv.adminGroupId === currentUserId);

  const handleUploadGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;
    setIsUploadingAvatar(true);
    try {
      const res = await conversationsApi.uploadAvatar(activeConversationId, file);
      const updated = normalizeConversation(res.data?.data ?? res.data);
      setConv(updated);
      toast.success(UI_MESSAGES.chat.updateGroupAvatarSuccess);
    } catch {
      toast.error(UI_MESSAGES.chat.updateGroupAvatarFailed);
    } finally {
      setIsUploadingAvatar(false);
      if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = '';
    }
  };

  const handleDeleteGroupAvatar = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xóa ảnh đại diện nhóm',
      message: UI_MESSAGES.chat.deleteGroupAvatarConfirm,
      isDanger: true,
      action: () => {
        setConfirmAction(null);
        (async () => {
          setIsUploadingAvatar(true);
          try {
            await conversationsApi.deleteAvatar(activeConversationId);
            setConv((prev) => prev ? { ...prev, avatar: undefined } : prev);
            toast.success(UI_MESSAGES.chat.deleteGroupAvatarSuccess);
          } catch {
            toast.error(UI_MESSAGES.chat.deleteGroupAvatarFailed);
          } finally {
            setIsUploadingAvatar(false);
          }
        })();
      }
    });
  };

  const handleUpdateGroupName = async () => {
    if (!activeConversationId || !groupNameInput.trim()) return;
    try {
      await conversationsApi.updateName(activeConversationId, groupNameInput.trim());
      setConv((prev) => prev ? { ...prev, name: groupNameInput.trim() } : prev);
      setEditingGroupName(false);
      toast.success(UI_MESSAGES.chat.updateGroupNameSuccess);
    } catch {
      toast.error(UI_MESSAGES.chat.updateGroupNameFailed);
    }
  };

  const handleLeaveGroup = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Rời nhóm',
      message: UI_MESSAGES.chat.leaveGroupConfirm,
      isDanger: true,
      confirmText: 'Rời nhóm',
      action: async () => {
        isLeavingOrDisbandingRef.current = true;
        try {
          await conversationsApi.leaveGroup(activeConversationId);
          navigate('/', { replace: true });
          toast.success(UI_MESSAGES.chat.leaveGroupSuccess);
        } catch {
          toast.error(UI_MESSAGES.chat.leaveGroupFailed);
        }
      }
    });
  };

  const handleDisbandGroup = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Giải tán nhóm',
      message: UI_MESSAGES.chat.dissolveGroupConfirm,
      isDanger: true,
      confirmText: 'Giải tán',
      action: async () => {
        isLeavingOrDisbandingRef.current = true;
        try {
          await conversationsApi.disbandGroup(activeConversationId);
          navigate('/', { replace: true });
          toast.success(UI_MESSAGES.chat.dissolveGroupSuccess);
        } catch {
          toast.error(UI_MESSAGES.chat.dissolveGroupFailed);
        }
      }
    });
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xóa thành viên',
      message: UI_MESSAGES.chat.removeMemberConfirm(memberName),
      isDanger: true,
      confirmText: 'Xóa khỏi nhóm',
      action: async () => {
        try {
          await conversationsApi.removeMember(activeConversationId, memberId);
          setConv((prev) => prev ? { ...prev, users: prev.users.filter(u => u._id !== memberId) } : prev);
          toast.success(UI_MESSAGES.chat.removeMemberSuccess(memberName));
        } catch {
          toast.error(UI_MESSAGES.chat.removeMemberFailed);
        }
      }
    });
  };

  const handleChangeAdminStep2 = (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xác nhận chuyển quyền',
      message: UI_MESSAGES.chat.transferAdminConfirm(memberName),
      isDanger: true,
      confirmText: 'Chuyển quyền',
      countdown: 5,
      action: async () => {
        try {
          await conversationsApi.changeAdmin(activeConversationId, memberId);
          setConv((prev) => prev ? { ...prev, adminGroupId: memberId } : prev);
          toast.success(UI_MESSAGES.chat.transferAdminSuccess(memberName));
        } catch {
          toast.error(UI_MESSAGES.chat.transferAdminFailed);
        }
      }
    });
  };

  const handleChangeAdmin = (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Chuyển quyền quản trị',
      message: UI_MESSAGES.chat.transferAdminConfirmSecondary(memberName),
      isDanger: true,
      confirmText: 'Tiếp tục',
      action: () => {
        handleChangeAdminStep2(memberId, memberName);
        return false;
      }
    });
  };

  const handleHideHistory = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xóa lịch sử chat',
      message: UI_MESSAGES.chat.deleteChatHistoryConfirm,
      isDanger: true,
      confirmText: 'Xóa lịch sử',
      action: async () => {
        try {
          await conversationsApi.hideHistory(activeConversationId);
          void refetchConversations({ silent: true });
          navigate('/', { replace: true });
          toast.success(UI_MESSAGES.chat.deleteChatHistorySuccess);
        } catch {
          toast.error(UI_MESSAGES.chat.deleteChatHistoryFailed);
        }
      }
    });
  };

  return {
    isGroupAdmin,
    handleUploadGroupAvatar,
    handleDeleteGroupAvatar,
    handleUpdateGroupName,
    handleLeaveGroup,
    handleDisbandGroup,
    handleRemoveMember,
    handleChangeAdmin,
    handleHideHistory,
  };
}
