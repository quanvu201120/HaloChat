import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type UserAdminData } from '../../services/admin';
import { ShieldBan, ShieldCheck, Edit, X, ChevronLeft, ChevronRight, Trash2, Key } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../constants/roles';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function UsersTab() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('newest');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserAdminData | null>(null);
  
  // Real fetch
  const { data, isLoading } = useQuery({
    queryKey: ['admin_users', page, debouncedSearch, statusFilter, roleFilter, sortFilter],
    queryFn: () => adminApi.getUsers({ 
      page, 
      limit: 20, 
      search: debouncedSearch, 
      status: statusFilter !== 'all' ? statusFilter : undefined,
      role: roleFilter !== 'all' ? roleFilter.toUpperCase() : undefined,
      sort: sortFilter !== 'newest' ? sortFilter : undefined
    }),
    staleTime: 0,
    gcTime: 0,
  });

  const disableMutation = useMutation({
    mutationFn: adminApi.disableUser,
    onSuccess: () => {
      toast.success('Đã khóa tài khoản');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    },
    onError: () => toast.error('Lỗi khi khóa tài khoản')
  });

  const enableMutation = useMutation({
    mutationFn: adminApi.enableUser,
    onSuccess: () => {
      toast.success('Đã mở khóa tài khoản');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    },
    onError: () => toast.error('Lỗi khi mở khóa tài khoản')
  });

  const handleToggleStatus = (user: UserAdminData) => {
    if (user.isDisabled || !user.isActive) {
      enableMutation.mutate(user._id);
    } else {
      if (confirm(`Bạn có chắc muốn khóa người dùng ${user.email}?`)) {
        disableMutation.mutate(user._id);
      }
    }
  };

  const resetAvatarMutation = useMutation({
    mutationFn: adminApi.resetUserAvatar,
    onSuccess: () => {
      toast.success('Đã xóa ảnh đại diện');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      // Update selected user local state
      setSelectedUser(prev => prev ? { ...prev, avatar: undefined } : null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi xóa ảnh đại diện')
  });

  const clearBioMutation = useMutation({
    mutationFn: (id: string) => adminApi.clearUserBio(id),
    onSuccess: () => {
      toast.success('Đã xóa tiểu sử');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setSelectedUser(prev => prev ? { ...prev, bio: '' } : null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi xóa tiểu sử')
  });

  const resetNameMutation = useMutation({
    mutationFn: (id: string) => adminApi.resetUserName(id),
    onSuccess: (data: any) => {
      toast.success('Đã đặt lại tên người dùng');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setSelectedUser(prev => prev ? { ...prev, name: data.name } : null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi đặt lại tên')
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role, password }: any) => adminApi.changeUserRole(id, { role, password }),
    onSuccess: (data: any) => {
      toast.success('Đã thay đổi quyền thành công');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setSelectedUser(prev => prev ? { ...prev, role: data.role } : null);
      setShowRoleModal(false);
      setAdminPassword('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi đổi quyền')
  });

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>(UserRole.USER);
  const [adminPassword, setAdminPassword] = useState('');

  const users = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* List View */}
      <div className={`flex flex-col h-full ${selectedUser ? 'hidden' : ''}`}>
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 mt-2">
        {/* Search */}
        <div className="relative flex-1" style={{marginBottom:'10px'}}>
          <div className="relative">
            <input 
              id="search-input"
              type="text" 
              placeholder=" "
              style={{padding:'2px 10px'}}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="peer w-full px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm"
            />
            <label 
              htmlFor="search-input"
              style={{padding:'0 5px'}}
              className="absolute pointer-events-none transition-all duration-200 text-[var(--text-muted)] px-1 bg-transparent z-10 whitespace-nowrap
                before:content-[''] before:absolute before:top-[7px] before:left-0 before:w-full before:h-[4px] before:bg-[var(--bg-primary)] before:-z-10
                before:hidden peer-focus:before:block peer-[:not(:placeholder-shown)]:before:block
                top-1/2 left-3 -translate-y-1/2 text-sm
                peer-focus:top-0 peer-focus:left-3 peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-indigo-500
                peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium
              "
            >
              Tìm kiếm theo Tên, Email, SĐT
            </label>
          </div>
        </div>

        {/* Sort */}
        <div className="relative min-w-[150px]">
          <div className="relative">
            <select 
              id="sort-filter"
              value={sortFilter}
              style={{padding:'2px 10px'}}
              onChange={(e) => setSortFilter(e.target.value)}
              className="peer w-full px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-md text-[var(--text-primary)] appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm cursor-pointer"
            >
              <option value="newest">Mới nhất</option>
              <option value="name_asc">Tên (A-Z)</option>
              <option value="name_desc">Tên (Z-A)</option>
            </select>
            <label 
              style={{padding:'0 5px'}}

              htmlFor="sort-filter"
              className="absolute pointer-events-none text-[var(--text-muted)] top-0 left-3 -translate-y-1/2 text-[11px] font-medium px-1 bg-transparent z-10 whitespace-nowrap
                before:content-[''] before:absolute before:top-[7px] before:left-0 before:w-full before:h-[4px] before:bg-[var(--bg-primary)] before:-z-10
                peer-focus:text-indigo-500"
            >
              Sắp xếp
            </label>
          </div>
        </div>

        {/* Role */}
        <div className="relative min-w-[160px]">
          <div className="relative">
            <select 
              id="role-filter"
              value={roleFilter}
              style={{padding:'2px 10px'}}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="peer w-full px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-md text-[var(--text-primary)] appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm cursor-pointer"
            >
              <option value="all">Tất cả</option>
              <option value={UserRole.USER}>USER</option>
              <option value={UserRole.ADMIN}>ADMIN</option>
              <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
            </select>
            <label 
              style={{padding:'0 5px'}}
              htmlFor="role-filter"
              className="absolute pointer-events-none text-[var(--text-muted)] top-0 left-3 -translate-y-1/2 text-[11px] font-medium px-1 bg-transparent z-10 whitespace-nowrap
                before:content-[''] before:absolute before:top-[7px] before:left-0 before:w-full before:h-[4px] before:bg-[var(--bg-primary)] before:-z-10
                peer-focus:text-indigo-500"
            >
              Vai trò
            </label>
          </div>
        </div>

        {/* Status */}
        <div className="relative min-w-[180px]">
          <div className="relative">
            <select 
              id="status-filter"
              value={statusFilter}
              style={{padding:'2px 10px'}}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="peer w-full px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-md text-[var(--text-primary)] appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm cursor-pointer"
            >
              <option value="all">Tất cả</option>
              <option value="active">Hoạt động</option>
              <option value="unverified">Chưa kích hoạt</option>
              <option value="banned">Vô hiệu hóa</option>
            </select>
            <label 
              style={{padding:'0 5px'}}
              htmlFor="status-filter"
              className="absolute pointer-events-none text-[var(--text-muted)] top-0 left-3 -translate-y-1/2 text-[11px] font-medium px-1 bg-transparent z-10 whitespace-nowrap
                before:content-[''] before:absolute before:top-[7px] before:left-0 before:w-full before:h-[4px] before:bg-[var(--bg-primary)] before:-z-10
                peer-focus:text-indigo-500"
            >
              Trạng thái
            </label>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-secondary)] text-sm">
                <th className="px-6 py-4 font-medium w-[60px] text-center">STT</th>
                <th className="px-6 py-4 font-medium w-[300px]">Người dùng</th>
                <th className="px-6 py-4 font-medium">Vai trò</th>
                <th className="px-6 py-4 font-medium">Trạng thái</th>
                <th className="px-6 py-4 font-medium">Ngày tham gia</th>
                <th className="px-6 py-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[var(--text-muted)]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[var(--text-muted)]">
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              ) : (
                users.map((u, index) => (
                  <tr 
                    key={u._id} 
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(u)}
                  >
                    <td className="px-6 py-4 text-center text-[var(--text-secondary)] font-medium">
                      {(page - 1) * 20 + index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const avatarUrl = typeof u.avatar === 'string' ? u.avatar : (u.avatar as any)?.url;
                          const DefaultAvatar = () => (
                            <div className="relative w-10 h-10 overflow-hidden bg-gray-100 rounded-full dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600">
                              <svg className="absolute w-12 h-12 text-gray-400 -left-1 mt-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                              </svg>
                            </div>
                          );
                          
                          return avatarUrl ? (
                            <img 
                              src={avatarUrl} 
                              alt="Avatar" 
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : <DefaultAvatar />;
                        })()}
                        {/* Fallback for broken images */}
                           <div className="hidden relative w-10 h-10 overflow-hidden bg-gray-100 rounded-full dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600">
                             <svg className="absolute w-12 h-12 text-gray-400 -left-1 mt-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                               <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                             </svg>
                           </div>
                        <div>
                          <div className="font-semibold text-[var(--text-primary)]">{u.name}</div>
                          <div className="text-sm text-[var(--text-muted)]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[var(--text-secondary)] capitalize">{u.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      {u.isDisabled ? (
                        <span style={{padding:'0 3px'}} className="inline-flex items-center px-2.5 py-1 rounded-xs text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Vô hiệu hóa
                        </span>
                      ) : !u.isActive ? (
                        <span style={{padding:'0 3px'}} className="inline-flex items-center px-2.5 py-1 rounded-xs text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Chưa kích hoạt
                        </span>
                      ) : (
                        <span style={{padding:'0 3px'}} className="inline-flex items-center px-2.5 py-1 rounded-xs text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Hoạt động
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          className="p-2 text-[var(--text-muted)] hover:text-indigo-500 rounded-lg hover:bg-[var(--bg-primary)] transition-colors tooltip"
                          title="Chỉnh sửa"
                          onClick={() => setSelectedUser(u)}
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          className={`p-2 rounded-lg transition-colors tooltip ${
                            u.isDisabled || !u.isActive 
                              ? 'text-[var(--text-muted)] hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' 
                              : 'text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                          }`}
                          title={u.isDisabled || !u.isActive ? "Mở khóa" : "Khóa tài khoản"}
                          onClick={() => handleToggleStatus(u)}
                          disabled={disableMutation.isPending || enableMutation.isPending}
                        >
                          {u.isDisabled || !u.isActive ? <ShieldCheck size={18} /> : <ShieldBan size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div style={{padding:'5px'}} className="p-5 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-sm text-[var(--text-secondary)]">
          <div className="text-center sm:text-left">
            Hiển thị <span className="font-medium text-[var(--text-primary)]">{total === 0 ? 0 : (page - 1) * 20 + 1}</span> đến <span className="font-medium text-[var(--text-primary)]">{Math.min(page * 20, total)}</span> trong tổng số <span className="font-medium text-[var(--text-primary)]">{total}</span>
          </div>
          
          <div className="flex items-center justify-center gap-1.5">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            
            {(() => {
              const totalPages = Math.ceil(total / 20);
              const pages = [];
              
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                if (page <= 4) {
                  pages.push(1, 2, 3, 4, 5, '...', totalPages);
                } else if (page >= totalPages - 3) {
                  pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                } else {
                  pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
                }
              }

              return pages.map((p, idx) => {
                if (p === '...') {
                  return <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] tracking-widest shrink-0">...</span>;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors font-medium border shrink-0 ${p >= 100 ? 'text-[10px]' : 'text-[13px]'} ${
                      page === p 
                        ? 'bg-blue-50 border-blue-300 text-blue-600 shadow-sm dark:bg-blue-900/30 dark:border-blue-700/50 dark:text-blue-400' 
                        : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/50 text-[var(--text-primary)]'
                    }`}
                  >
                    {p}
                  </button>
                );
              });
            })()}

            <button 
              disabled={page >= Math.ceil(total / 20) || total === 0} 
              onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="hidden sm:block"></div>
        </div>
      </div>
      </div>

      {/* User Detail View */}
      {selectedUser && (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden flex-1 flex flex-col mt-2">
            <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)]">
              <button 
                onClick={() => setSelectedUser(null)}
                className="flex items-center gap-2 p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-xl transition-colors font-medium"
              >
                <ChevronLeft size={20} />
                Quay lại
              </button>
              <h2 className="text-xl font-bold text-[var(--text-primary)] hidden sm:block">Thông tin chi tiết</h2>
              <div className="ml-auto flex items-center gap-3">
                {currentUser?.role === UserRole.SUPER_ADMIN && (
                  <button 
                    onClick={() => {
                      setSelectedNewRole(selectedUser.role as UserRole);
                      setShowRoleModal(true);
                    }}
                    className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Key size={16} />
                    Thay đổi Quyền (Cấp Role)
                  </button>
                )}
                <div className="relative">
                  <button 
                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                    className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm flex items-center gap-2"
                  >
                    Thao tác
                  </button>
                  {showActionsDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-card)] rounded-xl shadow-lg border border-[var(--border)] py-1 z-50">
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors flex items-center gap-2"
                        onClick={() => {
                          toast.error('Chưa có API Force Logout');
                          setShowActionsDropdown(false);
                        }}
                      >
                        Force Logout
                      </button>
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                        onClick={() => {
                          handleToggleStatus(selectedUser);
                          setShowActionsDropdown(false);
                        }}
                      >
                        {selectedUser.isDisabled || !selectedUser.isActive ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 bg-[var(--bg-primary)]">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mb-8">
                <div className="relative group">
                  {(() => {
                    const avatarUrl = typeof selectedUser.avatar === 'string' ? selectedUser.avatar : (selectedUser.avatar as any)?.url;
                    return avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-[var(--border)] shadow-sm shrink-0" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-4xl font-bold border-4 border-[var(--border)] shadow-sm shrink-0">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if(confirm('Bạn có chắc muốn xóa ảnh đại diện của người dùng này?')) {
                          resetAvatarMutation.mutate(selectedUser._id);
                        }
                      }}
                      className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 shadow-sm transition-colors text-xs font-bold uppercase flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Xóa Ảnh
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-3xl font-bold text-[var(--text-primary)]">{selectedUser.name}</h3>
                    <button 
                      onClick={() => {
                        if(confirm('Bạn có chắc muốn đặt lại tên người dùng này?')) {
                          resetNameMutation.mutate(selectedUser._id);
                        }
                      }}
                      className="px-3 py-1 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Đặt lại Tên
                    </button>
                  </div>
                  <p className="text-lg text-[var(--text-secondary)] mb-4">{selectedUser.email}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.isDisabled ? (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        Đang bị khóa
                      </span>
                    ) : !selectedUser.isActive ? (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Chưa xác thực
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Đang hoạt động
                      </span>
                    )}
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase">
                      {selectedUser.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 shadow-sm">
                <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-6 border-b border-[var(--border)] pb-2">Thông tin hệ thống</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">Ngày tham gia</span>
                    <span className="text-[var(--text-primary)] font-medium">
                      {new Date(selectedUser.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  {selectedUser.dateOfBirth && (
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">Ngày sinh</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {new Date(selectedUser.dateOfBirth).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  )}
                  {selectedUser.gender && (
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-[var(--text-muted)] uppercase mb-1">Giới tính</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {selectedUser.gender === 'MALE' ? 'Nam' : selectedUser.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                      </span>
                    </div>
                  )}
                </div>

                <div className={selectedUser.bio ? "mt-8" : "hidden"}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase">Tiểu sử</span>
                    <button 
                      onClick={() => {
                        if(confirm('Bạn có chắc muốn xóa tiểu sử của người dùng này?')) {
                          clearBioMutation.mutate(selectedUser._id);
                        }
                      }}
                      className="px-2 py-1 text-xs font-bold text-red-600 bg-red-100 hover:bg-red-200 rounded transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Xóa Tiểu sử
                    </button>
                  </div>
                  <div className="px-5 py-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] font-medium whitespace-pre-wrap min-h-[80px]">
                    {selectedUser.bio}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sudo Mode Role Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-[var(--border)]">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Cấp Quyền</h3>
              <button 
                onClick={() => {
                  setShowRoleModal(false);
                  setAdminPassword('');
                }}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-700/50">
                <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium">
                  Tính năng này yêu cầu xác thực bảo mật vì tác động tới quyền hạn cao nhất của hệ thống.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Vai trò mới</label>
                <select 
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={UserRole.USER}>USER</option>
                  <option value={UserRole.ADMIN}>ADMIN</option>
                  <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Mật khẩu của bạn</label>
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại để xác nhận..."
                  className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[var(--bg-primary)] border-t border-[var(--border)] flex justify-end gap-3">
              <button 
                onClick={() => setShowRoleModal(false)}
                className="px-5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button 
                disabled={changeRoleMutation.isPending || !adminPassword}
                onClick={() => {
                  changeRoleMutation.mutate({ 
                    id: selectedUser._id, 
                    role: selectedNewRole, 
                    password: adminPassword 
                  });
                }}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {changeRoleMutation.isPending ? 'Đang xử lý...' : 'Xác nhận Cấp Quyền'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
