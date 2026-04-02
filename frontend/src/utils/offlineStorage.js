import localforage from 'localforage';

// Initialize localforage for offline storage
localforage.config({
  name: 'OpsAI',
  storeName: 'offline_counts',
});

// Save counts offline
export const saveOfflineCounts = async (counts, type = 'bar') => {
  const key = `pending_${type}_counts`;
  const existing = (await localforage.getItem(key)) || [];
  const updated = [...existing, ...counts.map(c => ({ ...c, timestamp: new Date().toISOString() }))];
  await localforage.setItem(key, updated);
  return updated;
};

// Get pending offline counts
export const getPendingCounts = async (type = 'bar') => {
  const key = `pending_${type}_counts`;
  return (await localforage.getItem(key)) || [];
};

// Clear pending counts after sync
export const clearPendingCounts = async (type = 'bar') => {
  const key = `pending_${type}_counts`;
  await localforage.removeItem(key);
};

// Sync offline counts when online
export const syncOfflineCounts = async (api) => {
  const barCounts = await getPendingCounts('bar');
  const kitchenCounts = await getPendingCounts('kitchen');
  
  let synced = { bar: 0, kitchen: 0 };
  
  if (barCounts.length > 0) {
    try {
      await api.post('/inventory/bar/counts/bulk', barCounts);
      await clearPendingCounts('bar');
      synced.bar = barCounts.length;
    } catch (error) {
    }
  }
  
  if (kitchenCounts.length > 0) {
    try {
      await api.post('/inventory/kitchen/counts/bulk', kitchenCounts);
      await clearPendingCounts('kitchen');
      synced.kitchen = kitchenCounts.length;
    } catch (error) {
    }
  }
  
  return synced;
};

// Cache inventory items for offline use
export const cacheInventoryItems = async (items, type = 'bar') => {
  await localforage.setItem(`${type}_items_cache`, items);
};

export const getCachedInventoryItems = async (type = 'bar') => {
  return (await localforage.getItem(`${type}_items_cache`)) || [];
};
