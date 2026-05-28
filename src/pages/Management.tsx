import React, { useState } from 'react';
import { MapPin, Tag, Layers, Edit2, Trash2, Plus, X, Search } from 'lucide-react';
import { useBoxes } from '../hooks/useBoxes';
import { useItems } from '../hooks/useItems';
import { useItemTags } from '../hooks/useItemTags';
import { getTagColor } from '../utils/tagColors';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useCustomData } from '../hooks/useCustomData';

type ActiveTab = 'locations' | 'tags' | 'groups';

export const ManagementPage = () => {
  const { boxes, updateBox, loading: boxesLoading } = useBoxes();
  const { items, updateItem, loading: itemsLoading } = useItems();
  const { tags, tagCounts, loading: tagsLoading, renameTag, removeTag, addTag } = useItemTags();
  const { 
    customLocations, 
    customGroups, 
    addCustomLocation, 
    addCustomGroup, 
    deleteCustomLocationByName, 
    deleteCustomGroupByName,
    loading: customLoading
  } = useCustomData();

  const [activeTab, setActiveTab] = useState<ActiveTab>('locations');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tag Creation State
  const [newTagName, setNewTagName] = useState('');

  // Add Bottom Sheet States
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [addInputValue, setAddInputValue] = useState('');
  const [addSheetClosing, setAddSheetClosing] = useState(false);

  // Editing Modals / Dialog State
  const [editingItem, setEditingItem] = useState<{
    type: 'location' | 'tag' | 'group';
    oldValue: string;
    newValue: string;
  } | null>(null);

  // Deletion Confirmation States
  const [deletingItem, setDeletingItem] = useState<{
    type: 'location' | 'tag' | 'group';
    value: string;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const isLoading = boxesLoading || itemsLoading || tagsLoading || customLoading;

  // --- DYNAMIC DATA EXTRACTION ---
  
  // Locations (Rooms) extracted dynamically & merged with custom ones
  const dynamicLocations = React.useMemo(() => {
    const set = new Set([
      ...boxes.map(b => b.room || ''),
      ...items.map(i => i.room || ''),
      ...customLocations.map(cl => cl.name)
    ]);
    return Array.from(set).filter(Boolean).sort();
  }, [boxes, items, customLocations]);

  // Groups extracted dynamically from items & merged with custom ones
  const dynamicGroups = React.useMemo(() => {
    const set = new Set([
      ...items.map(i => i.groupName || ''),
      ...customGroups.map(cg => cg.name)
    ]);
    return Array.from(set).filter(Boolean).sort();
  }, [items, customGroups]);

  // --- HANDLERS FOR UPDATES & DELETIONS ---

  // Locations Handler
  const handleRenameLocation = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    setIsProcessing(true);
    try {
      // 1. Update all boxes with this room
      const boxesToUpdate = boxes.filter(b => b.room === oldName);
      await Promise.all(boxesToUpdate.map(b => updateBox(b.id, { room: newName.trim() })));

      // 2. Update all items with this room
      const itemsToUpdate = items.filter(i => i.room === oldName);
      await Promise.all(itemsToUpdate.map(i => updateItem(i.id, { room: newName.trim() })));

      // 3. Sync custom locations in Firestore
      await deleteCustomLocationByName(oldName);
      await addCustomLocation(newName.trim());

      setEditingItem(null);
    } catch (err) {
      console.error("Failed to rename location:", err);
      alert("Error renaming location. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLocation = async (roomName: string) => {
    setIsProcessing(true);
    try {
      // Set room of all matching boxes and items to empty string
      const boxesToUpdate = boxes.filter(b => b.room === roomName);
      await Promise.all(boxesToUpdate.map(b => updateBox(b.id, { room: '' })));

      const itemsToUpdate = items.filter(i => i.room === roomName);
      await Promise.all(itemsToUpdate.map(i => updateItem(i.id, { room: '' })));

      // Sync custom locations in Firestore
      await deleteCustomLocationByName(roomName);

      setDeletingItem(null);
    } catch (err) {
      console.error("Failed to clear location:", err);
      alert("Error clearing location. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Groups Handler
  const handleRenameGroup = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    setIsProcessing(true);
    try {
      const itemsToUpdate = items.filter(i => i.groupName === oldName);
      await Promise.all(itemsToUpdate.map(i => updateItem(i.id, { groupName: newName.trim() })));

      // Sync custom groups in Firestore
      await deleteCustomGroupByName(oldName);
      await addCustomGroup(newName.trim());

      setEditingItem(null);
    } catch (err) {
      console.error("Failed to rename group:", err);
      alert("Error renaming group. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteGroup = async (groupName: string) => {
    setIsProcessing(true);
    try {
      const itemsToUpdate = items.filter(i => i.groupName === groupName);
      await Promise.all(itemsToUpdate.map(i => updateItem(i.id, { groupName: '' })));

      // Sync custom groups in Firestore
      await deleteCustomGroupByName(groupName);

      setDeletingItem(null);
    } catch (err) {
      console.error("Failed to clear group:", err);
      alert("Error clearing group. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Tags Handler
  const handleRenameTag = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    setIsProcessing(true);
    try {
      await renameTag(oldName, newName);
      setEditingItem(null);
    } catch (err) {
      console.error("Failed to rename tag:", err);
      alert("Error renaming tag.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    setIsProcessing(true);
    try {
      await removeTag(tagName);
      setDeletingItem(null);
    } catch (err) {
      console.error("Failed to delete tag:", err);
      alert("Error deleting tag.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      await addTag(newTagName.trim());
      setNewTagName('');
    } catch (err) {
      console.error("Failed to add new tag:", err);
    }
  };

  // --- FAB BOTTOM SHEET HANDLERS ---
  const handleOpenAddSheet = () => {
    setAddInputValue('');
    setIsAddSheetOpen(true);
    setAddSheetClosing(false);
  };

  const handleCloseAddSheet = () => {
    setAddSheetClosing(true);
    setTimeout(() => {
      setIsAddSheetOpen(false);
      setAddSheetClosing(false);
    }, 300);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInputValue.trim()) return;
    setIsProcessing(true);
    try {
      if (activeTab === 'locations') {
        await addCustomLocation(addInputValue);
      } else if (activeTab === 'groups') {
        await addCustomGroup(addInputValue);
      } else if (activeTab === 'tags') {
        await addTag(addInputValue);
      }
      handleCloseAddSheet();
    } catch (err) {
      console.error("Failed to add from FAB:", err);
      alert("Error adding. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- SUBMIT CONTROLLER ---
  const handleSaveRename = () => {
    if (!editingItem) return;
    if (editingItem.type === 'location') {
      handleRenameLocation(editingItem.oldValue, editingItem.newValue);
    } else if (editingItem.type === 'group') {
      handleRenameGroup(editingItem.oldValue, editingItem.newValue);
    } else if (editingItem.type === 'tag') {
      handleRenameTag(editingItem.oldValue, editingItem.newValue);
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    if (deletingItem.type === 'location') {
      handleDeleteLocation(deletingItem.value);
    } else if (deletingItem.type === 'group') {
      handleDeleteGroup(deletingItem.value);
    } else if (deletingItem.type === 'tag') {
      handleDeleteTag(deletingItem.value);
    }
  };

  return (
    <div className="page-content" style={{ paddingBottom: '140px' }}>
      <header className="page-header-minimal">
        <h2 className="header-title">Management <span className="header-count" style={{ fontSize: '14px', opacity: 0.6 }}>Dashboard</span></h2>
      </header>

      {/* Modern Tabs Navigation */}
      <div style={{
        display: 'flex',
        background: 'var(--surface-color)',
        padding: '6px',
        borderRadius: '16px',
        gap: '6px',
        marginBottom: '20px',
        border: '1px solid var(--border-color)'
      }}>
        <button
          onClick={() => { setActiveTab('locations'); setSearchQuery(''); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 8px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'locations' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'locations' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          <MapPin size={18} />
          <span>Locations</span>
        </button>

        <button
          onClick={() => { setActiveTab('tags'); setSearchQuery(''); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 8px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'tags' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'tags' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          <Tag size={18} />
          <span>Tags</span>
        </button>

        <button
          onClick={() => { setActiveTab('groups'); setSearchQuery(''); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 8px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'groups' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'groups' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          <Layers size={18} />
          <span>Groups</span>
        </button>
      </div>

      {/* Global Search Bar */}
      <div className="search-container" style={{ marginBottom: '20px' }}>
        <div className="search-bar">
          {searchQuery ? (
            <button className="search-clear-text-btn" onClick={() => setSearchQuery('')}>Clear</button>
          ) : (
            <Search size={20} className="search-icon-static" />
          )}
          <input
            type="search"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
          />
        </div>
      </div>

      {/* Quick Add Tag Bar */}
      {activeTab === 'tags' && (
        <form onSubmit={handleAddNewTag} style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          background: 'var(--surface-color)',
          padding: '12px',
          borderRadius: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <input
            type="search"
            placeholder="Add new global tag..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#fff',
              fontSize: '14px'
            }}
            autoComplete="off"
          />
          <button type="submit" className="submit-btn" style={{
            padding: '10px 18px',
            borderRadius: '12px',
            marginTop: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            whiteSpace: 'nowrap'
          }}>
            <Plus size={16} />
            <span>Add Tag</span>
          </button>
        </form>
      )}

      {/* Tab Panels */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="loader"></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* TAB: LOCATIONS */}
          {activeTab === 'locations' && (() => {
            const filtered = dynamicLocations.filter(loc =>
              loc.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (filtered.length === 0) {
              return <p className="status-text">No locations found.</p>;
            }

            return filtered.map(loc => {
              const boxCount = boxes.filter(b => b.room === loc).length;
              const itemCount = items.filter(i => i.room === loc).length;

              return (
                <div key={loc} className="box-item-row" style={{ padding: '16px 20px', cursor: 'default' }}>
                  <div className="box-row-main" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(62, 130, 247, 0.15)',
                        color: 'var(--primary-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <MapPin size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{loc}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {boxCount} boxes • {itemCount} items
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setEditingItem({ type: 'location', oldValue: loc, newValue: loc })}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          color: '#fff',
                          padding: '10px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        title="Rename Location"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingItem({ type: 'location', value: loc })}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: 'none',
                          color: 'var(--error-color)',
                          padding: '10px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        title="Clear from all Boxes & Items"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            });
          })()}

          {/* TAB: TAGS */}
          {activeTab === 'tags' && (() => {
            const filtered = tags.filter(tag =>
              tag.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (filtered.length === 0) {
              return <p className="status-text">No tags found.</p>;
            }

            return filtered.map(tag => {
              const count = tagCounts[tag] || 0;
              const colors = getTagColor(tag);

              return (
                <div key={tag} className="box-item-row" style={{ padding: '16px 20px', cursor: 'default' }}>
                  <div className="box-row-main" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(247, 130, 62, 0.15)',
                        color: 'var(--accent-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Tag size={20} />
                      </div>
                      <div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border || colors.bg}`,
                          display: 'inline-block',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {tag}
                        </span>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          Used in {count} items
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setEditingItem({ type: 'tag', oldValue: tag, newValue: tag })}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          color: '#fff',
                          padding: '10px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        title="Rename Tag"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingItem({ type: 'tag', value: tag })}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: 'none',
                          color: 'var(--error-color)',
                          padding: '10px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        title="Remove Global Tag"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            });
          })()}

          {/* TAB: GROUPS */}
          {activeTab === 'groups' && (() => {
            const filtered = dynamicGroups.filter(grp =>
              grp.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (filtered.length === 0) {
              return <p className="status-text">No groups found.</p>;
            }

            return filtered.map(grp => {
              const count = items.filter(i => i.groupName === grp).length;

              return (
                <div key={grp} className="box-item-row" style={{ padding: '16px 20px', cursor: 'default' }}>
                  <div className="box-row-main" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(50, 215, 75, 0.15)',
                        color: 'var(--success-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Layers size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{grp}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Contains {count} items
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setEditingItem({ type: 'group', oldValue: grp, newValue: grp })}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          color: '#fff',
                          padding: '10px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        title="Rename Group"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingItem({ type: 'group', value: grp })}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: 'none',
                          color: 'var(--error-color)',
                          padding: '10px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        title="Clear from all Items"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            });
          })()}

        </div>
      )}

      {/* RENAME MODAL */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Rename {editingItem.type}</h3>
              <button
                onClick={() => setEditingItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>Current Name</label>
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '14px'
              }}>
                {editingItem.oldValue}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>New Name</label>
              <input
                type="search"
                value={editingItem.newValue}
                onChange={(e) => setEditingItem({ ...editingItem, newValue: e.target.value })}
                placeholder={`Enter new ${editingItem.type} name...`}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '14px'
                }}
                autoComplete="off"
                disabled={isProcessing}
                autoFocus
              />
            </div>

            <div className="modal-actions-vertical">
              <button
                className="submit-btn"
                onClick={handleSaveRename}
                disabled={isProcessing || !editingItem.newValue.trim() || editingItem.newValue.trim() === editingItem.oldValue}
                style={{ width: '100%', marginTop: 0 }}
              >
                {isProcessing ? 'Saving Changes...' : 'Save Changes'}
              </button>
              <button
                className="modal-btn-secondary"
                onClick={() => setEditingItem(null)}
                disabled={isProcessing}
                style={{ width: '100%' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE/REMOVE MODAL */}
      {deletingItem && (
        <ConfirmationModal
          isOpen={true}
          title={`Remove ${deletingItem.type}?`}
          message={
            deletingItem.type === 'tag'
              ? `Are you sure you want to remove the tag "${deletingItem.value}"? This will permanently delete the global tag suggestion and detach it from all items currently using it.`
              : `Are you sure you want to clear "${deletingItem.value}" from all boxes and items? They will be set to no ${deletingItem.type}, but no boxes or items will be deleted.`
          }
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingItem(null)}
          type="destructive"
        />
      )}

      {/* Dynamic Action FAB Button */}
      <button
        onClick={handleOpenAddSheet}
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '28px',
          backgroundColor: '#ff8c3b',
          color: '#ffffff',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(255, 140, 59, 0.4)',
          cursor: 'pointer',
          zIndex: 1000,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.backgroundColor = '#ffa05c';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = '#ff8c3b';
        }}
        title={`Add new ${activeTab.substring(0, activeTab.length - 1)}`}
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* Premium Slide-Up Action Sheet Modal */}
      {isAddSheetOpen && (
        <div 
          className={`action-sheet-overlay ${addSheetClosing ? 'fade-out' : ''}`} 
          onClick={handleCloseAddSheet}
        >
          <div 
            className={`action-sheet ${addSheetClosing ? 'slide-down' : ''}`} 
            onClick={(e) => e.stopPropagation()}
            style={{
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              maxWidth: '480px',
              background: '#121214',
              border: '1px solid rgba(255,255,255,0.08)',
              borderBottom: 'none'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', textTransform: 'capitalize' }}>
                Add New {activeTab.substring(0, activeTab.length - 1)}
              </h3>
              <button
                onClick={handleCloseAddSheet}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'rgba(255,255,255,0.5)', 
                  cursor: 'pointer',
                  padding: '4px' 
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                  Name
                </label>
                <input
                  type="search"
                  value={addInputValue}
                  onChange={(e) => setAddInputValue(e.target.value)}
                  placeholder={`Enter new ${activeTab.substring(0, activeTab.length - 1)} name...`}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    color: '#fff',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  autoComplete="off"
                  disabled={isProcessing}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-actions-vertical" style={{ gap: '12px' }}>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isProcessing || !addInputValue.trim()}
                  style={{ 
                    width: '100%', 
                    marginTop: 0,
                    padding: '14px',
                    backgroundColor: '#ff8c3b',
                    color: '#fff',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '15px'
                  }}
                >
                  {isProcessing ? 'Adding...' : `Add ${activeTab.substring(0, activeTab.length - 1)}`}
                </button>
                <button
                  type="button"
                  className="modal-btn-secondary"
                  onClick={handleCloseAddSheet}
                  disabled={isProcessing}
                  style={{ 
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '15px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
