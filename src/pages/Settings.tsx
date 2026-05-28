import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Clock, LogOut, Trash2 } from 'lucide-react';
import { signOut, deleteUser } from 'firebase/auth';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { ConfirmationModal } from '../components/ConfirmationModal';

const Settings = () => {
  const navigate = useNavigate();
  const [warrantyValue, setWarrantyValue] = useState('2');
  const [warrantyUnit, setWarrantyUnit] = useState('years');
  const [saved, setSaved] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'destructive' | 'primary';
    confirmString?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

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

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const batch = writeBatch(db);
        
        // 1. Delete all boxes
        const boxesQ = query(collection(db, "boxes"), where("uid", "==", user.uid));
        const boxesSnap = await getDocs(boxesQ);
        boxesSnap.docs.forEach(doc => batch.delete(doc.ref));

        // 2. Delete all items
        const itemsQ = query(collection(db, "items"), where("uid", "==", user.uid));
        const itemsSnap = await getDocs(itemsQ);
        itemsSnap.docs.forEach(doc => batch.delete(doc.ref));

        // 3. Delete all tags
        const tagsQ = query(collection(db, "item_tags"), where("uid", "==", user.uid));
        const tagsSnap = await getDocs(tagsQ);
        tagsSnap.docs.forEach(doc => batch.delete(doc.ref));

        // Commit all deletions
        await batch.commit();

        // 4. Finally delete the auth account
        await deleteUser(user);
        navigate('/');
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          setConfirmModal({
            isOpen: true,
            title: 'Re-authentication Required',
            message: 'For security reasons, you must log in again before deleting your account and data.',
            onConfirm: async () => {
              await signOut(auth);
              navigate('/');
            }
          });
        } else {
          console.error("Error deleting user data:", err);
          // If data deletion fails but user persists, we should still try to notify or handle
        }
      }
    }
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
                <div className="qty-stepper" style={{ width: '100%' }}>
                  <button type="button" onClick={() => setWarrantyValue(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)))} style={{ width: '44px' }}>-</button>
                  <input 
                    type="number" 
                    value={warrantyValue} 
                    onChange={(e) => setWarrantyValue(String(Math.max(1, parseInt(e.target.value) || 1)))}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button type="button" onClick={() => setWarrantyValue(prev => String((parseInt(prev) || 1) + 1))} style={{ width: '44px' }}>+</button>
                </div>
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
            onClick={() => setConfirmModal({
              isOpen: true,
              title: 'Log Out?',
              message: 'Are you sure you want to log out of your account?',
              onConfirm: handleLogout
            })}
            style={{ 
              width: '100%',
              padding: '16px',
              borderRadius: '24px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >
            <LogOut size={20} /> Log Out
          </button>

          <button 
            onClick={() => setConfirmModal({
              isOpen: true,
              title: 'Delete Account?',
              message: 'This action is PERMANENT. All your boxes, items, and settings will be deleted forever.',
              type: 'destructive',
              confirmString: auth.currentUser?.email || 'delete',
              onConfirm: handleDeleteAccount
            })}
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
            <Trash2 size={20} /> Delete Account
          </button>
          
          <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            Version 1.2.0 • Secured with Firebase
          </p>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type as any}
        confirmString={confirmModal.confirmString}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Settings;
