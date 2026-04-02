import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Plus, Trash, CaretDown, CaretUp } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const fmt$ = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PURCHASE_TYPES = [
  { value: 'bar',     label: 'Bar / Beverage' },
  { value: 'kitchen', label: 'Kitchen / Food' },
  { value: 'supply',  label: 'Supplies' },
  { value: 'other',   label: 'Other' },
];

const AddPurchaseDialog = ({ api, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    item_name: '', purchase_type: 'bar', quantity: '1',
    total_cost: '', date: new Date().toISOString().split('T')[0], vendor: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.item_name.trim()) { toast.error('Item name required'); return; }
    if (!form.total_cost || isNaN(parseFloat(form.total_cost))) { toast.error('Total cost required'); return; }
    setSaving(true);
    try {
      await api.post('/purchases', {
        item_name: form.item_name.trim(),
        item_type: form.purchase_type,
        purchase_type: form.purchase_type,
        quantity: parseFloat(form.quantity) || 1,
        total_cost: parseFloat(form.total_cost),
        date: new Date(form.date + 'T12:00:00Z').toISOString(),
      });
      toast.success('Purchase recorded');
      setOpen(false);
      setForm({ item_name: '', purchase_type: 'bar', quantity: '1', total_cost: '', date: new Date().toISOString().split('T')[0], vendor: '', notes: '' });
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
        <button className="p-3 bg-[#D4A017] text-[#0A0A12] rounded-xl" data-testid="add-purchase-btn">
          <Plus className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0]">Record Purchase</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Item / product name" value={form.item_name}
            onChange={e => set('item_name', e.target.value)}
            className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />

          <Select value={form.purchase_type} onValueChange={v => set('purchase_type', v)}>
            <SelectTrigger className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A2E] border-[#2B2B4A]">
              {PURCHASE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-[#F5F5F0]">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#5A5A70] mb-1 block">Quantity</label>
              <Input type="number" min="0" step="1" placeholder="1"
                value={form.quantity} onChange={e => set('quantity', e.target.value)}
                className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
            </div>
            <div>
              <label className="text-xs text-[#5A5A70] mb-1 block">Total Cost ($)</label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={form.total_cost} onChange={e => set('total_cost', e.target.value)}
                className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#5A5A70] mb-1 block">Date</label>
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
          </div>

          <Button onClick={handleSubmit} disabled={saving}
            className="w-full bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A]">
            {saving ? 'Saving…' : 'Record Purchase'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PurchaseEntry = () => {
  const { api, isManager } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [filterType, setFilterType] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/purchases?days=${days}`)
      .then(r => setPurchases(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/purchases/${id}`);
      toast.success('Purchase removed');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = filterType === 'all'
    ? purchases
    : purchases.filter(p => p.purchase_type === filterType);

  const totalCost = filtered.reduce((s, p) => s + (p.total_cost || 0), 0);
  const barCost = purchases.filter(p => p.purchase_type === 'bar').reduce((s, p) => s + p.total_cost, 0);
  const kitchenCost = purchases.filter(p => p.purchase_type === 'kitchen').reduce((s, p) => s + p.total_cost, 0);

  return (
    <div className="pb-24 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#D4A017]" />
            Purchases
          </h1>
          <p className="text-sm text-[#8E8E9F]">{purchases.length} entries · last {days} days</p>
        </div>
        {isManager && <AddPurchaseDialog api={api} onSuccess={load} />}
      </div>

      {/* KPI row */}
      <div className="flex gap-2 mb-4">
        {[
          { label: 'Total', value: fmt$(totalCost), color: 'text-[#F5F5F0]' },
          { label: 'Bar', value: fmt$(barCost), color: 'text-[#D4A017]' },
          { label: 'Kitchen', value: fmt$(kitchenCost), color: 'text-[#10B981]' },
        ].map(k => (
          <div key={k.label} className="flex-1 bg-[#1A1A2E] border border-white/5 rounded-xl p-3">
            <p className="text-xs text-[#5A5A70]">{k.label}</p>
            <p className={`text-base font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4">
        {[{ value: 'all', label: 'All' }, ...PURCHASE_TYPES].map(t => (
          <button key={t.value}
            onClick={() => setFilterType(t.value)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${
              filterType === t.value
                ? 'bg-[#D4A017] text-[#0A0A12] font-medium'
                : 'bg-[#1A1A2E] text-[#8E8E9F] border border-white/5'
            }`}>
            {t.label || 'All'}
          </button>
        ))}
        <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
          <SelectTrigger className="bg-[#1A1A2E] border-[#2B2B4A] text-[#8E8E9F] h-8 text-sm shrink-0 w-28">
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#5A5A70]">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No purchases recorded yet</p>
          {isManager && <p className="text-xs mt-1">Tap + to add your first entry</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="bg-[#1A1A2E] border border-white/5 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="min-w-0">
                  <p className="text-[#F5F5F0] text-sm truncate">{p.item_name}</p>
                  <p className="text-xs text-[#5A5A70] mt-0.5 capitalize">
                    {p.purchase_type || 'other'} · {p.date?.split('T')[0]}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[#D4A017] font-medium">{fmt$(p.total_cost)}</span>
                  {expandedId === p.id
                    ? <CaretUp className="w-4 h-4 text-[#5A5A70]" />
                    : <CaretDown className="w-4 h-4 text-[#5A5A70]" />}
                </div>
              </button>
              {expandedId === p.id && isManager && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 flex items-center justify-between">
                  <p className="text-xs text-[#5A5A70]">Qty: {p.quantity}</p>
                  <button
                    onClick={() => handleDelete(p.id)}
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

export default PurchaseEntry;
