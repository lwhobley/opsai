import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wine, MagnifyingGlass, Check, CaretLeft,
  CloudArrowUp, CloudSlash
} from '@phosphor-icons/react';
import { saveOfflineCounts, cacheInventoryItems, getCachedInventoryItems } from '../utils/offlineStorage';
import { toast } from 'sonner';

const LOCATIONS = ['Main Bar', 'Service Bar', 'Back Bar', 'Storage'];
const SECTIONS = {
  'Main Bar':    ['Well', 'Call Liquors', 'Premium', 'Liqueurs', 'Mixers'],
  'Service Bar': ['Well', 'Fast Movers'],
  'Back Bar':    ['Whiskey', 'Tequila', 'Rum', 'Gin', 'Vodka', 'Liqueurs'],
  'Storage':     ['Overstock', 'Wine', 'Beer'],
};

// level: { value, label, bg, fg, dot }
const LEVELS = [
  { value: 100, label: 'Full',  bg: '#10B981', fg: '#fff', dot: 'bg-[#10B981]' },
  { value: 75,  label: '75%',   bg: '#34D399', fg: '#fff', dot: 'bg-[#34D399]' },
  { value: 50,  label: '50%',   bg: '#D4A017', fg: '#0A0A12', dot: 'bg-[#D4A017]' },
  { value: 25,  label: '25%',   bg: '#F59E0B', fg: '#0A0A12', dot: 'bg-[#F59E0B]' },
  { value: 0,   label: 'Empty', bg: '#D62828', fg: '#fff', dot: 'bg-[#D62828]' },
];

const levelForValue = (v) => LEVELS.find(l => l.value === v);

// ── Level Segmented Control ───────────────────────────────────────────────────
const LevelControl = ({ value, onChange }) => (
  <div
    className="flex gap-1 p-1 rounded-xl"
    style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.05)' }}
    role="group"
    aria-label="Stock level"
  >
    {LEVELS.map(level => {
      const isActive = value === level.value;
      return (
        <button
          key={level.value}
          onClick={() => onChange(level.value)}
          className="flex-1 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5
                     transition-all duration-150 active:scale-95"
          style={isActive
            ? { background: level.bg, color: level.fg }
            : { background: 'transparent', color: 'rgba(255,255,255,0.28)' }
          }
          data-testid={`level-btn-${level.value}`}
        >
          <span className="text-[10px] font-semibold leading-none">{level.label}</span>
        </button>
      );
    })}
  </div>
);

// ── Level Badge ───────────────────────────────────────────────────────────────
const LevelBadge = ({ value }) => {
  const level = levelForValue(value);
  if (!level) return null;
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
      style={{ background: `${level.bg}20`, color: level.bg }}
    >
      {level.label}
    </span>
  );
};

