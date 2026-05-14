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
  confirmString?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'primary',
  confirmString
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setInputValue('');
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const handleConfirm = () => {
    if (confirmString && inputValue !== confirmString) return;
    onConfirm();
    handleClose();
  };

  const isConfirmDisabled = !!confirmString && inputValue !== confirmString;

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

        {confirmString && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.03)', 
              padding: '12px', 
              borderRadius: '12px', 
              marginBottom: '16px',
              border: '1px dashed var(--border-color)',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                To confirm deletion, please type:
              </p>
              <code style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '700', letterSpacing: '0.5px' }}>
                {confirmString}
              </code>
            </div>
            <input 
              type="text" 
              placeholder="Enter email here"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '12px', 
                backgroundColor: 'var(--bg-color)', 
                color: 'var(--text-primary)',
                border: '2px solid var(--border-color)',
                textAlign: 'center',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>
        )}
        
        <div className="action-sheet-options">
          <button 
            className={`option-btn ${type === 'destructive' ? 'destructive' : 'primary'}`} 
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            style={{ opacity: isConfirmDisabled ? 0.4 : 1, cursor: isConfirmDisabled ? 'not-allowed' : 'pointer' }}
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
