import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Plus, ChevronRight, X, LayoutGrid, List, Sliders, Tag, Edit2, Trash2 } from 'lucide-react';
import { useItems } from '../hooks/useItems';
import { useBoxes } from '../hooks/useBoxes';
import { useItemTags } from '../hooks/useItemTags';
import { getWarrantyStatus } from '../utils/warranty';
import { getTagColor } from '../utils/tagColors';
import { ItemEditModal, ImageSourceModal, FullscreenGallery } from '../components/ItemModals';
import { compressImage, blobToBase64 } from '../utils/imageUtils';
import { useRef } from 'react';

const ItemsPage = () => {
  const navigate = useNavigate();
  const { items, loading: itemsLoading, addItem, updateItem } = useItems();
  const { boxes } = useBoxes();
  const { tags: globalItemTags, addTag } = useItemTags();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemTags, setNewItemTags] = useState('');
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

  const toggleView = (type: 'grid' | 'list') => {
    setViewType(type);
    localStorage.setItem('itemsViewType', type);
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = item.name?.toLowerCase().includes(q) || 
                         item.description?.toLowerCase().includes(q) ||
                         item.tags?.some(t => t.toLowerCase().includes(q));
    
    const matchesTag = !selectedTag || item.tags?.includes(selectedTag);
    
    return matchesSearch && matchesTag;
  });

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !selectedBoxId) return;

    try {
      const tagsArray = newItemTags.split(',').map(t => t.trim()).filter(t => t !== '');
      await addItem(newItemName, 1, selectedBoxId, newItemDescription, tagsArray);
      setIsAddingItem(false);
      setNewItemName('');
      setNewItemDescription('');
      setNewItemTags('');
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
        const compressedBlob = await compressImage(file, 800, 0.6);
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

  const handleTagToggle = (tag: string) => {
    const currentTags = newItemTags.split(',').map(t => t.trim()).filter(t => t !== '');
    if (currentTags.includes(tag)) {
      const newTags = currentTags.filter(t => t !== tag);
      setNewItemTags(newTags.join(', '));
    } else {
      const newTags = [...currentTags, tag];
      setNewItemTags(newTags.join(', '));
    }
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
        <h2 className="header-title">All Items <span className="header-count">({items.length} Items)</span></h2>
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
            className={`filter-pill ${!selectedTag ? 'active' : ''}`}
            onClick={() => setSelectedTag(null)}
          >
            ALL
          </button>
          {globalItemTags.map(tag => {
            const colors = getTagColor(tag);
            const isActive = selectedTag === tag;
            return (
              <button 
                key={tag} 
                className={`filter-pill ${isActive ? 'active' : ''}`}
                style={{ 
                  backgroundColor: isActive ? colors.bg : `${colors.text}15`, // 15 is ~8% opacity
                  color: isActive ? colors.text : colors.text,
                  borderColor: isActive ? colors.bg : 'transparent',
                  opacity: isActive ? 1 : 0.8
                }}
                onClick={() => setSelectedTag(isActive ? null : tag)}
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
                    className="item-list-row-premium"
                    onClick={() => setEditingItem(item)}
                  >
                    <div className="item-list-left">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="item-list-img" />
                      ) : (
                        <div className="item-list-placeholder">
                          <Package size={16} />
                        </div>
                      )}
                      <div className="item-list-info">
                        <span className="item-list-name">{item.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="item-list-box">{box?.name || 'Unknown Box'}</span>
                          {item.tags && item.tags.length > 0 && (
                            <div className="item-card-tags" style={{ marginTop: 0 }}>
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
                  className="item-card-premium"
                  onClick={() => setEditingItem(item)}
                >
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
              <button className="close-btn" onClick={() => setIsAddingItem(false)}>
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
                <label>Tags (Comma separated)</label>
                <div className="tag-input-container">
                  <input 
                    type="text" 
                    placeholder="tools, electronics, kitchen..." 
                    value={newItemTags}
                    onChange={(e) => setNewItemTags(e.target.value)}
                  />
                  <div className="tag-suggestions">
                    {globalItemTags.map(tag => {
                      const colors = getTagColor(tag);
                      const isSelected = newItemTags.split(',').map(t => t.trim()).includes(tag);
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
