import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Trash, ShieldCheck, UserCircle, Key } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const ROLE_COLORS = {
  admin:   { bg: 'bg-[#D4A017]/20', text: 'text-[#D4A017]' },
  manager: { bg: 'bg-[#10B981]/20', text: 'text-[#10B981]' },
  staff:   { bg: 'bg-[#2B2B4A]',    text: 'text-[#8E8E9F]' },
};

const validatePin = (pin) => {
  if (!pin) return 'PIN is required';
  if (!/^\d+$/.test(pin)) return 'PIN must be digits only';
  if (pin.length !== 4 && pin.length !== 6) return 'PIN must be 4 or 6 digits';
  return null;
};

const AddUserDialog = ({ api, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', pin: '', confirmPin: '', role: 'staff' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const pinErr = validatePin(form.pin);
    if (pinErr) { toast.error(pinErr); return; }
    if (form.pin !== form.confirmPin) { toast.error('PINs do not match'); return; }

    setSaving(true);
    try {
      await api.post('/users', { name: form.name.trim(), pin: form.pin, role: form.role });
      toast.success(`${form.name} added`);
      setOpen(false);
      setForm({ name: '', pin: '', confirmPin: '', role: 'staff' });
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-3 bg-[#D4A017] text-[#0A0A12] rounded-xl" data-testid="add-user-btn">
          <Plus className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A]">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0]">Add User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
            data-testid="user-name-input"
          />
          <div>
            <Input
              type="password"
              placeholder="PIN (4 or 6 digits)"
              maxLength={6}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
              className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
              data-testid="user-pin-input"
            />
            <p className="text-xs text-[#5A5A70] mt-1 ml-1">4 or 6 digits</p>
          </div>
          <Input
            type="password"
            placeholder="Confirm PIN"
            maxLength={6}
            value={form.confirmPin}
            onChange={(e) => setForm({ ...form, confirmPin: e.target.value.replace(/\D/g, '') })}
            className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
            data-testid="user-pin-confirm-input"
          />
          <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
            <SelectTrigger className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" data-testid="user-role-select">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A2E] border-[#2B2B4A]">
              <SelectItem value="staff"   className="text-[#F5F5F0]">Staff — inventory counts only</SelectItem>
              <SelectItem value="manager" className="text-[#F5F5F0]">Manager — inventory + data entry</SelectItem>
              <SelectItem value="admin"   className="text-[#F5F5F0]">Admin — full access</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A]"
            data-testid="save-user-btn"
          >
            {saving ? 'Creating…' : 'Create User'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ResetPinDialog = ({ user, api, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const pinErr = validatePin(pin);
    if (pinErr) { toast.error(pinErr); return; }
    if (pin !== confirmPin) { toast.error('PINs do not match'); return; }

    setSaving(true);
    try {
      await api.put(`/users/${user.id}/pin`, { pin });
      toast.success(`PIN updated for ${user.name}`);
      setOpen(false);
      setPin('');
      setConfirmPin('');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-2 rounded-lg text-[#8E8E9F] hover:text-[#D4A017] hover:bg-[#D4A017]/10 transition-colors"
          title="Reset PIN"
        >
          <Key className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A]">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0]">Reset PIN — {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Input
              type="password"
              placeholder="New PIN (4 or 6 digits)"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
            />
            <p className="text-xs text-[#5A5A70] mt-1 ml-1">4 or 6 digits</p>
          </div>
          <Input
            type="password"
            placeholder="Confirm new PIN"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
          />
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A]"
          >
            {saving ? 'Saving…' : 'Update PIN'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const UserManagement = () => {
  const { api, isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      // (error logged server-side)
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (userId, userName) => {
    if (userId === currentUser?.id) { toast.error("You can't remove yourself"); return; }
    try {
      await api.delete(`/users/${userId}`);
      toast.success(`${userName} deactivated`);
      fetchUsers();
    } catch {
      toast.error('Failed to deactivate user');
    }
  };

  if (!isAdmin) {
    return (
      <div className="pb-24 fade-in text-center py-12" data-testid="user-management">
        <ShieldCheck className="w-16 h-16 text-[#2B2B4A] mx-auto mb-4" />
        <p className="text-[#5A5A70]">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="pb-24 fade-in" data-testid="user-management">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#D4A017]" />
            Users
          </h1>
          <p className="text-sm text-[#8E8E9F]">{users.length} active</p>
        </div>
        <AddUserDialog api={api} onSuccess={fetchUsers} />
      </div>

      <div className="flex gap-3 mb-5">
        {Object.entries(ROLE_COLORS).map(([role, c]) => (
          <span key={role} className={`text-xs px-2 py-1 rounded-lg ${c.bg} ${c.text} capitalize`}>
            {role}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-[#5A5A70]">No users yet</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const colors = ROLE_COLORS[u.role] || ROLE_COLORS.staff;
            const isMe = u.id === currentUser?.id;
            return (
              <div
                key={u.id}
                className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4 flex items-center justify-between"
                data-testid={`user-${u.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.bg}`}>
                    {u.role === 'admin'
                      ? <ShieldCheck className={`w-5 h-5 ${colors.text}`} weight="fill" />
                      : <UserCircle className={`w-5 h-5 ${colors.text}`} />
                    }
                  </div>
                  <div>
                    <p className="text-[#F5F5F0]">
                      {u.name}
                      {isMe && <span className="ml-2 text-xs text-[#5A5A70]">(you)</span>}
                    </p>
                    <p className="text-xs text-[#5A5A70] capitalize">{u.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <ResetPinDialog user={u} api={api} onSuccess={fetchUsers} />
                  {!isMe && (
                    <button
                      onClick={() => handleDeactivate(u.id, u.name)}
                      className="p-2 rounded-lg text-[#D62828] hover:bg-[#D62828]/20 transition-colors"
                      title="Deactivate user"
                      data-testid={`delete-user-${u.id}`}
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-[#1A1A2E] border border-white/5 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-[#D4A017]" />
          <span className="text-xs uppercase tracking-wider text-[#5A5A70] font-semibold">PIN Security</span>
        </div>
        <p className="text-sm text-[#8E8E9F]">
          PINs are 4 or 6 digits and are hashed — they cannot be recovered, only reset via the key icon.
        </p>
      </div>
    </div>
  );
};

export default UserManagement;
