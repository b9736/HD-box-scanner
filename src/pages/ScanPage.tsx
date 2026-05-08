import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Scanner from '../components/Scanner';
import { useBoxes } from '../hooks/useBoxes';

const ScanPage = () => {
  const navigate = useNavigate();
  const { boxes, loading } = useBoxes();
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [isNewBox, setIsNewBox] = useState(false);
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isChecking = React.useRef(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const [showPulse, setShowPulse] = useState(false);

  React.useEffect(() => {
    if (isNewBox && nameInputRef.current) {
      // Small timeout to ensure the modal is fully rendered on mobile
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isNewBox]);

  const triggerPulse = () => {
    setShowPulse(true);
    setTimeout(() => setShowPulse(false), 500);
  };

  const handleScanSuccess = async (decodedText: string) => {
    const cleanId = decodedText.trim();
    if (isChecking.current) return;
    
    isChecking.current = true;
    setScannedId(cleanId);
    
    try {
      const boxRef = doc(db, "boxes", cleanId);
      const boxSnap = await getDoc(boxRef);

      if (boxSnap.exists()) {
        navigate(`/box/${cleanId}`);
      } else {
        setIsNewBox(true);
      }
    } catch (err) {
      console.error("Database lookup failed:", err);
      isChecking.current = false;
    }
  };

  const handleCreateScannedBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedId || !name) return;

    setSaving(true);
    try {
      await setDoc(doc(db, "boxes", scannedId), {
        name,
        room: room || 'General',
        tags: [],
        createdAt: serverTimestamp(),
      });
      navigate(`/box/${scannedId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create box.");
    } finally {
      setSaving(false);
    }
  };

  const filteredBoxes = boxes.filter(box => 
    box.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    box.room?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'Just now';
    try {
      const date = timestamp.toDate();
      const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
      return `${Math.floor(diff / 86400)} days ago`;
    } catch (e) {
      return 'Just now';
    }
  };

  return (
    <div className="page-content dashboard">
      <div className="dashboard-scanner-card">
        <div className="scanner-header">
          <span>Scan QR Code</span>
        </div>
        <div className="mini-scanner-container" onClick={triggerPulse}>
          <Scanner onScanSuccess={handleScanSuccess} />
          <div className="mini-viewfinder">
            <div className="corner tl" />
            <div className="corner tr" />
            <div className="corner bl" />
            <div className="corner br" />
            <div className="scan-line" />
            <div className={`focus-pulse ${showPulse ? 'active' : ''}`} />
          </div>
        </div>
      </div>

      <div className="search-container">
        <div className="search-bar dashboard-search">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search Scanned Boxes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="box-list dashboard-list">
        {loading ? (
          <p className="status-text">Loading boxes...</p>
        ) : filteredBoxes.length === 0 ? (
          <p className="status-text">No boxes found.</p>
        ) : (
          filteredBoxes.map((box) => (
            <div key={box.id} className="box-item-row" onClick={() => navigate(`/box/${box.id}`)}>
              <div className="box-row-main">
                <div className="box-row-icon">📦</div>
                <div className="box-row-content">
                  <div className="box-row-title">{box.name}</div>
                  <div className="box-row-meta">Text: {box.room}</div>
                  <div className="box-row-time">Added: {formatRelativeTime(box.createdAt)}</div>
                </div>
              </div>
              <div className="box-row-tags">
                {box.tags?.map(tag => (
                  <span key={tag} className="row-tag">#{tag}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {isNewBox && (
        <div className="new-box-form-overlay">
          <div className="new-box-card">
            <p className="qr-badge">ID: {scannedId}</p>
            <h3>Initialize New Box</h3>
            <form onSubmit={handleCreateScannedBox} className="create-form">
              <div className="form-group">
                <label>Box Name</label>
                <input 
                  ref={nameInputRef}
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              <div className="form-group">
                <label>Room</label>
                <input 
                  type="text" 
                  placeholder="Optional" 
                  value={room} 
                  onChange={(e) => setRoom(e.target.value)} 
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              <button type="submit" className="submit-btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save & Open'}
              </button>
              <button type="button" onClick={() => {setIsNewBox(false); isChecking.current = false;}} className="cancel-btn">
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
