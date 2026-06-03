import { createContext, useContext, useState, useCallback } from 'react';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  // items: [{ plant, qty, size }]
  const [items, setItems] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isInWishlist = useCallback(
    id => items.some(i => i.plant.id === id),
    [items]
  );

  const toggleWishlist = useCallback(plant => {
    setItems(prev => {
      const exists = prev.some(i => i.plant.id === plant.id);
      if (exists) return prev.filter(i => i.plant.id !== plant.id);
      return [...prev, { plant, qty: 1, size: '' }];
    });
  }, []);

  const removeItem = useCallback(id => {
    setItems(prev => prev.filter(i => i.plant.id !== id));
  }, []);

  const updateItem = useCallback((id, field, value) => {
    setItems(prev =>
      prev.map(i => i.plant.id === id ? { ...i, [field]: value } : i)
    );
  }, []);

  const clearWishlist = useCallback(() => setItems([]), []);

  return (
    <WishlistContext.Provider value={{
      items,
      drawerOpen, setDrawerOpen,
      isInWishlist,
      toggleWishlist,
      removeItem,
      updateItem,
      clearWishlist,
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
