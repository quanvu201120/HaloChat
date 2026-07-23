/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useRef } from 'react';
import type { UserAdminData } from '../../services/admin';
import { UI_LIMITS } from '../../constants/limits';
import { PERMANENT_BAN_DAYS } from '../../constants/penalty';

export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getBanStatusLabel(banUntil?: string) {
  if (!banUntil) return null;
  const banDate = new Date(banUntil);
  if (Number.isNaN(banDate.getTime()) || banDate <= new Date()) return null;

  const diffDays = Math.ceil((banDate.getTime() - Date.now()) / DAY_IN_MS);
  if (diffDays >= PERMANENT_BAN_DAYS - 1) {
    return 'Khóa vĩnh viễn';
  }

  return `Khóa ${diffDays} ngày`;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export const LIMIT = UI_LIMITS.ADMIN_TABLE_PAGE_SIZE; // TODO: đổi lại 20 sau khi test xong

// ── MUI-style custom Select ──────────────────────────────────────────────────
export interface MuiSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  minWidth?: number;
  labelBgColor?: string;
}

export function MuiSelect({ label, value, onChange, options, minWidth = 140, labelBgColor = 'var(--bg-primary)' }: MuiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(o => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth, marginBottom: '10px' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '5px 20px 5px 12px',
          fontSize: '14px',
          color: 'var(--text-primary)',
          background: 'transparent',
          border: `1px solid ${open ? '#1976d2' : 'var(--border)'}`,
          borderRadius: '4px',
          cursor: 'pointer',
          textAlign: 'left',
          outline: 'none',
          boxShadow: open ? '0 0 0 1px #1976d2' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          position: 'relative',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {selectedLabel}
        {/* Arrow icon */}
        <span style={{
          position: 'absolute', right: '8px', top: '50%',
          transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
          transition: 'transform 0.2s',
          color: open ? '#1976d2' : 'var(--text-muted)',
          pointerEvents: 'none',
          fontSize: '12px',
        }}>▾</span>
      </button>
      {/* Floating label */}
      <span style={{
        position: 'absolute', top: 0, left: '10px',
        transform: 'translateY(-50%)',
        fontSize: '10px', fontWeight: 500,
        color: open ? '#1976d2' : 'var(--text-muted)',
        background: labelBgColor,
        padding: '0 4px',
        pointerEvents: 'none',
        transition: 'color 0.2s',
        whiteSpace: 'nowrap',
      }}>{label}</span>
      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: 'var(--bg-card)',
          borderRadius: '4px',
          boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
          paddingTop: '8px', paddingBottom: '8px',
          zIndex: 100,
          minWidth: '100%',
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '6px 16px',
                fontSize: '14px',
                border: 'none', cursor: 'pointer',
                background: opt.value === value ? 'rgba(25,118,210,0.12)' : 'transparent',
                color: opt.value === value ? '#1976d2' : 'var(--text-primary)',
                fontWeight: opt.value === value ? 600 : 400,
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(25,118,210,0.08)'; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────
export const UserStatusBadges = ({ user, variant = 'table' }: { user: UserAdminData, variant?: 'table' | 'detail' }) => {
  const badges = [];
  const now = new Date();
  const banStatusLabel = getBanStatusLabel(user.banUntil);
  const isBanned = !!banStatusLabel;
  const isMuted = user.muteUntil && new Date(user.muteUntil) > now;

  const renderBadge = (key: string, text: string, colorClass: string, detailColor: string) => {
    if (variant === 'table') {
      return (
        <span key={key} style={{padding:'0 3px'}} className={`inline-flex items-center px-2.5 py-1 rounded-xs text-xs font-medium ${colorClass}`}>
          {text}
        </span>
      );
    }
    return (
      <span key={key} style={{ padding: '5px 10px' }} className={`inline-flex items-center rounded text-[9px] font-bold ${detailColor} text-white uppercase tracking-wider shadow-sm`}>
        {text}
      </span>
    );
  };

  if (isBanned) {
    badges.push(renderBadge('ban', banStatusLabel!, 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', 'bg-[#e74c3c]'));
  } else if (user.isDisabled) {
    badges.push(renderBadge('disabled', 'Vô hiệu hóa', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', 'bg-[#e74c3c]'));
  } else {
    if (!user.isActive) {
      badges.push(renderBadge('unverified', 'Chưa xác thực', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', 'bg-[#e67e22]'));
    } else {
      badges.push(renderBadge('active', 'Hoạt động', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', 'bg-[#2ecc71]'));
    }
  }

  if (isMuted) {
    const muteDate = new Date(user.muteUntil!);
    const diffTime = Math.abs(muteDate.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    badges.push(renderBadge('mute', `Cấm chat ${diffDays} ngày`, 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400', 'bg-[#f39c12]'));
  }

  return <div className={`flex ${variant === 'table' ? 'flex-col items-start gap-1' : 'flex-wrap items-center gap-2 justify-center sm:justify-start mt-2'}`}>{badges}</div>;
};
// ────────────────────────────────────────────────────────────────────────────
export interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  placeholder?: string;
  valueClass?: string;
}

export function InfoItem({ icon, label, value, placeholder = 'Chưa xác định', valueClass = '' }: InfoItemProps) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--border)] last:border-b-0" style={{ padding: '10px 0' }}>
      <div className="w-9 h-9 flex items-center justify-center bg-[var(--bg-primary)] rounded-sm text-[var(--text-secondary)] shrink-0 border border-[var(--border)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
        <span className={`block text-sm font-semibold mt-0.5 break-all whitespace-normal ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] italic'} ${valueClass}`}>
          {value || placeholder}
        </span>
      </div>
    </div>
  );
}
