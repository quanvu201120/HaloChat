import { useState } from 'react';
import { api, authApi, API_BASE_URL, systemApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { UserRole } from '../constants/roles';
import { Play, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';

interface Endpoint {
  id: string;
  group: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  defaultBody?: Record<string, any>;
  defaultParams?: Record<string, string>;
  requireAuth: boolean;
}

const ENDPOINTS: Endpoint[] = [
  // AUTH
  {
    id: 'root-health', group: 'System', method: 'GET', path: '/',
    description: 'Kiểm tra endpoint gốc của app', requireAuth: true,
  },
  {
    id: 'login', group: 'Auth', method: 'POST', path: '/auth/login',
    description: 'Đăng nhập tài khoản', requireAuth: false,
    defaultBody: { email: 'admin@example.com', password: '123456' },
  },
  {
    id: 'register', group: 'Auth', method: 'POST', path: '/auth/register',
    description: 'Đăng ký tài khoản mới', requireAuth: false,
    defaultBody: { email: 'newuser@example.com', password: '123456', confirmPassword: '123456' },
  },
  {
    id: 'active', group: 'Auth', method: 'POST', path: '/auth/active',
    description: 'Kích hoạt tài khoản', requireAuth: false,
    defaultBody: { email: 'user@example.com', code: 'uuid-code-here' },
  },
  {
    id: 'resend-code', group: 'Auth', method: 'POST', path: '/auth/resend-code-active',
    description: 'Gửi lại mã kích hoạt', requireAuth: false,
    defaultBody: { email: 'user@example.com' },
  },
  {
    id: 'logout', group: 'Auth', method: 'POST', path: '/auth/logout',
    description: 'Đăng xuất', requireAuth: true,
  },
  {
    id: 'logout-all', group: 'Auth', method: 'POST', path: '/auth/logoutAll',
    description: 'Đăng xuất tất cả thiết bị', requireAuth: true,
  },
  {
    id: 'refresh', group: 'Auth', method: 'POST', path: '/auth/refreshToken',
    description: 'Refresh Access Token (dùng cookie)', requireAuth: false,
  },
  {
    id: 'change-pwd', group: 'Auth', method: 'POST', path: '/auth/change-password',
    description: 'Đổi mật khẩu', requireAuth: true,
    defaultBody: { passwordOld: '123456', passwordNew: 'newpass123', confirmPassword: 'newpass123' },
  },
  {
    id: 'forgot', group: 'Auth', method: 'POST', path: '/auth/forgot-password',
    description: 'Gửi mã quên mật khẩu', requireAuth: false,
    defaultBody: { email: 'user@example.com' },
  },
  {
    id: 'reset', group: 'Auth', method: 'POST', path: '/auth/reset-password',
    description: 'Đặt lại mật khẩu', requireAuth: false,
    defaultBody: { email: 'user@example.com', code: 'uuid-code', password: 'newpass123', confirmPassword: 'newpass123' },
  },
  // USERS
  {
    id: 'users-list', group: 'Users', method: 'GET', path: '/users',
    description: 'Lấy danh sách users (phân trang)', requireAuth: true,
    defaultParams: { current: '1', pageSize: '10' },
  },
  {
    id: 'users-get', group: 'Users', method: 'GET', path: '/users/:id',
    description: 'Lấy chi tiết một user theo ID', requireAuth: true,
    defaultParams: { id: '' },
  },
  {
    id: 'user-create', group: 'Users', method: 'POST', path: '/users',
    description: 'Tạo user mới (ADMIN)', requireAuth: true,
    defaultBody: { name: 'Test User', email: 'newuser@example.com', password: '123456', confirmPassword: '123456', role: UserRole.USER },
  },
  {
    id: 'users-update', group: 'Users', method: 'PATCH', path: '/users',
    description: 'Cập nhật thông tin user', requireAuth: true,
    defaultBody: { _id: 'user-id-here', name: 'Updated Name', phone: '0912345678' },
  },
  {
    id: 'users-delete', group: 'Users', method: 'DELETE', path: '/users/:id',
    description: 'Xóa user theo ID', requireAuth: true,
    defaultParams: { id: 'user-id-here' },
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'method-get', POST: 'method-post', PATCH: 'method-patch', DELETE: 'method-delete',
};

export default function ApiTesterPage() {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>(() =>
    Object.fromEntries(ENDPOINTS.map((ep) => [ep.id, JSON.stringify(ep.defaultBody || {}, null, 2)]))
  );
  const [params, setParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(ENDPOINTS.map((ep) => [ep.id, JSON.stringify(ep.defaultParams || {}, null, 2)]))
  );
  const [results, setResults] = useState<Record<string, { status: number; data: any; time: number }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const runEndpoint = async (ep: Endpoint) => {
    setLoading((l) => ({ ...l, [ep.id]: true }));
    const start = Date.now();
    try {
      let bodyParsed: any = {};
      let paramsParsed: any = {};

      try { bodyParsed = JSON.parse(bodies[ep.id] || '{}'); } catch { bodyParsed = {}; }
      try { paramsParsed = JSON.parse(params[ep.id] || '{}'); } catch { paramsParsed = {}; }

      let path = ep.path;
      // Replace :id in path
      if (paramsParsed.id) {
        path = path.replace(':id', paramsParsed.id);
        const { id, ...rest } = paramsParsed;
        paramsParsed = rest;
      }

      let res: any;
      if (ep.method === 'GET') {
        if (ep.id === 'root-health') res = await systemApi.getHello();
        else res = await api.get(path, { params: paramsParsed });
      }
      else if (ep.method === 'POST') {
        if (ep.id === 'refresh') res = await authApi.refreshToken();
        else if (ep.id === 'logout') res = await authApi.logout();
        else if (ep.id === 'logout-all') res = await authApi.logoutAll();
        else res = await api.post(path, bodyParsed);
      }
      else if (ep.method === 'PATCH') res = await api.patch(path, bodyParsed);
      else if (ep.method === 'DELETE') res = await api.delete(path);

      const time = Date.now() - start;
      setResults((r) => ({ ...r, [ep.id]: { status: res.status, data: res.data, time } }));
      toast.success(`${ep.method} ${ep.path} → ${res.status} (${time}ms)`);
    } catch (err: any) {
      const time = Date.now() - start;
      const status = err?.response?.status || 0;
      const data = err?.response?.data || { message: err.message };
      setResults((r) => ({ ...r, [ep.id]: { status, data, time } }));
      toast.error(`${ep.method} ${ep.path} → ${status}`);
    } finally {
      setLoading((l) => ({ ...l, [ep.id]: false }));
    }
  };

  const groups = Array.from(new Set(ENDPOINTS.map((e) => e.group)));

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FlaskConical size={24} style={{ color: 'var(--accent-primary)' }} />
          API Tester
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Test trực tiếp các API endpoints của NestJS backend
        </p>
      </div>

      {/* Base URL badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px', borderRadius: '8px',
        background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)',
        marginBottom: '24px', fontSize: '13px',
      }}>
        <span style={{ color: 'var(--accent-teal)' }}>🌐 Base URL:</span>
        <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
          {API_BASE_URL}
        </span>
        <span className="badge badge-success" style={{ fontSize: '10px' }}>
          <span className="badge-dot" /> Deployed
        </span>
      </div>

      {groups.map((group) => (
        <div key={group} style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '10px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ display: 'inline-block', width: '3px', height: '14px', borderRadius: '2px', background: 'var(--accent-primary)' }} />
            {group}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ENDPOINTS.filter((ep) => ep.group === group).map((ep) => {
              const isOpen = openId === ep.id;
              const result = results[ep.id];
              const isRunning = loading[ep.id];
              const hasParams = ep.defaultParams && Object.keys(ep.defaultParams).length > 0;
              const hasBody = ep.defaultBody && Object.keys(ep.defaultBody).length > 0;

              return (
                <div key={ep.id} className="api-card">
                  {/* Header row */}
                  <div
                    className="api-card-header"
                    onClick={() => setOpenId(isOpen ? null : ep.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <span className={`method-badge ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{ep.path}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>{ep.description}</span>
                      {ep.requireAuth && (
                        <span style={{ fontSize: '10px', color: 'var(--accent-orange)', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.2)', flexShrink: 0 }}>
                          🔒 Auth
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {result && (
                        <span className={`badge ${result.status >= 200 && result.status < 300 ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '11px' }}>
                          {result.status} · {result.time}ms
                        </span>
                      )}
                      {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {/* Body */}
                  {isOpen && (
                    <div className="api-card-body">
                      <div style={{ display: 'grid', gridTemplateColumns: hasBody && hasParams ? '1fr 1fr' : '1fr', gap: '12px' }}>
                        {/* Params */}
                        {hasParams && (
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px' }}>Query / Path Params</label>
                            <textarea
                              className="form-input code-block"
                              rows={4}
                              value={params[ep.id]}
                              onChange={(e) => setParams((p) => ({ ...p, [ep.id]: e.target.value }))}
                              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                              id={`params-${ep.id}`}
                            />
                          </div>
                        )}

                        {/* Body */}
                        {hasBody && (
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px' }}>Request Body (JSON)</label>
                            <textarea
                              className="form-input code-block"
                              rows={4}
                              value={bodies[ep.id]}
                              onChange={(e) => setBodies((b) => ({ ...b, [ep.id]: e.target.value }))}
                              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                              id={`body-${ep.id}`}
                            />
                          </div>
                        )}
                      </div>

                      <button
                        id={`run-${ep.id}`}
                        className="btn btn-primary"
                        onClick={() => runEndpoint(ep)}
                        disabled={isRunning}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {isRunning ? (
                          <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang gọi...</>
                        ) : (
                          <><Play size={13} /> Gọi API</>
                        )}
                      </button>

                      {result && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Response</span>
                            <span className={`badge ${result.status >= 200 && result.status < 300 ? 'badge-success' : 'badge-error'}`}>
                              {result.status}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{result.time}ms</span>
                          </div>
                          <pre className="code-block" style={{ maxHeight: '280px' }}>
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
