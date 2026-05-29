import React, { useState, useRef, useEffect } from 'react';
import { Search, Package, Plus, X, LayoutGrid, List, Sliders, Tag, Trash2, CheckSquare, Square, Tags, CheckCircle2, Settings, Minus } from 'lucide-react';
import { useItems } from '../hooks/useItems';
import { useBoxes } from '../hooks/useBoxes';
import { useItemTags } from '../hooks/useItemTags';
import { getWarrantyStatus } from '../utils/warranty';
import { getTagColor } from '../utils/tagColors';
import { ItemEditModal, ItemAddModal, ImageSourceModal, FullscreenGallery, TagManagementModal } from '../components/ItemModals';
import { compressImage, blobToBase64 } from '../utils/imageUtils';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { CameraCapture } from '../components/CameraCapture';

const ItemsPage = () => {
  const { items, loading: itemsLoading, addItem, updateItem, removeItem } = useItems();
  const { boxes } = useBoxes();
  const { tags: globalItemTags, addTag } = useItemTags();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [tempAddImages, setTempAddImages] = useState<string[]>([]);
  const [tempAddReceipts, setTempAddReceipts] = useState<string[]>([]);
  const [showAddDiscardConfirm, setShowAddDiscardConfirm] = useState(false);
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [viewType, setViewType] = useState<'grid' | 'list'>(localStorage.getItem('itemsViewType') as 'grid' | 'list' || 'grid');
  const [gridColumns, setGridColumns] = useState<number>(Number(localStorage.getItem('itemsGridColumns')) || 2);
  const [gridRows, setGridRows] = useState<number>(Number(localStorage.getItem('itemsGridRows')) || 20);
  const [listRows, setListRows] = useState<number>(Number(localStorage.getItem('itemsListRows')) || 20);
  const [listColumns, setListColumns] = useState<number>(Number(localStorage.getItem('itemsListColumns')) || 1);
  const [listScrollMode, setListScrollMode] = useState<'vertical' | 'horizontal'>(localStorage.getItem('listScrollMode') as 'vertical' | 'horizontal' || 'horizontal');
  const [applyOnlyToDesktop, setApplyOnlyToDesktop] = useState<boolean>(localStorage.getItem('applyOnlyToDesktop') === 'true');
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Edit states
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [tempEditImages, setTempEditImages] = useState<string[]>([]);
  const [tempEditReceipts, setTempEditReceipts] = useState<string[]>([]);

  useEffect(() => {
    if (editingItem) {
      setTempEditImages(editingItem.images || []);
      setTempEditReceipts(editingItem.receipts || []);
    } else {
      setTempEditImages([]);
      setTempEditReceipts([]);
    }
  }, [editingItem]);

  const [imageSourceModal, setImageSourceModal] = useState<any | null>(null);
  const [isCustomCameraOpen, setIsCustomCameraOpen] = useState(false);
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

  // Synchronously capture recovery context on first render before events can delete it
  const [pendingRecoveryContext, setPendingRecoveryContext] = useState(() => {
    const contextJson = localStorage.getItem('uploadContext');
    return contextJson ? JSON.parse(contextJson) : null;
  });

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

  // Recovery effect for mobile camera reloads - runs whenever items load or modal states change
  useEffect(() => {
    if (pendingRecoveryContext) {
      if (pendingRecoveryContext.itemId === 'new-item') {
        setIsAddingItem(true);
        localStorage.removeItem('uploadContext');
        setPendingRecoveryContext(null);
      } else if (pendingRecoveryContext.itemId && !editingItem && items.length > 0) {
        const item = items.find(i => i.id === pendingRecoveryContext.itemId);
        if (item) {
          setEditingItem(item);
          localStorage.removeItem('uploadContext');
          setPendingRecoveryContext(null);
        }
      }
    }
  }, [items, editingItem, pendingRecoveryContext]);



  const handleCommitBatchTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!batchTags.trim()) return;
    
    const newTags = batchTags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    newTags.forEach((t: string) => addTag(t)); // Make them permanent
    setSelectedBatchTags((prev: string[]) => Array.from(new Set([...prev, ...newTags])));
    setBatchTags('');
  };

  const handleSaveNewItem = async (data: any) => {
    try {
      await addItem(
        data.name, 
        data.quantity, 
        data.boxId, 
        data.description, 
        data.tags, 
        data.images, 
        data.receipts,
        data.purchaseDate,
        data.warrantyExpire,
        '', // groupName placeholder
        data.room
      );
      setIsAddingItem(false);
      setTempAddImages([]);
      setTempAddReceipts([]);
    } catch (err) {
      console.error(err);
      alert("Failed to save item.");
    }
  };

  const handleUpdateItem = async (updates: any) => {
    if (!editingItem) return;
    await updateItem(editingItem.id, updates);
    setEditingItem({ ...editingItem, ...updates });
  };

  const handleUploadFiles = async (files: File[], type: 'item' | 'receipt', targetItemId: string) => {
    if (files.length === 0) return;
    
    const currentItem = editingItem?.id === targetItemId ? editingItem : items.find(i => i.id === targetItemId);
    
    if (targetItemId !== 'new-item' && !currentItem) {
      console.error("No item found for upload context");
      return;
    }

    setIsUploading(true);
    try {
      const processedImages = await Promise.all(files.map(async file => {
        const compressedBlob = await compressImage(file, 500, 0.3);
        return await blobToBase64(compressedBlob);
      }));

      if (targetItemId === 'new-item') {
        if (type === 'item') setTempAddImages(prev => [...prev, ...processedImages]);
        else setTempAddReceipts(prev => [...prev, ...processedImages]);
      } else if (currentItem) {
        if (type === 'item') {
          setTempEditImages(prev => [...prev, ...processedImages]);
        } else {
          setTempEditReceipts(prev => [...prev, ...processedImages]);
        }
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    let context = uploadContextRef.current;
    if (!context) {
      const contextJson = sessionStorage.getItem('uploadContext');
      if (contextJson) context = JSON.parse(contextJson);
    }

    if (!context) return;
    
    const { type, itemId } = context;
    uploadContextRef.current = null; 
    sessionStorage.removeItem('uploadContext');
    
    await handleUploadFiles(files, type, itemId);
  };

  const handleDropFiles = async (type: 'item' | 'receipt', fileList: FileList) => {
    const files = Array.from(fileList);
    const targetItemId = editingItem ? editingItem.id : 'new-item';
    await handleUploadFiles(files, type, targetItemId);
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

  const handleSaveSettings = () => {
    localStorage.setItem('itemsGridColumns', String(gridColumns));
    localStorage.setItem('itemsGridRows', String(gridRows));
    localStorage.setItem('itemsListRows', String(listRows));
    localStorage.setItem('itemsListColumns', String(listColumns));
    localStorage.setItem('listScrollMode', listScrollMode);
    localStorage.setItem('applyOnlyToDesktop', String(applyOnlyToDesktop));
    setShowDisplaySettings(false);
  };

  const handleCancelSettings = () => {
    setGridColumns(Number(localStorage.getItem('itemsGridColumns')) || 2);
    setGridRows(Number(localStorage.getItem('itemsGridRows')) || 20);
    setListRows(Number(localStorage.getItem('itemsListRows')) || 20);
    setListColumns(Number(localStorage.getItem('itemsListColumns')) || 1);
    setListScrollMode(localStorage.getItem('listScrollMode') as 'vertical' | 'horizontal' || 'horizontal');
    setApplyOnlyToDesktop(localStorage.getItem('applyOnlyToDesktop') === 'true');
    setShowDisplaySettings(false);
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
                  className="view-toggle-btn"
                  onClick={() => setShowDisplaySettings(true)}
                  title="Display Settings"
                >
                  <Settings size={20} />
                </button>
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
            type="search" 
            placeholder="Search items..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
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
                  backgroundColor: colors.bg, 
                  color: isActive ? '#ffffff' : colors.text,
                  border: `1px solid ${isActive ? colors.text : colors.border || colors.bg}`,
                  opacity: isActive ? 1 : 0.6
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

      <div className="items-list-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
          <div 
            className={viewType === 'grid' ? 'items-grid' : 'items-list-view'}
            style={{ 
              gridTemplateColumns: viewType === 'grid' 
                ? `repeat(${(!isDesktop && applyOnlyToDesktop) ? 2 : gridColumns}, 1fr)` 
                : (listScrollMode === 'vertical' 
                    ? `repeat(${(!isDesktop && applyOnlyToDesktop) ? 1 : listColumns}, 1fr)` 
                    : 'none'),
              gridTemplateRows: viewType === 'list' && listScrollMode === 'horizontal'
                ? `repeat(${listRows}, auto)`
                : 'none',
              display: 'grid',
              gridAutoFlow: viewType === 'list' && listScrollMode === 'horizontal' ? 'column' : 'row',
              gap: '12px',
              minWidth: viewType === 'list' && listScrollMode === 'horizontal' 
                ? 'max-content'
                : (listScrollMode === 'horizontal' && viewType === 'grid'
                    ? `${(!isDesktop && applyOnlyToDesktop ? 2 : gridColumns) * 160}px`
                    : '100%'),
              paddingBottom: '140px'
            }}
          >
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
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                          {box && (
                            <span className="item-list-box">{box.name}</span>
                          )}
                          {(item.room || box?.room) && (
                            <span className="item-list-box">Location: {item.room || box?.room}</span>
                          )}
                          {warranty && (
                            <span style={{
                              backgroundColor: 'var(--surface-hover)',
                              color: warranty.color,
                              border: '1px solid var(--border-color)',
                              padding: '3px 8px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              marginTop: '4px',
                              marginBottom: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              {warranty.isExpired ? 'Expired' : warranty.text}
                            </span>
                          )}
                        </div>
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
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                        {box && (
                          <div className="item-card-box-info" style={{ margin: 0 }}>
                            <Package size={12} />
                            <span>{box.name}</span>
                          </div>
                        )}
                        {(item.room || box?.room) && (
                          <div className="item-card-box-info" style={{ margin: 0 }}>
                            <span>Location: {item.room || box?.room}</span>
                          </div>
                        )}
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
        <ItemAddModal 
          boxes={boxes}
          isUploading={isUploading}
          onClose={() => {
            setIsAddingItem(false);
            setTempAddImages([]);
            setTempAddReceipts([]);
          }}
          onSave={handleSaveNewItem}
          onImageRequest={(type) => {
            const context = { type, itemId: 'new-item' };
            uploadContextRef.current = context;
            localStorage.setItem('uploadContext', JSON.stringify(context));
            setImageSourceModal({ type });
          }}
          onPreviewImage={(images, index) => setFullscreenImage({ images, index })}
          onAddTag={addTag}
          onDrop={handleDropFiles}
          tempImages={tempAddImages}
          tempReceipts={tempAddReceipts}
          onRemoveTempImage={(type, index) => {
            if (type === 'item') setTempAddImages(prev => prev.filter((_, i) => i !== index));
            else setTempAddReceipts(prev => prev.filter((_, i) => i !== index));
          }}
        />
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
        <TagManagementModal onClose={() => setIsManagingTags(false)} />
      )}

      {editingItem && (
        <ItemEditModal 
          item={editingItem}
          boxes={boxes}
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
            localStorage.setItem('uploadContext', JSON.stringify(context));
            setImageSourceModal({ type });
          }}
          onPreviewImage={(images, index) => setFullscreenImage({ images, index })}
          onAddTag={addTag}
          onDrop={handleDropFiles}
          tempImages={tempEditImages}
          tempReceipts={tempEditReceipts}
          onRemoveTempImage={(type, index) => {
            if (type === 'item') setTempEditImages(prev => prev.filter((_, i) => i !== index));
            else setTempEditReceipts(prev => prev.filter((_, i) => i !== index));
          }}
        />
      )}

      {imageSourceModal && (
        <ImageSourceModal 
          onSelect={(source) => {
            if (source === 'camera') {
              setIsCustomCameraOpen(true);
            } else {
              fileInputRef.current?.click();
            }
            setImageSourceModal(null);
          }}
          onClose={() => setImageSourceModal(null)}
        />
      )}

      {isCustomCameraOpen && (
        <CameraCapture 
          onCapture={async (file) => {
            setIsCustomCameraOpen(false);
            let context = uploadContextRef.current;
            if (!context) {
              const contextJson = localStorage.getItem('uploadContext');
              if (contextJson) context = JSON.parse(contextJson);
            }
            if (context) {
              const { type, itemId } = context;
              uploadContextRef.current = null;
              localStorage.removeItem('uploadContext');
              await handleUploadFiles([file], type, itemId);
            }
          }}
          onClose={() => setIsCustomCameraOpen(false)}
        />
      )}

      {fullscreenImage && (
        <FullscreenGallery 
          images={fullscreenImage.images} 
          initialIndex={fullscreenImage.index} 
          onClose={() => setFullscreenImage(null)}
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

      {showDisplaySettings && (
        <div className="action-sheet-overlay" onClick={handleCancelSettings}>
          <div className="action-sheet" onClick={e => e.stopPropagation()}>
            <div className="action-sheet-header">
              <h3>Display Settings</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px'}}>
                Customize your item view layout.
              </p>
            </div>
            <div className="action-sheet-options" style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'block', marginBottom: '12px' }}>
                    <span>Grid Columns</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', backgroundColor: 'var(--surface-hover)', padding: '12px', borderRadius: '16px' }}>
                    <button 
                      className="stepper-btn" 
                      onClick={() => setGridColumns(Math.max(1, gridColumns - 1))}
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <Minus size={20} />
                    </button>
                    <span style={{ fontSize: '24px', fontWeight: '800', minWidth: '30px', textAlign: 'center' }}>{gridColumns}</span>
                    <button 
                      className="stepper-btn" 
                      onClick={() => setGridColumns(Math.min(6, gridColumns + 1))}
                      style={{ background: 'var(--primary-color)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>List Scroll Mode</span>
                </label>
                <div style={{ display: 'flex', background: 'var(--surface-hover)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
                  <button 
                    className={`view-toggle-btn ${listScrollMode === 'vertical' ? 'active' : ''}`}
                    onClick={() => setListScrollMode('vertical')}
                    style={{ flex: 1, padding: '10px' }}
                  >
                    Vertical
                  </button>
                  <button 
                    className={`view-toggle-btn ${listScrollMode === 'horizontal' ? 'active' : ''}`}
                    onClick={() => setListScrollMode('horizontal')}
                    style={{ flex: 1, padding: '10px' }}
                  >
                    Horizontal
                  </button>
                </div>
              </div>

              {listScrollMode === 'horizontal' && (
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>List Rows</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'center', backgroundColor: 'var(--surface-hover)', padding: '12px', borderRadius: '16px' }}>
                    <button 
                      className="stepper-btn" 
                      onClick={() => setListRows(Math.max(1, listRows - 1))}
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <Minus size={20} />
                    </button>
                    <span style={{ fontSize: '24px', fontWeight: '800', minWidth: '40px', textAlign: 'center' }}>{listRows}</span>
                    <button 
                      className="stepper-btn" 
                      onClick={() => setListRows(Math.min(10, listRows + 1))}
                      style={{ background: 'var(--primary-color)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              )}

              {listScrollMode === 'vertical' && (
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>List Columns</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'center', backgroundColor: 'var(--surface-hover)', padding: '12px', borderRadius: '16px' }}>
                    <button 
                      className="stepper-btn" 
                      onClick={() => setListColumns(Math.max(1, listColumns - 1))}
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <Minus size={20} />
                    </button>
                    <span style={{ fontSize: '24px', fontWeight: '800', minWidth: '40px', textAlign: 'center' }}>{listColumns}</span>
                    <button 
                      className="stepper-btn" 
                      onClick={() => setListColumns(Math.min(6, listColumns + 1))}
                      style={{ background: 'var(--primary-color)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              )}

              <div 
                className="toggle-wrapper" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '20px', 
                  cursor: 'pointer',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  transition: 'background-color 0.2s'
                }} 
                onClick={() => setApplyOnlyToDesktop(!applyOnlyToDesktop)}
              >
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Apply only to Web (Desktop)
                </span>
                
                {/* Custom Premium Sliding Switch Toggle */}
                <div style={{
                  width: '46px',
                  height: '26px',
                  borderRadius: '100px',
                  backgroundColor: applyOnlyToDesktop ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.08)',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transform: applyOnlyToDesktop ? 'translateX(20px)' : 'translateX(0)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                  }} />
                </div>
              </div>

              <button className="submit-btn" style={{ width: '100%', marginTop: '20px' }} onClick={handleSaveSettings}>
                Save
              </button>
              
              <button 
                type="button"
                className="option-btn" 
                style={{ 
                  width: '100%', 
                  marginTop: '12px', 
                  padding: '16px', 
                  borderRadius: '16px', 
                  border: 'none', 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                  color: 'var(--text-secondary)', 
                  fontSize: '16px', 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }} 
                onClick={handleCancelSettings}
              >
                Cancel
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
