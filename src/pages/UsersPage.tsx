import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Edit2, Eye, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { parseError, usersApi } from '../services/api';
import { fetchUserDetail, useUsersListQuery, type UserSummary } from '../queries/users';
import { UserRole } from '../constants/roles';
import { UI_LIMITS } from '../constants/limits';
import { UI_MESSAGES } from '../constants/messages';
import { formatDateVN } from '../utils/date';

const defaultCreate = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  address: '',
  role: UserRole.USER as UserRole,
};

const defaultEdit = {
  _id: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  role: UserRole.USER as UserRole,
  isActive: true,
};

export default function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [appliedSearchText, setAppliedSearchText] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState(defaultCreate);
  const [editForm, setEditForm] = useState(defaultEdit);

  const usersQuery = useUsersListQuery(currentPage, appliedSearchText, UI_LIMITS.USER_LIST_PAGE_SIZE);
  const users = usersQuery.data?.userList || [];
  const totalPages = usersQuery.data?.totalPages || 1;
  const isLoading = usersQuery.isPending && !usersQuery.data;
  const usersError = usersQuery.isError ? parseError(usersQuery.error) : '';

  const detailQuery = useQuery<Awaited<ReturnType<typeof fetchUserDetail>> | null, Error>({
    queryKey: ['users', 'detail', selectedDetailId],
    queryFn: async () => (selectedDetailId ? fetchUserDetail(selectedDetailId) : null),
    enabled: showDetail && Boolean(selectedDetailId),
  });

  useEffect(() => {
    if (usersQuery.isError) {
      toast.error(usersError);
    }
  }, [toast, usersError, usersQuery.isError]);

  useEffect(() => {
    if (detailQuery.isError && showDetail) {
      toast.error(parseError(detailQuery.error));
    }
  }, [detailQuery.error, detailQuery.isError, showDetail, toast]);

  const createMutation = useMutation({
    mutationFn: async (form: typeof defaultCreate) => {
      await usersApi.create({
        name: form.name,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        phone: form.phone || undefined,
        address: form.address || undefined,
        role: form.role,
      });
    },
    onSuccess: async () => {
      toast.success(UI_MESSAGES.users.createSuccess);
      setShowCreate(false);
      setCreateForm(defaultCreate);
      setCurrentPage(1);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      toast.error(parseError(err));
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      await usersApi.updateByAdmin(editForm._id, {
        name: editForm.name.trim() || undefined,
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        role: editForm.role || undefined,
      });
    },
    onSuccess: async () => {
      toast.success(UI_MESSAGES.users.updateSuccess);
      setShowEdit(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      toast.error(parseError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return;
      await usersApi.delete(selectedUser._id);
    },
    onSuccess: async () => {
      toast.success(UI_MESSAGES.users.deleteSuccess);
      setShowDelete(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      toast.error(parseError(err));
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setAppliedSearchText(searchText.trim());
  };

  const handleRefresh = () => {
    usersQuery.refetch();
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error(UI_MESSAGES.users.nameRequired);
      return;
    }
    if (!createForm.email) {
      toast.error(UI_MESSAGES.users.emailRequired);
      return;
    }
    if (!createForm.password) {
      toast.error(UI_MESSAGES.users.passwordRequired);
      return;
    }
    if (createForm.password.length < UI_LIMITS.PASSWORD_MIN_LENGTH) {
      toast.error(UI_MESSAGES.users.passwordTooShort);
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      toast.error(UI_MESSAGES.users.confirmPasswordMismatch);
      return;
    }

    await createMutation.mutateAsync(createForm);
  };

  const openEdit = (user: UserSummary) => {
    setSelectedUser(user);
    setEditForm({
      _id: user._id,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      role: user.role as UserRole || UserRole.USER,
      isActive: user.isActive,
    });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    await editMutation.mutateAsync();
  };

  const openDelete = (user: UserSummary) => {
    setSelectedUser(user);
    setShowDelete(true);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    await deleteMutation.mutateAsync();
  };

  const openDetail = (user: UserSummary) => {
    setSelectedUser(user);
    setSelectedDetailId(user._id);
    setShowDetail(true);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedDetailId(null);
  };

  const detailLoading = detailQuery.isFetching && !detailQuery.data;
  const detailUser = detailQuery.data || selectedUser;
  const createLoading = createMutation.isPending;
  const editLoading = editMutation.isPending;
  const deleteLoading = deleteMutation.isPending;

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Quan ly Users</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Quan ly nguoi dung he thong</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="btn-create-user">
          <Plus size={15} /> Tao user moi
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="toolbar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <div className="search-bar">
              <Search size={16} />
              <input
                id="search-users"
                className="search-input"
                placeholder="Tim theo email..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">Tim kiem</button>
          </form>
          <button className="btn btn-secondary" onClick={handleRefresh}>
            <RefreshCw size={14} /> Lam moi
          </button>
        </div>

        <div className="table-container" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)' }}>
          {isLoading ? (
            <div className="loading-center">
              <div className="loading-spinner" />
              Dang tai...
            </div>
          ) : usersQuery.isError ? (
            <div className="empty-state">
              <Users />
              <h3>Khong tai duoc danh sach users</h3>
              <p>{usersError}</p>
              <button className="btn btn-primary" onClick={handleRefresh}>Thu lai</button>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <Users />
              <h3>Khong co users nao</h3>
              <p>Thu tao user moi hoac thay doi dieu kien tim kiem</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Email</th>
                  <th>Ten</th>
                  <th>Vai tro</th>
                  <th>Loai TK</th>
                  <th>Trang thai</th>
                  <th>Ngay tao</th>
                  <th>Thao tac</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={u._id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{(currentPage - 1) * UI_LIMITS.USER_LIST_PAGE_SIZE + idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '11px' }}>
                          {(u.name || u.email || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.email}</span>
                      </div>
                    </td>
                    <td>{u.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      <span className={`badge ${u.role === UserRole.SUPER_ADMIN ? 'badge-error' : u.role === UserRole.ADMIN ? 'badge-info' : 'badge-warning'}`}>{u.role}</span>
                    </td>
                    <td><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.accountType}</span></td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-success' : 'badge-error'}`}>
                        <span className="badge-dot" />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDateVN(u.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-secondary btn-icon" title="Xem chi tiet" onClick={() => openDetail(u)}><Eye size={13} /></button>
                        <button className="btn btn-secondary btn-icon" title="Chinh sua" onClick={() => openEdit(u)}><Edit2 size={13} /></button>
                        <button className="btn btn-danger btn-icon" title="Xoa" onClick={() => openDelete(u)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && !usersQuery.isError && users.length > 0 && (
          <div className="pagination">
            <span className="pagination-info">Trang {currentPage} / {totalPages}</span>
            <div className="pagination-controls">
              <button className="page-btn" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + index;
                return (
                  <button
                    key={page}
                    className={`page-btn ${page === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
              <button className="page-btn" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tao user moi (ADMIN)"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Huy</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={createLoading} id="btn-create-submit">
              {createLoading ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Dang tao...</> : <><Plus size={14} /> Tao user</>}
            </button>
          </>
        )}
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ten *</label>
            <input
              id="create-name"
              className="form-input"
              placeholder="Nguyen Van A"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input
              id="create-email"
              className="form-input"
              type="email"
              placeholder="user@example.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Mat khau *</label>
            <input
              id="create-password"
              className="form-input"
              type="password"
              placeholder="********"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Xac nhan mat khau *</label>
            <input
              id="create-confirm"
              className="form-input"
              type="password"
              placeholder="********"
              value={createForm.confirmPassword}
              onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">So dien thoai</label>
            <input
              id="create-phone"
              className="form-input"
              placeholder="0912345678"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Vai tro</label>
            <select
              id="create-role"
              className="form-select"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
            >
              <option value={UserRole.USER}>USER</option>
              <option value={UserRole.ADMIN}>ADMIN</option>
              <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Dia chi</label>
          <input
            id="create-address"
            className="form-input"
            placeholder="TP. Ho Chi Minh"
            value={createForm.address}
            onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title={`Chinh sua: ${selectedUser?.email || ''}`}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Huy</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={editLoading} id="btn-edit-submit">
              {editLoading ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Dang luu...</> : 'Luu thay doi'}
            </button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ten hien thi</label>
            <input
              id="edit-name"
              className="form-input"
              placeholder="Nguyen Van A"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Vai tro</label>
            <select className="form-select" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}>
              <option value={UserRole.USER}>USER</option>
              <option value={UserRole.ADMIN}>ADMIN</option>
              <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">So dien thoai</label>
            <input
              id="edit-phone"
              className="form-input"
              placeholder="0912345678"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Dia chi</label>
            <input
              id="edit-address"
              className="form-input"
              placeholder="TP. Ho Chi Minh"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetail}
        onClose={closeDetail}
        title="Chi tiet nguoi dung"
        footer={<button className="btn btn-secondary" onClick={closeDetail}>Dong</button>}
      >
        {detailLoading ? (
          <div className="loading-center">
            <div className="loading-spinner" />
            Dang tai chi tiet...
          </div>
        ) : detailUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div className="avatar" style={{ width: 60, height: 60, fontSize: 22, margin: '0 auto 12px' }}>
                {(detailUser.name || detailUser.email).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{detailUser.name || 'Chua dat ten'}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{detailUser.email}</div>
            </div>
            <div className="divider" />
            {[
              { label: 'ID', value: detailUser._id },
              { label: 'Vai tro', value: detailUser.role },
              { label: 'Loai tai khoan', value: detailUser.accountType },
              { label: 'Trang thai', value: detailUser.isActive ? 'Da kich hoat' : 'Chua kich hoat' },
              { label: 'So dien thoai', value: detailUser.phone || '—' },
              { label: 'Dia chi', value: detailUser.address || '—' },
              { label: 'Ngay tao', value: formatDateVN(detailUser.createdAt) },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{item.label}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{item.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Xac nhan xoa"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setShowDelete(false)}>Huy</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading} id="btn-delete-confirm">
              {deleteLoading ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Dang xoa...</> : <><Trash2 size={14} /> Xoa</>}
            </button>
          </>
        )}
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Ban co chac muon xoa user <strong style={{ color: 'var(--text-primary)' }}>{selectedUser?.email}</strong>?
            <br />
            <span style={{ fontSize: '12px', color: 'var(--error)' }}>Hanh dong nay khong the hoan tac!</span>
          </p>
        </div>
      </Modal>
    </div>
  );
}
