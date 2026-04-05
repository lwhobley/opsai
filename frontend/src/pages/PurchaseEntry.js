import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart, Plus, Trash, CaretDown, CaretUp,
  Camera, FileImage, CircleNotch, Check, X,
  PencilSimple, Warning
} from '@phosphor-icons/react';
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

const TYPE_COLORS = {
  bar:     'text-[#D4A017] bg-[#D4A017]/10',
  kitchen: 'text-[#10B981] bg-[#10B981]/10',
  supply:  'text-[#60A5FA] bg-[#60A5FA]/10',
  other:   'text-[#8E8E9F] bg-[#2B2B4A]',
};

// ── Manual Add Dialog ────────────────────────────────────────────────────────
const AddPurchaseDialog = ({ api, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    item_name: '', purchase_type: 'bar', quantity: '1',
    total_cost: '', date: new Date().toISOString().split('T')[0],
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
      setForm({ item_name: '', purchase_type: 'bar', quantity: '1', total_cost: '', date: new Date().toISOString().split('T')[0] });
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
        <button className="flex items-center gap-2 px-3 py-2.5 bg-[#1A1A2E] border border-white/5 text-[#8E8E9F] rounded-xl text-sm">
          <Plus className="w-4 h-4" /> Manual
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0]">Add Purchase</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Item / product name" value={form.item_name}
            onChange={e => set('item_name', e.target.value)}
            className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
          <Select value={form.purchase_type} onValueChange={v => set('purchase_type', v)}>
            <SelectTrigger className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1A1A2E] border-[#2B2B4A]">
              {PURCHASE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-[#F5F5F0]">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#5A5A70] mb-1 block">Quantity</label>
              <Input type="number" min="0" step="1" placeholder="1" value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" />
            </div>
            <div>
              <label className="text-xs text-[#5A5A70] mb-1 block">Total Cost ($)</label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.total_cost}
                onChange={e => set('total_cost', e.target.value)}
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

// ── Editable receipt line item ────────────────────────────────────────────────
const ReceiptLineItem = ({ item, index, onChange, onRemove }) => {
  const [editing, setEditing] = useState(false);
  const set = (k, v) => onChange(index, { ...item, [k]: v });

  return (
    <div className="bg-[#0A0A12] rounded-xl p-3 border border-white/5">
      {editing ? (
        <div className="space-y-2">
          <Input value={item.name} onChange={e => set('name', e.target.value)}
            placeholder="Item name" className="bg-[#1A1A2E] border-[#2B2B4A] text-[#F5F5F0] text-sm h-8" />
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" value={item.quantity} onChange={e => set('quantity', parseFloat(e.target.value) || 1)}
              placeholder="Qty" className="bg-[#1A1A2E] border-[#2B2B4A] text-[#F5F5F0] text-sm h-8" />
            <Input type="number" value={item.unit_cost || ''} onChange={e => set('unit_cost', parseFloat(e.target.value) || 0)}
              placeholder="Unit $" className="bg-[#1A1A2E] border-[#2B2B4A] text-[#F5F5F0] text-sm h-8" />
            <Input type="number" value={item.total_cost || ''} onChange={e => set('total_cost', parseFloat(e.target.value) || 0)}
              placeholder="Total $" className="bg-[#1A1A2E] border-[#2B2B4A] text-[#F5F5F0] text-sm h-8" />
          </div>
          <div className="flex gap-2">
            <Select value={item.purchase_type || 'other'} onValueChange={v => set('purchase_type', v)}>
              <SelectTrigger className="bg-[#1A1A2E] border-[#2B2B4A] text-[#F5F5F0] h-8 text-sm flex-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1A1A2E] border-[#2B2B4A]">
                {PURCHASE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-[#F5F5F0] text-sm">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={() => setEditing(false)}
              className="px-3 py-1 bg-[#D4A017] text-[#0A0A12] rounded-lg text-xs font-medium">
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[#F5F5F0] truncate">{item.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${TYPE_COLORS[item.purchase_type] || TYPE_COLORS.other}`}>
                {item.purchase_type}
              </span>
              <span className="text-xs text-[#5A5A70]">
                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                {item.unit_cost ? ` @ ${fmt$(item.unit_cost)}` : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm font-medium text-[#D4A017]">{fmt$(item.total_cost)}</span>
            <button onClick={() => setEditing(true)}
              className="p-1.5 text-[#5A5A70] hover:text-[#F5F5F0] rounded-lg hover:bg-white/5">
              <PencilSimple className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onRemove(index)}
              className="p-1.5 text-[#D62828] hover:bg-[#D62828]/10 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Receipt Upload & Review ───────────────────────────────────────────────────
const ReceiptScanner = ({ api, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('upload');   // upload | parsing | review | saving
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [items, setItems] = useState([]);
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const reset = () => {
    setStep('upload'); setPreview(null); setParsed(null);
    setItems([]); setVendor(''); setDate(''); setError(null);
  };

  const handleFile = async (file) => {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
      toast.error('Use a photo (JPEG/PNG/WEBP) or PDF');
      return;
    }

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    setStep('parsing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/import/receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      const data = res.data;
      setParsed(data);
      setVendor(data.vendor || '');
      setDate(data.date || new Date().toISOString().split('T')[0]);
      setItems(data.items.map(item => ({
        ...item,
        quantity: item.quantity || 1,
        unit_cost: item.unit_cost || 0,
        total_cost: item.total_cost || 0,
        purchase_type: item.purchase_type || 'other',
      })));
      setStep('review');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not parse receipt. Try a clearer photo.';
      setError(msg);
      setStep('upload');
      toast.error(msg);
    }
  };

  const handleItemChange = (idx, updated) => {
    setItems(prev => prev.map((item, i) => i === idx ? updated : item));
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, {
      name: '', quantity: 1, unit: null, unit_cost: 0, total_cost: 0, purchase_type: 'bar'
    }]);
  };

  const handleConfirm = async () => {
    const validItems = items.filter(i => i.name?.trim() && (i.total_cost > 0));
    if (validItems.length === 0) { toast.error('Add at least one item with a name and cost'); return; }
    setStep('saving');
    try {
      const res = await api.post('/import/receipt/confirm', {
        vendor, date, items: validItems,
      });
      toast.success(res.data.message);
      setOpen(false);
      reset();
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
      setStep('review');
    }
  };

  const totalParsed = items.reduce((s, i) => s + (parseFloat(i.total_cost) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2.5 bg-[#D4A017] text-[#0A0A12] rounded-xl text-sm font-medium">
          <Camera className="w-4 h-4" /> Scan Receipt
        </button>
      </DialogTrigger>

      <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A] max-h-[92vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1A2E] border-b border-white/5 px-4 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[#F5F5F0] font-medium">
                {step === 'upload'  && 'Scan Receipt or Invoice'}
                {step === 'parsing' && 'Reading Receipt…'}
                {step === 'review'  && 'Review & Confirm'}
                {step === 'saving'  && 'Saving…'}
              </h2>
              {step === 'review' && (
                <p className="text-xs text-[#5A5A70] mt-0.5">
                  {items.length} items · {fmt$(totalParsed)} total — edit anything before saving
                </p>
              )}
            </div>
            {step === 'review' && (
              <button onClick={reset} className="text-xs text-[#5A5A70] hover:text-[#8E8E9F]">
                Start over
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Upload step ── */}
          {step === 'upload' && (
            <>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-[#D62828]/10 border border-[#D62828]/20 rounded-xl">
                  <Warning className="w-4 h-4 text-[#D62828] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#D62828]">{error}</p>
                </div>
              )}

              {/* Camera capture */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={e => handleFile(e.target.files[0])} />

              {/* File picker */}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden" onChange={e => handleFile(e.target.files[0])} />

              <button onClick={() => cameraRef.current?.click()}
                className="w-full py-6 bg-[#D4A017] text-[#0A0A12] rounded-2xl flex flex-col items-center gap-2 font-medium active:bg-[#E5B83A]">
                <Camera className="w-8 h-8" weight="fill" />
                <span>Take Photo</span>
                <span className="text-xs opacity-70">Point camera at receipt or invoice</span>
              </button>

              <button onClick={() => fileRef.current?.click()}
                className="w-full py-4 bg-[#0A0A12] border border-[#2B2B4A] text-[#8E8E9F] rounded-2xl flex items-center justify-center gap-2">
                <FileImage className="w-5 h-5" />
                Upload from gallery or PDF
              </button>

              <div className="p-3 bg-[#0A0A12] rounded-xl">
                <p className="text-xs text-[#5A5A70]">
                  📸 Works with invoices, delivery receipts, and purchase orders. Gemini AI reads the document and extracts every line item automatically.
                </p>
              </div>
            </>
          )}

          {/* ── Parsing step ── */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center py-12 gap-4">
              {preview && (
                <img src={preview} alt="Receipt" className="w-32 h-40 object-cover rounded-xl opacity-40" />
              )}
              <CircleNotch className="w-10 h-10 text-[#D4A017] animate-spin" />
              <div className="text-center">
                <p className="text-[#F5F5F0] font-medium">Reading receipt…</p>
                <p className="text-xs text-[#5A5A70] mt-1">AI is extracting items, prices, and dates</p>
              </div>
            </div>
          )}

          {/* ── Review step ── */}
          {step === 'review' && (
            <>
              {/* Receipt preview thumbnail */}
              {preview && (
                <img src={preview} alt="Receipt" className="w-full max-h-32 object-contain rounded-xl opacity-60" />
              )}

              {/* Vendor & date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#5A5A70] mb-1 block">Vendor / Supplier</label>
                  <Input value={vendor} onChange={e => setVendor(e.target.value)}
                    placeholder="Vendor name"
                    className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0] text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-[#5A5A70] mb-1 block">Date</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0] text-sm h-9" />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wider text-[#5A5A70] font-semibold">Line Items</p>
                  <button onClick={handleAddItem}
                    className="text-xs text-[#D4A017] flex items-center gap-1 hover:text-[#E5B83A]">
                    <Plus className="w-3.5 h-3.5" /> Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <ReceiptLineItem
                      key={idx} item={item} index={idx}
                      onChange={handleItemChange} onRemove={handleRemoveItem}
                    />
                  ))}
                </div>
                {items.length === 0 && (
                  <div className="text-center py-4 text-[#5A5A70] text-sm">
                    No items — tap Add item to add manually
                  </div>
                )}
              </div>

              {/* Totals summary */}
              {parsed?.total && (
                <div className="flex items-center justify-between p-3 bg-[#0A0A12] rounded-xl">
                  <div className="text-xs text-[#5A5A70]">
                    <p>Receipt total: {fmt$(parsed.total)}</p>
                    {parsed.tax > 0 && <p>Tax: {fmt$(parsed.tax)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#5A5A70]">Items total</p>
                    <p className={`text-sm font-medium ${Math.abs(totalParsed - parsed.total) > 0.5 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                      {fmt$(totalParsed)}
                    </p>
                  </div>
                </div>
              )}

              {/* Confirm button */}
              <Button onClick={handleConfirm}
                className="w-full bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A] h-12 text-base font-semibold">
                <Check className="w-5 h-5 mr-2" />
                Save {items.filter(i => i.name?.trim()).length} Purchases
              </Button>
            </>
          )}

          {/* ── Saving step ── */}
          {step === 'saving' && (
            <div className="flex flex-col items-center py-12 gap-3">
              <CircleNotch className="w-8 h-8 text-[#D4A017] animate-spin" />
              <p className="text-[#F5F5F0]">Saving purchases…</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
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
      .catch(() => {})
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

  const totalCost   = filtered.reduce((s, p) => s + (p.total_cost || 0), 0);
  const barCost     = purchases.filter(p => p.purchase_type === 'bar').reduce((s, p) => s + p.total_cost, 0);
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
        {isManager && (
          <div className="flex items-center gap-2">
            <AddPurchaseDialog api={api} onSuccess={load} />
            <ReceiptScanner api={api} onSuccess={load} />
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="flex gap-2 mb-4">
        {[
          { label: 'Total',   value: fmt$(totalCost),   color: 'text-[#F5F5F0]' },
          { label: 'Bar',     value: fmt$(barCost),     color: 'text-[#D4A017]' },
          { label: 'Kitchen', value: fmt$(kitchenCost), color: 'text-[#10B981]' },
        ].map(k => (
          <div key={k.label} className="flex-1 bg-[#1A1A2E] border border-white/5 rounded-xl p-3">
            <p className="text-xs text-[#5A5A70]">{k.label}</p>
            <p className={`text-base font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + period */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4">
        {[{ value: 'all', label: 'All' }, ...PURCHASE_TYPES].map(t => (
          <button key={t.value} onClick={() => setFilterType(t.value)}
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
          {isManager && <p className="text-xs mt-1">Scan a receipt or add manually</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="bg-[#1A1A2E] border border-white/5 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="w-full p-4 flex items-center justify-between text-left">
                <div className="min-w-0">
                  <p className="text-[#F5F5F0] text-sm truncate">{p.item_name}</p>
                  <p className="text-xs text-[#5A5A70] mt-0.5 capitalize">
                    <span className={`inline-block px-1.5 py-0.5 rounded mr-1 ${TYPE_COLORS[p.purchase_type] || TYPE_COLORS.other}`}>
                      {p.purchase_type || 'other'}
                    </span>
                    {p.date?.split('T')[0]}
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
                  <button onClick={() => handleDelete(p.id)}
                    className="flex items-center gap-1.5 text-xs text-[#D62828] hover:bg-[#D62828]/10 px-3 py-1.5 rounded-lg">
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
