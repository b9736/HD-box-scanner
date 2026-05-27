import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useBoxes } from '../hooks/useBoxes';

const CreateBox = () => {
  const navigate = useNavigate();
  const { createBox } = useBoxes();
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [hasQRCode, setHasQRCode] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput.startsWith('#') ? tagInput : `#${tagInput}`]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSaving(true);
    try {
      const newId = await createBox(name, room, tags, hasQRCode);
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

        <div className="form-group">
          <label>Tags</label>
          <div className="tag-input-wrapper">
            <input 
              type="text" 
              placeholder="Add tag (press Enter)" 
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            />
            <button type="button" onClick={handleAddTag} className="add-tag-btn">
              <Plus size={20} />
            </button>
          </div>
          <div className="tags-display">
            {tags.map(tag => (
              <span key={tag} className="tag-pill">
                {tag}
                <X size={12} onClick={() => removeTag(tag)} />
              </span>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '12px' }}>
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div 
              style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '6px', 
                border: '2px solid var(--border-color)',
                backgroundColor: hasQRCode ? 'var(--primary-color)' : 'transparent',
                borderColor: hasQRCode ? 'var(--primary-color)' : 'var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onClick={() => setHasQRCode(!hasQRCode)}
            >
              {hasQRCode && <Plus size={16} color="white" style={{ transform: 'rotate(45deg)' }} />}
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
