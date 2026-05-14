import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Image, Plus, ArrowLeft, Star, Tag, Edit2, Trash2 } from 'lucide-react';
import { getWarrantyStatus } from '../utils/warranty';
import { useItemTags } from '../hooks/useItemTags';
import { getTagColor } from '../utils/tagColors';
import { ConfirmationModal } from './ConfirmationModal';

export const ImageSourceModal: React.FC<{onSelect: (s: 'camera' | 'gallery') => void, onClose: () => void}> = ({ onSelect, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleSelect = (s: 'camera' | 'gallery') => {
    onSelect(s);
  };

  return (
    <div className={`action-sheet-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`action-sheet ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="action-btn" onClick={() => handleSelect('camera')}>
          <Camera size={20} /> Take Photo (Camera)
        </button>
        <button className="action-btn" onClick={() => handleSelect('gallery')}>
          <Image size={20} /> Upload from Gallery
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
  isUploading: boolean;
  onShowExpiredChange: (checked: boolean) => void;
  onClose: () => void;
  onUpdate: (updates: any) => Promise<void>;
  onImageRequest: (type: 'item' | 'receipt') => void;
  onPreviewImage: (images: string[], index: number) => void;
  onAddTag?: (name: string) => void;
  onDrop?: (type: 'item' | 'receipt', files: FileList) => void;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({ 
  item, 
  showExpired, 
  isUploading,
  onShowExpiredChange, 
  onClose, 
  onUpdate, 
  onImageRequest,
  onPreviewImage,
  onAddTag,
  onDrop
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [dragType, setDragType] = useState<'item' | 'receipt' | null>(null);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity || 1);
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate || '');
  const [warrantyExpire, setWarrantyExpire] = useState(item.warrantyExpire || '');
  const [description, setDescription] = useState(item.description || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(item.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'destructive' | 'primary';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [imageUrl, setImageUrl] = useState(item.imageUrl || '');
  const [receiptUrl, setReceiptUrl] = useState(item.receiptUrl || '');
  const { tags: allAvailableTags } = useItemTags();

  useEffect(() => {
    if (item.imageUrl !== imageUrl) setImageUrl(item.imageUrl || '');
    if (item.receiptUrl !== receiptUrl) setReceiptUrl(item.receiptUrl || '');
  }, [item.imageUrl, item.receiptUrl]);

  const warrantyStatus = getWarrantyStatus(warrantyExpire);

  const handlePurchaseDateChange = (date: string) => {
    setPurchaseDate(date);
    if (date) {
      const val = parseInt(localStorage.getItem('defaultWarrantyValue') || '2');
      const unit = localStorage.getItem('defaultWarrantyUnit') || 'years';
      const pDate = new Date(date + 'T00:00:00');
      if (unit === 'days') pDate.setDate(pDate.getDate() + val);
      else if (unit === 'months') pDate.setMonth(pDate.getMonth() + val);
      else if (unit === 'years') pDate.setFullYear(pDate.getFullYear() + val);
      
      const year = pDate.getFullYear();
      const month = String(pDate.getMonth() + 1).padStart(2, '0');
      const day = String(pDate.getDate()).padStart(2, '0');
      setWarrantyExpire(`${year}-${month}-${day}`);
    }
  };

  const hasChanges = 
    name !== item.name || 
    Number(quantity) !== (item.quantity || 1) || 
    purchaseDate !== (item.purchaseDate || '') ||
    warrantyExpire !== (item.warrantyExpire || '') ||
    description !== (item.description || '') ||
    JSON.stringify([...selectedTags].sort()) !== JSON.stringify([...(item.tags || [])].sort()) ||
    tagInput !== '';

  const handleDragOver = (e: React.DragEvent, type: 'item' | 'receipt') => {
    e.preventDefault();
    setDragType(type);
  };

  const handleDragLeave = () => {
    setDragType(null);
  };

  const handleDrop = (e: React.DragEvent, type: 'item' | 'receipt') => {
    e.preventDefault();
    setDragType(null);
    if (e.dataTransfer.files.length > 0 && onDrop) {
      onDrop(type, e.dataTransfer.files);
    }
  };

  const handleCloseAttempt = () => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const manualTags = tagInput.split(',').map(t => t.trim()).filter(t => t !== '');
      const finalTags = Array.from(new Set([...selectedTags, ...manualTags]));
      
      await onUpdate({
        name,
        quantity: Number(quantity),
        purchaseDate,
        warrantyExpire,
        description,
        tags: finalTags,
        imageUrl,
        receiptUrl
      });
      handleClose();
    } catch (err) {
      console.error("Submit error", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCommitTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tagInput.trim()) return;
    
    const newTags = tagInput.split(',').map(t => t.trim()).filter(t => t !== '');
    // Add to global collection if callback exists
    if (onAddTag) {
      newTags.forEach(t => onAddTag(t));
    }
    setSelectedTags(prev => Array.from(new Set([...prev, ...newTags])));
    setTagInput('');
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header sticky-header">
          <div className="modal-header-left">
            <h3>Edit Item</h3>
            <button className="submit-btn compact-save" type="submit" disabled={saving} onClick={handleSubmit}>
              {saving ? '...' : 'Save'}
            </button>
          </div>
          <button className="close-btn" type="button" onClick={handleCloseAttempt}>Close</button>
        </div>
        
        <form onSubmit={handleSubmit} className="item-edit-form">
          <div className="form-row-gallery" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div 
              className={`gallery-section ${dragType === 'item' ? 'drag-active' : ''}`} 
              style={{ flex: '1 1 200px', minWidth: '150px', marginBottom: 0, textAlign: 'left', borderRadius: '12px', border: dragType === 'item' ? '2px dashed var(--primary-color)' : '2px dashed transparent', padding: '4px' }}
              onDragOver={(e) => handleDragOver(e, 'item')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'item')}
            >
              <label>Item Photos</label>
              <div className="modal-gallery-scroll">
                {(item.images || []).map((img: string, idx: number) => (
                  <div key={idx} className="modal-gallery-item">
                    <img src={img} alt="" onClick={() => onPreviewImage(item.images || [], idx)} />
                    <button type="button" className="delete-photo-btn" onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Delete Photo',
                        message: 'Permanently delete this photo? Images are auto-saved.',
                        type: 'destructive',
                        onConfirm: () => {
                          const newImages = item.images.filter((_: any, i: number) => i !== idx);
                          onUpdate({ ...item, images: newImages, imageUrl: newImages[0] || '' });
                        }
                      });
                    }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="add-photo-box" onClick={() => onImageRequest('item')}>
                  {isUploading ? '...' : <Camera size={20} />}
                </div>
              </div>
            </div>

            <div 
              className={`gallery-section ${dragType === 'receipt' ? 'drag-active' : ''}`} 
              style={{ flex: '1 1 200px', minWidth: '150px', marginBottom: 0, textAlign: 'left', borderRadius: '12px', border: dragType === 'receipt' ? '2px dashed var(--primary-color)' : '2px dashed transparent', padding: '4px' }}
              onDragOver={(e) => handleDragOver(e, 'receipt')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'receipt')}
            >
              <label>Receipts & Docs</label>
              <div className="modal-gallery-scroll">
                {(item.receipts || []).map((img: string, idx: number) => (
                  <div key={idx} className="modal-gallery-item">
                    <img src={img} alt="" onClick={() => onPreviewImage(item.receipts || [], idx)} />
                    <button type="button" className="delete-photo-btn" onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Delete Receipt',
                        message: 'Permanently delete this receipt/document?',
                        type: 'destructive',
                        onConfirm: () => {
                          const newReceipts = item.receipts.filter((_: any, i: number) => i !== idx);
                          onUpdate({ ...item, receipts: newReceipts, receiptUrl: newReceipts[0] || '' });
                        }
                      });
                    }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="add-photo-box" onClick={() => onImageRequest('receipt')}>
                  {isUploading ? '...' : <Plus size={20} />}
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Item Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Notes, specs, or where exactly in the box..."
              className="premium-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Tags</label>
            {selectedTags.length > 0 && (
              <div className="edit-tags-container" style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedTags.map(tag => {
                  const colors = getTagColor(tag);
                  return (
                    <span 
                      key={tag} 
                      className="tag-pill" 
                      style={{ 
                        backgroundColor: colors.bg, 
                        color: colors.text, 
                        borderColor: colors.border,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid'
                      }}
                    >
                      {tag} <X size={14} onClick={() => handleTagToggle(tag)} style={{ cursor: 'pointer', opacity: 0.7 }} />
                    </span>
                  );
                })}
              </div>
            )}
            <div className="tag-input-wrapper" style={{ marginBottom: '12px' }}>
              <input 
                type="text" 
                value={tagInput} 
                onChange={e => setTagInput(e.target.value)} 
                placeholder="tools, electronics..." 
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleCommitTag())}
                style={{ border: 'none', backgroundColor: 'transparent' }}
              />
              <button type="button" className="tag-add-btn" onClick={handleCommitTag} style={{ padding: '8px' }}>
                <Plus size={20} />
              </button>
            </div>
              <div className="tag-suggestions">
                {allAvailableTags
                  .filter(tag => !selectedTags.includes(tag))
                  .map(tag => {
                  const colors = getTagColor(tag);
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`suggestion-chip ${isSelected ? 'active' : ''}`}
                      style={{ 
                        backgroundColor: isSelected ? colors.activeBg : 'rgba(255,255,255,0.05)',
                        color: colors.text,
                        borderColor: isSelected ? colors.text : 'rgba(255,255,255,0.1)'
                      }}
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
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
              <input type="date" value={purchaseDate} onChange={e => handlePurchaseDateChange(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
            </div>
            <div className="form-group">
              <label>
                Warranty Expire
                {warrantyStatus && (
                  (() => {
                    if (!showExpired && warrantyStatus.isExpired) return null;
                    return <span style={{ color: warrantyStatus.color, fontWeight: 700, marginLeft: '4px' }}>({warrantyStatus.text})</span>;
                  })()
                )}
              </label>
              <input type="date" value={warrantyExpire} onChange={e => setWarrantyExpire(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '4px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <input type="checkbox" checked={showExpired} onChange={(e) => onShowExpiredChange(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              Show Expired in Items Card
            </label>
          </div>
        </form>
      </div>

      {showDiscardConfirm && (
        <div className="action-sheet-overlay" onClick={() => setShowDiscardConfirm(false)}>
          <div className="action-sheet" onClick={e => e.stopPropagation()}>
            <div className="action-sheet-header">
              <h3>Unsaved Changes</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px'}}>
                You have made changes to this item. Would you like to save them?
              </p>
            </div>
            <div className="action-sheet-options">
              <button className="option-btn primary" onClick={(e) => { e.preventDefault(); handleSubmit(e as any); }}>
                Save & Close
              </button>
              <button className="option-btn destructive" onClick={handleClose}>
                Discard Changes
              </button>
              <button className="option-btn" onClick={() => setShowDiscardConfirm(false)}>
                Keep Editing
              </button>
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

export interface ItemAddModalProps {
  boxes: any[];
  isUploading: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onImageRequest: (type: 'item' | 'receipt') => void;
  onPreviewImage: (images: string[], index: number) => void;
  onAddTag?: (name: string) => void;
  tempImages?: string[];
  tempReceipts?: string[];
  onRemoveTempImage?: (type: 'item' | 'receipt', index: number) => void;
  onDrop?: (type: 'item' | 'receipt', files: FileList) => void;
}

export const ItemAddModal: React.FC<ItemAddModalProps> = ({
  boxes,
  isUploading,
  onClose,
  onSave,
  onImageRequest,
  onPreviewImage,
  onAddTag,
  tempImages = [],
  tempReceipts = [],
  onRemoveTempImage,
  onDrop
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [dragType, setDragType] = useState<'item' | 'receipt' | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpire, setWarrantyExpire] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [saving, setSaving] = useState(false);
  const { tags: allAvailableTags } = useItemTags();

  const handleDragOver = (e: React.DragEvent, type: 'item' | 'receipt') => {
    e.preventDefault();
    setDragType(type);
  };

  const handleDragLeave = () => {
    setDragType(null);
  };

  const handleDrop = (e: React.DragEvent, type: 'item' | 'receipt') => {
    e.preventDefault();
    setDragType(null);
    if (e.dataTransfer.files.length > 0 && onDrop) {
      onDrop(type, e.dataTransfer.files);
    }
  };

  const handlePurchaseDateChange = (date: string) => {
    setPurchaseDate(date);
    if (date) {
      const val = parseInt(localStorage.getItem('defaultWarrantyValue') || '2');
      const unit = localStorage.getItem('defaultWarrantyUnit') || 'years';
      const pDate = new Date(date + 'T00:00:00');
      if (unit === 'days') pDate.setDate(pDate.getDate() + val);
      else if (unit === 'months') pDate.setMonth(pDate.getMonth() + val);
      else if (unit === 'years') pDate.setFullYear(pDate.getFullYear() + val);
      
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const manualTags = tagInput.split(',').map(t => t.trim()).filter(t => t !== '');
      const finalTags = Array.from(new Set([...selectedTags, ...manualTags]));
      
      await onSave({
        name,
        quantity: Number(quantity),
        purchaseDate,
        warrantyExpire,
        description,
        tags: finalTags,
        boxId: selectedBoxId,
        images: tempImages,
        receipts: tempReceipts
      });
      handleClose();
    } catch (err) {
      console.error("Save error", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header sticky-header">
          <div className="modal-header-left">
            <h3>Add New Item</h3>
            <button className="submit-btn compact-save" type="submit" disabled={saving || !name.trim()} onClick={handleSubmit}>
              {saving ? '...' : 'Save'}
            </button>
          </div>
          <button className="close-btn" type="button" onClick={handleClose}>Close</button>
        </div>

        <form onSubmit={handleSubmit} className="item-edit-form">
          <div className="form-row-gallery" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div 
              className={`gallery-section ${dragType === 'item' ? 'drag-active' : ''}`} 
              style={{ flex: '1 1 200px', minWidth: '150px', marginBottom: 0, textAlign: 'left', borderRadius: '12px', border: dragType === 'item' ? '2px dashed var(--primary-color)' : '2px dashed transparent', padding: '4px' }}
              onDragOver={(e) => handleDragOver(e, 'item')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'item')}
            >
              <label>Item Photos</label>
              <div className="modal-gallery-scroll">
                {tempImages.map((img, idx) => (
                  <div key={idx} className="modal-gallery-item">
                    <img src={img} alt="" onClick={() => onPreviewImage(tempImages, idx)} />
                    <button type="button" className="delete-photo-btn" onClick={() => onRemoveTempImage?.('item', idx)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="add-photo-box" onClick={() => onImageRequest('item')}>
                  {isUploading ? '...' : <Camera size={20} />}
                </div>
              </div>
            </div>

            <div 
              className={`gallery-section ${dragType === 'receipt' ? 'drag-active' : ''}`} 
              style={{ flex: '1 1 200px', minWidth: '150px', marginBottom: 0, textAlign: 'left', borderRadius: '12px', border: dragType === 'receipt' ? '2px dashed var(--primary-color)' : '2px dashed transparent', padding: '4px' }}
              onDragOver={(e) => handleDragOver(e, 'receipt')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'receipt')}
            >
              <label>Receipts & Docs</label>
              <div className="modal-gallery-scroll">
                {tempReceipts.map((img, idx) => (
                  <div key={idx} className="modal-gallery-item">
                    <img src={img} alt="" onClick={() => onPreviewImage(tempReceipts, idx)} />
                    <button type="button" className="delete-photo-btn" onClick={() => onRemoveTempImage?.('receipt', idx)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="add-photo-box" onClick={() => onImageRequest('receipt')}>
                  {isUploading ? '...' : <Plus size={20} />}
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Item Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="What are you adding?" autoFocus />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" />
            </div>
            <div className="form-group">
              <label>Select Box (Optional)</label>
              <select value={selectedBoxId} onChange={e => setSelectedBoxId(e.target.value)} className="premium-select">
                <option value="">Unassigned</option>
                {boxes.map(box => (
                  <option key={box.id} value={box.id}>{box.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Purchase Date</label>
              <input type="date" value={purchaseDate} onChange={e => handlePurchaseDateChange(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Warranty Expire</label>
              <input type="date" value={warrantyExpire} onChange={e => setWarrantyExpire(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Notes, specs, or where exactly in the box..."
              className="premium-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Tags</label>
            {selectedTags.length > 0 && (
              <div className="edit-tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {selectedTags.map(tag => {
                  const colors = getTagColor(tag);
                  return (
                    <span 
                      key={tag} 
                      className="tag-pill" 
                      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag} <X size={14} />
                    </span>
                  );
                })}
              </div>
            )}
            <div className="tag-input-wrapper">
              <input 
                type="text" 
                placeholder="tools, electronics..." 
                value={tagInput} 
                onChange={e => setTagInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), setTagInput(''))}
              />
              <button type="button" className="tag-add-btn" onClick={() => {
                if (tagInput.trim()) {
                  const newTags = tagInput.split(',').map(t => t.trim()).filter(t => t !== '');
                  if (onAddTag) newTags.forEach(t => onAddTag(t));
                  setSelectedTags(prev => Array.from(new Set([...prev, ...newTags])));
                  setTagInput('');
                }
              }}>
                <Plus size={20} />
              </button>
            </div>
            <div className="tag-suggestions" style={{ marginTop: '12px' }}>
              {allAvailableTags
                .filter(tag => !selectedTags.includes(tag))
                .map(tag => {
                const colors = getTagColor(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className="suggestion-chip"
                    style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FullscreenGallery: React.FC<{
  images: string[], 
  initialIndex: number, 
  onClose: () => void,
  onSetThumbnail?: (url: string) => void,
  currentThumbnail?: string
}> = ({ images, initialIndex, onClose, onSetThumbnail, currentThumbnail }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollAmount = currentIndex * scrollRef.current.offsetWidth;
      scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'auto' });
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.offsetWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  };

  const navigate = (dir: number) => {
    const nextIndex = Math.max(0, Math.min(images.length - 1, currentIndex + dir));
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: nextIndex * scrollRef.current.offsetWidth, behavior: 'smooth' });
    }
  };

  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <button className="fullscreen-close" onClick={onClose}><X size={28} /></button>
      {images.length > 1 && (
        <>
          <button className="nav-arrow left" onClick={(e) => { e.stopPropagation(); navigate(-1); }} style={{ opacity: currentIndex === 0 ? 0.3 : 1 }}>
            <ArrowLeft size={32} />
          </button>
          <button className="nav-arrow right" onClick={(e) => { e.stopPropagation(); navigate(1); }} style={{ opacity: currentIndex === images.length - 1 ? 0.3 : 1 }}>
            <ArrowLeft size={32} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </>
      )}
      <div className="fullscreen-scroll" ref={scrollRef} onScroll={handleScroll} onClick={e => e.stopPropagation()}>
        {images.map((img, idx) => (
          <div key={idx} className="fullscreen-slide">
            <img src={img} alt="" />
            {onSetThumbnail && (
              <button className={`fullscreen-star ${currentThumbnail === img ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onSetThumbnail(img); }}>
                <Star size={28} fill={currentThumbnail === img ? "currentColor" : "none"} />
              </button>
            )}
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="gallery-dots">
          {images.map((_, idx) => (
            <div 
              key={idx} 
              className={`gallery-dot ${idx === currentIndex ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                navigate(idx - currentIndex);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TagManagementModal: React.FC<{onClose: () => void}> = ({ onClose }) => {
  const { tags: globalItemTags, addTag, removeTag, renameTag } = useItemTags();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'destructive' | 'primary';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleAddNewTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagCategory.trim()) {
      addTag(newTagCategory.trim());
      setNewTagCategory('');
    }
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: 'rgba(62, 130, 247, 0.1)', padding: '8px', borderRadius: '10px' }}>
              <Tag size={20} color="var(--primary-color)" />
            </div>
            <h3>Item Tags ({globalItemTags.length})</h3>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="tag-manage-list">
          {globalItemTags.map(tag => {
            const colors = getTagColor(tag);
            const isEditing = editingTag === tag;
            
            return (
              <div key={tag} className={`tag-manage-chip ${isEditing ? 'is-editing' : ''}`}>
                <div className="tag-dot" style={{ backgroundColor: colors.text }} />
                {isEditing ? (
                  <input 
                    className="tag-edit-input"
                    autoFocus
                    value={editingTagValue}
                    onChange={(e) => setEditingTagValue(e.target.value)}
                    onBlur={() => {
                      if (editingTagValue.trim() && editingTagValue !== tag) {
                        renameTag(tag, editingTagValue);
                      }
                      setEditingTag(null);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        if (editingTagValue.trim() && editingTagValue !== tag) {
                          renameTag(tag, editingTagValue);
                        }
                        setEditingTag(null);
                      }
                    }}
                  />
                ) : (
                  <span className="tag-name" style={{ color: colors.text }}>{tag}</span>
                )}
                <div className="tag-actions">
                  <button 
                    className="tag-action-btn"
                    onClick={() => {
                      setEditingTag(tag);
                      setEditingTagValue(tag);
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    className="tag-action-btn delete"
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Delete Tag',
                        message: `Delete tag "${tag}" globally? This will remove it from ALL items and suggestions.`,
                        type: 'destructive',
                        onConfirm: () => removeTag(tag)
                      });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="tag-add-section">
          <h4>Add New Category</h4>
          <form onSubmit={handleAddNewTag} className="tag-input-wrapper">
            <input 
              type="text" 
              placeholder="CATEGORY NAME..." 
              value={newTagCategory}
              onChange={(e) => setNewTagCategory(e.target.value)}
            />
            <button type="submit" className="tag-add-btn">
              <Plus size={24} />
            </button>
          </form>
        </div>
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
