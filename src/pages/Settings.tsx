import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Clock } from 'lucide-react';

const Settings = () => {
  const navigate = useNavigate();
  const [warrantyValue, setWarrantyValue] = useState('2');
  const [warrantyUnit, setWarrantyUnit] = useState('years');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedValue = localStorage.getItem('defaultWarrantyValue') || '2';
    const savedUnit = localStorage.getItem('defaultWarrantyUnit') || 'years';
    setWarrantyValue(savedValue);
    setWarrantyUnit(savedUnit);
  }, []);

  const handleSave = () => {
    localStorage.setItem('defaultWarrantyValue', warrantyValue);
    localStorage.setItem('defaultWarrantyUnit', warrantyUnit);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page-content">
      <header className="page-header-minimal">
        <button onClick={() => navigate(-1)} className="back-btn">
          <ArrowLeft size={24} />
        </button>
        <h2 className="header-title">Settings</h2>
      </header>

      <div className="settings-container" style={{ padding: '20px' }}>
        <div className="settings-section">
          <h3 className="section-header" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} /> Default Warranty
          </h3>
          
          <div className="settings-card" style={{ 
            backgroundColor: 'var(--surface-color)', 
            padding: '24px', 
            borderRadius: '24px',
            border: '1px solid var(--border-color)'
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              When you set a purchase date, the warranty will automatically be calculated based on this duration.
            </p>
            
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Duration</label>
                <input 
                  type="number" 
                  value={warrantyValue} 
                  onChange={(e) => setWarrantyValue(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <select 
                  value={warrantyUnit} 
                  onChange={(e) => setWarrantyUnit(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-color)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '16px'
                  }}
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleSave} 
              className="submit-btn" 
              style={{ 
                marginTop: '24px', 
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: saved ? '#34C759' : 'var(--primary-color)'
              }}
            >
              <Save size={18} /> {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
