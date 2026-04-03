import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CookingPot, MagnifyingGlass, Check, CaretLeft,
  CloudSlash, Plus, Minus
} from '@phosphor-icons/react';
import { saveOfflineCounts, cacheInventoryItems, getCachedInventoryItems } from '../utils/offlineStorage';
import { toast } from 'sonner';

const LOCATIONS = ['Line', 'Prep Area', 'Walk-In Cooler', 'Dry Storage', 'Freezer'];
const STATIONS = {
  'Line':          ['Grill', 'Fry', 'Saute', 'Salad'],
  'Prep Area':     ['Proteins', 'Vegetables', 'Sauces', 'Batch'],
  'Walk-In Cooler':['Proteins', 'Dairy', 'Produce', 'Prepped'],
  'Dry Storage':   ['Flour', 'Rice', 'Pasta', 'Spices', 'Oil'],
  'Freezer':       ['Proteins', 'Fries', 'Backup'],
};

// ── Quantity Control ──────────────────────────────────────────────────────────
const QuantityControl = ({ value = 0, onChange, onIncrement, onDecrement, unit, parLevel }) => {
  const isLow = parLevel > 0 && value < parLevel;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onDecrement}
          className="w-12 h-12 rounded-xl card-inset flex items-center justify-center
                     active:bg-[#D62828]/15 transition-colors touch-target shrink-0"
        >
          <Minus className="w-4 h-4 text-white/40" />
        </button>
        <div className="flex-1 relative">
          <input
            type="number"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full h-12 text-center text-xl font-light rounded-xl
                       bg-black/30 border border-white/[0.06] text-white/85
                       focus:outline-none focus:border-[#D4A017]/40 transition-colors"
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/20">{unit}</span>
          )}
        </div>
        <button
          onClick={onIncrement}
          className="w-12 h-12 rounded-xl card-inset flex items-center justify-center
                     active:bg-[#10B981]/15 transition-colors touch-target shrink-0"
        >
          <Plus className="w-4 h-4 text-white/40" />
        </button>
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        {[1, 5, 10].map(amt => (
          <button
            key={amt}
            onClick={() => onIncrement(amt)}
            className="flex-1 h-8 card-inset rounded-lg text-xs text-white/30
                       active:bg-[#D4A017]/10 active:text-[#D4A017] transition-colors font-medium"
          >
            +{amt}
          </button>
        ))}
      </div>

      {/* Par level indicator */}
      {parLevel > 0 && (
        <div className={`flex items-center justify-between text-[11px] px-1 ${
          isLow ? 'text-[#D62828]' : 'text-[#10B981]'
        }`}>
          <span>Par: {parLevel} {unit || 'each'}</span>
          <span>{isLow ? '↓ Below par' : '✓ Above par'}</span>
        </div>
      )}
    </div>
  );
};

