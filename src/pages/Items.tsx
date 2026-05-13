import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Plus, ChevronRight, X, Camera, LayoutGrid, List } from 'lucide-react';
import { useItems, Item } from '../hooks/useItems';
import { useBoxes } from '../hooks/useBoxes';
import { getWarrantyStatus } from '../utils/warranty';
import { getTagColor } from '../utils/tagColors';

const ItemsPage = () => {
  const navigate = useNavigate();
  const { items, loading: itemsLoading, addItem } = useItems();
  const { boxes } = useBoxes();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'list'>(localStorage.getItem('itemsViewType') as 'grid' | 'list' || 'grid');

  const toggleView = (type: 'grid' | 'list') => {
    setViewType(type);
    localStorage.setItem('itemsViewType', type);
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    return item.name?.toLowerCase().includes(q);
  });

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !selectedBoxId) return;

    try {
      await addItem(newItemName, 1, selectedBoxId, newItemDescription);
      setIsAddingItem(false);
      setNewItemName('');
      setNewItemDescription('');
      setSelectedBoxId('');
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
                    onClick={() => navigate(`/box/${item.boxId}`)}
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
                        <span className="item-list-box">{box?.name || 'Unknown Box'}</span>
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
                  onClick={() => navigate(`/box/${item.boxId}`)}
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
    </div>
  );
};

export default ItemsPage;
