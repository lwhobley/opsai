import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CookingPot, MagnifyingGlass, Check, CaretLeft, CloudArrowUp, Plus, Minus } from '@phosphor-icons/react';
import { saveOfflineCounts, cacheInventoryItems, getCachedInventoryItems } from '../utils/offlineStorage';
import { toast } from 'sonner';

const LOCATIONS = ['Line', 'Prep Area', 'Walk-In Cooler', 'Dry Storage', 'Freezer'];
const STATIONS = {
  'Line': ['Grill', 'Fry', 'Saute', 'Salad'],
  'Prep Area': ['Proteins', 'Vegetables', 'Sauces', 'Batch'],
  'Walk-In Cooler': ['Proteins', 'Dairy', 'Produce', 'Prepped'],
  'Dry Storage': ['Flour', 'Rice', 'Pasta', 'Spices', 'Oil'],
  'Freezer': ['Proteins', 'Fries', 'Backup'],
};

const KitchenInventory = () => {
  const { api, isManager } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [station, setStation] = useState(null);
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
    if (location) fetchItems();
  }, [location, station]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      let params = `?location=${encodeURIComponent(location)}`;
      if (station) params += `&station=${encodeURIComponent(station)}`;
      const response = await api.get(`/inventory/kitchen/items${params}`);
      setItems(response.data);
      await cacheInventoryItems(response.data, 'kitchen');
      
      const initialCounts = {};
      response.data.forEach(item => {
        if (item.latest_count !== null) {
          initialCounts[item.id] = item.latest_count;
        }
      });
      setCounts(initialCounts);
    } catch (error) {
      // (error logged server-side)
      const cached = await getCachedInventoryItems('kitchen');
      if (cached.length > 0) {
        setItems(cached);
        toast.info('Using cached data (offline)');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (itemId, value) => {
    const numValue = parseFloat(value) || 0;
    setCounts(prev => ({ ...prev, [itemId]: Math.max(0, numValue) }));
  };

  const handleIncrement = (itemId, amount = 1) => {
    setCounts(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + amount }));
  };

  const handleDecrement = (itemId, amount = 1) => {
    setCounts(prev => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] || 0) - amount) }));
  };

  const handleSaveCount = async (itemId) => {
    const quantity = counts[itemId];
    if (quantity === undefined) return;

    try {
      if (isOnline) {
        await api.post('/inventory/kitchen/counts', { item_id: itemId, quantity });
        toast.success('Count saved');
      } else {
        await saveOfflineCounts([{ item_id: itemId, quantity }], 'kitchen');
        toast.info('Count saved offline');
      }
    } catch (error) {
      await saveOfflineCounts([{ item_id: itemId, quantity }], 'kitchen');
      toast.info('Count saved offline');
    }
  };

  const handleSaveAllCounts = async () => {
    const countsToSave = Object.entries(counts).map(([item_id, quantity]) => ({
      item_id,
      quantity,
    }));

    if (countsToSave.length === 0) {
      toast.error('No counts to save');
      return;
    }

    try {
      if (isOnline) {
        await api.post('/inventory/kitchen/counts/bulk', countsToSave);
        toast.success(`${countsToSave.length} counts saved`);
      } else {
        await saveOfflineCounts(countsToSave, 'kitchen');
        toast.info(`${countsToSave.length} counts saved offline`);
      }
    } catch (error) {
      await saveOfflineCounts(countsToSave, 'kitchen');
      toast.info('Counts saved offline');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Location Selection View
  if (!location) {
    return (
      <div className="pb-24 fade-in" data-testid="kitchen-inventory">
        <div className="mb-6">
          <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
            <CookingPot className="w-6 h-6 text-[#D4A017]" />
            Kitchen Inventory
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
                  {STATIONS[loc]?.length || 0} stations
                </p>
              </div>
              <CookingPot className="w-6 h-6 text-[#D4A017]" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Guided Mode View
  if (guidedMode && filteredItems.length > 0) {
    const currentItem = filteredItems[currentItemIndex];
    const progress = ((currentItemIndex + 1) / filteredItems.length) * 100;

    return (
      <div className="pb-24 fade-in" data-testid="kitchen-guided-mode">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => setGuidedMode(false)}
            className="p-2 rounded-lg bg-[#1A1A2E] border border-white/5"
          >
            <CaretLeft className="w-5 h-5 text-[#8E8E9F]" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-medium text-[#F5F5F0]">Guided Count</h2>
            <p className="text-xs text-[#8E8E9F]">{currentItemIndex + 1} of {filteredItems.length}</p>
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
              {currentItem.location} • {currentItem.station}
            </p>
            <p className="text-xs text-[#8E8E9F] mt-1">Unit: {currentItem.unit || 'each'}</p>
          </div>

          {/* Quantity Input */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handleDecrement(currentItem.id)}
              className="h-16 w-16 rounded-full bg-[#0A0A12] border border-[#2B2B4A] 
                         flex items-center justify-center active:bg-[#D62828] active:border-[#D62828]"
              data-testid="qty-decrement"
            >
              <Minus className="w-6 h-6 text-[#8E8E9F]" />
            </button>
            <input
              type="number"
              value={counts[currentItem.id] || 0}
              onChange={(e) => handleQuantityChange(currentItem.id, e.target.value)}
              className="w-32 h-20 text-center text-3xl font-light bg-[#0A0A12] border border-[#2B2B4A] 
                         rounded-xl text-[#F5F5F0] focus:outline-none focus:border-[#D4A017]"
              data-testid="qty-input"
            />
            <button
              onClick={() => handleIncrement(currentItem.id)}
              className="h-16 w-16 rounded-full bg-[#0A0A12] border border-[#2B2B4A] 
                         flex items-center justify-center active:bg-[#10B981] active:border-[#10B981]"
              data-testid="qty-increment"
            >
              <Plus className="w-6 h-6 text-[#8E8E9F]" />
            </button>
          </div>

          {/* Quick Add Buttons */}
          <div className="flex justify-center gap-2 mt-4">
            {[1, 5, 10].map((amt) => (
              <button
                key={amt}
                onClick={() => handleIncrement(currentItem.id, amt)}
                className="px-4 py-2 rounded-lg bg-[#0A0A12] border border-[#2B2B4A] text-sm text-[#8E8E9F]
                           active:bg-[#D4A017] active:text-[#0A0A12]"
              >
                +{amt}
              </button>
            ))}
          </div>

          {currentItem.par_level > 0 && (
            <p className="text-center text-xs text-[#5A5A70] mt-4">
              Par Level: {currentItem.par_level} {currentItem.unit || 'each'}
            </p>
          )}
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
              if (currentItemIndex < filteredItems.length - 1) {
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
            {currentItemIndex < filteredItems.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="pb-24 fade-in" data-testid="kitchen-inventory-list">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={() => { setLocation(null); setStation(null); }}
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

      {/* Station Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        <button
          onClick={() => setStation(null)}
          className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
            !station ? 'bg-[#D4A017] text-[#0A0A12]' : 'bg-[#1A1A2E] text-[#8E8E9F]'
          }`}
        >
          All
        </button>
        {STATIONS[location]?.map((st) => (
          <button
            key={st}
            onClick={() => setStation(st)}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
              station === st ? 'bg-[#D4A017] text-[#0A0A12]' : 'bg-[#1A1A2E] text-[#8E8E9F]'
            }`}
            data-testid={`station-${st.toLowerCase()}`}
          >
            {st}
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
            <KitchenItemCard 
              key={item.id} 
              item={item} 
              quantity={counts[item.id]}
              onChange={(val) => handleQuantityChange(item.id, val)}
              onIncrement={() => handleIncrement(item.id)}
              onDecrement={() => handleDecrement(item.id)}
              onSave={() => handleSaveCount(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const KitchenItemCard = ({ item, quantity, onChange, onIncrement, onDecrement, onSave }) => {
  const [expanded, setExpanded] = useState(false);
  const isLowStock = item.par_level > 0 && (quantity || 0) < item.par_level;

  return (
    <div className={`bg-[#1A1A2E] border rounded-xl overflow-hidden ${
      isLowStock ? 'border-[#D62828]/50' : 'border-white/5'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
        data-testid={`item-${item.id}`}
      >
        <div>
          <span className="text-[#F5F5F0]">{item.name}</span>
          <p className="text-xs text-[#5A5A70]">{item.station} • {item.unit || 'each'}</p>
        </div>
        <div className="flex items-center gap-2">
          {quantity !== undefined && (
            <span className={`px-2 py-1 rounded text-xs ${
              isLowStock ? 'bg-[#D62828] text-white' : 'bg-[#10B981] text-white'
            }`}>
              {quantity}
            </span>
          )}
        </div>
      </button>
      
      {expanded && (
        <div className="p-4 pt-0 border-t border-white/5 fade-in">
          <div className="flex items-center justify-center gap-3 mb-3">
            <button
              onClick={onDecrement}
              className="h-12 w-12 rounded-full bg-[#0A0A12] border border-[#2B2B4A] 
                         flex items-center justify-center active:bg-[#D62828]"
            >
              <Minus className="w-5 h-5 text-[#8E8E9F]" />
            </button>
            <input
              type="number"
              value={quantity || 0}
              onChange={(e) => onChange(e.target.value)}
              className="w-24 h-12 text-center text-xl bg-[#0A0A12] border border-[#2B2B4A] 
                         rounded-xl text-[#F5F5F0] focus:outline-none focus:border-[#D4A017]"
            />
            <button
              onClick={onIncrement}
              className="h-12 w-12 rounded-full bg-[#0A0A12] border border-[#2B2B4A] 
                         flex items-center justify-center active:bg-[#10B981]"
            >
              <Plus className="w-5 h-5 text-[#8E8E9F]" />
            </button>
          </div>
          {item.par_level > 0 && (
            <p className="text-center text-xs text-[#5A5A70] mb-3">
              Par: {item.par_level} | {isLowStock ? '⚠️ Below par' : '✓ Above par'}
            </p>
          )}
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

export default KitchenInventory;
