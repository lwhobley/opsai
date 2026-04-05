import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { CurrencyDollar, Plus, Trash, CaretDown, CaretUp, PlugsConnected } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const fmt$ = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AddSaleDialog = ({ api, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    total_sales: '', bar_sales: '', food_sales: ''
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calculate total from bar + food
  const barVal  = parseFloat(form.bar_sales)  || 0;
  const foodVal = parseFloat(form.food_sales) || 0;
  const autoTotal = barVal + foodVal;

  const handleSubmit = async () => {
    const total = parseFloat(form.total_sales) || autoTotal;
    if (!total) { toast.error('Enter at least a total sales figure'); return; }
    setSaving(true);
    try {
      await api.post('/sales', {
        date: new Date(form.date + 'T12:00:00Z').toISOString(),
        total_sales: total,
        bar_sales:   barVal,
        food_sales:  foodVal,
      });
      toast.success('Sales recorded');
      setOpen(false);
      setForm({ date: new Date().toISOString().split('T')[0], total_sales: '', bar_sales: '', food_sales: '' });
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-3 bg-[#D4A017] text-[#0A0A12] rounded-xl" data-testid="add-sale-btn">
          <Plus className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A]">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0]">Record Daily Sales</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-[#5A5A70] mb-1 block">Date</label>
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#5A5A70] mb-1 block">Bar Sales ($)</label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={form.bar_sales} onChange={e => set('bar_sales', e.target.value)}
                className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
            </div>
            <div>
              <label className="text-xs text-[#5A5A70] mb-1 block">Food Sales ($)</label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={form.food_sales} onChange={e => set('food_sales', e.target.value)}
                className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
            </div>
          </div>

          {/* Auto total preview */}
          {autoTotal > 0 && !form.total_sales && (
            <div className="px-3 py-2 bg-[#0A0A12] rounded-lg flex justify-between items-center">
              <span className="text-xs text-[#5A5A70]">Auto total</span>
              <span className="text-[#D4A017] font-medium">{fmt$(autoTotal)}</span>
            </div>
          )}

          <div>
            <label className="text-xs text-[#5A5A70] mb-1 block">
              Total Sales ($) <span className="text-[#2B2B4A]">— leave blank to use bar + food sum</span>
            </label>
            <Input type="number" min="0" step="0.01" placeholder={autoTotal > 0 ? String(autoTotal.toFixed(2)) : '0.00'}
              value={form.total_sales} onChange={e => set('total_sales', e.target.value)}
              className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
          </div>

          <Button onClick={handleSubmit} disabled={saving}
            className="w-full bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A]">
            {saving ? 'Saving…' : 'Record Sales'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SalesEntry = () => {
  const { api, isManager } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [toastConnected, setToastConnected] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/sales?days=${days}`),
      api.get('/integrations/toast/status').catch(() => ({ data: { is_connected: false } })),
    ]).then(([salesRes, toastRes]) => {
      setSales(salesRes.data);
      setToastConnected(toastRes.data.is_connected);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/sales/${id}`);
      toast.success('Entry removed');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const totalSales  = sales.reduce((s, r) => s + (r.total_sales || 0), 0);
  const totalBar    = sales.reduce((s, r) => s + (r.bar_sales   || 0), 0);
  const totalFood   = sales.reduce((s, r) => s + (r.food_sales  || 0), 0);
  const avgDaily    = sales.length > 0 ? totalSales / sales.length : 0;

  return (
    <div className="pb-24 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
            <CurrencyDollar className="w-6 h-6 text-[#D4A017]" />
            Sales
          </h1>
          <p className="text-sm text-[#8E8E9F]">{sales.length} days · last {days} days</p>
        </div>
        {isManager && <AddSaleDialog api={api} onSuccess={load} />}
      </div>

      {/* Toast connected banner */}
      {toastConnected && (
        <div className="mb-4 px-3 py-2.5 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl flex items-center gap-2">
          <PlugsConnected className="w-4 h-4 text-[#10B981] shrink-0" />
          <p className="text-xs text-[#10B981]">Toast connected — sales sync automatically. Manual entry still available.</p>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Total Revenue', value: fmt$(totalSales), color: 'text-[#D4A017]' },
          { label: 'Avg / Day',     value: fmt$(avgDaily),   color: 'text-[#F5F5F0]' },
          { label: 'Bar Sales',     value: fmt$(totalBar),   color: 'text-[#F5F5F0]' },
          { label: 'Food Sales',    value: fmt$(totalFood),  color: 'text-[#F5F5F0]' },
        ].map(k => (
          <div key={k.label} className="bg-[#1A1A2E] border border-white/5 rounded-xl p-3">
            <p className="text-xs text-[#5A5A70]">{k.label}</p>
            <p className={`text-base font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex justify-end mb-3">
        <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
          <SelectTrigger className="bg-[#1A1A2E] border-[#2B2B4A] text-[#8E8E9F] h-8 text-sm w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1A2E] border-[#2B2B4A]">
            {[7,14,30,60,90].map(d => (
              <SelectItem key={d} value={String(d)} className="text-[#F5F5F0]">{d} days</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-7 h-7 border-2 border-[#D4A017] border-t-transparent rounded-full" />
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-[#5A5A70]">
          <CurrencyDollar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No sales recorded yet</p>
          {isManager && !toastConnected && (
            <p className="text-xs mt-1">Tap + to enter daily sales, or connect Toast in Integrations</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {[...sales].reverse().map(s => (
            <div key={s.id} className="bg-[#1A1A2E] border border-white/5 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div>
                  <p className="text-[#F5F5F0] text-sm">{s.date?.split('T')[0]}</p>
                  <p className="text-xs text-[#5A5A70] mt-0.5">
                    Bar {fmt$(s.bar_sales)} · Food {fmt$(s.food_sales)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[#D4A017] font-semibold">{fmt$(s.total_sales)}</span>
                  {expandedId === s.id
                    ? <CaretUp className="w-4 h-4 text-[#5A5A70]" />
                    : <CaretDown className="w-4 h-4 text-[#5A5A70]" />}
                </div>
              </button>
              {expandedId === s.id && isManager && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 flex justify-end">
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="flex items-center gap-1.5 text-xs text-[#D62828] hover:bg-[#D62828]/10 px-3 py-1.5 rounded-lg"
                  >
                    <Trash className="w-4 h-4" /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesEntry;
