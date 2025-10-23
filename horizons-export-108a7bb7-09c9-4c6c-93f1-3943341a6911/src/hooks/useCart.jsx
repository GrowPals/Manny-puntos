
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency } from '@/api/EcommerceApi';

const CartContext = createContext();

const CART_STORAGE_KEY = 'manny-ecommerce-cart';

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const storedCart = localStorage.getItem(CART_STORAGE_KEY);
      return storedCart ? JSON.parse(storedCart) : [];
    } catch (error) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = useCallback((product, variant, quantity, availableQuantity) => {
    return new Promise((resolve, reject) => {
      if (variant.manage_inventory) {
        const existingItem = cartItems.find(item => item.variant.id === variant.id);
        const currentCartQuantity = existingItem ? existingItem.quantity : 0;
        if ((currentCartQuantity + quantity) > availableQuantity) {
          const error = new Error(`No hay suficiente stock para ${product.title} (${variant.title}). Solo quedan ${availableQuantity}.`);
          reject(error);
          return;
        }
      }

      setCartItems(prevItems => {
        const existingItem = prevItems.find(item => item.variant.id === variant.id);
        if (existingItem) {
          return prevItems.map(item =>
            item.variant.id === variant.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [...prevItems, { product, variant, quantity }];
      });
      resolve();
    });
  }, [cartItems]);

  const removeFromCart = useCallback((variantId) => {
    setCartItems(prevItems => prevItems.filter(item => item.variant.id !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId, newQuantity) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.variant.id === variantId ? { ...item, quantity: newQuantity } : item
      ).filter(item => item.quantity > 0)
    );
  }, []);
  
  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const getCartTotal = useCallback(() => {
    if (cartItems.length === 0) return formatCurrency(0, { code: 'USD', symbol: '$', template: '$1' });
    
    return formatCurrency(cartItems.reduce((total, item) => {
      const price = item.variant.sale_price_in_cents ?? item.variant.price_in_cents;
      return total + price * item.quantity;
    }, 0), cartItems[0].variant.currency_info);
  }, [cartItems]);

  const value = useMemo(() => ({
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
  }), [cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
};
