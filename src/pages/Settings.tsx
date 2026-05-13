import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Clock, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Settings = () => {
  const navigate = useNavigate();
  const [warrantyValue, setWarrantyValue] = useState('2');
  const [warrantyUnit, setWarrantyUnit] = useState('years');
  const [saved, setSaved] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
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



        <div className="settings-section" style={{ marginTop: '32px' }}>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            style={{ 
              width: '100%',
              padding: '16px',
              borderRadius: '24px',
              backgroundColor: 'rgba(255, 69, 58, 0.1)',
              color: '#ff453a',
              border: '1px solid rgba(255, 69, 58, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <LogOut size={20} /> Log Out
          </button>
          
          <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            Version 1.2.0 • Secured with Firebase
          </p>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="action-sheet-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="action-sheet" onClick={e => e.stopPropagation()}>
            <div className="action-sheet-header">
              <h3>Log Out?</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px'}}>
                Are you sure you want to log out of your account?
              </p>
            </div>
            <div className="action-sheet-options">
              <button className="option-btn destructive" onClick={handleLogout}>Log Out</button>
              <button className="option-btn" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
