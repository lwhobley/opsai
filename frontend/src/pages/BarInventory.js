import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wine, MagnifyingGlass, Plus, Check, CaretLeft, CloudArrowUp } from '@phosphor-icons/react';
import { saveOfflineCounts, cacheInventoryItems, getCachedInventoryItems } from '../utils/offlineStorage';
import { toast } from 'sonner';

const LOCATIONS = ['Main Bar', 'Service Bar', 'Back Bar', 'Storage'];
const SECTIONS = {
  'Main Bar': ['Well', 'Call Liquors', 'Premium', 'Liqueurs', 'Mixers'],
  'Service Bar': ['Well', 'Fast Movers'],
  'Back Bar': ['Whiskey', 'Tequila', 'Rum', 'Gin', 'Vodka', 'Liqueurs'],
  'Storage': ['Overstock', 'Wine', 'Beer'],
};

const LEVELS = [
  { value: 100, label: 'Full', color: 'bg-[#10B981]' },
  { value: 75, label: '75%', color: 'bg-[#34D399]' },
  { value: 50, label: '50%', color: 'bg-[#D4A017]' },
  { value: 25, label: '25%', color: 'bg-[#F59E0B]' },
  { value: 0, label: 'Empty', color: 'bg-[#D62828]' },
];

const BarInventory = () => {
  const { api, isManager } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [section, setSection] = useState(null);
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({});
  const [guidedMode, setGuidedMode] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchItems();
  }, [location]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = location ? `?location=${encodeURIComponent(location)}` : '';
      const response = await api.get(`/inventory/bar/items${params}`);
      setItems(response.data);
      await cacheInventoryItems(response.data, 'bar');
      
      const initialCounts = {};
      response.data.forEach(item => {
        if (item.latest_count !== null) {
          initialCounts[item.id] = item.latest_count;
        }
      });
      setCounts(initialCounts);
    } catch (error) {
      console.error('Fetch error:', error);
      const cached = await getCachedInventoryItems('bar');
      if (cached.length > 0) {
        setItems(cached);
        toast.info('Using cached data (offline)');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLevelSelect = (itemId, level) => {
    setCounts(prev => ({ ...prev, [itemId]: level }));
  };

  const handleSaveCount = async (itemId) => {
    const level = counts[itemId];
    if (level === undefined) return;

    try {
      if (isOnline) {
        await api.post('/inventory/bar/counts', { item_id: itemId, level_percentage: level });
        toast.success('Count saved');
      } else {
        await saveOfflineCounts([{ item_id: itemId, level_percentage: level }], 'bar');
        toast.info('Count saved offline');
      }
    } catch (error) {
      await saveOfflineCounts([{ item_id: itemId, level_percentage: level }], 'bar');
      toast.info('Count saved offline');
    }
  };

  const handleSaveAllCounts = async () => {
    const countsToSave = Object.entries(counts).map(([item_id, level_percentage]) => ({
      item_id,
      level_percentage,
    }));

    if (countsToSave.length === 0) {
      toast.error('No counts to save');
      return;
    }

    try {
      if (isOnline) {
        await api.post('/inventory/bar/counts/bulk', countsToSave);
        toast.success(`${countsToSave.length} counts saved`);
      } else {
        await saveOfflineCounts(countsToSave, 'bar');
        toast.info(`${countsToSave.length} counts saved offline`);
      }
    } catch (error) {
      await saveOfflineCounts(countsToSave, 'bar');
      toast.info('Counts saved offline');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchesSection = !section || item.section === section;
    return matchesSearch && matchesSection;
  });

  const guidedItems = filteredItems.sort((a, b) => b.count_priority - a.count_priority);

  // Location Selection View
  if (!location) {
    return (
      <div className="pb-24 fade-in" data-testid="bar-inventory">
        <div className="mb-6">
          <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
            <Wine className="w-6 h-6 text-[#D4A017]" />
            Bar Inventory
          </h1>
          <p className="text-sm text-[#8E8E9F]">Select a location to start counting</p>
        </div>

        {!isOnline && (
          <div className="mb-4 px-4 py-3 bg-[#D4A017]/20 border border-[#D4A017]/50 rounded-lg flex items-center gap-2">
            <CloudArrowUp className="w-5 h-5 text-[#D4A017]" />
            <span className="text-sm text-[#D4A017]">Offline mode - counts will sync when online</span>
          </div>
        )}

        <div className="space-y-3">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocation(loc)}
              className="w-full p-5 bg-[#1A1A2E] border border-white/5 rounded-xl text-left
                         active:bg-[#252540] transition-all flex items-center justify-between"
              data-testid={`location-${loc.toLowerCase().replace(' ', '-')}`}
            >
              <div>
                <span className="text-lg text-[#F5F5F0]">{loc}</span>
                <p className="text-xs text-[#5A5A70] mt-1">
                  {SECTIONS[loc]?.length || 0} sections
                </p>
              </div>
              <Wine className="w-6 h-6 text-[#D4A017]" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Guided Mode View
  if (guidedMode && guidedItems.length > 0) {
    const currentItem = guidedItems[currentItemIndex];
    const progress = ((currentItemIndex + 1) / guidedItems.length) * 100;

    return (
      <div className="pb-24 fade-in" data-testid="bar-guided-mode">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => setGuidedMode(false)}
            className="p-2 rounded-lg bg-[#1A1A2E] border border-white/5"
          >
            <CaretLeft className="w-5 h-5 text-[#8E8E9F]" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-medium text-[#F5F5F0]">Guided Count</h2>
            <p className="text-xs text-[#8E8E9F]">{currentItemIndex + 1} of {guidedItems.length}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-[#1A1A2E] rounded-full mb-6">
          <div 
            className="h-full bg-[#D4A017] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Current Item */}
        <div className="bg-[#1A1A2E] border border-white/5 rounded-xl p-6 mb-6">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-light text-[#F5F5F0] mb-2">{currentItem.name}</h3>
            <p className="text-sm text-[#5A5A70]">
              {currentItem.location} • {currentItem.section}
            </p>
            {currentItem.bottle_size_ml && (
              <p className="text-xs text-[#8E8E9F] mt-1">{currentItem.bottle_size_ml}ml</p>
            )}
          </div>

          {/* Level Buttons */}
          <div className="grid grid-cols-5 gap-2">
            {LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => handleLevelSelect(currentItem.id, level.value)}
                className={`h-16 rounded-lg flex flex-col items-center justify-center transition-all
                           border-2 ${
                             counts[currentItem.id] === level.value
                               ? `${level.color} border-white text-white`
                               : 'bg-[#0A0A12] border-[#2B2B4A] text-[#8E8E9F]'
                           }`}
                data-testid={`level-btn-${level.value}`}
              >
                <span className="text-sm font-medium">{level.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentItemIndex(Math.max(0, currentItemIndex - 1))}
            disabled={currentItemIndex === 0}
            className="flex-1 py-4 bg-[#1A1A2E] border border-white/5 rounded-xl text-[#8E8E9F]
                       disabled:opacity-50 active:bg-[#252540]"
          >
            Previous
          </button>
          <button
            onClick={async () => {
              await handleSaveCount(currentItem.id);
              if (currentItemIndex < guidedItems.length - 1) {
                setCurrentItemIndex(currentItemIndex + 1);
              } else {
                setGuidedMode(false);
                toast.success('Inventory count complete!');
              }
            }}
            className="flex-1 py-4 bg-[#D4A017] text-[#0A0A12] rounded-xl font-medium
                       active:bg-[#E5B83A] flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            {currentItemIndex < guidedItems.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="pb-24 fade-in" data-testid="bar-inventory-list">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={() => { setLocation(null); setSection(null); }}
          className="p-2 rounded-lg bg-[#1A1A2E] border border-white/5"
        >
          <CaretLeft className="w-5 h-5 text-[#8E8E9F]" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-medium text-[#F5F5F0]">{location}</h2>
          <p className="text-xs text-[#8E8E9F]">{filteredItems.length} items</p>
        </div>
        {!isOnline && <CloudArrowUp className="w-5 h-5 text-[#D4A017]" />}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        <button
          onClick={() => setSection(null)}
          className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
            !section ? 'bg-[#D4A017] text-[#0A0A12]' : 'bg-[#1A1A2E] text-[#8E8E9F]'
          }`}
        >
          All
        </button>
        {SECTIONS[location]?.map((sec) => (
          <button
            key={sec}
            onClick={() => setSection(sec)}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
              section === sec ? 'bg-[#D4A017] text-[#0A0A12]' : 'bg-[#1A1A2E] text-[#8E8E9F]'
            }`}
            data-testid={`section-${sec.toLowerCase().replace(' ', '-')}`}
          >
            {sec}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5A5A70]" />
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-[#1A1A2E] border border-white/5 rounded-xl
                     text-[#F5F5F0] placeholder-[#5A5A70] focus:outline-none focus:border-[#D4A017]"
          data-testid="search-input"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setGuidedMode(true); setCurrentItemIndex(0); }}
          className="flex-1 py-3 bg-[#D4A017] text-[#0A0A12] rounded-xl font-medium
                     active:bg-[#E5B83A]"
          data-testid="start-guided-btn"
        >
          Start Guided Count
        </button>
        <button
          onClick={handleSaveAllCounts}
          className="py-3 px-4 bg-[#1A1A2E] border border-[#D4A017] text-[#D4A017] rounded-xl
                     active:bg-[#252540]"
          data-testid="save-all-btn"
        >
          <Check className="w-5 h-5" />
        </button>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <ItemCard 
              key={item.id} 
              item={item} 
              level={counts[item.id]}
              onLevelSelect={(level) => handleLevelSelect(item.id, level)}
              onSave={() => handleSaveCount(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ItemCard = ({ item, level, onLevelSelect, onSave }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#1A1A2E] border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
        data-testid={`item-${item.id}`}
      >
        <div>
          <span className="text-[#F5F5F0]">{item.name}</span>
          <p className="text-xs text-[#5A5A70]">{item.section}</p>
        </div>
        <div className="flex items-center gap-2">
          {level !== undefined && (
            <span className={`px-2 py-1 rounded text-xs ${
              level >= 75 ? 'bg-[#10B981] text-white' :
              level >= 50 ? 'bg-[#D4A017] text-black' :
              level >= 25 ? 'bg-[#F59E0B] text-black' :
              'bg-[#D62828] text-white'
            }`}>
              {level}%
            </span>
          )}
        </div>
      </button>
      
      {expanded && (
        <div className="p-4 pt-0 border-t border-white/5 fade-in">
          <div className="grid grid-cols-5 gap-2 mb-3">
            {LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => onLevelSelect(lvl.value)}
                className={`h-14 rounded-lg flex flex-col items-center justify-center transition-all
                           border-2 ${
                             level === lvl.value
                               ? `${lvl.color} border-white text-white`
                               : 'bg-[#0A0A12] border-[#2B2B4A] text-[#8E8E9F]'
                           }`}
                data-testid={`item-${item.id}-level-${lvl.value}`}
              >
                <span className="text-xs font-medium">{lvl.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={onSave}
            className="w-full py-3 bg-[#D4A017] text-[#0A0A12] rounded-lg font-medium
                       active:bg-[#E5B83A] flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Count
          </button>
        </div>
      )}
    </div>
  );
};

export default BarInventory;
