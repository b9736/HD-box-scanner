import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Trash2, ShieldAlert } from 'lucide-react';
import { useBoxes } from '../hooks/useBoxes';
import { ConfirmationModal } from '../components/ConfirmationModal';

const Trash = () => {
  const navigate = useNavigate();
  const { trashBoxes, restoreBox, deleteBoxPermanently, loading } = useBoxes();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'destructive' | 'primary';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const handleRestore = async (id: string) => {
    try {
      await restoreBox(id);
    } catch (err) {
      console.error(err);
      alert("Failed to restore box.");
    }
  };

  const handleDeletePermanent = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Permanently?',
      message: `Are you sure you want to permanently delete "${name}"? All items inside will be lost forever. This cannot be undone.`,
      type: 'destructive',
      onConfirm: async () => {
        try {
          await deleteBoxPermanently(id);
        } catch (err) {
          console.error(err);
          alert("Failed to delete box permanently.");
        }
      }
    });
  };

  const handleEmptyTrash = () => {
    if (trashBoxes.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Empty Trash?',
      message: `Are you sure you want to permanently delete all ${trashBoxes.length} boxes in the trash? All items inside these boxes will be lost forever.`,
      type: 'destructive',
      onConfirm: async () => {
        try {
          await Promise.all(trashBoxes.map(box => deleteBoxPermanently(box.id)));
        } catch (err) {
          console.error(err);
          alert("Failed to empty trash.");
        }
      }
    });
  };

  return (
    <div className="page-content">
      <header className="page-header-minimal">
        <button onClick={() => navigate(-1)} className="back-btn">
          <ArrowLeft size={24} />
        </button>
        <h2 className="header-title">Trash</h2>
        {trashBoxes.length > 0 && (
          <button 
            onClick={handleEmptyTrash} 
            className="view-toggle-btn"
            style={{ 
              color: '#ff453a', 
              backgroundColor: 'rgba(255, 69, 58, 0.1)', 
              border: '1px solid rgba(255, 69, 58, 0.2)',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Trash2 size={16} /> Empty Trash
          </button>
        )}
      </header>

      <div className="trash-container" style={{ padding: '0 20px 100px' }}>
        {loading ? (
          <p className="status-text">Loading deleted boxes...</p>
        ) : trashBoxes.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '80px', color: 'var(--text-secondary)' }}>
            <Trash2 size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>Your trash is empty.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              backgroundColor: 'rgba(255, 159, 10, 0.08)', 
              border: '1px solid rgba(255, 159, 10, 0.15)',
              padding: '12px 16px', 
              borderRadius: '16px',
              marginBottom: '8px'
            }}>
              <ShieldAlert size={20} color="#ff9f0a" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '13px', color: '#ff9f0a', fontWeight: '500', lineHeight: '1.4' }}>
                Items inside these boxes are preserved until permanently deleted. You can restore a box at any time to recover its full contents.
              </p>
            </div>

            {trashBoxes.map((box) => (
              <div 
                key={box.id} 
                className="box-item-row" 
                style={{ 
                  cursor: 'default',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: 'var(--surface-color)',
                  borderRadius: '24px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div className="box-row-main" style={{ flex: 1 }}>
                  <div className="box-row-icon" style={{ opacity: 0.5 }}>📦</div>
                  <div className="box-row-content">
                    <div className="box-row-title" style={{ opacity: 0.7 }}>
                      {box.name}
                    </div>
                    <div className="box-row-meta" style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', marginBottom: '6px' }}>
                      <span style={{
                        backgroundColor: 'var(--surface-hover)',
                        color: '#ffffff',
                        border: '1px solid var(--border-color)',
                        padding: '3px 8px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>
                        Location: {box.room || 'No Room'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleRestore(box.id)}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)', 
                      borderRadius: '12px',
                      padding: '10px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    title="Restore Box"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeletePermanent(box.id, box.name)}
                    style={{ 
                      background: 'rgba(255, 69, 58, 0.1)', 
                      border: '1px solid rgba(255, 69, 58, 0.2)', 
                      borderRadius: '12px',
                      padding: '10px',
                      color: '#ff453a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    title="Delete Permanently"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type as any}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Trash;
