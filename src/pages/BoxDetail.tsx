import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Edit3 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getTagColor } from '../utils/tagColors';
import { getWarrantyStatus } from '../utils/warranty';
import { db, storage } from '../firebase';
import { useItems } from '../hooks/useItems';
import { useBoxes } from '../hooks/useBoxes';
import { useGlobalTags } from '../hooks/useGlobalTags';
import { QRCodeCanvas } from 'qrcode.react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, X } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

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
  const [newTag, setNewTag] = useState('');
  
  const [newItemName, setNewItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [imageSourceModal, setImageSourceModal] = useState<{type: 'box' | 'item' | 'receipt', itemId?: string} | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isClosingDiscard, setIsClosingDiscard] = useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const uploadContextRef = React.useRef<{type: 'box' | 'item' | 'receipt', itemId?: string} | null>(null);
  const [showExpired, setShowExpired] = useState(localStorage.getItem('showExpiredStatus') !== 'false');

  const handleShowExpiredChange = (checked: boolean) => {
    setShowExpired(checked);
    localStorage.setItem('showExpiredStatus', String(checked));
  };

  useEffect(() => {
    const fetchBox = async () => {
      if (!id) return;
      const docRef = doc(db, "boxes", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBox({ id: docSnap.id, ...data });
        setEditName(data.name);
        setEditRoom(data.room);
        setEditTags(data.tags || []);
      } else {
        navigate('/');
      }
    };
    fetchBox();
  }, [id, navigate]);

  const handleUpdateBox = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !editName) return;
    await updateBox(id, editName, editRoom, editTags);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `boxes/${id}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateBox(id, box.name, box.room, box.tags || [], url);
      setBox({ ...box, imageUrl: url });
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Photo upload failed. Did you enable Firebase Storage?");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBox = async () => {
    if (!id) return;
    if (window.confirm("Are you sure you want to delete this box and all its contents?")) {
      await deleteBox(id);
      navigate('/');
    }
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const context = uploadContextRef.current;
    if (!file || !context) {
      console.log("No file or context", { file, context });
      return;
    }

    setUploading(true);
    const { type, itemId } = context;
    uploadContextRef.current = null; // Clear context

    try {
      console.log(`Starting ${type} upload...`);
      if (type === 'box') {
        const storageRef = ref(storage, `boxes/${id}`);
        console.log("Compressing box image...");
        const compressedBlob = await compressImage(file);
        await uploadBytes(storageRef, compressedBlob);
        const url = await getDownloadURL(storageRef);
        await updateBox(id!, box.name, box.room, box.tags || [], url);
        setBox({ ...box, imageUrl: url });
      } else {
        const storageRef = ref(storage, `items/${itemId}_${type}`);
        console.log(`Compressing ${type} image...`);
        const compressedBlob = await compressImage(file);
        await uploadBytes(storageRef, compressedBlob);
        const url = await getDownloadURL(storageRef);
        await updateItem(itemId!, { [type === 'item' ? 'imageUrl' : 'receiptUrl']: url });
        
        // If we are currently editing this item, update the editingItem state to reflect the change
        if (editingItem && editingItem.id === itemId) {
          setEditingItem({
            ...editingItem,
            [type === 'item' ? 'imageUrl' : 'receiptUrl']: url
          });
        }
      }
      console.log("Upload complete!");
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
      // Clear input values so the same file can be picked again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
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
          <Trash2 size={20} className="header-icon" onClick={handleDeleteBox} style={{color: '#ff453a'}} />
        </div>
      </header>

      {isEditing ? (
        <div className="edit-box-form-wrapper">
        <div className="edit-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 className="section-header" style={{ margin: 0 }}>Edit Box Info</h2>
          <div className="edit-actions" style={{ marginTop: 0 }}>
            <button type="button" onClick={handleUpdateBox} className="submit-btn" style={{ padding: '8px 24px', borderRadius: '12px', fontSize: '14px' }}>Save</button>
            <button type="button" onClick={handleCancelEdit} className="cancel-btn" style={{ fontSize: '14px' }}>Cancel</button>
          </div>
        </div>
        <form onSubmit={handleUpdateBox} className="edit-box-form">
            <div className="form-group">
              <label>Box Name</label>
              <input 
                type="text" 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                required 
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input 
                type="text" 
                placeholder="e.g. Attic, Garage" 
                value={editRoom} 
                onChange={(e) => setEditRoom(e.target.value)} 
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
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
              <div className="add-tag-inline">
                <input 
                  type="text" 
                  placeholder="Add a tag..." 
                  value={newTag} 
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <button type="button" onClick={handleAddTag}>Add</button>
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
        <div className="box-hero">
          <div className="box-photo-container no-print">
            {box.imageUrl ? (
              <img src={box.imageUrl} alt={box.name} className="box-photo" />
            ) : (
              <div className="photo-upload-label" onClick={() => setImageSourceModal({type: 'box'})}>
                {uploading ? "..." : <Camera size={18} />}
              </div>
            )}
          </div>
          <div className="box-hero-info">
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
          <div className="box-qr-card">
            <QRCodeCanvas value={box.id} size={36} bgColor="#FFFFFF" fgColor="#000000" level="L" includeMargin={false} />
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
                  {item.imageUrl && <img src={item.imageUrl} className="item-mini-photo" alt="" />}
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
        />
      )}

      {imageSourceModal && (
        <ImageSourceModal 
          onSelect={(source) => {
            uploadContextRef.current = imageSourceModal;
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
    </div>
  );
};

const ImageSourceModal: React.FC<{onSelect: (s: 'camera' | 'gallery') => void, onClose: () => void}> = ({ onSelect, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleSelect = (s: 'camera' | 'gallery') => {
    setIsClosing(true);
    setTimeout(() => onSelect(s), 300);
  };

  return (
    <div className={`modal-overlay action-sheet-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`action-sheet ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="action-btn" onClick={() => handleSelect('camera')}>
          <Camera size={20} /> Take Photo (Camera)
        </button>
        <button className="action-btn" onClick={() => handleSelect('gallery')}>
          <Printer size={20} /> Upload from Gallery
        </button>
        <div className="action-divider" />
        <button className="close-btn" style={{width: '100%', padding: '16px'}} onClick={handleClose}>Close</button>
      </div>
    </div>
  );
};

interface ItemEditModalProps {
  item: any;
  showExpired: boolean;
  onShowExpiredChange: (checked: boolean) => void;
  onClose: () => void;
  onUpdate: (updates: any) => Promise<void>;
  onImageRequest: (type: 'item' | 'receipt') => void;
}

const ItemEditModal: React.FC<ItemEditModalProps> = ({ item, showExpired, onShowExpiredChange, onClose, onUpdate, onImageRequest }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity || 1);
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate || '');
  const [warrantyExpire, setWarrantyExpire] = useState(item.warrantyExpire || '');
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState<'item' | 'receipt' | null>(null);
  const [saved, setSaved] = useState(false);
  const [imageUrl, setImageUrl] = useState(item.imageUrl || '');
  const [receiptUrl, setReceiptUrl] = useState(item.receiptUrl || '');

  // Sync with item prop changes (e.g. from background uploads)
  useEffect(() => {
    if (item.imageUrl !== imageUrl) setImageUrl(item.imageUrl || '');
    if (item.receiptUrl !== receiptUrl) setReceiptUrl(item.receiptUrl || '');
  }, [item.imageUrl, item.receiptUrl]);

  const warrantyStatus = getWarrantyStatus(warrantyExpire);

  // Auto-calculate warranty
  const handlePurchaseDateChange = (date: string) => {
    setPurchaseDate(date);
    
    if (date) {
      const val = parseInt(localStorage.getItem('defaultWarrantyValue') || '2');
      const unit = localStorage.getItem('defaultWarrantyUnit') || 'years';
      
      // Use T00:00:00 to ensure we treat the input as local time, not UTC
      const pDate = new Date(date + 'T00:00:00');
      if (unit === 'days') pDate.setDate(pDate.getDate() + val);
      else if (unit === 'months') pDate.setMonth(pDate.getMonth() + val);
      else if (unit === 'years') pDate.setFullYear(pDate.getFullYear() + val);
      
      // Convert back to YYYY-MM-DD format in local time
      const year = pDate.getFullYear();
      const month = String(pDate.getMonth() + 1).padStart(2, '0');
      const day = String(pDate.getDate()).padStart(2, '0');
      setWarrantyExpire(`${year}-${month}-${day}`);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'item' | 'receipt') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingType(type);
    try {
      const storageRef = ref(storage, `items/${item.id}_${type}`);
      console.log(`Compressing modal ${type} image...`);
      const compressedBlob = await compressImage(file);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);
      if (type === 'item') setImageUrl(url);
      else setReceiptUrl(url);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdate({
        name,
        quantity: Number(quantity),
        purchaseDate,
        warrantyExpire,
        imageUrl,
        receiptUrl
      });
      handleClose(); // Use handleClose for animation
    } catch (err) {
      console.error("Submit error", err);
    } finally {
      setSaving(false);
    }
  };

  const handleImageRequest = (type: 'item' | 'receipt') => {
    onImageRequest(type);
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Item</h3>
          <button className="close-btn" type="button" onClick={handleClose}>Close</button>
        </div>
        
        <form onSubmit={handleSubmit} className="item-edit-form">
          <div className="form-row-images">
            <div className="photo-box" onClick={() => handleImageRequest('item')}>
              {item.imageUrl || imageUrl ? <img src={imageUrl || item.imageUrl} /> : <Camera size={24} />}
              <span>{uploadingType === 'item' ? '...' : 'Item Photo'}</span>
            </div>
            <div className="photo-box" onClick={() => handleImageRequest('receipt')}>
              {item.receiptUrl || receiptUrl ? <img src={receiptUrl || item.receiptUrl} /> : <Printer size={24} />}
              <span>{uploadingType === 'receipt' ? '...' : 'Receipt'}</span>
            </div>
          </div>

          <div className="form-group">
            <label>Item Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Quantity</label>
            <div className="qty-stepper">
              <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
              <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
              <button type="button" onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Purchase Date</label>
              <input 
                type="date" 
                value={purchaseDate} 
                onChange={e => handlePurchaseDateChange(e.target.value)} 
                onClick={(e) => e.currentTarget.showPicker?.()} 
              />
            </div>

            <div className="form-group">
              <label>
                Warranty Expire
                {warrantyStatus && (
                  (() => {
                    if (!showExpired && warrantyStatus.isExpired) return null;
                    return (
                      <span style={{ color: warrantyStatus.color, fontWeight: 700, marginLeft: '4px' }}>
                        ({warrantyStatus.text})
                      </span>
                    );
                  })()
                )}
              </label>
              <input 
                type="date" 
                value={warrantyExpire} 
                onChange={e => setWarrantyExpire(e.target.value)} 
                onClick={(e) => e.currentTarget.showPicker?.()} 
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '4px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <input 
                type="checkbox" 
                checked={showExpired} 
                onChange={(e) => onShowExpiredChange(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Show Expired in Items Card
            </label>
          </div>

          <button type="submit" className="submit-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BoxDetail;
