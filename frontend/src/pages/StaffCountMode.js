/**
 * StaffCountMode — simplified inventory count UI for staff role.
 *
 * Staff see:
 *   1. Choose: Bar count or Kitchen count
 *   2. Choose a location/station
 *   3. Guided count through items one-by-one (or list mode)
 *   4. Submit — done.
 *
 * No navigation to other pages. No cost data. No management actions.
 * Offline-capable (uses same offlineStorage utils).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wine, CookingPot, CaretLeft, Check, CloudArrowUp,
  ArrowRight, ListBullets, ArrowsLeftRight, SignOut
} from '@phosphor-icons/react';
import { saveOfflineCounts, cacheInventoryItems, getCachedInventoryItems } from '../utils/offlineStorage';
import { toast } from 'sonner';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_cost-control-ai/artifacts/usjulrm9_IMG_2004.png';

// ── Constants ─────────────────────────────────────────────────────────────────
const BAR_LOCATIONS = ['Main Bar', 'Service Bar', 'Back Bar', 'Storage'];
const KITCHEN_LOCATIONS = ['Line', 'Prep Area', 'Walk-In Cooler', 'Dry Storage', 'Freezer'];

const BOTTLE_LEVELS = [
  { value: 100, label: 'Full',  short: '100%', color: 'bg-[#10B981]', textColor: 'text-white' },
  { value: 75,  label: '75%',   short: '75%',  color: 'bg-[#34D399]', textColor: 'text-white' },
  { value: 50,  label: 'Half',  short: '50%',  color: 'bg-[#D4A017]', textColor: 'text-[#0A0A12]' },
  { value: 25,  label: '25%',   short: '25%',  color: 'bg-[#F59E0B]', textColor: 'text-[#0A0A12]' },
  { value: 0,   label: 'Empty', short: 'Out',  color: 'bg-[#D62828]', textColor: 'text-white' },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────
const Header = ({ onBack, onLogout, title, subtitle, showBack = true }) => (
  <header className="sticky top-0 z-50 bg-[#0A0A12]/95 backdrop-blur border-b border-white/5 px-4 py-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={onBack} className="p-2 rounded-lg bg-[#1A1A2E] border border-white/5">
            <CaretLeft className="w-5 h-5 text-[#8E8E9F]" />
          </button>
        )}
        {!showBack && <img src={LOGO_URL} alt="Ops AI" className="h-7" />}
        <div>
          <p className="text-[#F5F5F0] font-medium leading-tight">{title}</p>
          {subtitle && <p className="text-xs text-[#5A5A70]">{subtitle}</p>}
        </div>
      </div>
      {onLogout && (
        <button onClick={onLogout} className="p-2 rounded-lg text-[#5A5A70] hover:text-[#D62828]">
          <SignOut className="w-5 h-5" />
        </button>
      )}
    </div>
  </header>
);

const ProgressBar = ({ current, total }) => (
  <div className="px-4 pt-3 pb-1">
    <div className="flex justify-between text-xs text-[#5A5A70] mb-1">
      <span>Item {current} of {total}</span>
      <span>{Math.round((current / total) * 100)}%</span>
    </div>
    <div className="h-1.5 bg-[#1A1A2E] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#D4A017] rounded-full transition-all duration-300"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  </div>
);

// ── Step 1: Choose type ───────────────────────────────────────────────────────
const ChooseType = ({ onSelect, onLogout, userName, isOnline }) => (
  <div className="min-h-screen bg-[#0A0A12] flex flex-col">
    <Header title={`Hi, ${userName}`} subtitle="What are you counting?" showBack={false} onLogout={onLogout} />

    {!isOnline && (
      <div className="mx-4 mt-3 px-3 py-2 bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-lg flex items-center gap-2">
        <CloudArrowUp className="w-4 h-4 text-[#D4A017] shrink-0" />
        <p className="text-xs text-[#D4A017]">Offline — counts will sync when back online</p>
      </div>
    )}

    <div className="flex-1 flex flex-col justify-center px-4 gap-4">
      <button
        onClick={() => onSelect('bar')}
        className="w-full p-6 bg-[#1A1A2E] border border-white/5 rounded-2xl active:bg-[#252540] transition-all flex items-center gap-4"
      >
        <div className="w-14 h-14 bg-[#D4A017]/10 rounded-xl flex items-center justify-center shrink-0">
          <Wine className="w-7 h-7 text-[#D4A017]" weight="fill" />
        </div>
        <div className="text-left">
          <p className="text-xl text-[#F5F5F0] font-light">Bar Count</p>
          <p className="text-sm text-[#5A5A70]">Bottles & beverages</p>
        </div>
        <ArrowRight className="w-5 h-5 text-[#5A5A70] ml-auto" />
      </button>

      <button
        onClick={() => onSelect('kitchen')}
        className="w-full p-6 bg-[#1A1A2E] border border-white/5 rounded-2xl active:bg-[#252540] transition-all flex items-center gap-4"
      >
        <div className="w-14 h-14 bg-[#10B981]/10 rounded-xl flex items-center justify-center shrink-0">
          <CookingPot className="w-7 h-7 text-[#10B981]" weight="fill" />
        </div>
        <div className="text-left">
          <p className="text-xl text-[#F5F5F0] font-light">Kitchen Count</p>
          <p className="text-sm text-[#5A5A70]">Food & dry goods</p>
        </div>
        <ArrowRight className="w-5 h-5 text-[#5A5A70] ml-auto" />
      </button>
    </div>

    <p className="text-center text-xs text-[#2B2B4A] pb-8">Ops AI · Staff Mode</p>
  </div>
);

// ── Step 2: Choose location ───────────────────────────────────────────────────
const ChooseLocation = ({ type, onSelect, onBack }) => {
  const locations = type === 'bar' ? BAR_LOCATIONS : KITCHEN_LOCATIONS;
  const Icon = type === 'bar' ? Wine : CookingPot;
  const accentColor = type === 'bar' ? 'text-[#D4A017]' : 'text-[#10B981]';

  return (
    <div className="min-h-screen bg-[#0A0A12] flex flex-col">
      <Header
        onBack={onBack}
        title={type === 'bar' ? 'Bar Count' : 'Kitchen Count'}
        subtitle="Choose a location"
      />
      <div className="flex-1 p-4 space-y-3 pt-5">
        {locations.map((loc) => (
          <button
            key={loc}
            onClick={() => onSelect(loc)}
            className="w-full p-5 bg-[#1A1A2E] border border-white/5 rounded-xl active:bg-[#252540] transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${accentColor}`} />
              <p className="text-lg text-[#F5F5F0] font-light">{loc}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#5A5A70]" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Step 3 + 4: Count items ───────────────────────────────────────────────────
const CountItems = ({ type, location, api, isOnline, onBack, onDone }) => {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('guided'); // guided | list
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Load items
  useEffect(() => {
    const load = async () => {
      try {
        const endpoint = type === 'bar'
          ? `/inventory/bar/items?location=${encodeURIComponent(location)}`
          : `/inventory/kitchen/items?location=${encodeURIComponent(location)}`;
        const res = await api.get(endpoint);
        setItems(res.data);
        await cacheInventoryItems(res.data, type);
        // Pre-fill last known counts
        const init = {};
        res.data.forEach(item => {
          if (item.latest_count !== null && item.latest_count !== undefined) {
            init[item.id] = item.latest_count;
          }
        });
        setCounts(init);
      } catch {
        const cached = await getCachedInventoryItems(type);
        const filtered = cached.filter(i => i.location === location);
        setItems(filtered);
        toast.info('Using cached items (offline)');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [type, location]);

  const setLevel = (id, val) => setCounts(p => ({ ...p, [id]: val }));
  const setQty   = (id, val) => setCounts(p => ({ ...p, [id]: Math.max(0, parseFloat(val) || 0) }));
  const incQty   = (id, n)   => setCounts(p => ({ ...p, [id]: Math.max(0, (p[id] || 0) + n) }));

  const handleSubmit = async () => {
    const toSave = Object.entries(counts).map(([item_id, val]) => ({
      item_id,
      [type === 'bar' ? 'level_percentage' : 'quantity']: val,
    }));
    if (toSave.length === 0) { toast.error('Nothing counted yet'); return; }

    setSubmitting(true);
    try {
      const endpoint = type === 'bar'
        ? '/inventory/bar/counts/bulk'
        : '/inventory/kitchen/counts/bulk';

      if (isOnline) {
        await api.post(endpoint, toSave);
        toast.success(`${toSave.length} counts saved ✓`);
      } else {
        await saveOfflineCounts(toSave, type);
        toast.info(`${toSave.length} counts saved offline`);
      }
      onDone();
    } catch {
      await saveOfflineCounts(toSave, type);
      toast.info('Saved offline');
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A12] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0A12] flex flex-col">
        <Header onBack={onBack} title={location} subtitle="No items found" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#5A5A70] px-8 text-center">
          <p>No items set up for this location yet.</p>
          <p className="text-xs">Ask your manager to add items in the inventory settings.</p>
        </div>
      </div>
    );
  }

  const countedCount = Object.keys(counts).length;

  // ── Guided mode ──
  if (mode === 'guided') {
    const item = items[currentIdx];
    const isLast = currentIdx === items.length - 1;
    const isCounted = counts[item.id] !== undefined;

    return (
      <div className="min-h-screen bg-[#0A0A12] flex flex-col">
        <Header
          onBack={onBack}
          title={location}
          subtitle={`${countedCount} of ${items.length} counted`}
        />
        <ProgressBar current={currentIdx + 1} total={items.length} />

        {/* Mode toggle */}
        <div className="px-4 pt-3">
          <button
            onClick={() => setMode('list')}
            className="flex items-center gap-1.5 text-xs text-[#5A5A70] hover:text-[#8E8E9F]"
          >
            <ListBullets className="w-4 h-4" /> Switch to list view
          </button>
        </div>

        {/* Item card */}
        <div className="flex-1 flex flex-col justify-center px-4 py-4">
          <div className="bg-[#1A1A2E] border border-white/5 rounded-2xl p-6 mb-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-light text-[#F5F5F0] mb-1">{item.name}</h2>
              <p className="text-sm text-[#5A5A70]">
                {item.section || item.station || location}
                {item.bottle_size_ml ? ` · ${item.bottle_size_ml}ml` : ''}
                {item.unit ? ` · ${item.unit}` : ''}
              </p>
              {item.latest_count !== null && item.latest_count !== undefined && (
                <p className="text-xs text-[#2B2B4A] mt-1">
                  Last count: {type === 'bar' ? `${item.latest_count}%` : `${item.latest_count} ${item.unit || ''}`}
                </p>
              )}
            </div>

            {type === 'bar' ? (
              /* Bottle level buttons */
              <div className="grid grid-cols-5 gap-2">
                {BOTTLE_LEVELS.map(lvl => {
                  const selected = counts[item.id] === lvl.value;
                  return (
                    <button
                      key={lvl.value}
                      onClick={() => setLevel(item.id, lvl.value)}
                      className={`h-20 rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-all active:scale-95 ${
                        selected
                          ? `${lvl.color} border-white/50 ${lvl.textColor}`
                          : 'bg-[#0A0A12] border-[#2B2B4A] text-[#5A5A70]'
                      }`}
                    >
                      <span className="text-sm font-semibold">{lvl.short}</span>
                      <span className="text-xs opacity-70">{lvl.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Kitchen quantity input */
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => incQty(item.id, -1)}
                  className="w-14 h-14 bg-[#0A0A12] border border-[#2B2B4A] rounded-xl flex items-center justify-center text-2xl text-[#F5F5F0] active:bg-[#1A1A2E]"
                >−</button>
                <div className="text-center">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={counts[item.id] ?? ''}
                    onChange={e => setQty(item.id, e.target.value)}
                    placeholder="0"
                    className="w-24 text-center text-3xl font-light text-[#F5F5F0] bg-transparent border-b-2 border-[#D4A017] focus:outline-none pb-1"
                  />
                  <p className="text-xs text-[#5A5A70] mt-1">{item.unit || 'units'}</p>
                </div>
                <button
                  onClick={() => incQty(item.id, 1)}
                  className="w-14 h-14 bg-[#0A0A12] border border-[#2B2B4A] rounded-xl flex items-center justify-center text-2xl text-[#F5F5F0] active:bg-[#1A1A2E]"
                >+</button>
              </div>
            )}
          </div>

          {/* Nav buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex-1 py-4 bg-[#1A1A2E] border border-white/5 rounded-xl text-[#8E8E9F] disabled:opacity-30 active:bg-[#252540] text-sm"
            >
              Back
            </button>

            {isLast ? (
              <button
                onClick={handleSubmit}
                disabled={submitting || countedCount === 0}
                className="flex-1 py-4 bg-[#D4A017] text-[#0A0A12] rounded-xl font-semibold active:bg-[#E5B83A] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                {submitting ? 'Saving…' : `Submit ${countedCount} counts`}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!isCounted) toast.info('Tip: select a level before moving on');
                  setCurrentIdx(i => Math.min(items.length - 1, i + 1));
                }}
                className="flex-1 py-4 bg-[#D4A017] text-[#0A0A12] rounded-xl font-semibold active:bg-[#E5B83A] flex items-center justify-center gap-2"
              >
                Next <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Skip to submit early */}
          {!isLast && countedCount > 0 && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-3 w-full py-3 text-sm text-[#5A5A70] hover:text-[#8E8E9F] flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" /> Submit {countedCount} counts now
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── List mode ──
  return (
    <div className="min-h-screen bg-[#0A0A12] flex flex-col">
      <Header
        onBack={onBack}
        title={location}
        subtitle={`${countedCount} of ${items.length} counted`}
      />

      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button
          onClick={() => setMode('guided')}
          className="flex items-center gap-1.5 text-xs text-[#5A5A70] hover:text-[#8E8E9F]"
        >
          <ArrowsLeftRight className="w-4 h-4" /> Guided mode
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || countedCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-[#0A0A12] rounded-xl text-sm font-medium disabled:opacity-40"
        >
          <Check className="w-4 h-4" />
          {submitting ? 'Saving…' : `Submit (${countedCount})`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[#F5F5F0] text-sm">{item.name}</p>
                <p className="text-xs text-[#5A5A70]">
                  {item.section || item.station}
                  {item.bottle_size_ml ? ` · ${item.bottle_size_ml}ml` : ''}
                </p>
              </div>
              {counts[item.id] !== undefined && (
                <span className="text-xs px-2 py-1 bg-[#D4A017]/20 text-[#D4A017] rounded-lg font-medium">
                  {type === 'bar' ? `${counts[item.id]}%` : `${counts[item.id]} ${item.unit || ''}`}
                </span>
              )}
            </div>

            {type === 'bar' ? (
              <div className="grid grid-cols-5 gap-1.5">
                {BOTTLE_LEVELS.map(lvl => {
                  const selected = counts[item.id] === lvl.value;
                  return (
                    <button
                      key={lvl.value}
                      onClick={() => setLevel(item.id, lvl.value)}
                      className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                        selected
                          ? `${lvl.color} border-white/30 ${lvl.textColor}`
                          : 'bg-[#0A0A12] border-[#2B2B4A] text-[#5A5A70]'
                      }`}
                    >
                      {lvl.short}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => incQty(item.id, -1)}
                  className="w-9 h-9 bg-[#0A0A12] border border-[#2B2B4A] rounded-lg text-[#F5F5F0] flex items-center justify-center text-lg">−</button>
                <input
                  type="number" min="0" step="0.5"
                  value={counts[item.id] ?? ''}
                  onChange={e => setQty(item.id, e.target.value)}
                  placeholder="0"
                  className="flex-1 text-center text-[#F5F5F0] bg-[#0A0A12] border border-[#2B2B4A] rounded-lg py-2 focus:outline-none focus:border-[#D4A017]"
                />
                <button onClick={() => incQty(item.id, 1)}
                  className="w-9 h-9 bg-[#0A0A12] border border-[#2B2B4A] rounded-lg text-[#F5F5F0] flex items-center justify-center text-lg">+</button>
                <span className="text-xs text-[#5A5A70] w-10 shrink-0">{item.unit || ''}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Done screen ───────────────────────────────────────────────────────────────
const DoneScreen = ({ onCountAgain, onLogout }) => (
  <div className="min-h-screen bg-[#0A0A12] flex flex-col items-center justify-center px-8 text-center gap-6">
    <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center">
      <Check className="w-10 h-10 text-[#10B981]" weight="bold" />
    </div>
    <div>
      <h2 className="text-2xl font-light text-[#F5F5F0] mb-2">Count Submitted</h2>
      <p className="text-[#5A5A70] text-sm">Your counts have been saved successfully.</p>
    </div>
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <button
        onClick={onCountAgain}
        className="w-full py-4 bg-[#D4A017] text-[#0A0A12] rounded-xl font-semibold"
      >
        Count Another Location
      </button>
      <button
        onClick={onLogout}
        className="w-full py-4 bg-[#1A1A2E] border border-white/5 text-[#8E8E9F] rounded-xl text-sm"
      >
        Sign Out
      </button>
    </div>
  </div>
);

// ── Root ──────────────────────────────────────────────────────────────────────
const StaffCountMode = () => {
  const { api, user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [step, setStep] = useState('choose-type');      // choose-type | choose-location | counting | done
  const [type, setType] = useState(null);               // bar | kitchen
  const [location, setLocation] = useState(null);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const handleLogout = async () => { await logout(); };

  const reset = () => { setStep('choose-type'); setType(null); setLocation(null); };

  if (step === 'choose-type') return (
    <ChooseType
      onSelect={t => { setType(t); setStep('choose-location'); }}
      onLogout={handleLogout}
      userName={user?.name || 'Staff'}
      isOnline={isOnline}
    />
  );

  if (step === 'choose-location') return (
    <ChooseLocation
      type={type}
      onSelect={loc => { setLocation(loc); setStep('counting'); }}
      onBack={() => setStep('choose-type')}
    />
  );

  if (step === 'counting') return (
    <CountItems
      type={type}
      location={location}
      api={api}
      isOnline={isOnline}
      onBack={() => setStep('choose-location')}
      onDone={() => setStep('done')}
    />
  );

  return <DoneScreen onCountAgain={reset} onLogout={handleLogout} />;
};

export default StaffCountMode;
