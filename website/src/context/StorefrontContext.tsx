"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItem {
  id: string;
  variantId?: string;
  slug: string;
  title: string;
  brand?: string;
  variantLabel?: string;
  specNote?: string;
  mrpPaise: number;
  sellingPricePaise: number;
  quantity: number;
  badge?: string;
  imageUrl?: string;
}

export interface WishlistItem {
  id: string;
  slug: string;
  title: string;
  brand?: string;
  mrpPaise: number;
  sellingPricePaise: number;
  rating?: number;
  ratingCount?: number;
  inStock?: boolean;
  imageUrl?: string;
}

export interface UserDeliveryAddress {
  fullName: string;
  mobile: string;
  alternatePhone?: string;
  houseFlatNo: string;
  streetArea: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  addressType: "home" | "work" | "other";
}

export interface DeliveryLocation {
  pincode: string;
  city: string;
  state: string;
  locality?: string;
  isExpressAvailable: boolean;
  isDeliverable: boolean;
}

interface StorefrontContextType {
  // Cart
  cart: CartItem[];
  cartCount: number;
  cartTotalPaise: number;
  addToCart: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateCartQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;

  // Wishlist
  wishlist: WishlistItem[];
  wishlistCount: number;
  isInWishlist: (id: string) => boolean;
  toggleWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string) => void;

  // Delivery / Pincode
  location: DeliveryLocation;
  setLocation: (loc: DeliveryLocation) => void;
  checkAndApplyPincode: (pincode: string) => Promise<{ success: boolean; message?: string }>;

  // Saved Delivery Address
  deliveryAddress: UserDeliveryAddress | null;
  saveDeliveryAddress: (address: UserDeliveryAddress) => void;
  hasValidDeliveryAddress: () => boolean;

  // Hydration readiness
  isHydrated: boolean;
}

const DEFAULT_LOCATION: DeliveryLocation = {
  pincode: "462001",
  city: "Bhopal",
  state: "Madhya Pradesh",
  locality: "MP Nagar",
  isExpressAvailable: true,
  isDeliverable: true,
};

const StorefrontContext = createContext<StorefrontContextType | undefined>(undefined);

export function StorefrontProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [location, setLocation] = useState<DeliveryLocation>(DEFAULT_LOCATION);
  const [deliveryAddress, setDeliveryAddress] = useState<UserDeliveryAddress | null>(null);

  // Load from localStorage only after client mounts
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("wondersale_cart");
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedWishlist = localStorage.getItem("wondersale_wishlist");
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist));

      const savedLoc = localStorage.getItem("wondersale_location");
      if (savedLoc) setLocation(JSON.parse(savedLoc));

      const savedAddr = localStorage.getItem("wondersale_delivery_address");
      if (savedAddr) setDeliveryAddress(JSON.parse(savedAddr));
    } catch {
      // Ignore localStorage errors
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Sync state changes to localStorage only after hydration
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("wondersale_cart", JSON.stringify(cart));
    } catch {
      // Ignore quota errors
    }
  }, [cart, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("wondersale_wishlist", JSON.stringify(wishlist));
    } catch {
      // Ignore quota errors
    }
  }, [wishlist, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("wondersale_location", JSON.stringify(location));
    } catch {
      // Ignore quota errors
    }
  }, [location, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (deliveryAddress) {
        localStorage.setItem("wondersale_delivery_address", JSON.stringify(deliveryAddress));
      } else {
        localStorage.removeItem("wondersale_delivery_address");
      }
    } catch {
      // Ignore quota errors
    }
  }, [deliveryAddress, isHydrated]);

  const saveDeliveryAddress = (addr: UserDeliveryAddress) => {
    setDeliveryAddress(addr);
    // Also keep active location aligned if user entered a deliverable pincode
    if (addr.pincode && addr.city) {
      setLocation((prev) => ({
        ...prev,
        pincode: addr.pincode,
        city: addr.city,
        state: addr.state || prev.state,
        locality: addr.streetArea || prev.locality,
        isExpressAvailable: addr.pincode.startsWith("462"),
        isDeliverable: true,
      }));
    }
  };

  const hasValidDeliveryAddress = (): boolean => {
    if (!deliveryAddress) return false;
    const { fullName, mobile, houseFlatNo, streetArea, city, pincode } = deliveryAddress;
    return Boolean(
      fullName?.trim() &&
        mobile?.trim() &&
        /^\d{10}$/.test(mobile.trim().replace(/\D/g, "")) &&
        houseFlatNo?.trim() &&
        streetArea?.trim() &&
        city?.trim() &&
        pincode?.trim() &&
        pincode.trim().length === 6
    );
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotalPaise = cart.reduce(
    (acc, item) => acc + item.sellingPricePaise * item.quantity,
    0
  );
  const wishlistCount = wishlist.length;

  const addToCart = (item: Omit<CartItem, "quantity">, quantity = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === item.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const isInWishlist = (id: string) => {
    return wishlist.some((item) => item.id === id);
  };

  const toggleWishlist = (item: WishlistItem) => {
    setWishlist((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const removeFromWishlist = (id: string) => {
    setWishlist((prev) => prev.filter((item) => item.id !== id));
  };

  const checkAndApplyPincode = async (pincode: string) => {
    try {
      const res = await fetch(`/api/pincode/check?pincode=${encodeURIComponent(pincode)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.error?.message || "Invalid PIN code" };
      }

      const pData = data.data;
      if (!pData.isDeliverable) {
        return {
          success: false,
          message: `PIN code ${pincode} is currently unserviceable for delivery.`,
        };
      }

      setLocation({
        pincode: pData.pincode,
        city: pData.city,
        state: pData.state,
        locality: pData.city === "Bhopal" ? "MP Nagar" : pData.city,
        isExpressAvailable: pData.isExpressAvailable,
        isDeliverable: pData.isDeliverable,
      });

      return { success: true };
    } catch {
      return { success: false, message: "Unable to verify PIN code serviceability" };
    }
  };

  return (
    <StorefrontContext.Provider
      value={{
        cart,
        cartCount,
        cartTotalPaise,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        wishlist,
        wishlistCount,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        location,
        setLocation,
        checkAndApplyPincode,
        deliveryAddress,
        saveDeliveryAddress,
        hasValidDeliveryAddress,
        isHydrated,
      }}
    >
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  const context = useContext(StorefrontContext);
  if (!context) {
    throw new Error("useStorefront must be used within a StorefrontProvider");
  }
  return context;
}
