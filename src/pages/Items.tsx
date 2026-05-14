import React, { useState, useRef, useEffect } from 'react';
import { Search, Package, Plus, ChevronRight, X, LayoutGrid, List, Sliders, Tag, Edit2, Trash2, CheckSquare, Square, Tags, CheckCircle2, AlertCircle } from 'lucide-react';
import { useItems } from '../hooks/useItems';
import { useBoxes } from '../hooks/useBoxes';
import { useItemTags } from '../hooks/useItemTags';
import { getWarrantyStatus } from '../utils/warranty';
import { getTagColor } from '../utils/tagColors';
import { ItemEditModal, ImageSourceModal, FullscreenGallery } from '../components/ItemModals';
import { compressImage, blobToBase64 } from '../utils/imageUtils';
import { ConfirmationModal } from '../components/ConfirmationModal';

const ItemsPage = () => {
  const { items, loading: itemsLoading, addItem, updateItem, removeItem } = useItems();
  const { boxes } = useBoxes();
  const { tags: globalItemTags, addTag, removeTag, renameTag } = useItemTags();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [selectedNewItemTags, setSelectedNewItemTags] = useState<string[]>([]);
  const [newItemTagInput, setNewItemTagInput] = useState('');
  const [showAddDiscardConfirm, setShowAddDiscardConfirm] = useState(false);
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [newTagCategory, setNewTagCategory] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'list'>(localStorage.getItem('itemsViewType') as 'grid' | 'list' || 'grid');
  
  // Edit states
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [imageSourceModal, setImageSourceModal] = useState<any | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{images: string[], index: number} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showExpiredInItems, setShowExpiredInItems] = useState(localStorage.getItem('showExpiredStatus') !== 'false');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'destructive' | 'primary';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadContextRef = useRef<{type: 'item' | 'receipt', itemId: string} | null>(null);

  // Selection states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchModal, setBatchModal] = useState<'delete' | 'assign' | 'remove' | 'clear' | null>(null);
  const [batchTags, setBatchTags] = useState<string>('');
  const [selectedBatchTags, setSelectedBatchTags] = useState<string[]>([]);

  const toggleView = (type: 'grid' | 'list') => {
    setViewType(type);
    localStorage.setItem('itemsViewType', type);
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = item.name?.toLowerCase().includes(q) || 
                         item.description?.toLowerCase().includes(q) ||
                         item.tags?.some((t: string) => t.toLowerCase().includes(q));
    
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => item.tags?.includes(tag));
    
    return matchesSearch && matchesTags;
  });

  // Recovery effect for mobile camera reloads
  useEffect(() => {
    const contextJson = sessionStorage.getItem('uploadContext');
    if (contextJson && items.length > 0) {
      const context = JSON.parse(contextJson);
      if (context.itemId && !editingItem) {
        const item = items.find(i => i.id === context.itemId);
        if (item) setEditingItem(item);
      }
    }
  }, [items, editingItem]);

  const handleCommitNewItemTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newItemTagInput.trim()) return;
    
    const newTags = newItemTagInput.split(',').map(t => t.trim()).filter(t => t !== '');
    newTags.forEach(t => addTag(t)); // Make them permanent
    setSelectedNewItemTags(prev => Array.from(new Set([...prev, ...newTags])));
    setNewItemTagInput('');
  };

  const handleCommitBatchTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!batchTags.trim()) return;
    
    const newTags = batchTags.split(',').map(t => t.trim()).filter(t => t !== '');
    newTags.forEach(t => addTag(t)); // Make them permanent
    setSelectedBatchTags(prev => Array.from(new Set([...prev, ...newTags])));
    setBatchTags('');
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !selectedBoxId) return;

    try {
      const manualTags = newItemTagInput.split(',').map(t => t.trim()).filter(t => t !== '');
      const finalTags = Array.from(new Set([...selectedNewItemTags, ...manualTags]));
      
      await addItem(newItemName, 1, selectedBoxId, newItemDescription, finalTags);
      setIsAddingItem(false);
      setNewItemName('');
      setNewItemDescription('');
      setSelectedNewItemTags([]);
      setNewItemTagInput('');
      setSelectedBoxId('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateItem = async (updates: any) => {
    if (!editingItem) return;
    await updateItem(editingItem.id, updates);
    setEditingItem({ ...editingItem, ...updates });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Check ref first, then fallback to sessionStorage
    let context = uploadContextRef.current;
    if (!context) {
      const contextJson = sessionStorage.getItem('uploadContext');
      if (contextJson) context = JSON.parse(contextJson);
    }

    if (files.length === 0 || !context) return;
    
    // Find the item even if editingItem was lost
    const targetItemId = context.itemId;
    const currentItem = editingItem?.id === targetItemId ? editingItem : items.find(i => i.id === targetItemId);
    
    if (!currentItem) {
      console.error("No item found for upload context");
      return;
    }

    setIsUploading(true);
    const { type } = context;
    uploadContextRef.current = null; 
    sessionStorage.removeItem('uploadContext');

    try {
      const processedImages = await Promise.all(files.map(async file => {
        // Reduced size/quality to prevent Firestore 1MB document limit errors
        const compressedBlob = await compressImage(file, 500, 0.3);
        return await blobToBase64(compressedBlob);
      }));

      if (type === 'item') {
        const currentImages = currentItem.images || [];
        const newImages = [...currentImages, ...processedImages];
        const updates = { images: newImages, imageUrl: newImages[0] || '' };
        await updateItem(targetItemId, updates);
        if (editingItem?.id === targetItemId) setEditingItem({ ...editingItem, ...updates });
      } else {
        const currentReceipts = currentItem.receipts || [];
        const newReceipts = [...currentReceipts, ...processedImages];
        const updates = { receipts: newReceipts, receiptUrl: newReceipts[0] || '' };
        await updateItem(targetItemId, updates);
        if (editingItem?.id === targetItemId) setEditingItem({ ...editingItem, ...updates });
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(filteredItems.map(i => i.id));
  };

  const handleUnselectAll = () => {
    setSelectedIds([]);
  };

  const handleBatchDelete = async () => {
    await Promise.all(selectedIds.map(id => removeItem(id)));
    setSelectedIds([]);
    setIsSelectionMode(false);
    setBatchModal(null);
  };

  const handleBatchAssignTags = async () => {
    const manualTags = batchTags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    const tagsArray = Array.from(new Set([...selectedBatchTags, ...manualTags]));
    
    await Promise.all(selectedIds.map(id => {
      const item = items.find(i => i.id === id);
      if (!item) return;
      const combinedTags = Array.from(new Set([...(item.tags || []), ...tagsArray]));
      return updateItem(id, { tags: combinedTags });
    }));
    setBatchTags('');
    setSelectedBatchTags([]);
    setBatchModal(null);
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleBatchRemoveTags = async () => {
    const manualTags = batchTags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    const tagsArray = Array.from(new Set([...selectedBatchTags, ...manualTags]));
    
    await Promise.all(selectedIds.map(id => {
      const item = items.find(i => i.id === id);
      if (!item) return;
      const filteredTags = (item.tags || []).filter(t => !tagsArray.includes(t));
      return updateItem(id, { tags: filteredTags });
    }));
    setBatchTags('');
    setSelectedBatchTags([]);
    setBatchModal(null);
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleBatchClearTags = async () => {
    await Promise.all(selectedIds.map(id => updateItem(id, { tags: [] })));
    setSelectedIds([]);
    setIsSelectionMode(false);
    setBatchModal(null);
  };



  const handleAddNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagCategory) return;
    
    try {
      await addTag(newTagCategory);
      setNewTagCategory('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-content">
      <header className="page-header-minimal">
        {isSelectionMode ? (
          <>
            <div className="selection-header-left">
              <button className="close-selection-btn" onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}>
                <X size={20} />
              </button>
              <div className="selection-count-container">
                <span className="selection-count">{selectedIds.length}</span>
                <span className="selection-label">Items selected</span>
              </div>
            </div>
            <div className="selection-actions">
              <div className="selection-action-group">
                <button className="selection-icon-btn" onClick={handleSelectAll} title="Select All Visible"><CheckSquare size={18} /></button>
                <span className="action-label">All</span>
              </div>
              <div className="selection-action-group">
                <button className="selection-icon-btn" onClick={handleUnselectAll} title="Clear Selection"><Square size={18} /></button>
                <span className="action-label">None</span>
              </div>
              <div className="selection-divider" />
              <div className="selection-action-group">
                <button className="selection-icon-btn" onClick={() => setBatchModal('assign')} title="Assign Tags"><Tags size={20} /></button>
                <span className="action-label">Tags</span>
              </div>
              <div className="selection-action-group">
                <button className="selection-icon-btn" onClick={() => setBatchModal('clear')} title="Clear All Tags">
                  <div style={{position: 'relative', display: 'flex'}}>
                    <Tag size={18} />
                    <X size={12} style={{position: 'absolute', top: -2, right: -4, backgroundColor: 'var(--bg-color)', borderRadius: '50%'}} />
                  </div>
                </button>
                <span className="action-label">Clear</span>
              </div>
              <div className="selection-action-group">
                <button className="selection-icon-btn destructive" onClick={() => setBatchModal('delete')} title="Delete"><Trash2 size={20} /></button>
                <span className="action-label">Delete</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="header-title">All Items <span className="header-count">({items.length} Items)</span></h2>
            <div className="header-right-actions">
              <div className="view-toggle-container">
                <button 
                  className={`view-toggle-btn ${viewType === 'grid' ? 'active' : ''}`}
                  onClick={() => toggleView('grid')}
                  title="Grid View"
                >
                  <LayoutGrid size={20} />
                </button>
                <button 
                  className={`view-toggle-btn ${viewType === 'list' ? 'active' : ''}`}
                  onClick={() => toggleView('list')}
                  title="List View"
                >
                  <List size={20} />
                </button>
              </div>
              <button 
                className={`view-toggle-btn ${isSelectionMode ? 'active' : ''}`}
                onClick={() => setIsSelectionMode(true)}
                title="Selection Mode"
              >
                <CheckSquare size={20} />
              </button>
            </div>
          </>
        )}
      </header>

      <div className="search-container">
        <div className="search-bar">
          <Search size={20} className="search-icon-static" />
          <input 
            type="text" 
            placeholder="Search items..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-text-btn" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="filter-scroll-container">
        <div className="filter-scroll">
          <button 
            className="filter-settings-btn"
            onClick={() => setIsManagingTags(true)}
            title="Manage Tags"
          >
            <Sliders size={18} />
          </button>
          <button 
            className={`filter-pill ${selectedTags.length === 0 ? 'active' : ''}`}
            onClick={() => setSelectedTags([])}
          >
            ALL
          </button>
          {globalItemTags.map(tag => {
            const colors = getTagColor(tag);
            const isActive = selectedTags.includes(tag);
            return (
              <button 
                key={tag} 
                className={`filter-pill ${isActive ? 'active' : ''}`}
                style={{ 
                  backgroundColor: isActive ? colors.text : colors.bg, 
                  color: isActive ? '#ffffff' : colors.text,
                  border: isActive ? 'none' : `1px solid ${colors.bg}`,
                  opacity: isActive ? 1 : 0.8
                }}
                onClick={() => {
                  setSelectedTags(prev => 
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  );
                }}
              >
                {tag.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="items-list-container">
        {itemsLoading ? (
          <div className="status-text-container">
            <div className="loader-small"></div>
            <p className="status-text">Loading items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state-large">
            <Package size={48} className="empty-icon" />
            <p className="status-text">No items found.</p>
          </div>
        ) : (
          <div className={viewType === 'grid' ? 'items-grid' : 'items-list-view'}>
            {filteredItems.map((item) => {
              const box = boxes.find(b => b.id === item.boxId);
              const warranty = item.warrantyExpire ? getWarrantyStatus(item.warrantyExpire) : null;
              
              if (viewType === 'list') {
                return (
                  <div 
                    key={item.id} 
                    className={`item-list-row-premium ${selectedIds.includes(item.id) ? 'selected' : ''}`}
                    onClick={() => isSelectionMode ? toggleItemSelection(item.id) : setEditingItem(item)}
                  >
                    <div className="item-list-left">
                      {isSelectionMode && (
                        <div className="selection-indicator">
                          {selectedIds.includes(item.id) ? <CheckCircle2 size={20} color="var(--primary-color)" /> : <Square size={20} />}
                        </div>
                      )}
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="item-list-img" />
                      ) : (
                        <div className="item-list-placeholder">
                          <Package size={16} />
                        </div>
                      )}
                      <div className="item-list-info">
                        <span className="item-list-name">{item.name}</span>
                        <span className="item-list-box">{box?.name || 'Unknown Box'}</span>
                        {item.tags && item.tags.length > 0 && (
                          <div className="item-card-tags" style={{ marginTop: '4px', justifyContent: 'flex-start' }}>
                            {item.tags.map(tag => {
                              const colors = getTagColor(tag);
                              return (
                                <span key={tag} className="item-tag-pill" style={{ backgroundColor: colors.bg, color: colors.text }}>
                                  {tag}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="item-list-right">
                      {item.quantity > 1 && (
                        <span className="item-list-qty">{item.quantity}x</span>
                      )}
                      {warranty && (
                        <span className="warranty-tag-mini" style={{ color: warranty.color }}>
                          {warranty.isExpired ? 'Expired' : warranty.text}
                        </span>
                      )}
                      <ChevronRight size={18} className="item-card-arrow" />
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={item.id} 
                  className={`item-card-premium ${selectedIds.includes(item.id) ? 'selected' : ''}`}
                  onClick={() => isSelectionMode ? toggleItemSelection(item.id) : setEditingItem(item)}
                >
                  {isSelectionMode && (
                    <div className="selection-indicator-floating">
                      {selectedIds.includes(item.id) ? <CheckCircle2 size={20} color="var(--primary-color)" /> : <Square size={20} />}
                    </div>
                  )}
                  <div className="item-card-image-area">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="item-card-img" />
                    ) : (
                      <div className="item-card-placeholder">
                        <Package size={24} />
                      </div>
                    )}
                    {item.quantity > 1 && (
                      <div className="item-card-qty-badge">{item.quantity}x</div>
                    )}
                  </div>
                  
                  <div className="item-card-content">
                    <div className="item-card-main">
                      <h3 className="item-card-name">{item.name}</h3>
                      <div className="item-card-box-info">
                        <Package size={12} />
                        <span>{box?.name || 'Unknown Box'}</span>
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div className="item-card-tags">
                          {item.tags.map(tag => {
                            const colors = getTagColor(tag);
                            return (
                              <span key={tag} className="item-tag-pill" style={{ backgroundColor: colors.bg, color: colors.text }}>
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="item-card-footer">
                      {warranty && (
                        <span className="warranty-tag-mini" style={{ color: warranty.color }}>
                          {warranty.isExpired ? 'Expired' : warranty.text}
                        </span>
                      )}
                      <ChevronRight size={16} className="item-card-arrow" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => setIsAddingItem(true)}>
        <Plus size={24} />
      </button>

      {isAddingItem && (
        <div className="modal-overlay" onClick={() => setIsAddingItem(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Item</h3>
              <button className="close-btn" onClick={() => {
                const hasChanges = newItemName || newItemDescription || selectedNewItemTags.length > 0 || newItemTagInput || selectedBoxId;
                if (hasChanges) {
                  setShowAddDiscardConfirm(true);
                } else {
                  setIsAddingItem(false);
                }
              }}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddItem} className="create-form">
              <div className="form-group">
                <label>Item Name</label>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="What are you adding?" 
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea 
                  placeholder="Additional details, serial numbers, etc." 
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  className="premium-textarea"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                {selectedNewItemTags.length > 0 && (
                  <div className="edit-tags-container" style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedNewItemTags.map(tag => {
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
                          {tag} <X size={14} onClick={() => setSelectedNewItemTags(prev => prev.filter(t => t !== tag))} style={{ cursor: 'pointer', opacity: 0.7 }} />
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="tag-input-wrapper" style={{ marginBottom: '12px' }}>
                  <input 
                    type="text" 
                    placeholder="tools, electronics..." 
                    value={newItemTagInput}
                    onChange={(e) => setNewItemTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleCommitNewItemTag())}
                    style={{ border: 'none', backgroundColor: 'transparent' }}
                  />
                  <button type="button" className="tag-add-btn" onClick={handleCommitNewItemTag} style={{ padding: '8px' }}>
                    <Plus size={20} />
                  </button>
                </div>
                  <div className="tag-suggestions">
                    {globalItemTags
                      .filter(tag => !selectedNewItemTags.includes(tag))
                      .map(tag => {
                      const colors = getTagColor(tag);
                      const isSelected = selectedNewItemTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`suggestion-chip ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedNewItemTags(prev => 
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            );
                          }}
                          style={{
                            backgroundColor: isSelected ? colors.bg : 'transparent',
                            color: isSelected ? colors.text : 'var(--text-secondary)',
                            borderColor: isSelected ? colors.border : 'var(--border-color)'
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

              <div className="form-group">
                <label>Select Box</label>
                <select 
                  value={selectedBoxId} 
                  onChange={(e) => setSelectedBoxId(e.target.value)}
                  required
                  className="premium-select"
                >
                  <option value="" disabled>Choose a box...</option>
                  {boxes.map(box => (
                    <option key={box.id} value={box.id}>{box.name} ({box.room || 'No Room'})</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="submit-btn" disabled={!newItemName || !selectedBoxId}>
                Add to Box
              </button>
            </form>
          </div>
        </div>
      )}

      {showAddDiscardConfirm && (
        <div className="action-sheet-overlay" onClick={() => setShowAddDiscardConfirm(false)}>
          <div className="action-sheet" onClick={e => e.stopPropagation()}>
            <div className="action-sheet-header">
              <h3>Unsaved Progress</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px'}}>
                You've started adding an item. Would you like to save it or discard your progress?
              </p>
            </div>
            <div className="action-sheet-options">
              <button className="option-btn primary" onClick={(e) => { e.preventDefault(); handleAddItem(e as any); setShowAddDiscardConfirm(false); }}>
                Save & Close
              </button>
              <button className="option-btn destructive" onClick={() => { setIsAddingItem(false); setShowAddDiscardConfirm(false); }}>
                Discard Progress
              </button>
              <button className="option-btn" onClick={() => setShowAddDiscardConfirm(false)}>
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
      {isManagingTags && (
        <div className="modal-overlay" onClick={() => setIsManagingTags(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(62, 130, 247, 0.1)', padding: '8px', borderRadius: '10px' }}>
                  <Tag size={20} color="var(--primary-color)" />
                </div>
                <h3>Item Tags ({globalItemTags.length})</h3>
              </div>
              <button className="close-btn" onClick={() => setIsManagingTags(false)}>
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
                            message: `Delete tag "${tag}" from global suggestions? (Existing items will keep it)`,
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
        </div>
      )}

      {editingItem && (
        <ItemEditModal 
          item={editingItem}
          showExpired={showExpiredInItems}
          isUploading={isUploading}
          onShowExpiredChange={(checked) => {
            setShowExpiredInItems(checked);
            localStorage.setItem('showExpiredStatus', String(checked));
          }}
          onClose={() => setEditingItem(null)}
          onUpdate={handleUpdateItem}
          onImageRequest={(type) => {
            const context = { type, itemId: editingItem.id };
            uploadContextRef.current = context;
            sessionStorage.setItem('uploadContext', JSON.stringify(context));
            setImageSourceModal({ type });
          }}
          onPreviewImage={(images, index) => setFullscreenImage({ images, index })}
          onAddTag={addTag}
        />
      )}

      {imageSourceModal && (
        <ImageSourceModal 
          onSelect={(source) => {
            if (source === 'camera') cameraInputRef.current?.click();
            else fileInputRef.current?.click();
            setImageSourceModal(null);
          }}
          onClose={() => setImageSourceModal(null)}
        />
      )}

      {fullscreenImage && (
        <FullscreenGallery 
          images={fullscreenImage.images} 
          initialIndex={fullscreenImage.index} 
          onClose={() => setFullscreenImage(null)}
          onSetThumbnail={async (url) => {
            await handleUpdateItem({ imageUrl: url });
          }}
          currentThumbnail={editingItem?.imageUrl}
        />
      )}

      {/* Batch Action Modals */}
      {batchModal === 'delete' && (
        <div className="modal-overlay" onClick={() => setBatchModal(null)}>
          <div className="modal-content compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete {selectedIds.length} Items?</h3>
              <button className="close-btn" onClick={() => setBatchModal(null)}><X size={24} /></button>
            </div>
            <div className="batch-modal-body">
              <p>This action cannot be undone. All selected items will be permanently removed.</p>
              <div className="batch-modal-actions">
                <button className="batch-btn destructive" onClick={handleBatchDelete}>Confirm Delete</button>
                <button className="batch-btn secondary" onClick={() => setBatchModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {batchModal === 'clear' && (
        <div className="modal-overlay" onClick={() => setBatchModal(null)}>
          <div className="modal-content compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Clear All Tags?</h3>
              <button className="close-btn" onClick={() => setBatchModal(null)}><X size={24} /></button>
            </div>
            <div className="batch-modal-body">
              <p>Remove every tag from the {selectedIds.length} selected items?</p>
              <div className="batch-modal-actions">
                <button className="batch-btn destructive" onClick={handleBatchClearTags}>Remove Tags</button>
                <button className="batch-btn secondary" onClick={() => setBatchModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(batchModal === 'assign' || batchModal === 'remove') && (
        <div className="modal-overlay" onClick={() => setBatchModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{batchModal === 'assign' ? 'Assign Tags' : 'Remove Tags'}</h3>
              <button className="close-btn" onClick={() => setBatchModal(null)}><X size={24} /></button>
            </div>
            <div className="batch-modal-body">
              <p style={{marginBottom: '16px', color: 'var(--text-secondary)'}}>
                {batchModal === 'assign' 
                  ? `Add these tags to the ${selectedIds.length} selected items.`
                  : `Remove these tags from the ${selectedIds.length} selected items.`}
              </p>
              <div className="form-group">
                <label>Tags</label>
                {selectedBatchTags.length > 0 && (
                  <div className="edit-tags-container" style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedBatchTags.map(tag => {
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
                          {tag} <X size={14} onClick={() => setSelectedBatchTags(prev => prev.filter(t => t !== tag))} style={{ cursor: 'pointer', opacity: 0.7 }} />
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="tag-input-wrapper" style={{ marginBottom: '12px' }}>
                  <input 
                    type="text" 
                    value={batchTags} 
                    onChange={e => setBatchTags(e.target.value)} 
                    placeholder="tools, electronics..." 
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleCommitBatchTag())}
                    style={{ border: 'none', backgroundColor: 'transparent' }}
                    autoFocus
                  />
                  <button type="button" className="tag-add-btn" onClick={handleCommitBatchTag} style={{ padding: '8px' }}>
                    <Plus size={20} />
                  </button>
                </div>
                  <div className="tag-suggestions">
                    {globalItemTags
                      .filter(tag => !selectedBatchTags.includes(tag))
                      .map(tag => {
                      const colors = getTagColor(tag);
                      const isSelected = selectedBatchTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`suggestion-chip ${isSelected ? 'active' : ''}`}
                          style={{ 
                            backgroundColor: isSelected ? colors.bg : 'rgba(255,255,255,0.05)',
                            color: isSelected ? colors.text : 'var(--text-secondary)',
                            borderColor: isSelected ? colors.border : 'var(--border-color)'
                          }}
                          onClick={() => {
                            setSelectedBatchTags(prev => 
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            );
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="batch-modal-actions" style={{marginTop: '24px'}}>
                <button 
                  className={`batch-btn ${batchModal === 'assign' ? 'primary' : 'destructive'}`} 
                  onClick={batchModal === 'assign' ? handleBatchAssignTags : handleBatchRemoveTags}
                >
                  {batchModal === 'assign' ? 'Apply Tags' : 'Remove Tags'}
                </button>
              </div>
            </div>
          </div>

      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        hidden 
        accept="image/*" 
        onChange={handleImageSelect} 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        hidden 
        accept="image/*" 
        capture="environment" 
        onChange={handleImageSelect} 
      />
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

export default ItemsPage;