// ── Item Card ─────────────────────────────────────────────────────────────────
const ItemCard = ({ item, level, onLevelSelect, onSave }) => {
  const [expanded, setExpanded] = useState(false);
  const hasCounted = level !== undefined;

  return (
    <div className={`card-surface overflow-hidden transition-all ${expanded ? 'shadow-lg' : ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center justify-between text-left touch-target"
        data-testid={`item-${item.id}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/80 truncate">{item.name}</p>
          <p className="text-[11px] text-white/25 mt-0.5">{item.section}</p>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          {hasCounted ? <LevelBadge value={level} /> : (
            <span className="text-[11px] text-white/15">—</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.04] fade-in pt-3 space-y-3">
          <LevelControl value={level} onChange={onLevelSelect} />
          <button
            onClick={onSave}
            disabled={level === undefined}
            className="w-full h-11 bg-[#D4A017] text-[#0A0A12] rounded-xl font-semibold text-sm
                       active:opacity-90 disabled:opacity-30 transition-opacity
                       flex items-center justify-center gap-2"
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
const GuidedMode = ({ items, counts, onLevelSelect, onSaveCount, onFinish, onBack }) => {
  const [index, setIndex] = useState(0);
  const item = items[index];
  const progress = ((index + 1) / items.length) * 100;

  const handleNext = async () => {
    await onSaveCount(item.id);
    if (index < items.length - 1) {
      setIndex(index + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div className="pb-24 fade-in" data-testid="bar-guided-mode">
      {/* Header */}
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

      {/* Progress bar */}
      <div className="h-0.5 bg-white/[0.06] rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-[#D4A017] rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Item */}
      <div className="card-surface p-6 mb-5 text-center">
        <h3 className="text-2xl font-light text-white/90 mb-1">{item.name}</h3>
        <p className="text-[12px] text-white/25">
          {item.location} · {item.section}
          {item.bottle_size_ml ? ` · ${item.bottle_size_ml}ml` : ''}
        </p>
        <div className="mt-6">
          <LevelControl value={counts[item.id]} onChange={v => onLevelSelect(item.id, v)} />
        </div>
      </div>

      {/* Navigation */}
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
const BarInventory = () => {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [section, setSection] = useState(null);
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

  useEffect(() => { fetchItems(); }, [location]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = location ? `?location=${encodeURIComponent(location)}` : '';
      const response = await api.get(`/inventory/bar/items${params}`);
      setItems(response.data);
      await cacheInventoryItems(response.data, 'bar');
      const initial = {};
      response.data.forEach(item => {
        if (item.latest_count !== null) initial[item.id] = item.latest_count;
      });
      setCounts(initial);
    } catch {
      const cached = await getCachedInventoryItems('bar');
      if (cached.length > 0) { setItems(cached); toast.info('Using cached data (offline)'); }
    } finally {
      setLoading(false);
    }
  };

  const handleLevelSelect = (itemId, level) =>
    setCounts(prev => ({ ...prev, [itemId]: level }));

  const handleSaveCount = async (itemId) => {
    const level = counts[itemId];
    if (level === undefined) return;
    try {
      if (isOnline) {
        await api.post('/inventory/bar/counts', { item_id: itemId, level_percentage: level });
        toast.success('Count saved');
      } else {
        await saveOfflineCounts([{ item_id: itemId, level_percentage: level }], 'bar');
        toast.info('Saved offline');
      }
    } catch {
      await saveOfflineCounts([{ item_id: itemId, level_percentage: level }], 'bar');
      toast.info('Saved offline');
    }
  };

  const handleSaveAll = async () => {
    const toSave = Object.entries(counts).map(([item_id, level_percentage]) => ({ item_id, level_percentage }));
    if (!toSave.length) { toast.error('No counts to save'); return; }
    try {
      if (isOnline) {
        await api.post('/inventory/bar/counts/bulk', toSave);
        toast.success(`${toSave.length} counts saved`);
      } else {
        await saveOfflineCounts(toSave, 'bar');
        toast.info(`${toSave.length} counts saved offline`);
      }
    } catch {
      await saveOfflineCounts(toSave, 'bar');
      toast.info('Saved offline');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch  = !search  || item.name.toLowerCase().includes(search.toLowerCase());
    const matchesSection = !section || item.section === section;
    return matchesSearch && matchesSection;
  });

  const guidedItems = [...filteredItems].sort((a, b) => b.count_priority - a.count_priority);
  const countedCount = Object.keys(counts).length;

  // ── Location Selection ──────────────────────────────────────────────────────
  if (!location) {
    return (
      <div className="pb-24 fade-in" data-testid="bar-inventory">
        <div className="mb-6">
          <h1 className="text-page-title flex items-center gap-2">
            <Wine className="w-5 h-5 text-[#D4A017]" />
            Bar Inventory
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
                <p className="text-[11px] text-white/25 mt-0.5">{SECTIONS[loc]?.length || 0} sections</p>
              </div>
              <Wine className="w-4 h-4 text-[#D4A017]/50" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Guided Mode ─────────────────────────────────────────────────────────────
  if (guidedMode && guidedItems.length > 0) {
    return (
      <GuidedMode
        items={guidedItems}
        counts={counts}
        onLevelSelect={handleLevelSelect}
        onSaveCount={handleSaveCount}
        onFinish={() => { setGuidedMode(false); toast.success('Inventory count complete!'); }}
        onBack={() => setGuidedMode(false)}
      />
    );
  }

  // ── List View ───────────────────────────────────────────────────────────────
  return (
    <div className="pb-24 fade-in" data-testid="bar-inventory-list">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => { setLocation(null); setSection(null); }}
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

      {/* Section tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-hide">
        {['All', ...(SECTIONS[location] || [])].map(sec => {
          const isActive = sec === 'All' ? !section : section === sec;
          return (
            <button
              key={sec}
              onClick={() => setSection(sec === 'All' ? null : sec)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all font-medium ${
                isActive
                  ? 'bg-[#D4A017] text-[#0A0A12]'
                  : 'card-surface text-white/35 hover:text-white/55'
              }`}
              data-testid={`section-${sec.toLowerCase().replace(/ /g, '-')}`}
            >
              {sec}
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
          {[1,2,3,4,5].map(i => (
            <div key={i} className="card-surface h-16 skeleton" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-white/20 text-sm">No items found</div>
      ) : (
        <div className="space-y-1.5">
          {filteredItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              level={counts[item.id]}
              onLevelSelect={v => handleLevelSelect(item.id, v)}
              onSave={() => handleSaveCount(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BarInventory;
