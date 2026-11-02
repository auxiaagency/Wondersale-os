import React from "react";
import {
  Utensils,
  Headphones,
  Shirt,
  Cookie,
  Home,
  Sparkles,
  Gamepad2,
  Tv,
  Smartphone,
  Watch,
  ShoppingBag,
  Heart,
  Baby,
  Footprints,
  BookOpen,
  Coffee,
  Package,
  Layers,
  Wrench,
  Camera,
  Scissors,
  Gift,
  Car,
  Lightbulb,
  Music,
  ShoppingBasket,
  Apple,
  Dumbbell,
  Shield,
  Palette,
  Luggage,
  Folder,
  Tag,
  Glasses,
  Clock,
  Fan,
  Flame,
  Zap,
} from "lucide-react";

export interface AvailableIcon {
  name: string;
  label: string;
  icon: React.ElementType;
}

export const CATEGORY_ICON_REGISTRY: Record<string, React.ElementType> = {
  Utensils,
  Headphones,
  Shirt,
  Cookie,
  Home,
  Sparkles,
  Gamepad2,
  Tv,
  Smartphone,
  Watch,
  ShoppingBag,
  Heart,
  Baby,
  Footprints,
  BookOpen,
  Coffee,
  Package,
  Layers,
  Wrench,
  Camera,
  Scissors,
  Gift,
  Car,
  Lightbulb,
  Music,
  ShoppingBasket,
  Apple,
  Dumbbell,
  Shield,
  Palette,
  Luggage,
  Folder,
  Tag,
  Glasses,
  Clock,
  Fan,
  Flame,
  Zap,
};

export const AVAILABLE_ICONS: AvailableIcon[] = [
  { name: "Headphones", label: "Headphones (Audio / Tech)", icon: Headphones },
  { name: "Smartphone", label: "Smartphone (Electronics)", icon: Smartphone },
  { name: "Tv", label: "TV & Displays", icon: Tv },
  { name: "Watch", label: "Smartwatch / Clocks", icon: Watch },
  { name: "Shirt", label: "Shirt (Fashion & Apparel)", icon: Shirt },
  { name: "ShoppingBag", label: "Shopping Bag (Fashion / Style)", icon: ShoppingBag },
  { name: "Glasses", label: "Glasses (Eyewear & Accessories)", icon: Glasses },
  { name: "Footprints", label: "Footwear / Shoes", icon: Footprints },
  { name: "Cookie", label: "Cookie (Food / Snacks)", icon: Cookie },
  { name: "Apple", label: "Apple / Fresh Produce", icon: Apple },
  { name: "ShoppingBasket", label: "Shopping Basket (Grocery)", icon: ShoppingBasket },
  { name: "Coffee", label: "Coffee / Beverages", icon: Coffee },
  { name: "Utensils", label: "Utensils (Kitchen & Dining)", icon: Utensils },
  { name: "Flame", label: "Cookware / Cooktop", icon: Flame },
  { name: "Home", label: "Home & Living", icon: Home },
  { name: "Fan", label: "Fan & Appliances", icon: Fan },
  { name: "Sparkles", label: "Beauty & Personal Care", icon: Sparkles },
  { name: "Scissors", label: "Grooming & Salon", icon: Scissors },
  { name: "Heart", label: "Wellness & Health", icon: Heart },
  { name: "Gamepad2", label: "Gamepad (Toys & Gaming)", icon: Gamepad2 },
  { name: "Baby", label: "Baby & Kids", icon: Baby },
  { name: "Gift", label: "Gifts & Novelties", icon: Gift },
  { name: "BookOpen", label: "Books & Stationery", icon: BookOpen },
  { name: "Palette", label: "Craft & Art", icon: Palette },
  { name: "Dumbbell", label: "Fitness & Sports", icon: Dumbbell },
  { name: "Luggage", label: "Bags & Luggage", icon: Luggage },
  { name: "Car", label: "Auto & Motor", icon: Car },
  { name: "Wrench", label: "Tools & Hardware", icon: Wrench },
  { name: "Lightbulb", label: "Lighting & Electrical", icon: Lightbulb },
  { name: "Zap", label: "Power & Fast Deals", icon: Zap },
  { name: "Music", label: "Music & Instruments", icon: Music },
  { name: "Camera", label: "Cameras & Optics", icon: Camera },
  { name: "Shield", label: "Safety & Security", icon: Shield },
  { name: "Package", label: "Package / General Item", icon: Package },
];

/**
 * Returns a React Lucide Icon component for the given icon name or category fallback.
 */
export function getCategoryIcon(iconName?: string | null, categoryName?: string): React.ElementType {
  if (iconName && CATEGORY_ICON_REGISTRY[iconName]) {
    return CATEGORY_ICON_REGISTRY[iconName];
  }

  // Automatic heuristic inference if no icon is explicitly set
  const lower = (categoryName || "").toLowerCase();
  if (lower.includes("electronic") || lower.includes("audio") || lower.includes("gadget")) return Headphones;
  if (lower.includes("fashion") || lower.includes("apparel") || lower.includes("cloth")) return Shirt;
  if (lower.includes("food") || lower.includes("snack") || lower.includes("grocery")) return Cookie;
  if (lower.includes("kitchen") || lower.includes("dining") || lower.includes("cook")) return Utensils;
  if (lower.includes("home") || lower.includes("living")) return Home;
  if (lower.includes("personal care") || lower.includes("beauty") || lower.includes("cosmetic")) return Sparkles;
  if (lower.includes("toy") || lower.includes("kid") || lower.includes("game")) return Gamepad2;
  if (lower.includes("sport") || lower.includes("fitness")) return Dumbbell;
  if (lower.includes("stationery") || lower.includes("book")) return BookOpen;

  return Package;
}
