import React, { useState, useRef } from 'react';
import { Search, Package, Plus, ChevronRight, X, LayoutGrid, List, Sliders, Tag, Edit2, Trash2, CheckSquare, Square, Tags, CheckCircle2 } from 'lucide-react';
import { useItems } from '../hooks/useItems';
import { useBoxes } from '../hooks/useBoxes';
import { useItemTags } from '../hooks/useItemTags';
import { getWarrantyStatus } from '../utils/warranty';
import { getTagColor } from '../utils/tagColors';
import { ItemEditModal, ImageSourceModal, FullscreenGallery } from '../components/ItemModals';
import { compressImage, blobToBase64 } from '../utils/imageUtils';

const ItemsPage = () => {
  const { items, loading: itemsLoading, addItem, updateItem, removeItem } = useItems();
  const { boxes } = useBoxes();
  const { tags: globalItemTags, addTag } = useItemTags();
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
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'list'>(localStorage.getItem('itemsViewType') as 'grid' | 'list' || 'grid');
  
  // Edit states
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [imageSourceModal, setImageSourceModal] = useState<any | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{images: string[], index: number} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showExpiredInItems, setShowExpiredInItems] = useState(localStorage.getItem('showExpiredStatus') !== 'false');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadContextRef = useRef<{type: 'item' | 'receipt', itemId: string} | null>(null);

  // Selection states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchModal, setBatchModal] = useState<'delete' | 'assign' | 'remove' | 'clear' | null>(null);
  const [batchTags, setBatchTags] = useState<string>('');

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
                       selectedTags.every(tag => item.tags?.includes(tag));
    
    return matchesSearch && matchesTags;
  });

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
    const context = uploadContextRef.current;
    if (files.length === 0 || !context || !editingItem) return;

    setIsUploading(true);
    const { type } = context;
    uploadContextRef.current = null; 

    try {
      const processedImages = await Promise.all(files.map(async file => {
        const compressedBlob = await compressImage(file, 600, 0.4);
        return await blobToBase64(compressedBlob);
      }));

      if (type === 'item') {
        const currentImages = editingItem.images || [];
        const newImages = [...currentImages, ...processedImages];
        await handleUpdateItem({ images: newImages, imageUrl: newImages[0] || '' });
      } else {
        const currentReceipts = editingItem.receipts || [];
        const newReceipts = [...currentReceipts, ...processedImages];
        await handleUpdateItem({ receipts: newReceipts, receiptUrl: newReceipts[0] || '' });
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
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
    const tagsArray = batchTags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    await Promise.all(selectedIds.map(id => {
      const item = items.find(i => i.id === id);
      if (!item) return;
      const combinedTags = Array.from(new Set([...(item.tags || []), ...tagsArray]));
      return updateItem(id, { tags: combinedTags });
    }));
    setBatchTags('');
    setBatchModal(null);
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleBatchRemoveTags = async () => {
    const tagsArray = batchTags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    await Promise.all(selectedIds.map(id => {
      const item = items.find(i => i.id === id);
      if (!item) return;
      const filteredTags = (item.tags || []).filter(t => !tagsArray.includes(t));
      return updateItem(id, { tags: filteredTags });
    }));
    setBatchTags('');
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
                  backgroundColor: isActive ? colors.bg : `${colors.text}15`, 
                  color: isActive ? colors.text : colors.text,
                  borderColor: isActive ? colors.bg : 'transparent',
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
                <label>Tags (New tags only)</label>
                <div className="tag-input-container">
                  <input 
                    type="text" 
                    placeholder="tools, electronics..." 
                    value={newItemTagInput}
                    onChange={(e) => setNewItemTagInput(e.target.value)}
                  />
                  <div className="tag-suggestions">
                    {globalItemTags.map(tag => {
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
                return (
                  <div key={tag} className="tag-manage-chip">
                    <div className="tag-dot" style={{ backgroundColor: colors.text }} />
                    <span className="tag-name" style={{ color: colors.text }}>{tag}</span>
                    <div className="tag-actions">
                      <button className="tag-action-btn"><Edit2 size={14} /></button>
                      <button className="tag-action-btn delete"><Trash2 size={14} /></button>
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
            uploadContextRef.current = { type, itemId: editingItem.id };
            setImageSourceModal({ type });
          }}
          onPreviewImage={(images, index) => setFullscreenImage({ images, index })}
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
                <label>Tags (Comma separated)</label>
                <div className="tag-input-container">
                  <input 
                    type="text" 
                    value={batchTags} 
                    onChange={e => setBatchTags(e.target.value)} 
                    placeholder="tools, electronics..." 
                    autoFocus
                  />
                  <div className="tag-suggestions">
                    {globalItemTags.map(tag => {
                      const colors = getTagColor(tag);
                      const isSelected = batchTags.split(',').map((t: string) => t.trim()).includes(tag);
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
                          onClick={() => {
                            const current = batchTags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
                            if (current.includes(tag)) {
                              setBatchTags(current.filter(t => t !== tag).join(', '));
                            } else {
                              setBatchTags([...current, tag].join(', '));
                            }
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
    </div>
  );
};

export default ItemsPage;
