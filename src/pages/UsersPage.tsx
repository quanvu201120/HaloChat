import React, { useState, useEffect, useCallback } from 'react';
import { usersApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import {
  Plus, Search, RefreshCw, Edit2, Trash2, Eye,
  Users, ChevronLeft, ChevronRight
} from 'lucide-react';

interface User {
  _id: string;
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  role: string;
  isActive: boolean;
  accountType: string;
  createdAt?: string;
}

const PAGE_SIZE = 10;

// CreateUserDto: { name*, email*, password*, confirmPassword*, phone?, address?, role? }
const defaultCreate = { name: '', email: '', password: '', confirmPassword: '', phone: '', address: '', role: 'USER' };

// UpdateUserByAdminDto: { name?, email?, phone?, address?, role? }
const defaultEdit = { _id: '', name: '', email: '', phone: '', address: '', role: 'USER' };

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createForm, setCreateForm] = useState(defaultCreate);
  const [createLoading, setCreateLoading] = useState(false);

  const [editForm, setEditForm] = useState(defaultEdit);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async (page = currentPage) => {
    setIsLoading(true);
    try {
      const params: any = { current: page, pageSize: PAGE_SIZE };
      if (searchText.trim()) params.email = `/${searchText}/i`;
      const res = await usersApi.getAll(params);
      // TransformInterceptor: { statusCode, message, data: { userList, totalPages } }
      const data = res.data?.data ?? res.data;
      setUsers(data?.userList || []);
      setTotalPages(data?.totalPages || 1);
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchText]);

  useEffect(() => { fetchUsers(currentPage); }, [currentPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers(1);
  };

  // ===== CREATE =====
  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast.error('Tên không được để trống'); return; }
    if (!createForm.email) { toast.error('Email không được để trống'); return; }
    if (!createForm.password) { toast.error('Mật khẩu không được để trống'); return; }
    if (createForm.password.length < 6) { toast.error('Mật khẩu phải có ít nhất 6 ký tự'); return; }
    if (createForm.password !== createForm.confirmPassword) { toast.error('Xác nhận mật khẩu không khớp'); return; }

    setCreateLoading(true);
    try {
      // Gửi đúng CreateUserDto fields
      await usersApi.create({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        confirmPassword: createForm.confirmPassword,
        phone: createForm.phone || undefined,
        address: createForm.address || undefined,
        role: createForm.role,
      });
      toast.success('Tạo user thành công!');
      setShowCreate(false);
      setCreateForm(defaultCreate);
      setCurrentPage(1);
      fetchUsers(1);
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setCreateLoading(false);
    }
  };

  // ===== EDIT =====
  const openEdit = (user: User) => {
    setSelectedUser(user);
    setEditForm({ _id: user._id, name: user.name || '', email: user.email || '', phone: user.phone || '', address: user.address || '', role: user.role || 'USER' });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    setEditLoading(true);
    try {
      // Gửi UpdateUserByAdminDto
      await usersApi.updateByAdmin(editForm._id, {
        name: editForm.name.trim() || undefined,
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        role: editForm.role || undefined,
      });
      toast.success('Cập nhật user thành công!');
      setShowEdit(false);
      fetchUsers(currentPage);
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setEditLoading(false);
    }
  };

  // ===== DELETE =====
  const openDelete = (user: User) => { setSelectedUser(user); setShowDelete(true); };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setDeleteLoading(true);
    try {
      await usersApi.delete(selectedUser._id);
      toast.success('Xóa user thành công!');
      setShowDelete(false);
      fetchUsers(currentPage);
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDetail = async (user: User) => {
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const res = await usersApi.getOne(user._id);
      const detail = res.data?.data ?? res.data;
      setSelectedUser(detail);
    } catch (err: any) {
      setSelectedUser(user);
      toast.error(parseError(err));
    } finally {
      setDetailLoading(false);
    }
  };
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Quản lý Users</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Quản lý người dùng hệ thống</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="btn-create-user">
          <Plus size={15} /> Tạo user mới
        </button>
      </div>

      {/* Table card */}
      <div className="card" style={{ padding: 0 }}>
        {/* Toolbar */}
        <div className="toolbar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <div className="search-bar">
              <Search size={16} />
              <input id="search-users" className="search-input" placeholder="Tìm theo email..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">Tìm kiếm</button>
          </form>
          <button className="btn btn-secondary" onClick={() => fetchUsers(currentPage)}>
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>

        {/* Table */}
        <div className="table-container" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)' }}>
          {isLoading ? (
            <div className="loading-center"><div className="loading-spinner" /> Đang tải...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <Users />
              <h3>Không có users nào</h3>
              <p>Thử tạo user mới hoặc thay đổi điều kiện tìm kiếm</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Email</th><th>Tên</th><th>Vai trò</th>
                  <th>Loại TK</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={u._id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
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
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-info' : 'badge-warning'}`}>{u.role}</span>
                    </td>
                    <td><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.accountType}</span></td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-success' : 'badge-error'}`}>
                        <span className="badge-dot" />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(u.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-secondary btn-icon" title="Xem chi tiết" onClick={() => openDetail(u)}><Eye size={13} /></button>
                        <button className="btn btn-secondary btn-icon" title="Chỉnh sửa" onClick={() => openEdit(u)}><Edit2 size={13} /></button>
                        <button className="btn btn-danger btn-icon" title="Xóa" onClick={() => openDelete(u)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && users.length > 0 && (
          <div className="pagination">
            <span className="pagination-info">Trang {currentPage} / {totalPages}</span>
            <div className="pagination-controls">
              <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                return (
                  <button key={page} className={`page-btn ${page === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>
                    {page}
                  </button>
                );
              })}
              <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== CREATE MODAL ===== */}
      {/* CreateUserDto: name*, email*, password*, confirmPassword*, phone?, address?, role? */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Tạo user mới (ADMIN)"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={createLoading} id="btn-create-submit">
              {createLoading ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang tạo...</> : <><Plus size={14} /> Tạo user</>}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tên *</label>
            <input id="create-name" className="form-input" placeholder="Nguyễn Văn A" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input id="create-email" className="form-input" type="email" placeholder="user@example.com" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Mật khẩu *</label>
            <input id="create-password" className="form-input" type="password" placeholder="••••••••" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Xác nhận mật khẩu *</label>
            <input id="create-confirm" className="form-input" type="password" placeholder="••••••••"
              value={createForm.confirmPassword} onChange={e => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
              style={{ borderColor: createForm.confirmPassword && createForm.password !== createForm.confirmPassword ? 'var(--error)' : '' }} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Số điện thoại</label>
            <input id="create-phone" className="form-input" placeholder="0912345678" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Vai trò</label>
            <select id="create-role" className="form-select" value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Địa chỉ</label>
          <input id="create-address" className="form-input" placeholder="TP. Hồ Chí Minh" value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} />
        </div>
      </Modal>

      {/* ===== EDIT MODAL ===== */}
      {/* UpdateUserByAdminDto: name?, email?, phone?, address?, role? */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Chỉnh sửa: ${selectedUser?.email}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={editLoading} id="btn-edit-submit">
              {editLoading ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</> : 'Lưu thay đổi'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tên hiển thị</label>
            <input id="edit-name" className="form-input" placeholder="VD: Nguyễn Văn A" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Vai trò</label>
            <select className="form-select" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Số điện thoại</label>
            <input id="edit-phone" className="form-input" placeholder="VD: 0912345678" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Địa chỉ</label>
            <input id="edit-address" className="form-input" placeholder="VD: TP. Hồ Chí Minh" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* ===== DETAIL MODAL ===== */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="Chi tiết người dùng"
        footer={<button className="btn btn-secondary" onClick={() => setShowDetail(false)}>Đóng</button>}
      >
        {detailLoading ? (
          <div className="loading-center"><div className="loading-spinner" /> Đang tải chi tiết...</div>
        ) : selectedUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div className="avatar" style={{ width: 60, height: 60, fontSize: 22, margin: '0 auto 12px' }}>
                {(selectedUser.name || selectedUser.email).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedUser.name || 'Chưa đặt tên'}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{selectedUser.email}</div>
            </div>
            <div className="divider" />
            {[
              { label: 'ID', value: selectedUser._id },
              { label: 'Vai trò', value: selectedUser.role },
              { label: 'Loại tài khoản', value: selectedUser.accountType },
              { label: 'Trạng thái', value: selectedUser.isActive ? '✅ Đã kích hoạt' : '❌ Chưa kích hoạt' },
              { label: 'Số điện thoại', value: selectedUser.phone || '—' },
              { label: 'Địa chỉ', value: selectedUser.address || '—' },
              { label: 'Ngày tạo', value: formatDate(selectedUser.createdAt) },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{item.label}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ===== DELETE MODAL ===== */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Xác nhận xóa"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowDelete(false)}>Hủy</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading} id="btn-delete-confirm">
              {deleteLoading ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang xóa...</> : <><Trash2 size={14} /> Xóa</>}
            </button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Bạn có chắc muốn xóa user <strong style={{ color: 'var(--text-primary)' }}>{selectedUser?.email}</strong>?
            <br />
            <span style={{ fontSize: '12px', color: 'var(--error)' }}>Hành động này không thể hoàn tác!</span>
          </p>
        </div>
      </Modal>
    </div>
  );
}
