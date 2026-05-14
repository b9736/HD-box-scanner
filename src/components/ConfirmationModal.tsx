import React, { useState, useEffect } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'destructive' | 'primary' | 'warning';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'primary'
}) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) setIsClosing(false);
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div className={`action-sheet-overlay ${isClosing ? 'fade-out' : ''}`} onClick={handleClose}>
      <div className={`action-sheet ${isClosing ? 'slide-down' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="action-sheet-header">
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '16px', 
            backgroundColor: type === 'destructive' ? 'rgba(255, 69, 58, 0.1)' : 'rgba(62, 130, 247, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            {type === 'destructive' ? (
              <Trash2 size={24} color="var(--error-color)" />
            ) : (
              <AlertCircle size={24} color="var(--primary-color)" />
            )}
          </div>
          <h3>{title}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
            {message}
          </p>
        </div>
        
        <div className="action-sheet-options">
          <button 
            className={`option-btn ${type === 'destructive' ? 'destructive' : 'primary'}`} 
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
          <button className="option-btn" onClick={handleClose}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};
