
import { useState, useEffect } from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
  countdown?: number;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  onConfirm,
  onCancel,
  isDanger = false,
  countdown = 0,
}: ConfirmModalProps) {
  const [timer, setTimer] = useState(countdown);

  useEffect(() => {
    if (isOpen) {
      setTimer(countdown);
    }
  }, [isOpen, countdown]);

  useEffect(() => {
    if (isOpen && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen, timer]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            disabled={timer > 0}
            onClick={async () => {
              const shouldClose = await onConfirm();
              if (shouldClose !== false) {
                onCancel();
              }
            }}
          >
            {timer > 0 ? `${confirmText} (${timer})` : confirmText}
          </button>
        </div>
      }
    >
      <div style={{ padding: '10px 0', fontSize: '14.5px', color: 'var(--text-secondary)' }}>
        {message}
      </div>
    </Modal>
  );
}
