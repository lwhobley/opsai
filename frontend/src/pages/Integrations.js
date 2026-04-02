import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PlugsConnected, Plug, ArrowsClockwise, CheckCircle,
  WarningCircle, Clock, X, Eye, EyeSlash
} from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const StatusBadge = ({ status }) => {
  if (!status) return null;
  const map = {
    success: { color: 'text-[#10B981] bg-[#10B981]/10', icon: <CheckCircle className="w-3 h-3" weight="fill" />, label: 'Synced' },
    error:   { color: 'text-[#D62828] bg-[#D62828]/10',  icon: <WarningCircle className="w-3 h-3" weight="fill" />, label: 'Error' },
    pending: { color: 'text-[#D4A017] bg-[#D4A017]/10',  icon: <Clock className="w-3 h-3" />,        label: 'Pending' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
};

const formatDate = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

// ── Connect Dialog ───────────────────────────────────────────────────────────
const ConnectToastDialog = ({ api, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: '', client_secret: '', restaurant_guid: '', restaurant_name: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleConnect = async () => {
    if (!form.client_id || !form.client_secret || !form.restaurant_guid) {
      toast.error('Client ID, Client Secret, and Restaurant GUID are required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/integrations/toast/connect', form);
      toast.success(res.data.message);
      setOpen(false);
      setForm({ client_id: '', client_secret: '', restaurant_guid: '', restaurant_name: '' });
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Connection failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A] text-sm">
          Connect Toast
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A]">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0]">Connect Toast POS</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-[#5A5A70] -mt-2">
          Find these in Toast Web → Integrations → API Access
        </p>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-[#8E8E9F] mb-1 block">Restaurant Name (optional)</label>
            <Input
              placeholder="Enish Houston"
              value={form.restaurant_name}
              onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })}
              className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
            />
          </div>
          <div>
            <label className="text-xs text-[#8E8E9F] mb-1 block">Restaurant GUID *</label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={form.restaurant_guid}
              onChange={(e) => setForm({ ...form, restaurant_guid: e.target.value.trim() })}
              className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0] font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#8E8E9F] mb-1 block">Client ID *</label>
            <Input
              placeholder="Toast Client ID"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value.trim() })}
              className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0] font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#8E8E9F] mb-1 block">Client Secret *</label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                placeholder="Toast Client Secret"
                value={form.client_secret}
                onChange={(e) => setForm({ ...form, client_secret: e.target.value.trim() })}
                className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0] font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A70] hover:text-[#8E8E9F]"
              >
                {showSecret ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="p-3 bg-[#0A0A12] rounded-lg border border-[#2B2B4A]">
            <p className="text-xs text-[#5A5A70]">
              🔒 Credentials are stored encrypted and never logged. 
              Connection is verified immediately on save.
            </p>
          </div>
          <Button
            onClick={handleConnect}
            disabled={saving}
            className="w-full bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A]"
          >
            {saving ? 'Connecting…' : 'Connect & Verify'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Toast Card ───────────────────────────────────────────────────────────────
const ToastCard = ({ api, isAdmin, isManager }) => {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/integrations/toast/status');
      setStatus(res.data);
    } catch (err) {
      console.error('Toast status error:', err);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/integrations/toast/sync');
      toast.success(`Sync complete — ${res.data.orders_processed} orders | $${res.data.total_sales.toLocaleString()}`);
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.post('/integrations/toast/disconnect');
      toast.success('Toast disconnected');
      fetchStatus();
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = status?.is_connected;

  return (
    <div className="bg-[#1A1A2E] border border-white/5 rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Toast logo placeholder */}
          <div className="w-10 h-10 rounded-xl bg-[#FF4C00]/10 flex items-center justify-center">
            <span className="text-[#FF4C00] font-bold text-sm">T</span>
          </div>
          <div>
            <p className="text-[#F5F5F0] font-medium">Toast POS</p>
            <p className="text-xs text-[#5A5A70]">Sales sync</p>
          </div>
        </div>

        {/* Connection dot */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#10B981]' : 'bg-[#2B2B4A]'}`} />
          <span className="text-xs text-[#8E8E9F]">{connected ? 'Connected' : 'Not connected'}</span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        {connected ? (
          <>
            {/* Restaurant name */}
            {status?.restaurant_name && (
              <div className="flex items-center gap-2">
                <PlugsConnected className="w-4 h-4 text-[#10B981]" />
                <span className="text-sm text-[#F5F5F0]">{status.restaurant_name}</span>
              </div>
            )}

            {/* Last sync */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5A5A70]">Last synced</p>
                <p className="text-sm text-[#F5F5F0]">
                  {status?.last_synced_at ? formatDate(status.last_synced_at) : 'Never'}
                </p>
              </div>
              {status?.last_sync_status && <StatusBadge status={status.last_sync_status} />}
            </div>

            {/* Error message */}
            {status?.last_sync_status === 'error' && status?.last_sync_message && (
              <div className="p-2 bg-[#D62828]/10 rounded-lg">
                <p className="text-xs text-[#D62828]">{status.last_sync_message}</p>
              </div>
            )}

            {/* Connected since */}
            {status?.connected_at && (
              <p className="text-xs text-[#5A5A70]">
                Connected {formatDate(status.connected_at)}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {isManager && (
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1 bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A] text-sm h-9"
                >
                  <ArrowsClockwise className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </Button>
              )}
              {isAdmin && (
                <Button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  variant="outline"
                  className="border-[#2B2B4A] text-[#D62828] hover:bg-[#D62828]/10 text-sm h-9"
                >
                  <X className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              )}
            </div>

            {/* Auto-sync note */}
            <p className="text-xs text-[#5A5A70]">
              💡 Syncs yesterday's sales. Hit Sync Now anytime or trigger from Dashboard.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-[#8E8E9F]">
              Connect Toast to automatically pull daily sales into your dashboard — no manual entry.
            </p>
            <ul className="text-xs text-[#5A5A70] space-y-1">
              <li>✓ Total, bar & food sales split</li>
              <li>✓ Order-level data</li>
              <li>✓ Auto-populates KPI dashboard</li>
            </ul>
            {isAdmin ? (
              <ConnectToastDialog api={api} onSuccess={fetchStatus} />
            ) : (
              <p className="text-xs text-[#5A5A70]">Ask your admin to connect Toast.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const Integrations = () => {
  const { api, isAdmin, isManager } = useAuth();

  return (
    <div className="pb-24 fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
          <PlugsConnected className="w-6 h-6 text-[#D4A017]" />
          Integrations
        </h1>
        <p className="text-sm text-[#8E8E9F]">Connect your POS and third-party tools</p>
      </div>

      <div className="space-y-4">
        <ToastCard api={api} isAdmin={isAdmin} isManager={isManager} />

        {/* Placeholder cards for future integrations */}
        {[
          { name: 'Square', desc: 'Coming soon', color: '#00B4D8' },
          { name: 'QuickBooks', desc: 'Coming soon', color: '#2CA01C' },
        ].map((item) => (
          <div
            key={item.name}
            className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4 flex items-center justify-between opacity-40"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl" style={{ background: item.color + '20' }}>
                <span className="w-full h-full flex items-center justify-center text-sm font-bold" style={{ color: item.color }}>
                  {item.name[0]}
                </span>
              </div>
              <div>
                <p className="text-[#F5F5F0]">{item.name}</p>
                <p className="text-xs text-[#5A5A70]">{item.desc}</p>
              </div>
            </div>
            <Plug className="w-5 h-5 text-[#2B2B4A]" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Integrations;
