import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Edit3, X, Camera, Package, ChevronDown, Search, Copy, Move, ChevronRight, FolderMinus, FolderPlus } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getTagColor } from '../utils/tagColors';
import { getWarrantyStatus } from '../utils/warranty';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems, Item } from '../hooks/useItems';
import { useBoxes } from '../hooks/useBoxes';
import { useItemTags } from '../hooks/useItemTags';
import { QRCodeCanvas } from 'qrcode.react';
import { compressImage, blobToBase64 } from '../utils/imageUtils';
import { ItemEditModal, ImageSourceModal, FullscreenGallery, QRCodePreviewModal } from '../components/ItemModals';
import { ConfirmationModal } from '../components/ConfirmationModal';

const BoxDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [box, setBox] = useState<any>(null);
  const { items, loading: itemsLoading, addItem, removeItem, updateItem } = useItems(id || '');
  const { boxes, updateBox, deleteBox, migrateBoxToNumeric } = useBoxes();
  const { items: allItems } = useItems(); // Global user items search
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editHasQRCode, setEditHasQRCode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Slide-up bottom sheet states
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isClosingAddSheet, setIsClosingAddSheet] = useState(false);
  const [addSheetMode, setAddSheetMode] = useState<'choice' | 'create' | 'existing'>('create');
  const [activeGroupNameForAdd, setActiveGroupNameForAdd] = useState('');

  // Quick Create Form states
  const [sheetItemName, setSheetItemName] = useState('');
  const [sheetQty, setSheetQty] = useState(1);
  const [sheetGroupName, setSheetGroupName] = useState('');
  const [sheetNewGroupInput, setSheetNewGroupInput] = useState('');

  // Quick Create Tags states
  const [sheetSelectedTags, setSheetSelectedTags] = useState<string[]>([]);
  const [sheetTagInput, setSheetTagInput] = useState('');
  const { tags: allAvailableTags, addTag: addGlobalTag } = useItemTags();

  // Search existing states
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');
  const [selectedExistingItem, setSelectedExistingItem] = useState<any | null>(null);

  // Multi-Selection Mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isBulkGroupSheetOpen, setIsBulkGroupSheetOpen] = useState(false);
  const [isClosingBulkGroupSheet, setIsClosingBulkGroupSheet] = useState(false);
  const [bulkNewGroupInput, setBulkNewGroupInput] = useState('');
  const [bulkLocalCreatedGroups, setBulkLocalCreatedGroups] = useState<string[]>([]);

  // Group Collapsed states (persisted offline)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`collapsedGroups_${id}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const globalGroups = React.useMemo(() => {
    const groupsSet = new Set<string>();
    items.forEach(item => {
      if (item.groupName && item.groupName.trim() !== '') {
        groupsSet.add(item.groupName.trim());
      }
    });
    return Array.from(groupsSet).sort();
  }, [items]);

  const [sheetLocalCreatedGroups, setSheetLocalCreatedGroups] = useState<string[]>([]);

  const handleAddSheetNewGroup = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    if (!sheetLocalCreatedGroups.includes(trimmed)) {
      setSheetLocalCreatedGroups(prev => [...prev, trimmed]);
    }
    setSheetGroupName(trimmed);
    setSheetNewGroupInput('');
  };

  const handleSheetTagToggle = (tag: string) => {
    setSheetSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddSheetNewTag = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    if (!sheetSelectedTags.includes(trimmed)) {
      setSheetSelectedTags(prev => [...prev, trimmed]);
    }
    addGlobalTag(trimmed);
    setSheetTagInput('');
  };

  const renderedGroups = React.useMemo(() => {
    const unionSet = new Set<string>(globalGroups);
    sheetLocalCreatedGroups.forEach(g => unionSet.add(g));
    if (sheetGroupName && sheetGroupName.trim() !== '') {
      unionSet.add(sheetGroupName.trim());
    }
    return Array.from(unionSet).sort();
  }, [globalGroups, sheetLocalCreatedGroups, sheetGroupName]);

  const toggleGroup = (groupName: string) => {
    const newCollapsed = { ...collapsedGroups, [groupName]: !collapsedGroups[groupName] };
    setCollapsedGroups(newCollapsed);
    localStorage.setItem(`collapsedGroups_${id}`, JSON.stringify(newCollapsed));
  };

  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{images: string[], index: number} | null>(null);
  const [imageSourceModal, setImageSourceModal] = useState<{type: 'box' | 'item' | 'receipt', itemId?: string} | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isClosingDiscard, setIsClosingDiscard] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [showExpired, setShowExpired] = useState(localStorage.getItem('showExpiredStatus') !== 'false');
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
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

  const renderedBulkGroups = React.useMemo(() => {
    const unionSet = new Set<string>(globalGroups);
    bulkLocalCreatedGroups.forEach(g => unionSet.add(g));
    return Array.from(unionSet).sort();
  }, [globalGroups, bulkLocalCreatedGroups]);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedItemIds([]);
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId) 
        : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredItems.map(item => item.id);
    const allSelected = visibleIds.every(id => selectedItemIds.includes(id));
    if (allSelected) {
      setSelectedItemIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedItemIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkGroupAssign = async (groupName: string) => {
    const trimmedGroup = groupName.trim();
    try {
      await Promise.all(selectedItemIds.map(itemId => 
        updateItem(itemId, { groupName: trimmedGroup })
      ));
      handleCloseBulkGroupSheet();
      setIsSelectionMode(false);
      setSelectedItemIds([]);
    } catch (err) {
      console.error("Error bulk assigning group:", err);
      alert("Failed to assign group to items.");
    }
  };

  const handleBulkRemoveGroup = async () => {
    try {
      await Promise.all(selectedItemIds.map(itemId => 
        updateItem(itemId, { groupName: '' })
      ));
      setIsSelectionMode(false);
      setSelectedItemIds([]);
    } catch (err) {
      console.error("Error bulk removing group:", err);
      alert("Failed to remove group from items.");
    }
  };

  const handleBulkDelete = () => {
    if (selectedItemIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Items',
      message: `Are you sure you want to permanently delete all ${selectedItemIds.length} selected items? This action cannot be undone.`,
      type: 'destructive',
      onConfirm: async () => {
        try {
          await Promise.all(selectedItemIds.map(itemId => 
            removeItem(itemId)
          ));
          setIsSelectionMode(false);
          setSelectedItemIds([]);
        } catch (err) {
          console.error("Error bulk deleting items:", err);
          alert("Failed to delete items.");
        }
      }
    });
  };

  const handleCloseBulkGroupSheet = () => {
    setIsClosingBulkGroupSheet(true);
    setTimeout(() => {
      setIsBulkGroupSheetOpen(false);
      setIsClosingBulkGroupSheet(false);
      setBulkNewGroupInput('');
      setBulkLocalCreatedGroups([]);
    }, 300);
  };

  const handleBulkGroupSheetNewGroup = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    if (!bulkLocalCreatedGroups.includes(trimmed)) {
      setBulkLocalCreatedGroups(prev => [...prev, trimmed]);
    }
    setBulkNewGroupInput('');
    handleBulkGroupAssign(trimmed);
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
          setEditImageUrl(data.imageUrl || '');
          setEditHasQRCode(!!data.hasQRCode);
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

    // Reorder images so the selected thumbnail is first
    let newImages = [...(box.images || [])];
    if (editImageUrl && newImages.includes(editImageUrl)) {
      newImages = [editImageUrl, ...newImages.filter(img => img !== editImageUrl)];
    }

    const isAlphanumeric = isNaN(Number(id));
    if (isAlphanumeric && editHasQRCode) {
      try {
        const newNumericId = await migrateBoxToNumeric(id, {
          name: editName,
          room: editRoom,
          hasQRCode: true,
          imageUrl: editImageUrl,
          images: newImages
        });
        setIsEditing(false);
        navigate(`/box/${newNumericId}`);
        return;
      } catch (err) {
        console.error("Failed to migrate box to numeric ID:", err);
        alert("Migration failed. Please check your network.");
        return;
      }
    }

    await updateBox(id, { 
      name: editName, 
      room: editRoom, 
      hasQRCode: editHasQRCode, 
      imageUrl: editImageUrl,
      images: newImages
    });
    setBox({ 
      ...box, 
      name: editName, 
      room: editRoom, 
      hasQRCode: editHasQRCode, 
      imageUrl: editImageUrl,
      images: newImages
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    // Check if anything changed
    const hasChanged = editName !== box.name || 
                       editRoom !== box.room ||
                       editImageUrl !== (box.imageUrl || '') ||
                       editHasQRCode !== !!box.hasQRCode;
    
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
    setEditImageUrl(box.imageUrl || '');
    setEditHasQRCode(!!box.hasQRCode);
    setSelectedTagFilters([]);
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

  const handleDeleteBox = async () => {
    if (!id) return;
    await deleteBox(id);
    navigate('/');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCloseAddSheet = () => {
    setIsClosingAddSheet(true);
    setTimeout(() => {
      setIsAddSheetOpen(false);
      setIsClosingAddSheet(false);
      // Reset form states
      setAddSheetMode('create');
      setSheetItemName('');
      setSheetQty(1);
      setSheetGroupName('');
      setSheetNewGroupInput('');
      setSheetLocalCreatedGroups([]);
      setSheetSearchQuery('');
      setSelectedExistingItem(null);
      setActiveGroupNameForAdd('');
      setSheetSelectedTags([]);
      setSheetTagInput('');
    }, 300);
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetItemName.trim()) return;

    try {
      await addItem(
        sheetItemName.trim(),
        sheetQty,
        id,
        '', // description
        sheetSelectedTags, // tags
        [], // images
        [], // receipts
        '', // purchaseDate
        '', // warrantyExpire
        sheetGroupName.trim()
      );
      handleCloseAddSheet();
    } catch (err) {
      console.error("Error quick creating item:", err);
      alert("Failed to create item.");
    }
  };

  const handleOpenAdvanced = async () => {
    if (!sheetItemName.trim()) {
      alert("Please enter a name first.");
      return;
    }

    try {
      const newId = await addItem(
        sheetItemName.trim(),
        sheetQty,
        id,
        '',
        sheetSelectedTags,
        [],
        [],
        '',
        '',
        sheetGroupName.trim()
      );

      // Construct a draft editing item to open the advanced modal immediately
      const newItem: any = {
        id: newId,
        name: sheetItemName.trim(),
        quantity: sheetQty,
        boxId: id || '',
        groupName: sheetGroupName.trim(),
        description: '',
        tags: sheetSelectedTags,
        images: [],
        receipts: [],
        purchaseDate: '',
        warrantyExpire: '',
        uid: user?.uid || '',
      };

      setEditingItem(newItem);
      
      // Close the bottom sheet with animation
      setIsClosingAddSheet(true);
      setTimeout(() => {
        setIsAddSheetOpen(false);
        setIsClosingAddSheet(false);
        // Reset sheet form fields
        setAddSheetMode('create');
        setSheetItemName('');
        setSheetQty(1);
        setSheetGroupName('');
        setSheetNewGroupInput('');
        setSheetLocalCreatedGroups([]);
        setSheetSearchQuery('');
        setSelectedExistingItem(null);
        setActiveGroupNameForAdd('');
        setSheetSelectedTags([]);
        setSheetTagInput('');
      }, 300);
    } catch (err) {
      console.error("Error creating item for advanced edit:", err);
      alert("Failed to proceed to advanced edit.");
    }
  };

  const handleTransferItem = async (transferType: 'move' | 'copy') => {
    if (!selectedExistingItem) return;

    try {
      const destinationGroupName = activeGroupNameForAdd || selectedExistingItem.groupName || '';
      
      if (transferType === 'move') {
        await updateItem(selectedExistingItem.id, {
          boxId: id,
          groupName: destinationGroupName
        });
      } else {
        await addItem(
          selectedExistingItem.name,
          selectedExistingItem.quantity || 1,
          id, // boxId
          selectedExistingItem.description || '',
          selectedExistingItem.tags || [],
          selectedExistingItem.images || [],
          selectedExistingItem.receipts || [],
          selectedExistingItem.purchaseDate || '',
          selectedExistingItem.warrantyExpire || '',
          destinationGroupName
        );
      }

      handleCloseAddSheet();
    } catch (err) {
      console.error(`Error transferring item (${transferType}):`, err);
      alert(`Failed to ${transferType} item.`);
    }
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

  const itemBoxes = React.useMemo(() => {
    const map: Record<string, string> = {};
    boxes.forEach(b => {
      map[b.id] = b.name;
    });
    return map;
  }, [boxes]);

  const filteredExistingItems = React.useMemo(() => {
    if (!sheetSearchQuery.trim()) return [];
    const queryStr = sheetSearchQuery.toLowerCase().trim();
    return allItems.filter(item => {
      if (item.boxId === id) return false;
      const matchesName = item.name.toLowerCase().includes(queryStr);
      const matchesTag = item.tags?.some(t => t.toLowerCase().includes(queryStr));
      return matchesName || matchesTag;
    });
  }, [allItems, sheetSearchQuery, id]);

  const filteredItems = React.useMemo(() => {
    return items.filter(item => selectedTagFilters.length === 0 || selectedTagFilters.some(tag => (item.tags || []).includes(tag)));
  }, [items, selectedTagFilters]);

  const hasAnyGroups = React.useMemo(() => {
    return items.some(item => item.groupName && item.groupName.trim() !== '');
  }, [items]);

  const groupedItems = React.useMemo(() => {
    const groups: Record<string, Item[]> = {};
    filteredItems.forEach(item => {
      const g = item.groupName && item.groupName.trim() !== '' ? item.groupName.trim() : 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });
    return groups;
  }, [filteredItems]);

  const sortedGroupNames = React.useMemo(() => {
    const keys = Object.keys(groupedItems);
    return keys.sort((a, b) => {
      if (a === 'General') return 1;
      if (b === 'General') return -1;
      return a.localeCompare(b);
    });
  }, [groupedItems]);

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
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Box Name</label>
              <input 
                type="text" 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                required 
                autoComplete="off"
                style={{ width: '100%' }}
              />
            </div>
            
            <div className="form-row-compact">
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
              <div className="form-group" style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <input 
                    type="checkbox" 
                    checked={editHasQRCode} 
                    onChange={(e) => setEditHasQRCode(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  QR Code
                </label>
              </div>
            </div>

            {/* Box Image Selection */}
            {box.images && box.images.length > 0 && (
              <div className="box-image-selector" style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Select Main Image</label>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
                  {box.images.map((img: string) => (
                    <div 
                      key={img}
                      onClick={() => setEditImageUrl(img)}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: `2px solid ${editImageUrl === img ? 'var(--primary-color)' : 'transparent'}`,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s'
                      }}
                    >
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  <div 
                    onClick={() => setEditImageUrl('')}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px solid ${editImageUrl === '' ? 'var(--primary-color)' : 'transparent'}`,
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <Package size={20} color="var(--text-secondary)" />
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      ) : (
        <div className="box-hero" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="box-hero-info" style={{ padding: 0 }}>
              <h1 className="box-detail-title">Box: {box.name}</h1>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px', marginBottom: '4px' }}>
                <div className="box-room-large">{box.room || 'No Room'}</div>
                {box.hasQRCode && (
                  <span style={{ 
                    fontSize: '12px', 
                    color: 'var(--text-secondary)', 
                    backgroundColor: 'rgba(255, 255, 255, 0.08)', 
                    padding: '2px 8px', 
                    borderRadius: '6px',
                    fontWeight: 500
                  }}>
                    QR ID: {box.id}
                  </span>
                )}
              </div>
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
              <div className="box-qr-card" style={{ padding: 0, marginTop: 0, cursor: 'pointer' }} onClick={() => setShowQRModal(true)}>
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
        <div className="section-header-inline" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div className="section-header" style={{ whiteSpace: 'nowrap' }}>Items ({items.length})</div>
            
            {/* Tag Filter Bar */}
            <div className="header-tag-filter" style={{ 
              display: 'flex', 
              gap: '6px', 
              flexWrap: 'wrap',
              flex: 1
            }}>
              {Array.from(new Set(items.flatMap(item => item.tags || []))).map(tag => {
                const colors = getTagColor(tag);
                const isActive = selectedTagFilters.includes(tag);
                return (
                  <span 
                    key={tag}
                    onClick={() => {
                      if (isActive) {
                        setSelectedTagFilters(selectedTagFilters.filter(t => t !== tag));
                      } else {
                        setSelectedTagFilters([...selectedTagFilters, tag]);
                      }
                    }}
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      backgroundColor: colors.bg,
                      color: isActive ? '#ffffff' : colors.text,
                      border: `1px solid ${isActive ? colors.text : colors.border}`,
                      opacity: isActive ? 1 : 0.6,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                      transform: isActive ? 'scale(1.05)' : 'scale(1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {tag}
                    <span style={{ 
                      fontSize: '10px', 
                      opacity: 0.8, 
                      fontWeight: 'bold',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      padding: '1px 4px',
                      borderRadius: '4px'
                    }}>
                      {items.filter(i => (i.tags || []).includes(tag)).length}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={toggleSelectionMode}
              className={`select-items-btn ${isSelectionMode ? 'active' : ''}`}
              style={{
                backgroundColor: isSelectionMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                color: isSelectionMode ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {isSelectionMode ? 'Done' : 'Select'}
            </button>
            
            {isSelectionMode && filteredItems.length > 0 && (
              <button
                onClick={toggleSelectAll}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {filteredItems.every(item => selectedItemIds.includes(item.id)) ? 'Deselect All' : 'Select All'}
              </button>
            )}

            {!isSelectionMode && (
              <button 
                onClick={() => {
                  setActiveGroupNameForAdd('');
                  setSheetGroupName('');
                  setAddSheetMode('create');
                  setIsAddSheetOpen(true);
                }} 
                className="add-item-btn-small"
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        <div className="items-list">
          {itemsLoading ? (
            <p className="status-text">Loading...</p>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <p className="status-text">Empty box.</p>
            </div>
          ) : !hasAnyGroups ? (
            // Flat List Fallback (If box has no groups, render standard flat list)
            filteredItems.map(item => (
              <div 
                key={item.id} 
                className={`item-row ${isSelectionMode ? 'in-selection-mode' : ''} ${isSelectionMode && selectedItemIds.includes(item.id) ? 'selected' : ''}`} 
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelectItem(item.id);
                  } else {
                    setEditingItem(item);
                  }
                }}
              >
                <div className="item-row-left">
                  {isSelectionMode && (
                    <div className={`row-checkbox ${selectedItemIds.includes(item.id) ? 'checked' : ''}`} style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      flexShrink: 0,
                      backgroundColor: selectedItemIds.includes(item.id) ? 'var(--primary-color)' : 'transparent',
                      borderColor: selectedItemIds.includes(item.id) ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.3)',
                      transition: 'all 0.15s ease'
                    }}>
                      {selectedItemIds.includes(item.id) && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  )}
                  {item.imageUrl && (
                    <img 
                      src={item.imageUrl} 
                      className="item-mini-photo" 
                      alt="" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelectionMode) {
                          toggleSelectItem(item.id);
                        } else {
                          setFullscreenImage({ images: item.images || [item.imageUrl as string], index: 0 });
                        }
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
                        {item.tags.map((tag: string) => {
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
                {!isSelectionMode && (
                  <div className="item-row-actions">
                    <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="delete-item-btn">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            // Collapsible Groups Card Layout
            sortedGroupNames.map(groupName => {
              const groupItems = groupedItems[groupName] || [];
              const isCollapsed = collapsedGroups[groupName] || false;
              
              if (groupItems.length === 0) return null; // Hide groups that don't have matching tag-filtered items
              
              return (
                <div key={groupName} className="item-group-card" style={{
                  backgroundColor: 'var(--surface-color)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '12px',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease-in-out'
                }}>
                  <div 
                    className="group-header" 
                    onClick={() => toggleGroup(groupName)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div className="group-header-left" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span className="group-chevron" style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-secondary)',
                        transition: 'transform 0.2s ease'
                      }}>
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      </span>
                      <span className="group-title" style={{
                        fontWeight: 700,
                        fontSize: '15px',
                        color: 'var(--text-primary)'
                      }}>{groupName}</span>
                      <span className="group-badge" style={{
                        fontSize: '11px',
                        backgroundColor: 'var(--surface-hover)',
                        color: 'var(--text-secondary)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 600
                      }}>{groupItems.length}</span>
                    </div>
                    
                    {!isSelectionMode && (
                      <button 
                        className="group-add-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          const gName = groupName === 'General' ? '' : groupName;
                          setActiveGroupNameForAdd(gName);
                          setSheetGroupName(gName);
                          setAddSheetMode('create');
                          setIsAddSheetOpen(true);
                        }}
                        style={{
                          backgroundColor: 'rgba(62, 130, 247, 0.1)',
                          color: 'var(--primary-color)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={12} /> Add
                      </button>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="group-items-list" style={{
                      padding: '8px'
                    }}>
                      {groupItems.map(item => (
                        <div 
                          key={item.id} 
                          className={`item-row ${isSelectionMode ? 'in-selection-mode' : ''} ${isSelectionMode && selectedItemIds.includes(item.id) ? 'selected' : ''}`} 
                          onClick={() => {
                            if (isSelectionMode) {
                              toggleSelectItem(item.id);
                            } else {
                              setEditingItem(item);
                            }
                          }} 
                          style={{
                            margin: '4px 0',
                            border: 'none',
                            backgroundColor: 'rgba(255, 255, 255, 0.01)'
                          }}
                        >
                          <div className="item-row-left">
                            {isSelectionMode && (
                              <div className={`row-checkbox ${selectedItemIds.includes(item.id) ? 'checked' : ''}`} style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: '12px',
                                flexShrink: 0,
                                backgroundColor: selectedItemIds.includes(item.id) ? 'var(--primary-color)' : 'transparent',
                                borderColor: selectedItemIds.includes(item.id) ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.3)',
                                transition: 'all 0.15s ease'
                              }}>
                                {selectedItemIds.includes(item.id) && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                            )}
                            {item.imageUrl && (
                              <img 
                                src={item.imageUrl} 
                                className="item-mini-photo" 
                                alt="" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isSelectionMode) {
                                    toggleSelectItem(item.id);
                                  } else {
                                    setFullscreenImage({ images: item.images || [item.imageUrl as string], index: 0 });
                                  }
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
                                  {item.tags.map((tag: string) => {
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
                          {!isSelectionMode && (
                            <div className="item-row-actions">
                              <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="delete-item-btn">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
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
      {showQRModal && (
        <QRCodePreviewModal 
          value={box.id} 
          title={box.name} 
          qrId={box.id}
          onClose={() => setShowQRModal(false)} 
        />
      )}

      {/* Slide-up Add Item Sheet */}
      {isAddSheetOpen && (
        <div className={`action-sheet-overlay ${isClosingAddSheet ? 'fade-out' : ''}`} onClick={handleCloseAddSheet}>
          <div className={`action-sheet add-item-sheet ${isClosingAddSheet ? 'slide-down' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="action-sheet-header">
              <div className="sheet-handle" style={{
                width: '36px',
                height: '4px',
                backgroundColor: 'var(--border-color)',
                borderRadius: '2px',
                margin: '0 auto 12px auto'
              }} />
              <h3>Add Item to Box</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px'}}>
                {addSheetMode === 'choice' && 'Choose how you want to add an item'}
                {addSheetMode === 'create' && 'Create a new item'}
                {addSheetMode === 'existing' && 'Add existing item from another box'}
              </p>
            </div>
            
            {addSheetMode === 'choice' && (
              <div className="action-sheet-options">
                <button className="option-btn choice-btn" onClick={() => setAddSheetMode('create')}>
                  <Plus size={18} style={{marginRight: '8px', verticalAlign: 'middle'}} />
                  Create New Item
                </button>
                <button className="option-btn choice-btn" onClick={() => setAddSheetMode('existing')}>
                  <Search size={18} style={{marginRight: '8px', verticalAlign: 'middle'}} />
                  Add Existing Item
                </button>
                <button className="option-btn secondary" onClick={handleCloseAddSheet} style={{backgroundColor: 'transparent', color: 'var(--text-secondary)'}}>
                  Cancel
                </button>
              </div>
            )}

            {addSheetMode === 'create' && (
              <form onSubmit={handleQuickCreate} className="quick-create-form" style={{ textAlign: 'left' }}>
                <div className="form-group">
                  <label>Item Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Double Apple Shisha Tobacco" 
                    value={sheetItemName} 
                    onChange={e => setSheetItemName(e.target.value)} 
                    required 
                    autoFocus
                  />
                </div>
                
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Quantity</label>
                  <div className="quantity-stepper" style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--surface-hover)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    width: 'fit-content'
                  }}>
                    <button type="button" onClick={() => setSheetQty(Math.max(1, sheetQty - 1))} style={{
                      width: '40px',
                      height: '40px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '18px',
                      cursor: 'pointer'
                    }}>-</button>
                    <input 
                      type="number" 
                      value={sheetQty} 
                      onChange={e => setSheetQty(Math.max(1, parseInt(e.target.value) || 1))} 
                      style={{
                        width: '40px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        fontSize: '16px',
                        outline: 'none',
                        padding: 0
                      }}
                    />
                    <button type="button" onClick={() => setSheetQty(sheetQty + 1)} style={{
                      width: '40px',
                      height: '40px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '18px',
                      cursor: 'pointer'
                    }}>+</button>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Group</label>
                  
                  {/* Group Chips Container */}
                  <div className="group-chips-container" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '12px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    padding: '4px 0'
                  }}>
                    {renderedGroups.map(g => {
                      const isSelected = sheetGroupName === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          className={`group-chip ${isSelected ? 'active' : ''}`}
                          onClick={() => setSheetGroupName(isSelected ? '' : g)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
                            backgroundColor: isSelected ? 'var(--primary-color)' : 'rgba(255,255,255,0.04)',
                            color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)',
                            display: 'inline-block'
                          }} />
                          {g}
                        </button>
                      );
                    })}
                    {renderedGroups.length === 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No groups created yet. Use the field below to add one.
                      </span>
                    )}
                  </div>

                  {/* Quick Add Group Field */}
                  <div className="group-add-wrapper" style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '4px'
                  }}>
                    <input 
                      type="text" 
                      placeholder="Add new group (e.g. Shisha)..."
                      value={sheetNewGroupInput}
                      onChange={e => setSheetNewGroupInput(e.target.value)}
                      onKeyPress={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSheetNewGroup(sheetNewGroupInput);
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--surface-hover)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                    <button 
                      type="button" 
                      onClick={() => handleAddSheetNewGroup(sheetNewGroupInput)}
                      style={{
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Tags</label>
                  
                  {/* Selected Tags list */}
                  {sheetSelectedTags.length > 0 && (
                    <div className="sheet-selected-tags" style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '8px', 
                      marginBottom: '12px' 
                    }}>
                      {sheetSelectedTags.map(tag => {
                        const colors = getTagColor(tag);
                        return (
                          <span 
                            key={tag} 
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
                              border: '1px solid',
                              fontWeight: 600
                            }}
                          >
                            {tag} 
                            <X 
                              size={14} 
                              onClick={() => handleSheetTagToggle(tag)} 
                              style={{ cursor: 'pointer', opacity: 0.7 }} 
                            />
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick Add Tag Field */}
                  <div className="tag-add-wrapper" style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <input 
                      type="text" 
                      placeholder="Add tag (e.g. tools)..."
                      value={sheetTagInput}
                      onChange={e => setSheetTagInput(e.target.value)}
                      onKeyPress={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSheetNewTag(sheetTagInput);
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--surface-hover)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                    <button 
                      type="button" 
                      onClick={() => handleAddSheetNewTag(sheetTagInput)}
                      style={{
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>

                  {/* Tag Suggestions Container */}
                  <div className="tag-suggestions" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    maxHeight: '90px',
                    overflowY: 'auto',
                    padding: '2px 0'
                  }}>
                    {allAvailableTags
                      .filter(tag => !sheetSelectedTags.includes(tag))
                      .map(tag => {
                        const colors = getTagColor(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleSheetTagToggle(tag)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid rgba(255,255,255,0.08)',
                              backgroundColor: 'rgba(255,255,255,0.04)',
                              color: colors.text,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    {allAvailableTags.length === 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No tags created yet.
                      </span>
                    )}
                  </div>
                </div>

                <div className="sheet-form-actions" style={{marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  <button type="submit" className="submit-btn" style={{margin: 0, width: '100%'}}>
                    Save Item
                  </button>
                  
                  <button type="button" className="advanced-options-link" onClick={handleOpenAdvanced} style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-color)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '8px 0',
                    textAlign: 'center'
                  }}>
                    Advanced Details...
                  </button>
                  
                  <button type="button" className="option-btn secondary" onClick={() => setAddSheetMode('existing')} style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                    <Search size={16} /> Search & Add Existing Item...
                  </button>
                  <button type="button" className="option-btn secondary" onClick={handleCloseAddSheet} style={{backgroundColor: 'transparent', color: 'var(--text-secondary)', padding: '8px', width: '100%'}}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {addSheetMode === 'existing' && (
              <div className="existing-search-flow">
                <div className="search-bar dashboard-search" style={{
                  marginBottom: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Search size={18} color="var(--text-secondary)" />
                  <input 
                    type="text" 
                    placeholder="Search existing items..." 
                    value={sheetSearchQuery}
                    onChange={e => setSheetSearchQuery(e.target.value)}
                    autoFocus
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '15px',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                  {sheetSearchQuery && (
                    <X size={18} color="var(--text-secondary)" style={{cursor: 'pointer'}} onClick={() => setSheetSearchQuery('')} />
                  )}
                </div>

                <div className="search-results-list" style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  paddingRight: '4px'
                }}>
                  {filteredExistingItems.length === 0 ? (
                    <p style={{textAlign: 'center', color: 'var(--text-secondary)', padding: '16px 0', fontSize: '14px'}}>
                      {sheetSearchQuery ? 'No matching items found.' : 'Type to search items from other boxes.'}
                    </p>
                  ) : (
                    filteredExistingItems.map(item => (
                      <div 
                        key={item.id} 
                        className="search-item-row" 
                        onClick={() => setSelectedExistingItem(item)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          backgroundColor: selectedExistingItem?.id === item.id ? 'rgba(62, 130, 247, 0.15)' : 'var(--surface-hover)',
                          borderRadius: '12px',
                          border: `1px solid ${selectedExistingItem?.id === item.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{textAlign: 'left'}}>
                          <div style={{fontWeight: 600, fontSize: '14px'}}>{item.name}</div>
                          <div style={{fontSize: '11px', color: 'var(--text-secondary)'}}>
                            Qty: {item.quantity || 1} • Box: {itemBoxes[item.boxId] || 'Loading...'}
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--text-secondary)" />
                      </div>
                    ))
                  )}
                </div>

                {selectedExistingItem && (
                  <div className="existing-transfer-actions" style={{
                    marginTop: '16px', 
                    padding: '16px', 
                    backgroundColor: 'rgba(255,255,255,0.02)', 
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <div style={{fontSize: '13px', fontWeight: 600, marginBottom: '12px', textAlign: 'center'}}>
                      Transfer "{selectedExistingItem.name}" to this Box
                    </div>
                    <div style={{display: 'flex', gap: '12px'}}>
                      <button 
                        className="option-btn flex-1" 
                        onClick={() => handleTransferItem('move')}
                        style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '12px'}}
                      >
                        <Move size={18} />
                        <span style={{fontSize: '13px'}}>Move Here</span>
                        <span style={{fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'normal'}}>Removes from old box</span>
                      </button>
                      <button 
                        className="option-btn flex-1" 
                        onClick={() => handleTransferItem('copy')}
                        style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '12px'}}
                      >
                        <Copy size={18} />
                        <span style={{fontSize: '13px'}}>Copy Here</span>
                        <span style={{fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'normal'}}>Clones with details</span>
                      </button>
                    </div>
                  </div>
                )}

                <div style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%'}}>
                  <button type="button" className="option-btn secondary" onClick={() => setAddSheetMode('create')} style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                    <Plus size={16} /> Create a New Item instead...
                  </button>
                  <button type="button" className="option-btn secondary" onClick={handleCloseAddSheet} style={{backgroundColor: 'transparent', color: 'var(--text-secondary)', padding: '8px', width: '100%'}}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Premium Floating Bulk Action Bar */}
      {isSelectionMode && selectedItemIds.length > 0 && (
        <div className="bulk-action-bar-container">
          <div className="bulk-action-bar">
            <div className="bulk-selected-count">
              Selected: <strong>{selectedItemIds.length}</strong> {selectedItemIds.length === 1 ? 'item' : 'items'}
            </div>
            <div className="bulk-actions-group">
              <button 
                onClick={() => setIsBulkGroupSheetOpen(true)} 
                className="bulk-action-btn"
                title="Assign selected to Group"
              >
                <FolderPlus size={18} />
                <span>Group</span>
              </button>
              <button 
                onClick={handleBulkRemoveGroup} 
                className="bulk-action-btn"
                title="Remove from Groups"
              >
                <FolderMinus size={18} />
                <span>Ungroup</span>
              </button>
              <button 
                onClick={handleBulkDelete} 
                className="bulk-action-btn destructive"
                title="Delete selected items"
              >
                <Trash2 size={18} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Slide-up Group Assignment Sheet */}
      {isBulkGroupSheetOpen && (
        <div className={`action-sheet-overlay bulk-group-overlay ${isClosingBulkGroupSheet ? 'fade-out' : ''}`} onClick={handleCloseBulkGroupSheet}>
          <div className={`action-sheet bulk-group-sheet ${isClosingBulkGroupSheet ? 'slide-down' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="action-sheet-header">
              <div className="sheet-handle" style={{
                width: '36px',
                height: '4px',
                backgroundColor: 'var(--border-color)',
                borderRadius: '2px',
                margin: '0 auto 12px auto'
              }} />
              <h3>Assign to Group</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px'}}>
                Assign {selectedItemIds.length} selected {selectedItemIds.length === 1 ? 'item' : 'items'} to a group
              </p>
            </div>
            
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Select a Group</label>
              
              {/* Group Chips Selector */}
              <div className="group-chips-container" style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '16px',
                maxHeight: '150px',
                overflowY: 'auto',
                padding: '4px 0'
              }}>
                {renderedBulkGroups.map(g => (
                  <button
                    key={g}
                    type="button"
                    className="group-chip"
                    onClick={() => handleBulkGroupAssign(g)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid rgba(255,255,255,0.08)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.4)',
                      display: 'inline-block'
                    }} />
                    {g}
                  </button>
                ))}
                {renderedBulkGroups.length === 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No groups created yet. Use the field below to create and assign.
                  </span>
                )}
              </div>

              {/* Quick Add and Assign Field */}
              <div className="group-add-wrapper" style={{
                display: 'flex',
                gap: '8px',
                marginTop: '8px'
              }}>
                <input 
                  type="text" 
                  placeholder="Create new group & assign..."
                  value={bulkNewGroupInput}
                  onChange={e => setBulkNewGroupInput(e.target.value)}
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBulkGroupSheetNewGroup(bulkNewGroupInput);
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--surface-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button 
                  type="button" 
                  onClick={() => handleBulkGroupSheetNewGroup(bulkNewGroupInput)}
                  style={{
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            <div style={{marginTop: '24px', display: 'flex', justifyContent: 'center'}}>
              <button 
                type="button" 
                className="option-btn secondary" 
                onClick={handleCloseBulkGroupSheet} 
                style={{backgroundColor: 'transparent', color: 'var(--text-secondary)', padding: '8px'}}
              >
                Cancel
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
export default BoxDetail;
