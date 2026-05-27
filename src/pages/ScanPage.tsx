import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Scanner from '../components/Scanner';
import { useBoxes } from '../hooks/useBoxes';
import { useAuth } from '../contexts/AuthContext';


const ScanPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [foundBox, setFoundBox] = useState<{ id: string; name: string; room: string } | null>(null);
  const [isClosingFoundBox, setIsClosingFoundBox] = useState(false);


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

      if (boxSnap.exists() && boxSnap.data().uid === user?.uid && !boxSnap.data().inTrash) {
        const data = boxSnap.data();
        setFoundBox({
          id: cleanId,
          name: data.name || 'Unnamed Box',
          room: data.room || 'General'
        });
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
    if (!user) {
      alert("You must be logged in to create a box.");
      setSaving(false);
      return;
    }

    try {
      await setDoc(doc(db, "boxes", scannedId), {
        name,
        room: room || 'General',
        tags: [],
        uid: user.uid,
        hasQRCode: true,
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

      {foundBox && (
        <div className={`action-sheet-overlay ${isClosingFoundBox ? 'fade-out' : ''}`} style={{ zIndex: 9999 }}>
          <div className={`action-sheet ${isClosingFoundBox ? 'slide-down' : ''}`} style={{ paddingBottom: '32px' }}>
            <div className="sheet-handle" />
            <div className="action-sheet-header" style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📦</div>
              <h3>Box Found!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
                This QR code matches an existing box.
              </p>
            </div>

            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.03)', 
              padding: '16px', 
              borderRadius: '16px', 
              marginBottom: '24px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '15px',
              textAlign: 'left'
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Box Name:</span> <span style={{ color: 'white', fontWeight: 700, marginLeft: '4px' }}>{foundBox.name}</span>
              </div>
              
              <div>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Location:</span> <span style={{ color: 'white', fontWeight: 600, marginLeft: '4px' }}>{foundBox.room}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>QR ID:</span> <span style={{ color: 'white', fontWeight: 600, marginLeft: '4px' }}>{foundBox.id}</span>
              </div>
            </div>

            <div className="action-sheet-options">
              <button 
                type="button"
                className="option-btn primary" 
                onClick={() => navigate(`/box/${foundBox.id}`)}
              >
                Open Box Detail
              </button>
              <button 
                type="button"
                className="option-btn" 
                onClick={() => {
                  setIsClosingFoundBox(true);
                  setTimeout(() => {
                    setFoundBox(null);
                    setIsClosingFoundBox(false);
                    isChecking.current = false;
                  }, 300);
                }}
              >
                Scan Another Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
