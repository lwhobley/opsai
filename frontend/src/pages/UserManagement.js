import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Trash, ShieldCheck, UserCircle, Key } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const UserManagement = () => {
  const { api, isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'staff' });

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.pin) {
      toast.error('Name and PIN are required');
      return;
    }

    if (newUser.pin.length !== 4 || !/^\d{4}$/.test(newUser.pin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    try {
      await api.post('/users', newUser);
      toast.success('User created');
      setShowAddDialog(false);
      setNewUser({ name: '', pin: '', role: 'staff' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser?.id) {
      toast.error("You can't delete yourself");
      return;
    }

    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deactivated');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  if (!isAdmin) {
    return (
      <div className="pb-24 fade-in text-center py-12" data-testid="user-management">
        <ShieldCheck className="w-16 h-16 text-[#2B2B4A] mx-auto mb-4" />
        <p className="text-[#5A5A70]">
          Admin access required
        </p>
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
          <p className="text-sm text-[#8E8E9F]">{users.length} active users</p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <button 
              className="p-3 bg-[#D4A017] text-[#0A0A12] rounded-xl"
              data-testid="add-user-btn"
            >
              <Plus className="w-5 h-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A]">
            <DialogHeader>
              <DialogTitle className="text-[#F5F5F0]">Add User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
                data-testid="user-name-input"
              />
              <Input
                type="password"
                placeholder="4-digit PIN"
                maxLength={4}
                value={newUser.pin}
                onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '') })}
                className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
                data-testid="user-pin-input"
              />
              <Select 
                value={newUser.role} 
                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]" data-testid="user-role-select">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A2E] border-[#2B2B4A]">
                  <SelectItem value="staff" className="text-[#F5F5F0]">Staff</SelectItem>
                  <SelectItem value="manager" className="text-[#F5F5F0]">Manager</SelectItem>
                  <SelectItem value="admin" className="text-[#F5F5F0]">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAddUser}
                className="w-full bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A]"
                data-testid="save-user-btn"
              >
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div 
              key={user.id}
              className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4 flex items-center justify-between"
              data-testid={`user-${user.id}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  user.role === 'admin' ? 'bg-[#D4A017]/20' : 
                  user.role === 'manager' ? 'bg-[#10B981]/20' : 'bg-[#2B2B4A]'
                }`}>
                  {user.role === 'admin' ? (
                    <ShieldCheck className={`w-5 h-5 text-[#D4A017]`} weight="fill" />
                  ) : (
                    <UserCircle className={`w-5 h-5 ${
                      user.role === 'manager' ? 'text-[#10B981]' : 'text-[#8E8E9F]'
                    }`} />
                  )}
                </div>
                <div>
                  <p className="text-[#F5F5F0]">{user.name}</p>
                  <p className="text-xs text-[#5A5A70] capitalize">{user.role}</p>
                </div>
              </div>
              
              {user.id !== currentUser?.id && (
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="p-2 rounded-lg text-[#D62828] hover:bg-[#D62828]/20 transition-colors"
                  data-testid={`delete-user-${user.id}`}
                >
                  <Trash className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PIN Info */}
      <div className="mt-6 p-4 bg-[#1A1A2E] border border-white/5 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-[#D4A017]" />
          <span className="text-xs uppercase tracking-wider text-[#5A5A70] font-semibold">
            PIN Security
          </span>
        </div>
        <p className="text-sm text-[#8E8E9F]">
          Each user has a unique 4-digit PIN for quick login. 
          PINs are securely hashed and cannot be recovered.
        </p>
      </div>
    </div>
  );
};

export default UserManagement;
