import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Scan, Search, Package, Settings, Plus, X } from 'lucide-react';
import { getTagColor } from './utils/tagColors';
import { getWarrantyStatus } from './utils/warranty';
import './index.css';

// Placeholder Components
import CreateBox from './pages/CreateBox';
import ScanPage from './pages/ScanPage';
import BoxDetail from './pages/BoxDetail';
import SettingsPage from './pages/Settings';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useBoxes } from './hooks/useBoxes';

const Home = () => {
  const { boxes, loading: boxesLoading } = useBoxes();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    // Fetch all items for global search
    const itemsQuery = query(collection(db, "items"));
    const unsubscribe = onSnapshot(itemsQuery, (snapshot) => {
      const itemsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllItems(itemsData);
      setLoadingItems(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredBoxes = boxes.filter(box => {
    const q = searchQuery.toLowerCase();
    return box.name?.toLowerCase().includes(q) || 
           box.room?.toLowerCase().includes(q) || 
           box.tags?.some(t => t.toLowerCase().includes(q));
  });

  const filteredItems = searchQuery.length > 0 ? allItems.filter(item => {
    const q = searchQuery.toLowerCase();
    return item.name?.toLowerCase().includes(q);
  }) : [];

  return (
    <div className="page-content">
      <header className="page-header-minimal">
        <h2 className="header-title">My Boxes</h2>
      </header>

      <div className="search-container">
        <div className="search-bar">
          {searchQuery ? (
            <button className="search-clear-text-btn" onClick={() => setSearchQuery('')}>
              Clear
            </button>
          ) : (
            <Search size={20} className="search-icon-static" />
          )}
          <input 
            type="text" 
            placeholder="Search for boxes or items..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="box-list">
        {boxesLoading ? (
          <p className="status-text">Loading boxes...</p>
        ) : filteredBoxes.length === 0 && searchQuery === '' ? (
          <p className="status-text">No boxes found. Add your first box below!</p>
        ) : (
          <>
            {filteredBoxes.map((box) => (
              <div key={box.id} className="box-item-row" onClick={() => navigate(`/box/${box.id}`)}>
                <div className="box-row-main">
                  <div className="box-row-icon">📦</div>
                  <div className="box-row-content">
                    <div className="box-row-title">
                      {box.name}
                      <span className="box-item-count">({allItems.filter(i => i.boxId === box.id).length})</span>
                    </div>
                    <div className="box-row-meta">Location: {box.room || 'No Room'}</div>
                    <div className="box-row-preview">
                      {allItems
                        .filter(i => i.boxId === box.id)
                        .map(i => `${i.name} ${i.quantity || 1}x`)
                        .join(', ') || 'Empty'}
                    </div>
                  </div>
                </div>
                <div className="box-row-tags">
                  {box.tags?.map(tag => {
                    const colors = getTagColor(tag);
                    return (
                      <span key={tag} className="row-tag" style={{ backgroundColor: colors.bg, color: colors.text }}>
                        #{tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredItems.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 className="section-header" style={{ marginBottom: '16px' }}>Matching Items</h3>
                {filteredItems.map(item => (
                  <div key={item.id} className="item-row" onClick={() => navigate(`/box/${item.boxId}`)}>
                    <div className="item-row-left">
                      {item.imageUrl ? <img src={item.imageUrl} className="item-mini-photo" /> : <Package size={16} />}
                      <div className="item-info">
                        <span className="item-name">{item.name}</span>
                        <div className="item-meta-row">
                          <span className="item-qty">Quantity: {item.quantity}</span>
                          {item.purchaseDate && (
                            <span className="item-meta-date">Purchased: {item.purchaseDate}</span>
                          )}
                          {item.warrantyExpire && (
                            (() => {
                              const status = getWarrantyStatus(item.warrantyExpire);
                              const showExpired = localStorage.getItem('showExpiredStatus') !== 'false';
                              if (!showExpired && status?.isExpired) return null;
                              return (
                                <span className="item-meta-date" style={{ color: status?.color }}>
                                  Warranty: {item.warrantyExpire} ({status?.text})
                                </span>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Link to="/create" className="fab">
        <Plus size={24} />
      </Link>
    </div>
  );
};

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
      <div className="app-container">
        {!isMobile && (
          <aside className="sidebar">
            <div className="header-title" style={{marginBottom: '32px'}}>HD Scanner</div>
            <nav className="side-nav">
              <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}><Package size={20} /> <span>Boxes</span></Link>
              <Link to="/settings" className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}><Settings size={20} /> <span>Settings</span></Link>
            </nav>
          </aside>
        )}

        <div className="main-wrapper" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
          <header className="app-header">
            <div className="header-title">{isMobile ? 'HD Box Scanner' : 'Dashboard'}</div>
            <Link to="/settings" style={{ color: 'inherit' }}>
              <Settings size={24} className="header-icon" />
            </Link>
          </header>

          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreateBox />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/box/:id" element={<BoxDetail />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>

        {isMobile && (
          <nav className="bottom-nav">
            <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
              <Package size={24} />
              <span>Boxes</span>
            </Link>
            <Link to="/scan" className={`nav-item ${location.pathname === '/scan' ? 'active' : ''}`}>
              <Scan size={24} />
              <span>Scan</span>
            </Link>
            <Link to="/settings" className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}>
              <Settings size={24} />
              <span>Settings</span>
            </Link>
          </nav>
        )}
      </div>
  );
}

export default App;
