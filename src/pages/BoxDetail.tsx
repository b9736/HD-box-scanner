import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Edit3, X, Camera } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getTagColor } from '../utils/tagColors';
import { getWarrantyStatus } from '../utils/warranty';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../hooks/useItems';
import { useBoxes } from '../hooks/useBoxes';
import { useGlobalTags } from '../hooks/useGlobalTags';
import { QRCodeCanvas } from 'qrcode.react';
import { compressImage, blobToBase64 } from '../utils/imageUtils';
import { ItemEditModal, ImageSourceModal, FullscreenGallery } from '../components/ItemModals';
import { ConfirmationModal } from '../components/ConfirmationModal';

const BoxDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [box, setBox] = useState<any>(null);
  const { items, loading: itemsLoading, addItem, removeItem, updateItem } = useItems(id || '');
  const { updateBox, deleteBox } = useBoxes();
  
  const { tags: globalTags } = useGlobalTags();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  const [newItemName, setNewItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{images: string[], index: number} | null>(null);
  const [imageSourceModal, setImageSourceModal] = useState<{type: 'box' | 'item' | 'receipt', itemId?: string} | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isClosingDiscard, setIsClosingDiscard] = useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [showExpired, setShowExpired] = useState(localStorage.getItem('showExpiredStatus') !== 'false');
  const [isDragging, setIsDragging] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'destructive' | 'primary';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const handleShowExpiredChange = (checked: boolean) => {
    setShowExpired(checked);
    localStorage.setItem('showExpiredStatus', String(checked));
  };

  const { user } = useAuth();

  useEffect(() => {
    const fetchBox = async () => {
      if (!id || !user) return; // Wait for auth to initialize

      try {
        const docRef = doc(db, "boxes", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Security check: ensure this box belongs to the current user
          if (data.uid !== user.uid) {
            console.error("Access denied: UID mismatch");
            navigate('/');
            return;
          }
          
          setBox({ id: docSnap.id, ...data });
          setEditName(data.name);
          setEditRoom(data.room);
          setEditTags(data.tags || []);
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error("Error fetching box:", err);
        navigate('/');
      }
    };
    fetchBox();
  }, [id, navigate, user]);

  const handleUpdateBox = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !editName) return;
    await updateBox(id, { name: editName, room: editRoom, tags: editTags });
    setBox({ ...box, name: editName, room: editRoom, tags: editTags });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    // Check if anything changed
    const hasChanged = editName !== box.name || 
                       editRoom !== box.room || 
                       JSON.stringify(editTags) !== JSON.stringify(box.tags || []);
    
    if (hasChanged) {
      setShowDiscardModal(true);
    } else {
      closeEditMode();
    }
  };

  const closeEditMode = () => {
    // Reset to original values
    setEditName(box.name);
    setEditRoom(box.room);
    setEditTags(box.tags || []);
    setIsEditing(false);
  };

  const handleConfirmDiscard = () => {
    setIsClosingDiscard(true);
    setTimeout(() => {
      closeEditMode();
      setShowDiscardModal(false);
      setIsClosingDiscard(false);
    }, 300);
  };

  const handleCancelDiscard = () => {
    setIsClosingDiscard(true);
    setTimeout(() => {
      setShowDiscardModal(false);
      setIsClosingDiscard(false);
    }, 300);
  };

  const handleAddTag = () => {
    if (newTag && !editTags.includes(newTag)) {
      setEditTags([...editTags, newTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(t => t !== tagToRemove));
  };

  const handleDeleteBox = async () => {
    if (!id) return;
    await deleteBox(id);
    navigate('/');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;
    await addItem(newItemName);
    setNewItemName('');
    setIsAdding(false);
  };

  const handleUploadFiles = async (files: File[], type: 'box' | 'item' | 'receipt', itemId?: string) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const processedImages = await Promise.all(files.map(async file => {
        const compressedBlob = await compressImage(file, 500, 0.3);
        return await blobToBase64(compressedBlob);
      }));

      if (type === 'box') {
        const currentImages = box.images || [];
        const newImages = [...currentImages, ...processedImages];
        await updateBox(id!, { images: newImages, imageUrl: newImages[0] });
        setBox({ ...box, images: newImages, imageUrl: newImages[0] });
      } else {
        const isReceipt = type === 'receipt';
        const field = isReceipt ? 'receipts' : 'images';
        const urlField = isReceipt ? 'receiptUrl' : 'imageUrl';
        
        const currentItem = items.find(i => i.id === itemId);
        if (currentItem) {
          const existingList = (currentItem as any)[field] || [];
          const newList = [...existingList, ...processedImages];
          const updates = { [field]: newList, [urlField]: newList[0] };
          await updateItem(itemId!, updates);
          
          if (editingItem && editingItem.id === itemId) {
            setEditingItem({ ...editingItem, ...updates });
          }
        }
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const contextJson = sessionStorage.getItem('uploadContext');
    if (files.length === 0 || !contextJson) return;

    const context = JSON.parse(contextJson);
    sessionStorage.removeItem('uploadContext'); 
    handleUploadFiles(files, context.type, context.itemId);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUploadFiles(files, 'box');
    }
  };

  if (!box) return <div className="page-content">Loading box...</div>;

  return (
    <div className="page-content">
      <header className="page-header-minimal no-print">
        <button onClick={() => navigate('/')} className="back-btn">
          <ArrowLeft size={24} />
        </button>
        <div className="header-actions">
          <Printer size={20} className="header-icon" onClick={handlePrint} />
          <Edit3 size={20} className="header-icon" onClick={() => setIsEditing(!isEditing)} />
          <Trash2 size={20} className="header-icon" onClick={() => setShowDeleteConfirm(true)} style={{color: '#ff453a'}} />
        </div>
      </header>

      {isEditing ? (
        <div className="edit-box-form-wrapper compact">
        <div className="edit-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="section-header" style={{ margin: 0, fontSize: '18px' }}>Edit Box Info</h2>
          <div className="edit-actions" style={{ marginTop: 0 }}>
            <button type="button" onClick={handleUpdateBox} className="submit-btn" style={{ padding: '6px 20px', borderRadius: '10px', fontSize: '13px' }}>Save</button>
            <button type="button" onClick={handleCancelEdit} className="cancel-btn" style={{ fontSize: '13px' }}>Cancel</button>
          </div>
        </div>
        <form onSubmit={handleUpdateBox} className="edit-box-form compact">
            <div className="form-row-compact">
              <div className="form-group flex-2">
                <label>Box Name</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  required 
                  autoComplete="off"
                />
              </div>
              <div className="form-group flex-1">
                <label>Location</label>
                <input 
                  type="text" 
                  placeholder="Attic..." 
                  value={editRoom} 
                  onChange={(e) => setEditRoom(e.target.value)} 
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Tags</label>
              <div className="edit-tags-container">
                {editTags?.map(tag => {
                  const colors = getTagColor(tag);
                  return (
                    <span 
                      key={tag} 
                      className="tag-pill"
                      style={{ 
                        backgroundColor: colors.bg, 
                        color: colors.text,
                        borderColor: colors.border
                      }}
                    >
                      {tag} <X size={14} onClick={() => handleRemoveTag(tag)} />
                    </span>
                  );
                })}
              </div>
              <div className="tag-input-wrapper" style={{ marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Add a tag..." 
                  value={newTag} 
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  style={{ border: 'none', backgroundColor: 'transparent' }}
                />
                <button type="button" className="tag-add-btn" onClick={handleAddTag} style={{ padding: '8px' }}>
                  <Plus size={20} />
                </button>
              </div>
              
              {/* Global Tag Suggestions */}
              {globalTags.length > 0 && (
                <div style={{marginTop: '12px'}}>
                  <div style={{fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px'}}>Quick Select Existing:</div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                    {globalTags
                      .filter(tag => !editTags.includes(tag)) // Don't show tags already added
                      .slice(0, 10) // Show top 10
                      .map(tag => {
                        const colors = getTagColor(tag);
                        return (
                          <span 
                            key={tag} 
                            onClick={() => setEditTags([...editTags, tag])}
                            style={{ 
                              fontSize: '11px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              color: colors.text,
                              cursor: 'pointer',
                              border: `1px solid ${colors.border}`
                            }}
                          >
                            + {tag}
                          </span>
                        );
                      })
                    }
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div className="box-hero" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="box-hero-info" style={{ padding: 0 }}>
              <h1 className="box-detail-title">Box: {box.name}</h1>
              <div className="box-room-large">{box.room || 'No Room'}</div>
              <div className="box-row-tags" style={{marginTop: '4px'}}>
                {box.tags?.map((tag: string) => {
                  const colors = getTagColor(tag);
                  return (
                    <span 
                      key={tag} 
                      className="row-tag" 
                      style={{ 
                        fontSize: '10px', 
                        padding: '2px 8px',
                        backgroundColor: colors.bg,
                        color: colors.text
                      }}
                    >
                      #{tag}
                    </span>
                  );
                })}
              </div>
            </div>
            {box.hasQRCode && (
              <div className="box-qr-card" style={{ padding: 0, marginTop: 0 }}>
                <QRCodeCanvas value={box.id} size={48} bgColor="#FFFFFF" fgColor="#000000" level="L" includeMargin={false} />
              </div>
            )}
          </div>

          <div className="box-gallery-section" style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '13px'}}>Box Photos (Auto-saved)</label>
            <div 
              className={`box-gallery-scroll ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {(box.images || []).map((img: string, idx: number) => (
                <div key={idx} className="gallery-item">
                  <img 
                    src={img} 
                    alt="" 
                    className="box-photo-thumb"
                    onClick={() => setFullscreenImage({ images: box.images!, index: idx })} 
                  />
                  <button 
                    type="button" 
                    className="delete-photo-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmModal({
                        isOpen: true,
                        title: 'Delete Photo',
                        message: 'Permanently delete this photo? Images are auto-saved.',
                        type: 'destructive',
                        onConfirm: () => {
                          const newImages = (box.images || []).filter((_: any, i: number) => i !== idx);
                          updateBox(id!, { images: newImages, imageUrl: newImages[0] || '' });
                          setBox({ ...box, images: newImages, imageUrl: newImages[0] });
                        }
                      });
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="add-photo-square" onClick={() => setImageSourceModal({ type: 'box' })}>
                {uploading ? '...' : <Camera size={24} />}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="items-section no-print">
        <div className="section-header-inline">
          <div className="section-header">Items ({items.length})</div>
          <button onClick={() => setIsAdding(true)} className="add-item-btn-small">
            <Plus size={16} /> Add
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleAddItem} className="add-item-inline-form">
            <input 
              autoFocus
              type="text" 
              placeholder="What's inside?" 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <div className="inline-edit-actions">
              <button type="submit" className="save-item-btn">Save</button>
              <button type="button" onClick={() => setIsAdding(false)} className="cancel-item-btn">Cancel</button>
            </div>
          </form>
        )}

        <div className="items-list">
          {itemsLoading ? (
            <p className="status-text">Loading...</p>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <p className="status-text">Empty box.</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="item-row" onClick={() => setEditingItem(item)}>
                <div className="item-row-left">
                  {item.imageUrl && (
                    <img 
                      src={item.imageUrl} 
                      className="item-mini-photo" 
                      alt="" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenImage({ images: item.images || [item.imageUrl as string], index: 0 });
                      }} 
                    />
                  )}
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <div className="item-meta-row">
                      <span className="item-qty">Quantity: {item.quantity || 1}</span>
                      {item.purchaseDate && (
                        <span className="item-meta-date">Purchased: {item.purchaseDate}</span>
                      )}
                      {item.warrantyExpire && (
                          (() => {
                            const status = getWarrantyStatus(item.warrantyExpire);
                            if (!showExpired && status?.isExpired) return null;
                            return (
                              <span className="item-meta-date" style={{ color: status?.color }}>
                                Warranty: {item.warrantyExpire} ({status?.text})
                              </span>
                            );
                          })()
                        )}
                    </div>
                    {item.tags && item.tags.length > 0 && (
                      <div className="item-row-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {item.tags.map(tag => {
                          const colors = getTagColor(tag);
                          return (
                            <span 
                              key={tag} 
                              className="item-tag-pill" 
                              style={{ 
                                fontSize: '9px', 
                                padding: '1px 6px', 
                                backgroundColor: colors.bg, 
                                color: colors.text,
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                fontWeight: '700'
                              }}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="item-row-actions">
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="delete-item-btn">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editingItem && (
        <ItemEditModal 
          item={editingItem} 
          showExpired={showExpired}
          isUploading={uploading}
          onShowExpiredChange={handleShowExpiredChange}
          onClose={() => setEditingItem(null)} 
          onUpdate={async (updates) => {
            try {
              await updateItem(editingItem.id, updates);
              setEditingItem(null);
            } catch (err: any) {
              console.error("Update failed:", err);
              alert(`Error: ${err.message || "Failed to save changes."}`);
              throw err; 
            }
          }}
          onImageRequest={(type) => {
            setImageSourceModal({type, itemId: editingItem.id});
          }}
          onPreviewImage={(images, index) => setFullscreenImage({images, index})}
        />
      )}

      {imageSourceModal && (
        <ImageSourceModal 
          onSelect={(source) => {
            sessionStorage.setItem('uploadContext', JSON.stringify(imageSourceModal));
            if (source === 'camera') cameraInputRef.current?.click();
            else fileInputRef.current?.click();
            setImageSourceModal(null);
          }}
          onClose={() => setImageSourceModal(null)}
        />
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        hidden 
        accept="image/*" 
        onChange={(e) => handleImageSelect(e)} 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        hidden 
        accept="image/*" 
        capture="environment" 
        onChange={(e) => handleImageSelect(e)} 
      />

      {/* Fullscreen Gallery */}
      {fullscreenImage && (
        <FullscreenGallery 
          images={fullscreenImage.images} 
          initialIndex={fullscreenImage.index} 
          onClose={() => setFullscreenImage(null)} 
          currentThumbnail={box.imageUrl}
          onSetThumbnail={(url) => {
            const newUrl = box.imageUrl === url ? '' : url;
            updateBox(id!, { imageUrl: newUrl });
            setBox({ ...box, imageUrl: newUrl });
          }}
        />
      )}

      {/* Discard Changes Modal */}
      {showDiscardModal && (
        <div className={`action-sheet-overlay ${isClosingDiscard ? 'fade-out' : ''}`} onClick={handleCancelDiscard}>
          <div className={`action-sheet ${isClosingDiscard ? 'slide-down' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="action-sheet-header">
              <h3>Discard changes?</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px'}}>You have unsaved changes in this box.</p>
            </div>
            <div className="action-sheet-options">
              <button className="option-btn destructive" onClick={handleConfirmDiscard}>Discard Changes</button>
              <button className="option-btn" onClick={handleCancelDiscard}>Keep Editing</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Box Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="action-sheet-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="action-sheet" onClick={e => e.stopPropagation()}>
            <div className="action-sheet-header">
              <h3>Delete Box?</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px'}}>
                Are you sure you want to delete this box and all its contents? This action cannot be undone.
              </p>
            </div>
            <div className="action-sheet-options">
              <button className="option-btn destructive" onClick={handleDeleteBox}>Delete Everything</button>
              <button className="option-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
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
export default BoxDetail;
