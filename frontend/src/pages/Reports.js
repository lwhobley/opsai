import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ChartBar, WarningCircle, Scales, ArrowDown, ArrowUp,
  Trash, Plus, X, Wine, CookingPot, CheckCircle,
  ArrowsClockwise, MinusCircle
} from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;

const PeriodSelector = ({ value, onChange }) => (
  <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
    <SelectTrigger className="bg-black/30 border-white/[0.06] text-white/70 w-28 h-9 text-sm rounded-xl">
      <SelectValue />
    </SelectTrigger>
    <SelectContent className="bg-[#171726] border-white/[0.06] rounded-xl">
      {[7, 14, 30, 60, 90].map(d => (
        <SelectItem key={d} value={String(d)} className="text-white/70 focus:bg-white/[0.04] focus:text-white">{d} days</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const KpiCard = ({ label, value, sub, color = 'text-white/75' }) => (
  <div className="card-inset rounded-xl p-3.5 flex-1 min-w-0">
    <p className="text-2xs text-white/25 uppercase tracking-wide font-medium mb-1.5">{label}</p>
    <p className={`text-metric-sm font-light ${color}`}>{value}</p>
    {sub && <p className="text-[11px] text-white/20 mt-1">{sub}</p>}
  </div>
);

const VarianceBadge = ({ variance, targetLabel }) => {
  const over = variance > 0;
  const Icon = over ? ArrowUp : ArrowDown;
  return (
    <div className={`flex items-center gap-1.5 text-sm font-medium ${over ? 'text-[#D62828]' : 'text-[#10B981]'}`}>
      <Icon className="w-4 h-4" />
      {Math.abs(variance).toFixed(1)}% {over ? 'over' : 'under'} {targetLabel} target
    </div>
  );
};

const UrgencyDot = ({ urgency }) => {
  const map = { critical: 'bg-[#D62828]', high: 'bg-[#F59E0B]', medium: 'bg-[#D4A017]' };
  return <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${map[urgency] || 'bg-white/10'}`} />;
};

const SectionHeader = ({ children }) => (
  <p className="text-section-label mb-3">{children}</p>
);

const EmptyState = ({ label }) => (
  <div className="text-center py-10 text-white/20 text-sm">{label}</div>
);

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-6 h-6 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── Log Waste Dialog ─────────────────────────────────────────────────────────
const LogWasteDialog = ({ api, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    item_name: '', item_type: 'bar', reason: 'waste',
    quantity: '1', unit: '', estimated_cost: '', notes: '', date: ''
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.item_name) { toast.error('Item name is required'); return; }
    setSaving(true);
    try {
      await api.post('/reports/waste', {
        ...form,
        quantity: parseFloat(form.quantity) || 1,
        estimated_cost: parseFloat(form.estimated_cost) || 0,
      });
      toast.success('Waste logged');
      setOpen(false);
      setForm({ item_name: '', item_type: 'bar', reason: 'waste', quantity: '1', unit: '', estimated_cost: '', notes: '', date: '' });
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to log waste');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="h-9 px-3.5 bg-[#D4A017] text-[#0A0A12] rounded-xl flex items-center gap-2 text-sm font-semibold">
          <Plus className="w-4 h-4" /> Log Waste
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#111120] border-white/[0.06] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white/85 text-base font-medium">Log Waste / Comp / Spill</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Item name (e.g. Hennessy VS, Jollof Rice)" value={form.item_name}
            onChange={e => set('item_name', e.target.value)} className="bg-black/30 border-white/[0.06] text-white/80" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#5A5A70] mb-1 block">Type</label>
              <Select value={form.item_type} onValueChange={v => set('item_type', v)}>
                <SelectTrigger className="bg-black/30 border-white/[0.06] text-white/80"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#171726] border-white/[0.06]">
                  <SelectItem value="bar" className="text-white/80">Bar</SelectItem>
                  <SelectItem value="kitchen" className="text-white/80">Kitchen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#5A5A70] mb-1 block">Reason</label>
              <Select value={form.reason} onValueChange={v => set('reason', v)}>
                <SelectTrigger className="bg-black/30 border-white/[0.06] text-white/80"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#171726] border-white/[0.06]">
                  {['waste','comp','spill','breakage','expired','other'].map(r => (
                    <SelectItem key={r} value={r} className="text-[#F5F5F0] capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Qty" type="number" min="0" step="0.1" value={form.quantity}
              onChange={e => set('quantity', e.target.value)} className="bg-black/30 border-white/[0.06] text-white/80" />
            <Input placeholder="Unit (oz, portion, bottle…)" value={form.unit}
              onChange={e => set('unit', e.target.value)} className="bg-black/30 border-white/[0.06] text-white/80" />
          </div>

          <Input placeholder="Estimated cost ($)" type="number" min="0" step="0.01" value={form.estimated_cost}
            onChange={e => set('estimated_cost', e.target.value)} className="bg-black/30 border-white/[0.06] text-white/80" />

          <Input placeholder="Notes (optional)" value={form.notes}
            onChange={e => set('notes', e.target.value)} className="bg-black/30 border-white/[0.06] text-white/80" />

          <div>
            <label className="text-xs text-[#5A5A70] mb-1 block">Date (leave blank for today)</label>
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="bg-black/30 border-white/[0.06] text-white/80" />
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A] rounded-xl font-semibold">
            {saving ? 'Saving…' : 'Log Entry'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Report Tabs ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'low-stock',  label: 'Low Stock',  icon: WarningCircle },
  { id: 'variance',   label: 'Variance',   icon: Scales },
  { id: 'waste',      label: 'Waste',      icon: Trash },
  { id: 'sales',      label: 'Sales',      icon: ChartBar },
  { id: 'pour-cost',  label: 'Pour Cost',  icon: Wine },
  { id: 'food-cost',  label: 'Food Cost',  icon: CookingPot },
];

// ── Low Stock Panel ──────────────────────────────────────────────────────────
const LowStockPanel = ({ api }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/reports/low-stock').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState label="Could not load low stock data" />;

  const { items, summary } = data;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <KpiCard label="Total Low" value={summary.total_low} color="text-[#F59E0B]" />
        <KpiCard label="Critical" value={summary.critical} color="text-[#D62828]" />
        <KpiCard label="High" value={summary.high} color="text-[#F59E0B]" />
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <CheckCircle className="w-10 h-10 text-[#10B981]" weight="fill" />
          <p className="text-[#10B981] text-sm font-medium">All stock above par</p>
        </div>
      ) : (
        <>
          <SectionHeader>Items needing attention</SectionHeader>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="card-inset rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <UrgencyDot urgency={item.urgency} />
                  <div className="min-w-0">
                    <p className="text-[#F5F5F0] text-sm truncate">{item.name}</p>
                    <p className="text-xs text-[#5A5A70] capitalize">
                      {item.type === 'bar' ? `Bar · ${item.location}` : `Kitchen · ${item.station || item.location}`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {item.type === 'bar' ? (
                    <p className={`text-sm font-medium ${item.level_pct === 0 ? 'text-[#D62828]' : 'text-[#F59E0B]'}`}>
                      {item.level_pct}%
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-[#F59E0B]">
                      {item.quantity} / {item.par_level} {item.unit}
                    </p>
                  )}
                  <p className="text-xs text-[#5A5A70]">{item.last_counted?.split(' ')[0]}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Variance Panel ───────────────────────────────────────────────────────────
const VariancePanel = ({ api }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/reports/inventory-variance').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState label="Could not load variance data" />;

  const { items, summary } = data;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <KpiCard label="Items Tracked" value={summary.total_items} />
        <KpiCard label="Shrinkage" value={summary.shrinkage_items} color="text-[#D62828]" />
        <KpiCard label="Est. Loss" value={fmt$(summary.estimated_shrinkage_cost)} color="text-[#D62828]" />
      </div>
      {items.length === 0 ? (
        <EmptyState label="Need at least 2 counts per item to show variance" />
      ) : (
        <>
          <SectionHeader>Count-to-count movement (bar)</SectionHeader>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="card-inset rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-[#F5F5F0] truncate">{item.name}</p>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    item.change_pct < -25 ? 'text-[#D62828]' :
                    item.change_pct < 0  ? 'text-[#F59E0B]' : 'text-[#10B981]'
                  }`}>
                    {item.change_pct > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(item.change_pct)}%
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-[#5A5A70]">
                  <span>{item.previous_pct}% → {item.current_pct}%</span>
                  {item.cost_impact > 0 && item.change_pct < 0 && (
                    <span className="text-[#D62828]">~{fmt$(item.cost_impact)} lost</span>
                  )}
                </div>
                {item.flag === 'shrinkage' && (
                  <p className="text-xs text-[#D62828] mt-1">⚠ Unusual drop — check for waste or theft</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Waste Panel ───────────────────────────────────────────────────────────────
const WastePanel = ({ api }) => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/reports/waste-summary?days=${days}`).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/reports/waste/${id}`);
      toast.success('Entry removed');
      load();
    } catch { toast.error('Failed to remove entry'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PeriodSelector value={days} onChange={setDays} />
        <LogWasteDialog api={api} onSuccess={load} />
      </div>
      {loading ? <Spinner /> : !data ? <EmptyState label="No data" /> : (
        <>
          <div className="flex gap-2">
            <KpiCard label="Total Waste Cost" value={fmt$(data.total_waste_cost)} color="text-[#D62828]" />
            <KpiCard label="Entries" value={data.recent_entries.length} />
          </div>
          {data.by_reason.length > 0 && (
            <>
              <SectionHeader>By reason</SectionHeader>
              <div className="space-y-2">
                {data.by_reason.map((r, i) => (
                  <div key={i} className="card-inset rounded-xl p-3 flex items-center justify-between">
                    <p className="text-sm text-[#F5F5F0] capitalize">{r.reason}</p>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#F5F5F0]">{fmt$(r.cost)}</p>
                      <p className="text-xs text-[#5A5A70]">{r.count} entries</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {data.recent_entries.length > 0 && (
            <>
              <SectionHeader>Recent entries</SectionHeader>
              <div className="space-y-2">
                {data.recent_entries.map((e, i) => (
                  <div key={i} className="card-inset rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-[#F5F5F0] truncate">{e.item}</p>
                      <p className="text-xs text-[#5A5A70] capitalize">
                        {e.date} · {e.reason} · {e.quantity}{e.unit ? ` ${e.unit}` : ''}
                      </p>
                      {e.notes && <p className="text-xs text-[#8E8E9F] mt-0.5">{e.notes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-[#F5F5F0]">{fmt$(e.cost)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {data.recent_entries.length === 0 && data.by_reason.length === 0 && (
            <EmptyState label="No waste logged in this period" />
          )}
        </>
      )}
    </div>
  );
};

// ── Sales Panel ───────────────────────────────────────────────────────────────
const SalesPanel = ({ api }) => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/sales?days=${days}`).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-4">
      <PeriodSelector value={days} onChange={setDays} />
      {loading ? <Spinner /> : !data ? <EmptyState label="No data" /> : (
        <>
          <div className="flex gap-2">
            <KpiCard label="Total Sales" value={fmt$(data.summary.total_sales)} color="text-[#D4A017]" />
            <KpiCard label="Avg / Day" value={fmt$(data.summary.avg_daily_sales)} />
          </div>
          <div className="flex gap-2">
            <KpiCard label="Bar Sales" value={fmt$(data.summary.bar_sales)} />
            <KpiCard label="Food Sales" value={fmt$(data.summary.food_sales)} />
          </div>
          {data.rows.length === 0 ? <EmptyState label="No sales data in this period" /> : (
            <>
              <SectionHeader>Daily breakdown</SectionHeader>
              <div className="space-y-2">
                {[...data.rows].reverse().map((r, i) => (
                  <div key={i} className="card-inset rounded-xl p-3 flex items-center justify-between">
                    <p className="text-sm text-[#F5F5F0]">{r.date}</p>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#D4A017]">{fmt$(r.total)}</p>
                      <p className="text-xs text-[#5A5A70]">Bar {fmt$(r.bar)} · Food {fmt$(r.food)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ── Pour Cost Panel ───────────────────────────────────────────────────────────
const PourCostPanel = ({ api }) => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/pour-cost?days=${days}`).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-4">
      <PeriodSelector value={days} onChange={setDays} />
      {loading ? <Spinner /> : !data ? <EmptyState label="No data" /> : (
        <>
          <div className="flex gap-2">
            <KpiCard label="Pour Cost %" value={fmtPct(data.pour_cost_pct)}
              color={data.status === 'over' ? 'text-[#D62828]' : data.status === 'under' ? 'text-[#10B981]' : 'text-[#F5F5F0]'} />
            <KpiCard label="Target" value={fmtPct(data.target_pct)} />
          </div>
          <div className="flex gap-2">
            <KpiCard label="Bar Sales" value={fmt$(data.bar_sales)} />
            <KpiCard label="Bar COGS" value={fmt$(data.bar_cogs)} />
          </div>
          {data.waste_cost > 0 && (
            <KpiCard label="Waste Cost (bar)" value={fmt$(data.waste_cost)} color="text-[#D62828]" />
          )}
          <VarianceBadge variance={data.variance} targetLabel="20%" />

          {data.top_purchases.length > 0 && (
            <>
              <SectionHeader>Top bar purchases</SectionHeader>
              <div className="space-y-2">
                {data.top_purchases.map((p, i) => (
                  <div key={i} className="card-inset rounded-xl p-3 flex items-center justify-between">
                    <p className="text-sm text-[#F5F5F0] truncate">{p.name}</p>
                    <p className="text-sm font-medium text-[#F5F5F0]">{fmt$(p.cost)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          {data.bar_sales === 0 && <EmptyState label="No bar sales recorded in this period" />}
        </>
      )}
    </div>
  );
};

// ── Food Cost Panel ───────────────────────────────────────────────────────────
const FoodCostPanel = ({ api }) => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/food-cost?days=${days}`).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-4">
      <PeriodSelector value={days} onChange={setDays} />
      {loading ? <Spinner /> : !data ? <EmptyState label="No data" /> : (
        <>
          <div className="flex gap-2">
            <KpiCard label="Food Cost %" value={fmtPct(data.food_cost_pct)}
              color={data.status === 'over' ? 'text-[#D62828]' : data.status === 'under' ? 'text-[#10B981]' : 'text-[#F5F5F0]'} />
            <KpiCard label="Target" value={fmtPct(data.target_pct)} />
          </div>
          <div className="flex gap-2">
            <KpiCard label="Food Sales" value={fmt$(data.food_sales)} />
            <KpiCard label="Food COGS" value={fmt$(data.food_cogs)} />
          </div>
          {data.waste_cost > 0 && (
            <KpiCard label="Waste Cost (kitchen)" value={fmt$(data.waste_cost)} color="text-[#D62828]" />
          )}
          <VarianceBadge variance={data.variance} targetLabel="30%" />

          {data.menu_items.length > 0 && (
            <>
              <SectionHeader>Menu item cost breakdown</SectionHeader>
              <div className="space-y-2">
                {data.menu_items.map((item, i) => (
                  <div key={i} className="card-inset rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-[#F5F5F0] truncate">{item.name}</p>
                      <p className={`text-sm font-medium ${item.cost_pct > 35 ? 'text-[#D62828]' : item.cost_pct > 30 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                        {fmtPct(item.cost_pct)}
                      </p>
                    </div>
                    <div className="flex justify-between text-xs text-[#5A5A70]">
                      <span>Cost {fmt$(item.cost)} · Price {fmt$(item.price)}</span>
                      <span>Margin {fmt$(item.margin)}</span>
                    </div>
                    {/* Cost bar */}
                    <div className="mt-2 h-1 bg-[#2B2B4A] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.cost_pct > 35 ? 'bg-[#D62828]' : item.cost_pct > 30 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`}
                        style={{ width: `${Math.min(item.cost_pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {data.food_sales === 0 && data.menu_items.length === 0 && (
            <EmptyState label="No food sales or menu items recorded" />
          )}
        </>
      )}
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const Reports = () => {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('low-stock');

  const panels = {
    'low-stock': <LowStockPanel api={api} />,
    'variance':  <VariancePanel api={api} />,
    'waste':     <WastePanel api={api} />,
    'sales':     <SalesPanel api={api} />,
    'pour-cost': <PourCostPanel api={api} />,
    'food-cost': <FoodCostPanel api={api} />,
  };

  return (
    <div className="pb-24 fade-in">
      <div className="mb-5">
        <h1 className="text-page-title flex items-center gap-2">
          <ChartBar className="w-5 h-5 text-[#D4A017]" />
          Reports
        </h1>
        <p className="text-[12px] text-white/30 mt-0.5">Inventory, costs & waste</p>
      </div>

      {/* Tab scroll */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5 scrollbar-hide -mx-4 px-4">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors shrink-0 font-medium ${
                active
                  ? 'bg-[#D4A017] text-[#0A0A12]'
                  : 'card-surface text-white/35 hover:text-white/55'
              }`}
            >
              <Icon className="w-3.5 h-3.5" weight={active ? 'fill' : 'regular'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div>{panels[activeTab]}</div>
    </div>
  );
};

export default Reports;
