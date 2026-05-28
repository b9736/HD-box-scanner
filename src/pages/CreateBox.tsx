import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useBoxes } from '../hooks/useBoxes';

const CreateBox = () => {
  const navigate = useNavigate();
  const { createBox } = useBoxes();
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [hasQRCode, setHasQRCode] = useState(false);
  const [saving, setSaving] = useState(false);

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

        <div className="form-group">
          <label>Location</label>
          <input 
            type="text" 
            placeholder="e.g. Attic (Optional)" 
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
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
