import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { UserAdminData } from '../../services/admin';
import { UserRole } from '../../constants/roles';
import { AdminMobileFilter } from '../../components/admin/AdminMobileFilter';
import { formatDateVN } from '../../utils/date';
import { LIMIT, MuiSelect, UserStatusBadges } from './UsersTab.primitives';

interface UsersListViewProps {
  selectedUser: UserAdminData | null;
  isFilterOpen: boolean;
  setIsFilterOpen: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  sortFilter: string;
  setSortFilter: (v: string) => void;
  roleFilter: string;
  setRoleFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  users: UserAdminData[];
  total: number;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  isLoading: boolean;
  isFetching: boolean;
  setSelectedUser: (u: UserAdminData) => void;
}

export function UsersListView({
  selectedUser,
  isFilterOpen,
  setIsFilterOpen,
  setShowCreateModal,
  search,
  setSearch,
  sortFilter,
  setSortFilter,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  users,
  total,
  page,
  setPage,
  isLoading,
  isFetching,
  setSelectedUser,
}: UsersListViewProps) {
  const renderFilters = (idPrefix: string) => {
    const labelBgColor = idPrefix === 'mobile' ? 'var(--bg-card)' : 'var(--bg-primary)';

    return (
      <>
        {/* Tạo mới button */}
        <div className="flex items-center" style={{ marginBottom: '10px' }}>
          <button
            id={`${idPrefix}-btn-create-user`}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-[#1976d2] text-xs font-medium tracking-wide uppercase border border-[#1976d2] bg-transparent hover:bg-[rgba(25,118,210,0.08)] active:bg-[rgba(25,118,210,0.16)] transition-colors whitespace-nowrap"
            style={{ letterSpacing: '0.02857em', height:'34px', lineHeight: '1.75', padding:'3px 10px 3px', borderRadius:'4px' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Tạo mới
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1" style={{marginBottom:'10px', minWidth:'175px'}}>
          <div className="relative">
            <input
              id={`${idPrefix}-search-input`}
              type="text"
              placeholder=" "
              style={{padding:'2px 10px', borderRadius:'4px', height:'34px'}}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="peer w-full px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors "
            />
            <label
              htmlFor={`${idPrefix}-search-input `}
              style={{
                padding:'0 5px',
                background: labelBgColor
              }}
              className={`absolute pointer-events-none transition-all duration-200 text-[var(--text-muted)] z-10 whitespace-nowrap
                top-1/2 left-3 -translate-y-1/2 text-sm
                peer-focus:top-0 peer-focus:left-3 peer-focus:text-[10px] peer-focus:font-medium peer-focus:text-indigo-500
                peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium
              `}
            >
              Tìm theo Tên, Email, SĐT
            </label>
          </div>
        </div>

        {/* Sort */}
        <MuiSelect
          label="Sắp xếp"
          value={sortFilter}
          onChange={setSortFilter}
          options={[
            { value: 'newest', label: 'Mới nhất' },
            { value: 'name_asc', label: 'Tên (A-Z)' },
            { value: 'name_desc', label: 'Tên (Z-A)' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />

        {/* Role */}
        <MuiSelect
          label="Vai trò"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: UserRole.USER, label: 'USER' },
            { value: UserRole.ADMIN, label: 'ADMIN' },
            { value: UserRole.SUPER_ADMIN, label: 'SUPER_ADMIN' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />

        {/* Status */}
        <MuiSelect
          label="Trạng thái"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'active', label: 'Hoạt động' },
            { value: 'unverified', label: 'Chưa kích hoạt' },
            { value: 'banned', label: 'Vô hiệu hóa' },
            { value: 'suspended', label: 'Khóa tài khoản' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />
      </>
    );
  };

  return (
    <>
      {/* Mobile Toggle Button & Filters (Fixed to viewport) */}
      {!selectedUser && (
        <AdminMobileFilter
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen(!isFilterOpen)}
        >
          {renderFilters('mobile')}
        </AdminMobileFilter>
      )}

      <div className={`flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${selectedUser ? 'hidden' : ''}`}>
        {/* List View */}
        <div className={`flex flex-col h-full ${selectedUser ? 'hidden' : ''} relative`}>
      {/* Mobile Toggle Button (Absolute to touch the top padding) */}
      {/* Desktop Filters */}
      <div className="max-[1050px]:hidden min-[1050px]:flex flex-row flex-wrap gap-4 mb-6 mt-2 items-center w-full">
        {renderFilters('desktop')}
      </div>

      {/* Data Grid */}
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-secondary)] text-sm">
                <th className="px-6 py-4 font-medium w-[60px] text-center">STT</th>
                <th className="px-6 py-4 font-medium max-w-[150px] sm:max-w-[200px] lg:max-w-[250px]">Người dùng</th>
                <th className="px-6 py-4 font-medium">Vai trò</th>
                <th className="px-6 py-4 font-medium">Trạng thái</th>
                <th className="px-6 py-4 font-medium">Ngày tham gia</th>

              </tr>
            </thead>
            <tbody className={`transition-opacity duration-200 ${isFetching && !isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)]">
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
                      {(page - 1) * LIMIT + index + 1}
                    </td>
                    <td className="px-6 py-4 max-w-[150px] sm:max-w-[200px] lg:max-w-[250px]">
                      <div className="flex items-center gap-3 min-w-0">
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
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--text-primary)] truncate">{u.name}</div>
                          <div className="text-sm text-[var(--text-muted)] truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[var(--text-secondary)] capitalize">{u.role}</span>
                    </td>
                    <td className="px-6 py-4" style={{minWidth:'116px'}}>
                      <UserStatusBadges user={u} variant="table" />
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">
                      {formatDateVN(u.createdAt)}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-2.5 sm:p-5 border-t border-[var(--border)] flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-4 items-center text-[13px] sm:text-sm text-[var(--text-secondary)]">
          <div className="text-center sm:text-left">
            Hiển thị <span className="font-medium text-[var(--text-primary)]">{total === 0 ? 0 : (page - 1) * LIMIT + 1}</span> đến <span className="font-medium text-[var(--text-primary)]">{Math.min(page * LIMIT, total)}</span> trong tổng số <span className="font-medium text-[var(--text-primary)]">{total}</span>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            {(() => {
              const totalPages = Math.ceil(total / LIMIT);
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
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors font-medium border shrink-0 cursor-pointer ${(p as number) >= 100 ? 'text-[10px]' : 'text-[13px]'} ${
                      page === p
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 shadow-sm'
                        : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/50 text-[var(--text-primary)]'
                    }`}
                  >
                    {p}
                  </button>
                );
              });
            })()}

            <button
              disabled={page >= Math.ceil(total / LIMIT) || total === 0}
              onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="hidden sm:block"></div>
        </div>
      </div>
      </div>
      </div>
    </>
  );
}
