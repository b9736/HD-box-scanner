import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, MapPin } from 'lucide-react';
import { collection, query, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface SearchResult {
  id: string;
  name: string;
  boxId: string;
  boxName?: string;
  room?: string;
}

const GlobalSearch = () => {
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState('');
  const [allItems, setAllItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all boxes first for mapping
    const boxesQuery = query(collection(db, "boxes"));
    const itemsQuery = query(collection(db, "items"));

    const unsubscribeItems = onSnapshot(itemsQuery, (itemsSnap) => {
      const unsubscribeBoxes = onSnapshot(boxesQuery, (boxesSnap) => {
        const boxesMap = new Map(boxesSnap.docs.map(d => [d.id, d.data()]));
        
        const enrichedItems = itemsSnap.docs.map(d => {
          const itemData = d.data();
          const boxData = boxesMap.get(itemData.boxId) as any;
          return {
            id: d.id,
            ...itemData,
            boxName: boxData?.name || 'Unknown Box',
            room: boxData?.room || ''
          };
        }) as SearchResult[];

        setAllItems(enrichedItems);
        setLoading(false);
      });
      return () => unsubscribeBoxes();
    });

    return () => unsubscribeItems();
  }, []);

  const filteredResults = allItems.filter(item => 
    item.name.toLowerCase().includes(queryText.toLowerCase()) ||
    item.boxName?.toLowerCase().includes(queryText.toLowerCase())
  );

  return (
    <div className="page-content">
      <header className="page-header-minimal">
        <h2 className="header-title">Global Item Search</h2>
      </header>

      <div className="search-container">
        <div className="search-bar">
          <Search size={20} />
          <input 
            autoFocus
            type="text" 
            placeholder="Search for an item (e.g. 'Hammer')" 
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
        </div>
      </div>

      <div className="results-list">
        {loading ? (
          <p className="status-text">Indexing items...</p>
        ) : queryText === '' ? (
          <div className="search-placeholder">
            <Search size={48} className="placeholder-icon" />
            <p>Type to find items across all your boxes</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <p className="status-text">No items found matching "{queryText}"</p>
        ) : (
          filteredResults.map(result => (
            <div 
              key={result.id} 
              className="item-search-card"
              onClick={() => navigate(`/box/${result.boxId}`)}
            >
              <div className="result-main">
                <span className="result-item-name">{result.name}</span>
                <div className="result-box-path">
                  <Package size={14} />
                  <span>{result.boxName}</span>
                </div>
              </div>
              <div className="result-location">
                <MapPin size={14} />
                <span>{result.room}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GlobalSearch;
