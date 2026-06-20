import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlayClick?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, footer, closeOnOverlayClick = true }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button
            className="btn btn-secondary btn-icon"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