// ── Item Card ─────────────────────────────────────────────────────────────────
const KitchenItemCard = ({ item, quantity, onChange, onIncrement, onDecrement, onSave }) => {
  const [expanded, setExpanded] = useState(false);
  const isLow = item.par_level > 0 && (quantity || 0) < item.par_level;
  const hasCounted = quantity !== undefined;

  return (
    <div className={`card-surface overflow-hidden ${isLow ? 'border-l-2 border-[#D62828]/40' : ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center justify-between text-left touch-target"
        data-testid={`item-${item.id}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/80 truncate">{item.name}</p>
          <p className="text-[11px] text-white/25 mt-0.5">
            {item.station} · {item.unit || 'each'}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          {hasCounted ? (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              isLow
                ? 'bg-[#D62828]/15 text-[#D62828]'
                : 'bg-[#10B981]/12 text-[#10B981]'
            }`}>
              {quantity}
            </span>
          ) : (
            <span className="text-[11px] text-white/15">—</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.04] pt-4 space-y-3 fade-in">
          <QuantityControl
            value={quantity || 0}
            onChange={onChange}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            unit={item.unit}
            parLevel={item.par_level}
          />
          <button
            onClick={onSave}
            className="w-full h-11 bg-[#D4A017] text-[#0A0A12] rounded-xl font-semibold text-sm
                       active:opacity-90 flex items-center justify-center gap-2 transition-opacity"
          >
            <Check className="w-4 h-4" weight="bold" />
            Save Count
          </button>
        </div>
      )}
    </div>
  );
};

// ── Guided Mode ───────────────────────────────────────────────────────────────
const GuidedMode = ({ items, counts, onChange, onIncrement, onDecrement, onSaveCount, onFinish, onBack }) => {
  const [index, setIndex] = useState(0);
  const item = items[index];
  const progress = ((index + 1) / items.length) * 100;

  const handleNext = async () => {
    await onSaveCount(item.id);
    if (index < items.length - 1) setIndex(index + 1);
    else onFinish();
  };

  return (
    <div className="pb-24 fade-in" data-testid="kitchen-guided-mode">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="p-2.5 card-surface rounded-xl touch-target flex items-center justify-center"
        >
          <CaretLeft className="w-4 h-4 text-white/50" />
        </button>
        <div className="flex-1">
          <h2 className="text-[15px] font-medium text-white/80">Guided Count</h2>
          <p className="text-[11px] text-white/30">{index + 1} of {items.length}</p>
        </div>
      </div>

      <div className="h-0.5 bg-white/[0.06] rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-[#D4A017] rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="card-surface p-6 mb-5">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-light text-white/90 mb-1">{item.name}</h3>
          <p className="text-[12px] text-white/25">
            {item.location} · {item.station}
          </p>
        </div>
        <QuantityControl
          value={counts[item.id] || 0}
          onChange={v => onChange(item.id, v)}
          onIncrement={amt => onIncrement(item.id, amt)}
          onDecrement={() => onDecrement(item.id)}
          unit={item.unit}
          parLevel={item.par_level}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          className="flex-1 h-12 card-surface rounded-xl text-sm text-white/40
                     disabled:opacity-30 active:bg-white/[0.03] transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="flex-1 h-12 bg-[#D4A017] text-[#0A0A12] rounded-xl font-semibold text-sm
                     active:opacity-90 flex items-center justify-center gap-2 transition-opacity"
        >
          <Check className="w-4 h-4" weight="bold" />
          {index < items.length - 1 ? 'Save & Next' : 'Finish'}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const KitchenInventory = () => {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [station, setStation] = useState(null);
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({});
  const [guidedMode, setGuidedMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => { if (location) fetchItems(); }, [location, station]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      let params = `?location=${encodeURIComponent(location)}`;
      if (station) params += `&station=${encodeURIComponent(station)}`;
      const response = await api.get(`/inventory/kitchen/items${params}`);
      setItems(response.data);
      await cacheInventoryItems(response.data, 'kitchen');
      const initial = {};
      response.data.forEach(item => {
        if (item.latest_count !== null) initial[item.id] = item.latest_count;
      });
      setCounts(initial);
    } catch {
      const cached = await getCachedInventoryItems('kitchen');
      if (cached.length > 0) { setItems(cached); toast.info('Using cached data (offline)'); }
    } finally {
      setLoading(false);
    }
  };

  const handleChange    = (id, v) => setCounts(prev => ({ ...prev, [id]: Math.max(0, parseFloat(v) || 0) }));
  const handleIncrement = (id, amt = 1) => setCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + amt }));
  const handleDecrement = (id, amt = 1) => setCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) - amt) }));

  const handleSaveCount = async (id) => {
    const quantity = counts[id];
    if (quantity === undefined) return;
    try {
      if (isOnline) {
        await api.post('/inventory/kitchen/counts', { item_id: id, quantity });
        toast.success('Count saved');
      } else {
        await saveOfflineCounts([{ item_id: id, quantity }], 'kitchen');
        toast.info('Saved offline');
      }
    } catch {
      await saveOfflineCounts([{ item_id: id, quantity }], 'kitchen');
      toast.info('Saved offline');
    }
  };

  const handleSaveAll = async () => {
    const toSave = Object.entries(counts).map(([item_id, quantity]) => ({ item_id, quantity }));
    if (!toSave.length) { toast.error('No counts to save'); return; }
    try {
      if (isOnline) {
        await api.post('/inventory/kitchen/counts/bulk', toSave);
        toast.success(`${toSave.length} counts saved`);
      } else {
        await saveOfflineCounts(toSave, 'kitchen');
        toast.info(`${toSave.length} counts saved offline`);
      }
    } catch {
      await saveOfflineCounts(toSave, 'kitchen');
      toast.info('Saved offline');
    }
  };

  const filteredItems = items.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  const countedCount = Object.keys(counts).length;

  // ── Location Selection ──────────────────────────────────────────────────────
  if (!location) {
    return (
      <div className="pb-24 fade-in" data-testid="kitchen-inventory">
        <div className="mb-6">
          <h1 className="text-page-title flex items-center gap-2">
            <CookingPot className="w-5 h-5 text-[#D4A017]" />
            Kitchen Inventory
          </h1>
          <p className="text-[12px] text-white/30 mt-0.5">Select a location to begin</p>
        </div>

        {!isOnline && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#D4A017]/8 border border-[#D4A017]/20">
            <CloudSlash className="w-4 h-4 text-[#D4A017]" />
            <span className="text-xs text-[#D4A017]">Offline — counts will sync when online</span>
          </div>
        )}

        <div className="space-y-2">
          {LOCATIONS.map((loc, i) => (
            <button
              key={loc}
              onClick={() => setLocation(loc)}
              className="w-full card-surface px-5 py-4 text-left active:bg-white/[0.03]
                         transition-colors flex items-center justify-between touch-target fade-in-up"
              style={{ animationDelay: `${i * 40}ms` }}
              data-testid={`location-${loc.toLowerCase().replace(/ /g, '-')}`}
            >
              <div>
                <p className="text-sm text-white/80">{loc}</p>
                <p className="text-[11px] text-white/25 mt-0.5">{STATIONS[loc]?.length || 0} stations</p>
              </div>
              <CookingPot className="w-4 h-4 text-[#D4A017]/50" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Guided Mode ─────────────────────────────────────────────────────────────
  if (guidedMode && filteredItems.length > 0) {
    return (
      <GuidedMode
        items={filteredItems}
        counts={counts}
        onChange={handleChange}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onSaveCount={handleSaveCount}
        onFinish={() => { setGuidedMode(false); toast.success('Inventory count complete!'); }}
        onBack={() => setGuidedMode(false)}
      />
    );
  }

  // ── List View ───────────────────────────────────────────────────────────────
  return (
    <div className="pb-24 fade-in" data-testid="kitchen-inventory-list">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => { setLocation(null); setStation(null); }}
          className="p-2.5 card-surface rounded-xl touch-target flex items-center justify-center"
        >
          <CaretLeft className="w-4 h-4 text-white/50" />
        </button>
        <div className="flex-1">
          <h2 className="text-[15px] font-medium text-white/80">{location}</h2>
          <p className="text-[11px] text-white/25">
            {filteredItems.length} items
            {countedCount > 0 && ` · ${countedCount} counted`}
          </p>
        </div>
        {!isOnline && <CloudSlash className="w-4 h-4 text-[#D4A017]" />}
      </div>

      {/* Station tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-hide">
        {['All', ...(STATIONS[location] || [])].map(st => {
          const isActive = st === 'All' ? !station : station === st;
          return (
            <button
              key={st}
              onClick={() => setStation(st === 'All' ? null : st)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all font-medium ${
                isActive
                  ? 'bg-[#D4A017] text-[#0A0A12]'
                  : 'card-surface text-white/35 hover:text-white/55'
              }`}
              data-testid={`station-${st.toLowerCase().replace(/ /g, '-')}`}
            >
              {st}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-11 card-surface rounded-xl text-sm text-white/75
                     placeholder-white/20 focus:outline-none focus:border-[#D4A017]/40
                     border border-transparent transition-colors"
          data-testid="search-input"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setGuidedMode(true)}
          className="flex-1 h-11 bg-[#D4A017] text-[#0A0A12] rounded-xl font-semibold text-sm
                     active:opacity-90 transition-opacity"
          data-testid="start-guided-btn"
        >
          Guided Count
        </button>
        <button
          onClick={handleSaveAll}
          className="h-11 px-4 card-surface rounded-xl text-[#D4A017] text-sm font-medium
                     border border-[#D4A017]/20 active:bg-white/[0.03] transition-colors
                     flex items-center gap-2"
          data-testid="save-all-btn"
        >
          <Check className="w-4 h-4" weight="bold" />
          Save All
        </button>
      </div>

      {/* Items */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="card-surface h-16 skeleton" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-white/20 text-sm">No items found</div>
      ) : (
        <div className="space-y-1.5">
          {filteredItems.map(item => (
            <KitchenItemCard
              key={item.id}
              item={item}
              quantity={counts[item.id]}
              onChange={v => handleChange(item.id, v)}
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

export default KitchenInventory;
