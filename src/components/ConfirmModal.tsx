
import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => any;
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
  const [isLoading, setIsLoading] = useState(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTimer(countdown);
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  }, [isOpen, countdown, title]);

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
      onClose={isLoading ? () => {} : onCancel}
      title={title}
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </button>
          <button
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            disabled={timer > 0 || isLoading}
            onClick={async () => {
              if (isProcessingRef.current) return;
              isProcessingRef.current = true;
              try {
                setIsLoading(true);
                const shouldClose = await onConfirm();
                if (shouldClose !== false) {
                  onCancel();
                }
              } finally {
                // If it doesn't close, or if there's an error, we turn off loading state
                setIsLoading(false);
                isProcessingRef.current = false;
              }
            }}
          >
            {isLoading ? 'Đang xử lý...' : timer > 0 ? `${confirmText} (${timer})` : confirmText}
          </button>
        </div>
      }
    >
      <div style={{ padding: '10px 0', fontSize: '14.5px', color: 'var(--text-secondary)', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
        {message}
      </div>
    </Modal>
  );
}
