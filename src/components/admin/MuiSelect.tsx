import { useState, useEffect, useRef } from 'react';

export interface MuiSelectProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  minWidth?: number | string;
  labelBgColor?: string;
  height?: string;
  marginBottom?: string;
}

export function MuiSelect({ label, value, onChange, options, minWidth = 140, labelBgColor = 'var(--bg-primary)', height = '34px', marginBottom = '0px' }: MuiSelectProps) {
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
    <div ref={ref} style={{ position: 'relative', minWidth, marginBottom }} className="mui-select-container">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          height: height,
          padding: '0 20px 0 12px',
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
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span className="truncate pr-4">{selectedLabel}</span>
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
      
      {/* Floating label (if provided) */}
      {label && (
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
      )}

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
