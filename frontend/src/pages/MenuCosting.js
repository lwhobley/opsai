import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ForkKnife, Plus, CaretRight, Percent, CurrencyDollar } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const MenuCosting = () => {
  const { api, isManager } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: '', price: '' });

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    try {
      const response = await api.get('/menu/items');
      setMenuItems(response.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) {
      toast.error('Name and price are required');
      return;
    }

    try {
      await api.post('/menu/items', {
        name: newItem.name,
        category: newItem.category,
        price: parseFloat(newItem.price),
      });
      toast.success('Menu item added');
      setShowAddDialog(false);
      setNewItem({ name: '', category: '', price: '' });
      fetchMenuItems();
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  const categories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];

  return (
    <div className="pb-24 fade-in" data-testid="menu-costing">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
            <ForkKnife className="w-6 h-6 text-[#D4A017]" />
            Menu Costing
          </h1>
          <p className="text-sm text-[#8E8E9F]">{menuItems.length} items</p>
        </div>
        
        {isManager && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <button 
                className="p-3 bg-[#D4A017] text-[#0A0A12] rounded-xl"
                data-testid="add-menu-item-btn"
              >
                <Plus className="w-5 h-5" />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#1A1A2E] border-[#2B2B4A]">
              <DialogHeader>
                <DialogTitle className="text-[#F5F5F0]">Add Menu Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
                  data-testid="menu-item-name"
                />
                <Input
                  placeholder="Category (optional)"
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
                  data-testid="menu-item-category"
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  className="bg-[#0A0A12] border-[#2B2B4A] text-[#F5F5F0]"
                  data-testid="menu-item-price"
                />
                <Button 
                  onClick={handleAddItem}
                  className="w-full bg-[#D4A017] text-[#0A0A12] hover:bg-[#E5B83A]"
                  data-testid="save-menu-item"
                >
                  Add Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CurrencyDollar className="w-4 h-4 text-[#10B981]" />
            <span className="text-xs text-[#8E8E9F]">Avg Margin</span>
          </div>
          <span className="text-xl font-light text-[#10B981]">
            ${menuItems.length > 0 
              ? (menuItems.reduce((acc, item) => acc + item.profit_margin, 0) / menuItems.length).toFixed(2)
              : '0.00'}
          </span>
        </div>
        <div className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-[#D4A017]" />
            <span className="text-xs text-[#8E8E9F]">Avg Food Cost</span>
          </div>
          <span className="text-xl font-light text-[#D4A017]">
            {menuItems.length > 0 
              ? (menuItems.reduce((acc, item) => acc + item.food_cost_pct, 0) / menuItems.length).toFixed(1)
              : '0'}%
          </span>
        </div>
      </div>

      {/* Menu Items List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {categories.length > 0 ? (
            categories.map(category => (
              <div key={category}>
                <h3 className="text-xs uppercase tracking-wider text-[#5A5A70] font-semibold mb-2">
                  {category}
                </h3>
                <div className="space-y-2">
                  {menuItems
                    .filter(item => item.category === category)
                    .map(item => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {menuItems.map(item => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {menuItems.length === 0 && (
            <div className="text-center py-12">
              <ForkKnife className="w-16 h-16 text-[#2B2B4A] mx-auto mb-4" />
              <p className="text-[#5A5A70]">
                No menu items yet
                <br />
                Add items to start tracking costs
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MenuItemCard = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const isHighCost = item.food_cost_pct > 35;
  const isLowMargin = item.profit_margin < (item.price * 0.5);

  return (
    <div className={`bg-[#1A1A2E] border rounded-xl overflow-hidden ${
      isHighCost ? 'border-[#D62828]/50' : 'border-white/5'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
        data-testid={`menu-item-${item.id}`}
      >
        <div className="flex-1">
          <span className="text-[#F5F5F0]">{item.name}</span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-[#D4A017]">${item.price}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              isHighCost ? 'bg-[#D62828] text-white' : 'bg-[#2B2B4A] text-[#8E8E9F]'
            }`}>
              {item.food_cost_pct}% cost
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-lg ${isLowMargin ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
            ${item.profit_margin}
          </span>
          <p className="text-xs text-[#5A5A70]">margin</p>
        </div>
      </button>

      {expanded && item.ingredients?.length > 0 && (
        <div className="p-4 pt-0 border-t border-white/5 fade-in">
          <h4 className="text-xs uppercase tracking-wider text-[#5A5A70] font-semibold mb-2">
            Ingredients
          </h4>
          <div className="space-y-2">
            {item.ingredients.map((ing, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-[#8E8E9F]">
                  {ing.name} ({ing.quantity} {ing.unit})
                </span>
                <span className="text-[#F5F5F0]">${(ing.quantity * ing.cost).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 flex justify-between">
            <span className="text-sm text-[#8E8E9F]">Total Cost</span>
            <span className="text-sm text-[#D4A017] font-medium">${item.total_cost}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuCosting;
