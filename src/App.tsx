import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Scan, Search, Package, Settings, Plus, Sliders, Menu, Image, Folder } from 'lucide-react';
import { getTagColor } from './utils/tagColors';
import { getWarrantyStatus } from './utils/warranty';
import './index.css';

import CreateBox from './pages/CreateBox';
import ScanPage from './pages/ScanPage';
import BoxDetail from './pages/BoxDetail';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import { useBoxes } from './hooks/useBoxes';
import { useItems } from './hooks/useItems';
import ItemsPage from './pages/Items';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FullscreenGallery, TagManagementModal } from './components/ItemModals';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Critical Application Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          background: '#0d0d0d',
          color: '#fff',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#ef4444' }}>Something went wrong</h2>
          <p style={{ opacity: 0.7, margin: '10px 0 20px' }}>The application encountered an unexpected error. This is often caused by database sync issues.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: 'var(--primary-color, #3e82f7)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Home = () => {
  const { boxes, loading: boxesLoading } = useBoxes();
  const { items: allItems } = useItems();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<{images: string[], index: number} | null>(null);

  // Only show tags that exist on items
  const itemTags = Array.from(new Set(allItems.flatMap(item => item.tags || []))).sort();

  const filteredBoxes = boxes.filter(box => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = box.name?.toLowerCase().includes(q) || 
                         box.room?.toLowerCase().includes(q) || 
                         box.tags?.some(t => t.toLowerCase().includes(q));

    // Filter by items within this box
    const boxItems = allItems.filter(item => item.boxId === box.id);
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => boxItems.some(item => item.tags?.includes(tag)));

    return matchesSearch && matchesTags;
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
      <div className="filter-scroll-container">
        <div className="filter-scroll">
          <button 
            className="filter-settings-btn" 
            onClick={() => setIsManagingTags(true)}
            style={{ cursor: 'pointer' }}
            title="Manage Tags"
          >
            <Sliders size={18} />
          </button>
          <button 
            className={`filter-pill ${selectedTags.length === 0 ? 'active' : ''}`}
            onClick={() => setSelectedTags([])}
          >
            ALL
          </button>
          {itemTags.map(tag => {
            const colors = getTagColor(tag);
            const isActive = selectedTags.includes(tag);
            return (
              <button 
                key={tag} 
                className={`filter-pill ${isActive ? 'active' : ''}`}
                style={{ 
                  backgroundColor: isActive ? colors.text : colors.bg, 
                  color: isActive ? '#ffffff' : colors.text,
                  border: isActive ? 'none' : `1px solid ${colors.bg}`,
                  opacity: isActive ? 1 : 0.8
                }}
                onClick={() => {
                  setSelectedTags(prev => 
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  );
                }}
              >
                {tag.toUpperCase()}
              </button>
            );
          })}
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
                  <div className="box-row-icon">
                    {box.imageUrl ? (
                      <img 
                        src={box.imageUrl} 
                        alt="" 
                        className="box-row-icon-img" 
                        onClick={(e) => {
                          if (box.images && box.images.length > 0) {
                            e.stopPropagation();
                            setFullscreenImage({ images: box.images, index: 0 });
                          }
                        }}
                      />
                    ) : (
                      "📦"
                    )}
                  </div>
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
                    {/* Item-level Tags in this Box */}
                    {(() => {
                      const boxItemTags = Array.from(new Set(allItems.filter(i => i.boxId === box.id).flatMap(i => i.tags || [])));
                      if (boxItemTags.length === 0) return null;
                      return (
                        <div className="box-row-item-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {boxItemTags.map(tag => {
                            const colors = getTagColor(tag);
                            return (
                              <span key={tag} style={{ 
                                fontSize: '10px', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                backgroundColor: colors.bg, 
                                color: colors.text,
                                border: `1px solid ${colors.border}`,
                                opacity: 0.9
                              }}>
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
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

      {isManagingTags && (
        <TagManagementModal onClose={() => setIsManagingTags(false)} />
      )}

      {fullscreenImage && (
        <FullscreenGallery 
          images={fullscreenImage.images} 
          initialIndex={fullscreenImage.index} 
          onClose={() => setFullscreenImage(null)} 
        />
      )}
    </div>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="loading-screen" style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000'}}>
        <div className="loader"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const SidebarContent = () => (
    <>
      <div className="header-title" style={{marginBottom: '32px'}}>HD Scanner</div>
      <nav className="side-nav">
        <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}><Package size={20} /> <span>Boxes</span></Link>
        <Link to="/items" className={`nav-item ${location.pathname === '/items' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}><Search size={20} /> <span>Items</span></Link>
        <Link to="/gallery" className={`nav-item ${location.pathname === '/gallery' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}><Image size={20} /> <span>Gallery</span></Link>
        <Link to="/folders" className={`nav-item ${location.pathname === '/folders' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}><Folder size={20} /> <span>Folders</span></Link>
        <Link to="/settings" className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}><Settings size={20} /> <span>Settings</span></Link>
      </nav>
    </>
  );

  return (
    <div className="app-container">
        {isMobile && isMenuOpen && (
          <div className="mobile-sidebar-overlay" onClick={() => setIsMenuOpen(false)}>
            <aside className={`mobile-sidebar ${isMenuOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
              <SidebarContent />
            </aside>
          </div>
        )}

        {!isMobile && (
          <aside className="sidebar">
            <SidebarContent />
          </aside>
        )}

        <div className="main-wrapper" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/items" element={<ItemsPage />} />
              <Route path="/create" element={<CreateBox />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/box/:id" element={<BoxDetail />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/gallery" element={<div className="page-content"><h2>Gallery</h2><p>Coming soon...</p></div>} />
              <Route path="/folders" element={<div className="page-content"><h2>Folders</h2><p>Coming soon...</p></div>} />
            </Routes>
          </main>
        </div>

        {isMobile && (
          <nav className="bottom-nav">
            <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
              <Package size={24} />
              <span>Boxes</span>
            </Link>
            <Link to="/items" className={`nav-item ${location.pathname === '/items' ? 'active' : ''}`}>
              <Search size={24} />
              <span>Items</span>
            </Link>
            <Link to="/scan" className={`nav-item ${location.pathname === '/scan' ? 'active' : ''}`}>
              <Scan size={24} />
              <span>Scan</span>
            </Link>
            <div className="nav-item" onClick={() => setIsMenuOpen(true)} style={{ cursor: 'pointer' }}>
              <Menu size={24} />
              <span>Menu</span>
            </div>
          </nav>
        )}
      </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
