import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useBoxes } from '../hooks/useBoxes';
import { useCustomData } from '../hooks/useCustomData';

const CreateBox = () => {
  const navigate = useNavigate();
  const { boxes, createBox } = useBoxes();
  const { customLocations } = useCustomData();
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [hasQRCode, setHasQRCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddNewRoomInput, setShowAddNewRoomInput] = useState(false);
  const [newRoomInput, setNewRoomInput] = useState('');
  const [localRooms, setLocalRooms] = useState<string[]>([]);

  const existingRooms = React.useMemo(() => {
    return Array.from(new Set(boxes.map(b => b.room).filter(Boolean))).sort();
  }, [boxes]);

  const renderedRooms = React.useMemo(() => {
    const union = new Set<string>(existingRooms);
    localRooms.forEach(r => union.add(r));
    customLocations.forEach(cl => union.add(cl.name));
    if (room) {
      union.add(room);
    }
    return Array.from(union).sort();
  }, [existingRooms, localRooms, customLocations, room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSaving(true);
    try {
      const newId = await createBox(name, room, [], hasQRCode);
      navigate(`/box/${newId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create box. Check console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <header className="page-header-minimal">
        <button onClick={() => navigate('/')} className="back-btn">
          <ArrowLeft size={24} />
        </button>
        <h2 className="header-title">Initialize Box</h2>
      </header>

      <form onSubmit={handleSubmit} className="create-form">
        <div className="form-group">
          <label>Box Name</label>
          <input 
            type="text" 
            placeholder="e.g. Christmas Decorations" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Location (Optional)</label>
          {!showAddNewRoomInput ? (
            <select 
              value={room} 
              onChange={e => {
                if (e.target.value === 'add-new-room') {
                  setShowAddNewRoomInput(true);
                  setNewRoomInput('');
                } else {
                  setRoom(e.target.value);
                }
              }} 
              className="premium-select"
            >
              <option value="">Unassigned</option>
              {renderedRooms.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="add-new-room" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>+ Add New Location...</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="text" 
                value={newRoomInput} 
                onChange={e => setNewRoomInput(e.target.value)} 
                placeholder="Enter new location name"
                className="premium-input"
                style={{ flex: 1, margin: 0, width: '100%', minWidth: '150px' }}
                autoFocus
              />
              <button 
                type="button" 
                className="submit-btn" 
                style={{ padding: '8px 16px', height: '100%', fontSize: '13px' }}
                onClick={() => {
                  const trimmed = newRoomInput.trim();
                  if (trimmed) {
                    if (!localRooms.includes(trimmed)) {
                      setLocalRooms(prev => [...prev, trimmed]);
                    }
                    setRoom(trimmed);
                    setShowAddNewRoomInput(false);
                  }
                }}
              >
                Done
              </button>
              <button 
                type="button" 
                className="cancel-btn" 
                style={{ padding: '8px 16px', height: '100%', fontSize: '13px', margin: 0 }}
                onClick={() => setShowAddNewRoomInput(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginTop: '12px' }}>
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div 
              style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '6px', 
                border: '2px solid var(--border-color)',
                backgroundColor: hasQRCode ? 'var(--success-color)' : 'transparent',
                borderColor: hasQRCode ? 'var(--success-color)' : 'var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              {hasQRCode && <Check size={16} color="white" />}
            </div>
            <span style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Create QR code for this box</span>
            <input 
              type="checkbox" 
              checked={hasQRCode} 
              onChange={(e) => setHasQRCode(e.target.checked)} 
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <button type="submit" className="submit-btn" disabled={saving}>
          {saving ? 'Creating...' : 'Create Box'}
        </button>
      </form>
    </div>
  );
};

export default CreateBox;
