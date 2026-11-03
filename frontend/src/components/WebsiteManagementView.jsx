import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe,
  Package,
  ShoppingBag,
  TrendingUp,
  Search,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  Phone,
  MapPin,
  ArrowLeft,
  Filter,
  Layers,
  Sparkles,
  Save,
  Check,
  GripVertical,
  Utensils,
  Headphones,
  Shirt,
  Cookie,
  Home,
  Gamepad2,
  Tv,
  Smartphone,
  Watch,
  Heart,
  Baby,
  Footprints,
  BookOpen,
  Coffee,
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
  Tag,
  Glasses,
  Fan,
  Flame,
  Zap,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit3,
  Link as LinkIcon,
  Upload,
  LayoutGrid as Grid,
} from 'lucide-react';
import ImageCropModal from './ImageCropModal';
import {
  fetchWebsiteStats,
  fetchWebsiteOrders,
  updateWebsiteOrderStatus,
  toggleItemWebsiteListing,
  fetchItems,
  fetchCategories,
  updateCategory,
  fetchHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  uploadHeroSlideImage,
  fetchDealsOfTheDay,
  createDealOfTheDay,
  updateDealOfTheDay,
  deleteDealOfTheDay,
  fetchShopByCategoryCards,
  createShopByCategoryCard,
  updateShopByCategoryCard,
  deleteShopByCategoryCard,
  uploadShopByCategoryImage,
} from '../api';


const AVAILABLE_CATEGORY_ICONS = [
  { name: 'Headphones', label: 'Audio / Tech', icon: Headphones },
  { name: 'Smartphone', label: 'Electronics', icon: Smartphone },
  { name: 'Tv', label: 'TV & Displays', icon: Tv },
  { name: 'Watch', label: 'Watches / Time', icon: Watch },
  { name: 'Shirt', label: 'Fashion & Clothes', icon: Shirt },
  { name: 'ShoppingBag', label: 'Fashion / Bags', icon: ShoppingBag },
  { name: 'Glasses', label: 'Eyewear / Style', icon: Glasses },
  { name: 'Footprints', label: 'Footwear / Shoes', icon: Footprints },
  { name: 'Cookie', label: 'Food / Snacks', icon: Cookie },
  { name: 'Apple', label: 'Fresh Produce', icon: Apple },
  { name: 'ShoppingBasket', label: 'Grocery Basket', icon: ShoppingBasket },
  { name: 'Coffee', label: 'Beverages', icon: Coffee },
  { name: 'Utensils', label: 'Kitchen & Dining', icon: Utensils },
  { name: 'Flame', label: 'Cookware', icon: Flame },
  { name: 'Home', label: 'Home & Living', icon: Home },
  { name: 'Fan', label: 'Appliances / Cooling', icon: Fan },
  { name: 'Sparkles', label: 'Personal Care & Beauty', icon: Sparkles },
  { name: 'Scissors', label: 'Grooming', icon: Scissors },
  { name: 'Heart', label: 'Wellness & Health', icon: Heart },
  { name: 'Gamepad2', label: 'Toys & Gaming', icon: Gamepad2 },
  { name: 'Baby', label: 'Kids & Baby', icon: Baby },
  { name: 'Gift', label: 'Gifts & Toys', icon: Gift },
  { name: 'BookOpen', label: 'Books & Stationery', icon: BookOpen },
  { name: 'Palette', label: 'Art & Craft', icon: Palette },
  { name: 'Dumbbell', label: 'Sports & Fitness', icon: Dumbbell },
  { name: 'Luggage', label: 'Luggage & Travel', icon: Luggage },
  { name: 'Car', label: 'Auto & Accessories', icon: Car },
  { name: 'Wrench', label: 'Tools & Hardware', icon: Wrench },
  { name: 'Lightbulb', label: 'Lighting', icon: Lightbulb },
  { name: 'Zap', label: 'Fast Deals / Electronics', icon: Zap },
  { name: 'Music', label: 'Music & Sound', icon: Music },
  { name: 'Camera', label: 'Optics & Cameras', icon: Camera },
  { name: 'Shield', label: 'Security & Safety', icon: Shield },
  { name: 'Package', label: 'General / Storefront', icon: Package },
];

const ICON_MAP = AVAILABLE_CATEGORY_ICONS.reduce((acc, item) => {
  acc[item.name] = item.icon;
  return acc;
}, {});

function resolveCategoryIcon(iconName, categoryName) {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  const lower = (categoryName || '').toLowerCase();
  if (lower.includes('electronic') || lower.includes('audio')) return Headphones;
  if (lower.includes('fashion') || lower.includes('cloth') || lower.includes('apparel')) return Shirt;
  if (lower.includes('food') || lower.includes('snack')) return Cookie;
  if (lower.includes('kitchen') || lower.includes('dining')) return Utensils;
  if (lower.includes('home') || lower.includes('living')) return Home;
  if (lower.includes('personal') || lower.includes('beauty') || lower.includes('care')) return Sparkles;
  if (lower.includes('toy') || lower.includes('kid')) return Gamepad2;
  return Package;
}

export default function WebsiteManagementView({ currentUser, onBackToLauncher }) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'orders'
  const [stats, setStats] = useState({
    total_listed_items: 0,
    total_orders: 0,
    pending_orders: 0,
    confirmed_orders: 0,
    shipped_orders: 0,
    delivered_orders: 0,
    total_revenue: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Catalog Tab State
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all' | 'listed' | 'unlisted'
  const [togglingItemId, setTogglingItemId] = useState(null);

  // Orders Tab State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Categories Icon Management State
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [savingCategoryId, setSavingCategoryId] = useState(null);
  const [categorySuccessMsg, setCategorySuccessMsg] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isReordering, setIsReordering] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const res = await fetchCategories();
      const catList = Array.isArray(res) ? res : res.results || [];
      const sorted = [...catList].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      setCategories(sorted);
      if (sorted.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(sorted[0].id);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  }, [selectedCategoryId]);

  const handleUpdateCategoryIcon = async (catId, iconName) => {
    try {
      setSavingCategoryId(catId);
      await updateCategory(catId, { icon: iconName });
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, icon: iconName } : c))
      );
      setCategorySuccessMsg(`Icon successfully updated!`);
      setTimeout(() => setCategorySuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to update category icon: ' + (err.message || 'Server error'));
    } finally {
      setSavingCategoryId(null);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...categories];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, movedItem);

    // Reassign sequential display_order
    const withNewOrder = updated.map((item, idx) => ({
      ...item,
      display_order: idx,
    }));

    setCategories(withNewOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsReordering(true);

    try {
      // Persist display_order in backend
      await Promise.all(
        withNewOrder.map((cat, idx) => updateCategory(cat.id, { display_order: idx }))
      );
      setCategorySuccessMsg(`Category order reordered & saved!`);
      setTimeout(() => setCategorySuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to save reordered categories:', err);
      alert('Failed to save category order: ' + (err.message || 'Server error'));
      loadCategories();
    } finally {
      setIsReordering(false);
    }
  };

  // Hero Section Banners State
  const [heroSlides, setHeroSlides] = useState([]);
  const [loadingHeroSlides, setLoadingHeroSlides] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [heroSuccessMsg, setHeroSuccessMsg] = useState('');
  const [savingSlide, setSavingSlide] = useState(false);
  const [draggedSlideIdx, setDraggedSlideIdx] = useState(null);
  const [dragOverSlideIdx, setDragOverSlideIdx] = useState(null);
  const [cropQueue, setCropQueue] = useState([]);
  const [uploadingHeroImg, setUploadingHeroImg] = useState(false);
  const heroFileInputRef = useRef(null);

  const handleHeroImageFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCropQueue(files);
    e.target.value = '';
  };

  const handleHeroCropComplete = async (croppedFiles) => {
    if (!croppedFiles || !croppedFiles.length) {
      setCropQueue([]);
      return;
    }
    const fileToUpload = croppedFiles[0];
    try {
      setUploadingHeroImg(true);
      const res = await uploadHeroSlideImage(fileToUpload);
      if (res && res.image_url) {
        setEditingSlide((prev) => (prev ? { ...prev, image_url: res.image_url } : prev));
      }
    } catch (err) {
      alert('Failed to upload cropped image: ' + (err.message || 'Server error'));
    } finally {
      setUploadingHeroImg(false);
      setCropQueue([]);
    }
  };


  const loadHeroSlides = useCallback(async () => {
    try {
      setLoadingHeroSlides(true);
      const data = await fetchHeroSlides();
      const list = Array.isArray(data) ? data : data.results || [];
      const sorted = [...list].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      setHeroSlides(sorted);
    } catch (err) {
      console.error('Failed to load hero slides:', err);
    } finally {
      setLoadingHeroSlides(false);
    }
  }, []);

  const handleSaveHeroSlide = async (formData) => {
    try {
      setSavingSlide(true);
      if (formData.id) {
        const updated = await updateHeroSlide(formData.id, formData);
        setHeroSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setHeroSuccessMsg('Hero slide updated successfully!');
      } else {
        const created = await createHeroSlide({
          ...formData,
          display_order: heroSlides.length,
        });
        setHeroSlides((prev) => [...prev, created]);
        setHeroSuccessMsg('New hero slide added to homepage!');
      }
      setEditingSlide(null);
      setTimeout(() => setHeroSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to save hero slide: ' + (err.message || 'Server error'));
    } finally {
      setSavingSlide(false);
    }
  };

  const handleDeleteHeroSlide = async (slideId) => {
    if (!window.confirm('Are you sure you want to delete this hero slide?')) return;
    try {
      await deleteHeroSlide(slideId);
      setHeroSlides((prev) => prev.filter((s) => s.id !== slideId));
      setHeroSuccessMsg('Hero slide deleted.');
      setTimeout(() => setHeroSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to delete hero slide: ' + (err.message || 'Server error'));
    }
  };

  const handleToggleSlideActive = async (slide) => {
    try {
      const nextState = !slide.is_active;
      const updated = await updateHeroSlide(slide.id, { is_active: nextState });
      setHeroSlides((prev) => prev.map((s) => (s.id === slide.id ? updated : s)));
    } catch (err) {
      alert('Failed to update status: ' + (err.message || 'Server error'));
    }
  };

  const handleSlideDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (draggedSlideIdx === null || draggedSlideIdx === dropIdx) {
      setDraggedSlideIdx(null);
      setDragOverSlideIdx(null);
      return;
    }
    const updated = [...heroSlides];
    const [moved] = updated.splice(draggedSlideIdx, 1);
    updated.splice(dropIdx, 0, moved);
    const withOrder = updated.map((s, idx) => ({ ...s, display_order: idx }));
    setHeroSlides(withOrder);
    setDraggedSlideIdx(null);
    setDragOverSlideIdx(null);
    try {
      await Promise.all(withOrder.map((s, idx) => updateHeroSlide(s.id, { display_order: idx })));
      setHeroSuccessMsg('Slide display order updated!');
      setTimeout(() => setHeroSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to reorder hero slides:', err);
      loadHeroSlides();
    }
  };

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const data = await fetchWebsiteStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load website stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoadingItems(true);
      const res = await fetchItems({
        search: searchQuery,
        page_size: 100,
      });
      const itemList = Array.isArray(res) ? res : res.results || [];
      setItems(itemList);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [searchQuery]);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await fetchWebsiteOrders({
        status: orderStatusFilter,
        search: orderSearchQuery,
      });
      const orderList = Array.isArray(res) ? res : res.results || [];
      setOrders(orderList);
      if (orderList.length > 0 && !selectedOrder) {
        setSelectedOrder(orderList[0]);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [orderStatusFilter, orderSearchQuery, selectedOrder]);

  // Deals of the Day State
  const [deals, setDeals] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [dealSuccessMsg, setDealSuccessMsg] = useState('');
  const [savingDeal, setSavingDeal] = useState(false);
  const [catalogItemsForDeals, setCatalogItemsForDeals] = useState([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isSearchingInventory, setIsSearchingInventory] = useState(false);
  const [selectedProductObj, setSelectedProductObj] = useState(null);

  const loadDeals = useCallback(async () => {
    try {
      setLoadingDeals(true);
      const data = await fetchDealsOfTheDay();
      const list = Array.isArray(data) ? data : data.results || [];
      setDeals(list);
    } catch (err) {
      console.error('Failed to load deals of the day:', err);
    } finally {
      setLoadingDeals(false);
    }
  }, []);

  const searchInventoryForDeals = useCallback(async (query = '') => {
    try {
      setIsSearchingInventory(true);
      const res = await fetchItems({
        search: query.trim(),
        page_size: 50,
      });
      const list = Array.isArray(res) ? res : res.results || [];
      setCatalogItemsForDeals(list);
    } catch (err) {
      console.error('Failed to search inventory items for deal picker:', err);
    } finally {
      setIsSearchingInventory(false);
    }
  }, []);

  // Debounced search when typing into the product search bar
  useEffect(() => {
    if (!editingDeal || editingDeal.id) return;
    const timeout = setTimeout(() => {
      searchInventoryForDeals(itemSearchQuery);
    }, 250);
    return () => clearTimeout(timeout);
  }, [itemSearchQuery, editingDeal, searchInventoryForDeals]);


  const handleSaveDeal = async (formData) => {
    try {
      setSavingDeal(true);
      if (formData.id) {
        const updated = await updateDealOfTheDay(formData.id, formData);
        setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        setDealSuccessMsg('Deal updated & inventory prices synchronized!');
      } else {
        const created = await createDealOfTheDay(formData);
        setDeals((prev) => [created, ...prev]);
        setDealSuccessMsg('New Deal of the Day activated & inventory prices updated!');
      }
      setEditingDeal(null);
      setTimeout(() => setDealSuccessMsg(''), 3500);
      loadItems(); // refresh catalog to reflect updated prices
    } catch (err) {
      alert('Failed to save deal: ' + (err.message || 'Server error'));
    } finally {
      setSavingDeal(false);
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (!window.confirm('Are you sure you want to remove this deal? The item will immediately revert back to its normal inventory MRP and Selling Price.')) {
      return;
    }
    try {
      await deleteDealOfTheDay(dealId);
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      setDealSuccessMsg('Deal removed. Inventory prices restored to normal.');
      setTimeout(() => setDealSuccessMsg(''), 3500);
      loadItems();
    } catch (err) {
      alert('Failed to remove deal: ' + (err.message || 'Server error'));
    }
  };

  const handleToggleDealActive = async (deal) => {
    try {
      const nextState = !deal.is_active;
      const updated = await updateDealOfTheDay(deal.id, { is_active: nextState });
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? updated : d)));
      loadItems();
    } catch (err) {
      alert('Failed to toggle deal status: ' + (err.message || 'Server error'));
    }
  };

  // Shop By Category State
  const [shopCategoryCards, setShopCategoryCards] = useState([]);
  const [loadingShopCategoryCards, setLoadingShopCategoryCards] = useState(false);
  const [editingShopCategoryCard, setEditingShopCategoryCard] = useState(null);
  const [shopCategorySuccessMsg, setShopCategorySuccessMsg] = useState('');
  const [savingShopCategoryCard, setSavingShopCategoryCard] = useState(false);
  const [uploadingShopCategoryImg, setUploadingShopCategoryImg] = useState(false);
  const [draggedCardIdx, setDraggedCardIdx] = useState(null);
  const [dragOverCardIdx, setDragOverCardIdx] = useState(null);

  const loadShopCategoryCards = useCallback(async () => {
    try {
      setLoadingShopCategoryCards(true);
      const data = await fetchShopByCategoryCards();
      const list = Array.isArray(data) ? data : data.results || [];
      setShopCategoryCards(list);
    } catch (err) {
      console.error('Failed to load shop by category cards:', err);
    } finally {
      setLoadingShopCategoryCards(false);
    }
  }, []);

  const handleSaveShopCategoryCard = async (formData) => {
    try {
      setSavingShopCategoryCard(true);
      if (formData.id) {
        const updated = await updateShopByCategoryCard(formData.id, formData);
        setShopCategoryCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setShopCategorySuccessMsg('Category card updated successfully!');
      } else {
        const created = await createShopByCategoryCard({
          ...formData,
          display_order: shopCategoryCards.length + 1,
        });
        setShopCategoryCards((prev) => [...prev, created]);
        setShopCategorySuccessMsg('New category card added to storefront!');
      }
      setEditingShopCategoryCard(null);
      setTimeout(() => setShopCategorySuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to save category card: ' + (err.message || 'Server error'));
    } finally {
      setSavingShopCategoryCard(false);
    }
  };

  const handleDeleteShopCategoryCard = async (cardId) => {
    if (!window.confirm('Are you sure you want to remove this category card from the storefront?')) return;
    try {
      await deleteShopByCategoryCard(cardId);
      setShopCategoryCards((prev) => prev.filter((c) => c.id !== cardId));
      setShopCategorySuccessMsg('Category card removed.');
      setTimeout(() => setShopCategorySuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to delete category card: ' + (err.message || 'Server error'));
    }
  };

  const handleToggleShopCategoryActive = async (card) => {
    try {
      const nextState = !card.is_active;
      const updated = await updateShopByCategoryCard(card.id, { is_active: nextState });
      setShopCategoryCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
    } catch (err) {
      alert('Failed to update status: ' + (err.message || 'Server error'));
    }
  };

  const handleShopCategoryDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (draggedCardIdx === null || draggedCardIdx === dropIdx) {
      setDraggedCardIdx(null);
      setDragOverCardIdx(null);
      return;
    }
    const updated = [...shopCategoryCards];
    const [moved] = updated.splice(draggedCardIdx, 1);
    updated.splice(dropIdx, 0, moved);
    const withOrder = updated.map((c, idx) => ({ ...c, display_order: idx + 1 }));
    setShopCategoryCards(withOrder);
    setDraggedCardIdx(null);
    setDragOverCardIdx(null);
    try {
      await Promise.all(withOrder.map((c, idx) => updateShopByCategoryCard(c.id, { display_order: idx + 1 })));
      setShopCategorySuccessMsg('Display order updated!');
      setTimeout(() => setShopCategorySuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to reorder category cards:', err);
      loadShopCategoryCards();
    }
  };

  const handleUploadShopCategoryImg = async (file) => {
    try {
      setUploadingShopCategoryImg(true);
      const res = await uploadShopByCategoryImage(file);
      if (res && res.image_url) {
        setEditingShopCategoryCard((prev) => ({ ...prev, image_url: res.image_url }));
      }
    } catch (err) {
      alert('Failed to upload image: ' + (err.message || 'Server error'));
    } finally {
      setUploadingShopCategoryImg(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadDeals();
    loadShopCategoryCards();
  }, [loadStats, loadDeals, loadShopCategoryCards]);

  useEffect(() => {
    if (activeTab === 'catalog') {
      loadItems();
    } else if (activeTab === 'orders') {
      loadOrders();
    } else if (activeTab === 'categories') {
      loadCategories();
    } else if (activeTab === 'hero_slides') {
      loadHeroSlides();
    } else if (activeTab === 'deals') {
      loadDeals();
      searchInventoryForDeals();
    } else if (activeTab === 'shop_by_category') {
      loadShopCategoryCards();
    }
  }, [activeTab, loadItems, loadOrders, loadCategories, loadHeroSlides, loadDeals, searchInventoryForDeals, loadShopCategoryCards]);



  const handleToggleListing = async (item) => {
    const nextState = !item.is_listed_on_website;
    // Client-side rule check: Only products with image and weight can be published to website
    if (nextState) {
      const hasImage = Boolean(item.primary_image_url || (Array.isArray(item.images) && item.images.length > 0));
      const hasWeight = item.weight !== null && item.weight !== undefined && Number(item.weight) > 0;
      if (!hasImage || !hasWeight) {
        const missing = [];
        if (!hasImage) missing.push('Product Image');
        if (!hasWeight) missing.push('Weight in grams');
        alert(`Cannot publish "${item.name}" to the e-commerce website: Incomplete product.\nMissing: ${missing.join(' and ')}.\nOnly products that have an image and weight can be put on the website.`);
        return;
      }
    }

    setTogglingItemId(item.id);
    try {
      await toggleItemWebsiteListing(item.id, nextState);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_listed_on_website: nextState } : i))
      );
      setStats((prev) => ({
        ...prev,
        total_listed_items: prev.total_listed_items + (nextState ? 1 : -1),
      }));
    } catch (err) {
      console.error('Failed to toggle item listing:', err);
      alert('Failed to update website listing: ' + (err.message || 'Server error'));
    } finally {
      setTogglingItemId(null);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updated = await updateWebsiteOrderStatus(orderId, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: updated.status }));
      }
      loadStats();
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Failed to update status: ' + (err.message || 'Server error'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (catalogFilter === 'listed') return item.is_listed_on_website;
    if (catalogFilter === 'unlisted') return !item.is_listed_on_website;
    return true;
  });

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)' },
      CONFIRMED: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)' },
      PROCESSING: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: '1px solid rgba(168, 85, 247, 0.3)' },
      SHIPPED: { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.3)' },
      DELIVERED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)' },
      CANCELLED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' },
    };
    const s = styles[status] || { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: '1px solid rgba(148, 163, 184, 0.3)' };

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: s.bg,
          color: s.text,
          border: s.border,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        gap: '20px',
        padding: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Header Card */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px 24px',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(20, 24, 41, 0.8) 100%)',
          border: '1px solid rgba(14, 165, 233, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onBackToLauncher && (
            <button
              type="button"
              onClick={onBackToLauncher}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Return to Menu"
            >
              <ArrowLeft size={15} />
              <span>Menu</span>
            </button>
          )}

          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(14, 165, 233, 0.16)',
              color: '#0EA5E9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              flexShrink: 0,
            }}
          >
            <Globe size={24} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Website & Online Store
              </h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                wonder.sale
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Manage online catalog visibility, sync stock in real time, and process incoming e-commerce orders.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              loadStats();
              if (activeTab === 'catalog') loadItems();
              if (activeTab === 'orders') loadOrders();
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Refresh statistics and data"
          >
            <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <span>Visit Storefront</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Listed Products
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
              {loadingStats ? '...' : stats.total_listed_items}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={20} />
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Online Orders
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
              {loadingStats ? '...' : stats.total_orders}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.14)',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingBag size={20} />
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Fulfillment
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: '#F59E0B' }}>
              {loadingStats ? '...' : stats.pending_orders}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.14)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={20} />
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Delivered Revenue
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: '#10B981' }}>
              ₹{loadingStats ? '...' : Number(stats.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(168, 85, 247, 0.14)',
              color: '#A855F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`btn ${activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Package size={15} />
          <span>Product Catalog ({stats.total_listed_items} Listed)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', position: 'relative' }}
        >
          <ShoppingBag size={15} />
          <span>Online Orders</span>
          {stats.pending_orders > 0 && (
            <span
              style={{
                marginLeft: '6px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 800,
                background: '#F59E0B',
                color: '#000',
              }}
            >
              {stats.pending_orders}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Layers size={15} />
          <span>Manage Categories & Icons</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hero_slides')}
          className={`btn ${activeTab === 'hero_slides' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ImageIcon size={15} />
          <span>Hero Banner & Slides</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('deals')}
          className={`btn ${activeTab === 'deals' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Zap size={15} />
          <span>Deals of the Day</span>
          {deals.filter((d) => d.is_active && !d.is_expired).length > 0 && (
            <span
              style={{
                marginLeft: '4px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 800,
                background: '#EF4444',
                color: '#FFFFFF',
              }}
            >
              {deals.filter((d) => d.is_active && !d.is_expired).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shop_by_category')}
          className={`btn ${activeTab === 'shop_by_category' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Grid size={15} />
          <span>Shop By Category</span>
          {shopCategoryCards.length > 0 && (
            <span
              style={{
                marginLeft: '4px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 800,
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38BDF8',
              }}
            >
              {shopCategoryCards.length}
            </span>
          )}
        </button>
      </div>


      {/* TAB 1: PRODUCT CATALOG */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search & Filter Bar */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 18px',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog by name, UID, or barcode..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filter:</span>
              <button
                type="button"
                onClick={() => setCatalogFilter('all')}
                className={`btn btn-sm ${catalogFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              >
                All Items
              </button>
              <button
                type="button"
                onClick={() => setCatalogFilter('listed')}
                className={`btn btn-sm ${catalogFilter === 'listed' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Published Only
              </button>
              <button
                type="button"
                onClick={() => setCatalogFilter('unlisted')}
                className={`btn btn-sm ${catalogFilter === 'unlisted' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Unpublished
              </button>
            </div>
          </div>

          {/* Catalog Table */}
          <div
            className="glass-panel"
            style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-solid)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>Product</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>UID</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>Selling Price</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>MRP</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>In Stock</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>Website Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingItems ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#0EA5E9' }} />
                        <div>Loading inventory items...</div>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No items match the current search / filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isListed = Boolean(item.is_listed_on_website);
                      const isToggling = togglingItemId === item.id;
                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {item.primary_image_url ? (
                                <img
                                  src={item.primary_image_url}
                                  alt={item.name}
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: 'var(--radius-sm)',
                                    objectFit: 'cover',
                                    border: '1px solid var(--border-subtle)',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-surface-solid)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-subtle)',
                                  }}
                                >
                                  <Package size={18} />
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.description || 'No description entered'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {item.uid}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 800, color: '#10B981' }}>
                            ₹{Number(item.selling_price).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 18px', fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            ₹{Number(item.mrp || item.selling_price).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: (item.quantity || 0) > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                  color: (item.quantity || 0) > 0 ? '#10B981' : '#EF4444',
                                  alignSelf: 'flex-start',
                                }}
                              >
                                {item.quantity} in stock
                              </span>
                              {(!Boolean(item.primary_image_url || (Array.isArray(item.images) && item.images.length > 0)) || item.weight === null || item.weight === undefined || Number(item.weight) <= 0) && (
                                <span
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.66rem',
                                    fontWeight: 700,
                                    background: 'rgba(245, 158, 11, 0.14)',
                                    color: '#F59E0B',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    alignSelf: 'flex-start',
                                  }}
                                  title={`Missing: ${[!Boolean(item.primary_image_url || (Array.isArray(item.images) && item.images.length > 0)) && 'Image', (item.weight === null || item.weight === undefined || Number(item.weight) <= 0) && 'Weight'].filter(Boolean).join(', ')}`}
                                >
                                  Incomplete for E-com
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleListing(item)}
                              disabled={isToggling}
                              className="btn btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: isListed ? 'rgba(16, 185, 129, 0.16)' : 'var(--bg-surface-solid)',
                                color: isListed ? '#10B981' : 'var(--text-muted)',
                                border: isListed ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                              }}
                            >
                              {isToggling ? (
                                <RefreshCw size={13} className="animate-spin" />
                              ) : isListed ? (
                                <>
                                  <Eye size={13} />
                                  <span>Published</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff size={13} />
                                  <span>Unlisted</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ONLINE ORDERS */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Order Search & Status Filter */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 18px',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search by Order #, tracking ID, or customer phone..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                style={{
                  background: 'var(--bg-surface-solid)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                }}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Orders Master/Detail Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            {/* Orders List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {loadingOrders ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#0EA5E9' }} />
                  <div>Loading orders...</div>
                </div>
              ) : orders.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}>
                  <ShoppingBag size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No online orders yet</div>
                  <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Customer purchases from wonder.sale will appear right here.</div>
                </div>
              ) : (
                orders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="glass-panel"
                      style={{
                        padding: '16px 18px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        border: isSelected ? '1px solid #0EA5E9' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(14, 165, 233, 0.08)' : 'var(--bg-card)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>#{order.order_number}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <User size={12} />
                              {order.customer_name || 'Customer'}
                            </span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={12} />
                              {order.customer_mobile}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            ₹{Number(order.total_amount).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(order.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Order Detail Panel */}
            <div>
              {selectedOrder ? (
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Order Details
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                        #{selectedOrder.order_number}
                      </div>
                    </div>
                    {getStatusBadge(selectedOrder.status)}
                  </div>

                  {/* Customer Block */}
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-solid)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Customer Info
                    </div>
                    <div style={{ fontWeight: 700 }}>{selectedOrder.customer_name || 'Customer'}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{selectedOrder.customer_mobile}</div>
                  </div>

                  {/* Shipping Address */}
                  {selectedOrder.delivery_address && (
                    <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-solid)' }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Delivery Address
                      </div>
                      <div style={{ fontSize: '0.84rem' }}>
                        {selectedOrder.delivery_address.address_line || selectedOrder.delivery_address.address_line1 || selectedOrder.delivery_address.street || 'Address on file'}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {[selectedOrder.delivery_address.city, selectedOrder.delivery_address.pincode].filter(Boolean).join(' - ')}
                      </div>
                    </div>
                  )}

                  {/* Purchased Items */}
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Items Ordered ({(selectedOrder.items || []).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {(selectedOrder.items || []).map((oi) => (
                        <div
                          key={oi.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface-solid)',
                            fontSize: '0.84rem',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{oi.item_name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{oi.item_uid}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700 }}>₹{Number(oi.total_price).toFixed(2)}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{oi.quantity}x @ ₹{Number(oi.unit_price).toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Change Order Status
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '6px' }}>
                      {['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(selectedOrder.id, st)}
                          disabled={updatingOrderId === selectedOrder.id || selectedOrder.status === st}
                          className="btn btn-sm"
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '6px 8px',
                            background: selectedOrder.status === st ? 'rgba(14, 165, 233, 0.2)' : 'var(--bg-surface-solid)',
                            color: selectedOrder.status === st ? '#0EA5E9' : 'var(--text-primary)',
                            border: selectedOrder.status === st ? '1px solid #0EA5E9' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}>
                  Select an order on the left to see details and update status.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* TAB 3: MANAGE CATEGORIES & ICONS */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {categorySuccessMsg && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10B981',
                fontSize: '0.86rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={16} />
              <span>{categorySuccessMsg}</span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(300px, 360px) 1fr',
              gap: '18px',
              alignItems: 'start',
            }}
          >
            {/* Left: Categories List */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', margin: 0 }}>
                  Store Categories ({categories.length})
                </h3>
                <button
                  type="button"
                  onClick={loadCategories}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                  title="Refresh categories"
                >
                  <RefreshCw size={13} className={loadingCategories ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingCategories && categories.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Loading categories...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '580px', overflowY: 'auto' }}>
                  {categories.map((cat, index) => {
                    const isSelected = selectedCategoryId === cat.id;
                    const isBeingDragged = draggedIndex === index;
                    const isTargetedOver = dragOverIndex === index;
                    const CatIcon = resolveCategoryIcon(cat.icon, cat.name);

                    return (
                      <div
                        key={cat.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, index)}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isBeingDragged
                            ? 'rgba(14, 165, 233, 0.08)'
                            : isSelected
                            ? 'rgba(14, 165, 233, 0.14)'
                            : 'var(--bg-surface-solid)',
                          border: isTargetedOver
                            ? '2px dashed #0EA5E9'
                            : isSelected
                            ? '1px solid #0EA5E9'
                            : '1px solid var(--border-subtle)',
                          opacity: isBeingDragged ? 0.45 : 1,
                          transform: isTargetedOver ? 'scale(1.02)' : 'none',
                          transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Drag Handle */}
                          <div
                            style={{
                              color: 'var(--text-muted)',
                              cursor: 'grab',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '2px',
                            }}
                            title="Drag to reorder"
                          >
                            <GripVertical size={16} />
                          </div>

                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius-sm)',
                              background: '#680114',
                              color: '#F6E9C8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <CatIcon size={18} strokeWidth={2.2} />
                          </div>

                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              {cat.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Position #{index + 1} • <strong style={{ color: '#0EA5E9' }}>{cat.icon || 'Auto'}</strong>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              background: '#0EA5E9',
                              color: '#fff',
                              padding: '2px 8px',
                              borderRadius: '10px',
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Icon Selector Grid */}
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {(() => {
                const currentCat = categories.find((c) => c.id === selectedCategoryId) || categories[0];
                if (!currentCat) {
                  return (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No categories found in store database.
                    </div>
                  );
                }

                const ActiveIcon = resolveCategoryIcon(currentCat.icon, currentCat.name);
                const filteredIcons = AVAILABLE_CATEGORY_ICONS.filter((item) =>
                  item.name.toLowerCase().includes(iconSearchQuery.toLowerCase()) ||
                  item.label.toLowerCase().includes(iconSearchQuery.toLowerCase())
                );

                return (
                  <>
                    {/* Active Category Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '16px',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: 'var(--radius-md)',
                            background: '#680114',
                            color: '#F6E9C8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ActiveIcon size={26} strokeWidth={2.2} />
                        </div>
                        <div>
                          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            {currentCat.name}
                          </h2>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                            Pick any icon below to update this category across Wondersale storefront.
                          </p>
                        </div>
                      </div>

                      <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          placeholder="Search 34+ icons..."
                          value={iconSearchQuery}
                          onChange={(e) => setIconSearchQuery(e.target.value)}
                          className="input input-sm"
                          style={{ width: '100%', paddingLeft: '32px' }}
                        />
                      </div>
                    </div>

                    {/* Icons Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                        gap: '10px',
                        maxHeight: '480px',
                        overflowY: 'auto',
                        padding: '4px',
                      }}
                    >
                      {filteredIcons.map((item) => {
                        const IconComp = item.icon;
                        const isCurrentIcon = (currentCat.icon || '').toLowerCase() === item.name.toLowerCase();
                        const isSaving = savingCategoryId === currentCat.id;

                        return (
                          <button
                            key={item.name}
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleUpdateCategoryIcon(currentCat.id, item.name)}
                            style={{
                              padding: '12px 8px',
                              borderRadius: 'var(--radius-md)',
                              background: isCurrentIcon ? 'rgba(104, 1, 20, 0.15)' : 'var(--bg-surface-solid)',
                              border: isCurrentIcon ? '2px solid #680114' : '1px solid var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'center',
                            }}
                          >
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: isCurrentIcon ? '#680114' : 'transparent',
                                color: isCurrentIcon ? '#F6E9C8' : '#680114',
                                border: '1.5px solid #680114',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <IconComp size={20} strokeWidth={2} />
                            </div>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: isCurrentIcon ? '#680114' : 'var(--text-primary)',
                                lineHeight: 1.2,
                              }}
                            >
                              {item.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HERO SECTION & BANNERS */}
      {activeTab === 'hero_slides' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {heroSuccessMsg && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10B981',
                fontSize: '0.86rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={16} />
              <span>{heroSuccessMsg}</span>
            </div>
          )}

          {/* Top Bar: Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: 'var(--bg-surface-solid)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Storefront Hero Carousel ({heroSlides.length} Slides)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Manage headings, promotional badges, background images, discount copy, and shop button links. Drag to reorder sequence.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={loadHeroSlides}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={loadingHeroSlides ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setEditingSlide({
                    badge: 'Special Offer',
                    title: '',
                    subtitle: '',
                    button_text: 'Shop Now',
                    button_link: '/categories',
                    image_url: '',
                    alt_text: '',
                    is_active: true,
                  })
                }
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} />
                <span>Add Hero Slide</span>
              </button>
            </div>
          </div>

          {/* Slides List with Live Preview Card */}
          {loadingHeroSlides && heroSlides.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading hero slides...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {heroSlides.map((slide, idx) => {
                const isBeingDragged = draggedSlideIdx === idx;
                const isTargetOver = dragOverSlideIdx === idx;

                return (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedSlideIdx(idx);
                      e.dataTransfer.setData('text/plain', String(idx));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverSlideIdx !== idx) setDragOverSlideIdx(idx);
                    }}
                    onDragEnd={() => {
                      setDraggedSlideIdx(null);
                      setDragOverSlideIdx(null);
                    }}
                    onDrop={(e) => handleSlideDrop(e, idx)}
                    className="glass-panel"
                    style={{
                      padding: '18px 20px',
                      borderRadius: 'var(--radius-lg)',
                      border: isTargetOver
                        ? '2px dashed #0EA5E9'
                        : slide.is_active
                        ? '1px solid var(--border-subtle)'
                        : '1px dashed var(--border-subtle)',
                      background: isBeingDragged
                        ? 'rgba(14, 165, 233, 0.08)'
                        : 'var(--bg-surface-solid)',
                      opacity: isBeingDragged ? 0.4 : slide.is_active ? 1 : 0.65,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '20px',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    {/* Left: Drag grip & details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                      <div
                        style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                        title="Drag slide to reorder"
                      >
                        <GripVertical size={20} />
                      </div>

                      {/* Image Thumbnail in Circle (Exact like public site) */}
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: '#680114',
                          border: '3px solid #F6E9C8',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {slide.image_url ? (
                          <img
                            src={slide.image_url}
                            alt={slide.alt_text || slide.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <ImageIcon size={22} style={{ color: '#F6E9C8' }} />
                        )}
                      </div>

                      {/* Text Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#680114',
                              color: '#F6E9C8',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {slide.badge || 'Offer'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Slide #{idx + 1}
                          </span>
                          {!slide.is_active && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '8px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#EF4444',
                              }}
                            >
                              Hidden
                            </span>
                          )}
                        </div>

                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {slide.title}
                        </h3>

                        <p
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-muted)',
                            margin: '4px 0 6px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {slide.subtitle || 'No subtitle provided'}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <span>
                            Button: <strong style={{ color: 'var(--text-primary)' }}>{slide.button_text}</strong>
                          </span>
                          <span>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <LinkIcon size={12} />
                            <code>{slide.button_link}</code>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleSlideActive(slide)}
                        className={`btn ${slide.is_active ? 'btn-secondary' : 'btn-secondary'} btn-sm`}
                        title={slide.is_active ? 'Hide slide from storefront' : 'Activate slide'}
                        style={{
                          fontSize: '0.76rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: slide.is_active ? '#10B981' : 'var(--text-muted)',
                        }}
                      >
                        {slide.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                        <span>{slide.is_active ? 'Active' : 'Hidden'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingSlide(slide)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Edit3 size={15} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteHeroSlide(slide.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#EF4444', display: 'inline-flex', alignItems: 'center', padding: '6px 8px' }}
                        title="Delete slide"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit / Create Slide Modal */}
          {editingSlide && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(5, 8, 16, 0.8)',
                backdropFilter: 'blur(8px)',
                padding: '20px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '680px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  borderRadius: '16px',
                  background: '#131A29',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '24px',
                  boxShadow: '0 24px 50px rgba(0, 0, 0, 0.6)',
                  color: '#F8FAFC',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: '20px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                      {editingSlide.id ? 'Edit Hero Banner Slide' : 'Create New Hero Banner Slide'}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>
                      Configure the storefront hero carousel slide display and promotions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSlide(null)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#94A3B8';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveHeroSlide(editingSlide);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                        Pill Badge Text *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingSlide.badge || ''}
                        onChange={(e) => setEditingSlide({ ...editingSlide, badge: e.target.value })}
                        placeholder="e.g. Festival Special"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                        onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                        Button Label *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingSlide.button_text || ''}
                        onChange={(e) => setEditingSlide({ ...editingSlide, button_text: e.target.value })}
                        placeholder="e.g. Shop Deals"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                        onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                      Main Heading (Title) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingSlide.title || ''}
                      onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                      placeholder="e.g. Mega Kitchen Bonanza"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0B101B',
                        border: '1px solid #2A364E',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                      onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                      Subheading / Promotional Text
                    </label>
                    <input
                      type="text"
                      value={editingSlide.subtitle || ''}
                      onChange={(e) => setEditingSlide({ ...editingSlide, subtitle: e.target.value })}
                      placeholder="e.g. Up to 40% Off on Premium Air Fryers & Mixers"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0B101B',
                        border: '1px solid #2A364E',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                      onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                      Target Button Link URL *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingSlide.button_link || ''}
                      onChange={(e) => setEditingSlide({ ...editingSlide, button_link: e.target.value })}
                      placeholder="e.g. /category/kitchen-appliances or /search?q=air+fryer"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0B101B',
                        border: '1px solid #2A364E',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                      onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                    />
                  </div>

                  {/* Hidden file input for 1:1 image upload */}
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleHeroImageFileSelect}
                  />

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1' }}>
                        Product Image URL (1:1 Ratio) *
                      </label>
                      <button
                        type="button"
                        onClick={() => heroFileInputRef.current?.click()}
                        disabled={uploadingHeroImg}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38BDF8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: '6px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.22)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)')}
                      >
                        <Upload size={13} />
                        <span>{uploadingHeroImg ? 'Uploading...' : 'Upload & Crop 1:1 Image'}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        required
                        value={editingSlide.image_url || ''}
                        onChange={(e) => setEditingSlide({ ...editingSlide, image_url: e.target.value })}
                        placeholder="https://... direct image URL or upload above"
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                        onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                      />
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#64748B' }}>
                      The storefront hero circle uses a strict 1:1 square crop. Uploading automatically brings up the 1:1 cropper.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                      Image Alt Text
                    </label>
                    <input
                      type="text"
                      value={editingSlide.alt_text || ''}
                      onChange={(e) => setEditingSlide({ ...editingSlide, alt_text: e.target.value })}
                      placeholder="e.g. Kitchen air fryer and blender showcase"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0B101B',
                        border: '1px solid #2A364E',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                      onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                    />
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.74rem', color: '#64748B', lineHeight: '1.4' }}>
                      💡 <strong style={{ color: '#94A3B8' }}>What is this?</strong> Alt text (alternative text) describes the image for screen readers used by visually impaired visitors, improves Google image SEO ranking, and shows if the image fails to load.
                    </p>
                  </div>

                  {/* Live Mini Preview Box */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: '#680114',
                      color: '#F6E9C8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '6px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          background: 'rgba(0, 0, 0, 0.35)',
                          borderRadius: '10px',
                          display: 'inline-block',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {editingSlide.badge || 'BADGE'}
                      </span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '6px', color: '#F6E9C8' }}>
                        {editingSlide.title || 'Slide Title Preview'}
                      </div>
                      <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '3px' }}>
                        {editingSlide.subtitle || 'Subtitle text will appear here'}
                      </div>
                      <div style={{ marginTop: '10px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            background: '#F6E9C8',
                            color: '#680114',
                            borderRadius: '5px',
                            display: 'inline-block',
                          }}
                        >
                          {editingSlide.button_text || 'Shop Deals'} →
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: '#F6E9C8',
                        border: '3px solid #F6E9C8',
                        flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                      }}
                    >
                      {editingSlide.image_url ? (
                        <img
                          src={editingSlide.image_url}
                          alt={editingSlide.alt_text || 'preview'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#680114',
                          }}
                        >
                          <ImageIcon size={26} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#E2E8F0' }}>
                      <input
                        type="checkbox"
                        checked={editingSlide.is_active}
                        onChange={(e) => setEditingSlide({ ...editingSlide, is_active: e.target.checked })}
                        style={{ accentColor: '#38BDF8', width: '16px', height: '16px' }}
                      />
                      <span>Active on public website</span>
                    </label>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '10px',
                      marginTop: '12px',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setEditingSlide(null)}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#CBD5E1',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingSlide}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        background: '#0284C7',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: savingSlide ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
                      }}
                    >
                      <Save size={15} />
                      <span>{savingSlide ? 'Saving...' : 'Save Hero Slide'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Universal 1:1 Image Crop Modal Integration */}
          {cropQueue.length > 0 && (
            <ImageCropModal
              isOpen={cropQueue.length > 0}
              files={cropQueue}
              onCropComplete={handleHeroCropComplete}
              onCancel={() => setCropQueue([])}
            />
          )}
        </div>
      )}

      {/* TAB 4: DEALS OF THE DAY */}
      {activeTab === 'deals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {dealSuccessMsg && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                color: '#10B981',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={18} />
              <span>{dealSuccessMsg}</span>
            </div>
          )}

          {/* Section Header */}
          <div
            className="glass-panel"
            style={{
              padding: '18px 22px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} color="#EF4444" fill="#EF4444" />
                <span>Deals of the Day ({deals.length} Active Deals)</span>
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Set special promotional prices with automatic discount percentage calculation and countdown timer. When a deal is removed or time expires, prices automatically revert in inventory.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={loadDeals}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Refresh deals"
              >
                <RefreshCw size={14} className={loadingDeals ? 'spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingDeal({
                    item_id: '',
                    deal_selling_price: '',
                    deal_mrp: '',
                    custom_badge: 'Deal of the Day',
                    ends_at: '',
                    is_active: true,
                  });
                }}
                className="btn btn-primary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
                  border: 'none',
                }}
              >
                <Plus size={16} />
                <span>Add Deal of the Day</span>
              </button>
            </div>
          </div>

          {/* Deals Table */}
          <div
            className="glass-panel"
            style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {loadingDeals ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                <p>Loading Deals of the Day...</p>
              </div>
            ) : deals.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                  }}
                >
                  <Zap size={28} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  No Deals of the Day Configured Yet
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                  Select any product from your store inventory, set a special deal price & MRP, and set an optional end time to show on the website deals carousel!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDeal({
                      item_id: '',
                      deal_selling_price: '',
                      deal_mrp: '',
                      custom_badge: 'Deal of the Day',
                      ends_at: '',
                      is_active: true,
                    });
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} />
                  <span>Create First Deal</span>
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>PRODUCT</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>DEAL PRICE / MRP</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>DISCOUNT</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>ORIGINAL INVENTORY</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>EXPIRES AT</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>STATUS</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal) => {
                      const isExpired = deal.is_expired;
                      return (
                        <tr
                          key={deal.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            background: deal.is_active && !isExpired ? 'transparent' : 'rgba(0, 0, 0, 0.2)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '8px',
                                  background: '#1E293B',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                {deal.item_image_url ? (
                                  <img src={deal.item_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <Package size={20} color="#94A3B8" />
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {deal.item_name}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  UID: {deal.item_uid} • {deal.item_in_stock ? `${deal.item_quantity} in stock` : 'Out of stock'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#10B981' }}>
                                ₹{Number(deal.deal_selling_price).toFixed(2)}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                ₹{Number(deal.deal_mrp).toFixed(2)}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                              }}
                            >
                              {Math.round(deal.discount_percentage)}% OFF
                            </span>
                          </td>

                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Reverts to: <strong style={{ color: 'var(--text-primary)' }}>₹{Number(deal.original_selling_price).toFixed(2)}</strong> (MRP: ₹{Number(deal.original_mrp || deal.original_selling_price).toFixed(2)})
                            </div>
                          </td>

                          <td style={{ padding: '14px 18px' }}>
                            {deal.ends_at ? (
                              <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isExpired ? '#EF4444' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <Clock size={13} />
                                  <span>{new Date(deal.ends_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: isExpired ? '#EF4444' : '#10B981', marginTop: '2px' }}>
                                  {isExpired ? 'Expired (Prices Reverted)' : 'Active Countdown'}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                No time limit (Indefinite)
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleDealActive(deal)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  border: 'none',
                                  background: deal.is_active && !isExpired ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                  color: deal.is_active && !isExpired ? '#10B981' : 'var(--text-muted)',
                                  alignSelf: 'flex-start',
                                }}
                              >
                                {deal.is_active && !isExpired ? <Eye size={12} /> : <EyeOff size={12} />}
                                <span>{deal.is_active && !isExpired ? 'Active' : 'Inactive'}</span>
                              </button>

                              {deal.is_complete === false && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    background: 'rgba(239, 68, 68, 0.18)',
                                    color: '#EF4444',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    alignSelf: 'flex-start',
                                  }}
                                  title={`Missing: ${(deal.missing_requirements || ['image', 'weight']).join(' and ')}. Only complete products appear on e-com website.`}
                                >
                                  Incomplete
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setEditingDeal(deal)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '5px 10px' }}
                                title="Edit Deal"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDeal(deal.id)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '5px 10px' }}
                                title="Remove Deal & Revert Prices"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create / Edit Deal Modal */}
          {editingDeal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(5, 8, 16, 0.85)',
                backdropFilter: 'blur(8px)',
                padding: '20px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '620px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  borderRadius: '16px',
                  background: '#131A29',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '24px',
                  boxShadow: '0 24px 50px rgba(0, 0, 0, 0.7)',
                  color: '#F8FAFC',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: '18px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                      {editingDeal.id ? 'Edit Deal of the Day' : 'Add New Deal of the Day'}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                      Editing prices synchronizes live inventory. Ending a deal automatically restores original prices.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingDeal(null)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editingDeal.item_id && !editingDeal.item) {
                      alert('Please select an inventory product for this deal.');
                      return;
                    }

                    // Check completeness rule: must have image and weight
                    if (selectedProductObj) {
                      const hasImg = Boolean(selectedProductObj.primary_image_url || (Array.isArray(selectedProductObj.images) && selectedProductObj.images.length > 0));
                      const hasWt = selectedProductObj.weight !== null && selectedProductObj.weight !== undefined && Number(selectedProductObj.weight) > 0;
                      if (!hasImg || !hasWt) {
                        const missing = [];
                        if (!hasImg) missing.push('Product Image');
                        if (!hasWt) missing.push('Weight in grams');
                        alert(`Cannot add "${selectedProductObj.name}" to Deals of the Day: Incomplete product.\nMissing: ${missing.join(' and ')}.\nOnly products with an image and weight can be put on the e-commerce website.`);
                        return;
                      }
                    }

                    if (Number(editingDeal.deal_selling_price) >= Number(editingDeal.deal_mrp)) {
                      if (!window.confirm('Deal Selling Price is equal to or greater than MRP. Continue anyway?')) {
                        return;
                      }
                    }
                    handleSaveDeal(editingDeal);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  {/* Product Picker */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '8px' }}>
                      Choose Product from Inventory *
                    </label>

                    {editingDeal.id ? (
                      <div
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38BDF8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Package size={22} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>{editingDeal.item_name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
                            UID: <span style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>{editingDeal.item_uid}</span> • Normal Price: ₹{Number(editingDeal.original_selling_price).toFixed(2)} (MRP: ₹{Number(editingDeal.original_mrp || editingDeal.original_selling_price).toFixed(2)})
                          </div>
                        </div>
                      </div>
                    ) : selectedProductObj ? (
                      <div
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.9) 100%)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '8px',
                              background: '#1E293B',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            {selectedProductObj.primary_image_url || selectedProductObj.images?.[0]?.image ? (
                              <img
                                src={selectedProductObj.primary_image_url || selectedProductObj.images?.[0]?.image}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <Package size={22} color="#10B981" />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.92rem' }}>
                              {selectedProductObj.name}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '2px' }}>
                              UID: <span style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>{selectedProductObj.uid}</span> • Stock: <span style={{ color: '#10B981', fontWeight: 700 }}>{selectedProductObj.quantity || 0} in stock</span> • Current Sell: ₹{selectedProductObj.selling_price} | MRP: ₹{selectedProductObj.mrp || selectedProductObj.selling_price}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductObj(null);
                            setEditingDeal({ ...editingDeal, item_id: '', deal_selling_price: '', deal_mrp: '' });
                          }}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            color: '#CBD5E1',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Change Product
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Type to search any product across entire inventory (Name, UID, or Barcode)..."
                            value={itemSearchQuery}
                            onChange={(e) => setItemSearchQuery(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px 14px 12px 38px',
                              background: '#0B101B',
                              border: '1px solid #38BDF8',
                              borderRadius: '8px',
                              color: '#FFFFFF',
                              fontSize: '0.9rem',
                              outline: 'none',
                              boxSizing: 'border-box',
                              boxShadow: '0 0 0 2px rgba(56, 189, 248, 0.2)',
                            }}
                          />
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#38BDF8' }}>
                            <Search size={16} />
                          </div>
                          {isSearchingInventory && (
                            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                              <RefreshCw size={15} className="spin" />
                            </div>
                          )}
                        </div>

                        {/* Search Results Dropdown List */}
                        <div
                          style={{
                            marginTop: '8px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            background: '#0B101B',
                            border: '1px solid #2A364E',
                            borderRadius: '8px',
                            padding: '4px',
                            boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
                          }}
                        >
                          {isSearchingInventory && catalogItemsForDeals.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '0.84rem' }}>
                              Searching store inventory...
                            </div>
                          ) : catalogItemsForDeals.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '0.84rem' }}>
                              {itemSearchQuery ? `No products matching "${itemSearchQuery}"` : 'Type to search products in inventory...'}
                            </div>
                          ) : (
                            catalogItemsForDeals.map((item) => {
                              const hasImg = Boolean(item.primary_image_url || (Array.isArray(item.images) && item.images.length > 0));
                              const hasWt = item.weight !== null && item.weight !== undefined && Number(item.weight) > 0;
                              const isComplete = hasImg && hasWt;

                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    if (!isComplete) {
                                      const missing = [];
                                      if (!hasImg) missing.push('Product Image');
                                      if (!hasWt) missing.push('Weight in grams');
                                      alert(`Cannot select "${item.name}": Incomplete product.\nMissing: ${missing.join(' and ')}.\nOnly products with an image and weight can be put on the e-commerce website.`);
                                      return;
                                    }
                                    setSelectedProductObj(item);
                                    setEditingDeal({
                                      ...editingDeal,
                                      item_id: item.id,
                                      deal_selling_price: item.selling_price || '',
                                      deal_mrp: item.mrp || item.selling_price || '',
                                    });
                                  }}
                                  style={{
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    cursor: isComplete ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    transition: 'background 0.15s ease',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    opacity: isComplete ? 1 : 0.65,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1E293B')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.name}
                                      </span>
                                      {!isComplete && (
                                        <span
                                          style={{
                                            fontSize: '0.64rem',
                                            fontWeight: 700,
                                            padding: '1px 5px',
                                            borderRadius: '4px',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            color: '#EF4444',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                          }}
                                          title={`Missing: ${[!hasImg && 'image', !hasWt && 'weight'].filter(Boolean).join(' and ')}`}
                                        >
                                          Incomplete
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
                                      UID: <span style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>{item.uid}</span> • Weight: {item.weight && Number(item.weight) > 0 ? `${item.weight}g` : <strong style={{ color: '#EF4444' }}>None</strong>} • {item.quantity || 0} in stock
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right', shrink: 0 }}>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10B981' }}>
                                      ₹{Number(item.selling_price).toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: '0.74rem', color: '#64748B', textDecoration: 'line-through' }}>
                                      MRP: ₹{Number(item.mrp || item.selling_price).toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Inputs: Selling Price & MRP */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                        Deal Selling Price (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0.01"
                        value={editingDeal.deal_selling_price ?? ''}
                        onChange={(e) => setEditingDeal({ ...editingDeal, deal_selling_price: e.target.value })}
                        placeholder="e.g. 199.00"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                        Deal Reference MRP (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0.01"
                        value={editingDeal.deal_mrp ?? ''}
                        onChange={(e) => setEditingDeal({ ...editingDeal, deal_mrp: e.target.value })}
                        placeholder="e.g. 399.00"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Calculated Offer Percentage Preview */}
                  {(() => {
                    const sell = Number(editingDeal.deal_selling_price);
                    const mrp = Number(editingDeal.deal_mrp);
                    let discount = 0;
                    if (mrp > 0 && sell > 0 && mrp > sell) {
                      discount = Math.round(((mrp - sell) / mrp) * 100);
                    }
                    return (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700 }}>
                            AUTOMATICALLY CALCULATED OFFER
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#FFFFFF', marginTop: '2px' }}>
                            Discount based on difference: <strong style={{ color: '#EF4444' }}>₹{mrp > sell ? (mrp - sell).toFixed(2) : '0.00'} off</strong>
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 900,
                            color: '#EF4444',
                            background: 'rgba(239, 68, 68, 0.2)',
                            padding: '4px 12px',
                            borderRadius: '8px',
                          }}
                        >
                          {discount}% OFF
                        </div>
                      </div>
                    );
                  })()}

                  {/* Deal Timing Option: Ends At (High-Contrast Clean Date & Time Bar) */}
                  <div
                    style={{
                      padding: '16px 18px',
                      background: 'linear-gradient(180deg, #162032 0%, #0F172A 100%)',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#38BDF8',
                          }}
                        >
                          <Clock size={16} />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F1F5F9' }}>
                            Deal Expiry: Date & Exact Time
                          </span>
                          <span
                            style={{
                              marginLeft: '8px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              borderRadius: '4px',
                              color: '#94A3B8',
                              textTransform: 'uppercase',
                            }}
                          >
                            Optional
                          </span>
                        </div>
                      </div>

                      {editingDeal.ends_at && (
                        <button
                          type="button"
                          onClick={() => setEditingDeal({ ...editingDeal, ends_at: null })}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#F87171',
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          ✕ Clear (Make Indefinite)
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="datetime-local"
                        value={
                          editingDeal.ends_at
                            ? (() => {
                                const d = new Date(editingDeal.ends_at);
                                const tzOffset = d.getTimezoneOffset() * 60000;
                                return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
                              })()
                            : ''
                        }
                        onChange={(e) => {
                          if (!e.target.value) {
                            setEditingDeal({ ...editingDeal, ends_at: null });
                          } else {
                            setEditingDeal({ ...editingDeal, ends_at: new Date(e.target.value).toISOString() });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '11px 14px',
                          background: '#090D16',
                          border: '1px solid #38BDF8',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.92rem',
                          fontWeight: 600,
                          outline: 'none',
                          boxSizing: 'border-box',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          cursor: 'pointer',
                        }}
                      />
                    </div>

                    {/* Quick Preset Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700 }}>Quick presets:</span>
                      {[
                        { label: '+6 Hours', hours: 6 },
                        { label: '+12 Hours', hours: 12 },
                        { label: '+24 Hours (1 Day)', hours: 24 },
                        { label: '+3 Days', hours: 72 },
                        { label: '+7 Days', hours: 168 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const target = new Date(Date.now() + preset.hours * 60 * 60 * 1000);
                            setEditingDeal({ ...editingDeal, ends_at: target.toISOString() });
                          }}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '6px',
                            color: '#38BDF8',
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)')}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        fontSize: '0.75rem',
                        lineHeight: '1.4',
                      }}
                    >
                      {editingDeal.ends_at ? (
                        <span style={{ color: '#E2E8F0' }}>
                          ⏳ Deal will end precisely on <strong style={{ color: '#38BDF8' }}>{new Date(editingDeal.ends_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>. Once this exact minute passes, the deal automatically expires and prices revert back in inventory.
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>
                          ♾️ <strong style={{ color: '#F1F5F9' }}>No time limit set.</strong> This deal will remain active indefinitely on the website until you manually remove it. When removed, prices in inventory immediately revert back.
                        </span>
                      )}
                    </div>
                  </div>



                  {/* Badge text */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                      Storefront Pill Badge
                    </label>
                    <input
                      type="text"
                      value={editingDeal.custom_badge || ''}
                      onChange={(e) => setEditingDeal({ ...editingDeal, custom_badge: e.target.value })}
                      placeholder="e.g. Deal of the Day / Lightning Deal"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0B101B',
                        border: '1px solid #2A364E',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#E2E8F0' }}>
                      <input
                        type="checkbox"
                        checked={editingDeal.is_active}
                        onChange={(e) => setEditingDeal({ ...editingDeal, is_active: e.target.checked })}
                        style={{ accentColor: '#EF4444', width: '16px', height: '16px' }}
                      />
                      <span>Active on Website Deals of the Day Carousel</span>
                    </label>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '10px',
                      marginTop: '12px',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setEditingDeal(null)}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#CBD5E1',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingDeal}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        background: '#EF4444',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: savingDeal ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                      }}
                    >
                      <Save size={15} />
                      <span>{savingDeal ? 'Saving...' : 'Save & Sync Inventory'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SHOP BY CATEGORY SECTION */}
      {activeTab === 'shop_by_category' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {shopCategorySuccessMsg && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38BDF8',
                color: '#38BDF8',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={18} />
              <span>{shopCategorySuccessMsg}</span>
            </div>
          )}

          {/* Section Header */}
          <div
            className="glass-panel"
            style={{
              padding: '18px 22px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Shop By Category Grid Management
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38BDF8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  Homepage Grid
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Manage the promotional category feature cards on the storefront home page (Title, Subtitle, Promotional Badge, and Image). Drag to reorder!
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={loadShopCategoryCards}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Refresh cards"
              >
                <RefreshCw size={14} className={loadingShopCategoryCards ? 'spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingShopCategoryCard({
                    title: '',
                    subtitle: '',
                    badge: 'Special Offer',
                    link_url: '/categories',
                    image_url: '',
                    category: null,
                    is_active: true,
                  });
                }}
                className="btn btn-primary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  border: 'none',
                }}
              >
                <Plus size={16} />
                <span>Add Category Card</span>
              </button>
            </div>
          </div>

          {/* Cards Grid / Reorder List */}
          {loadingShopCategoryCards ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={26} className="spin" style={{ margin: '0 auto 12px' }} />
              <p>Loading Shop By Category cards...</p>
            </div>
          ) : shopCategoryCards.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: '#38BDF8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <Grid size={28} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                No Category Cards Configured
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                Add promotional category feature cards to display prominently in the 4-column Shop By Category grid on your storefront!
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingShopCategoryCard({
                    title: '',
                    subtitle: '',
                    badge: 'Special Offer',
                    link_url: '/categories',
                    image_url: '',
                    category: null,
                    is_active: true,
                  });
                }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={16} />
                <span>Create First Card</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {shopCategoryCards.map((card, idx) => {
                const isDragging = draggedCardIdx === idx;
                const isOver = dragOverCardIdx === idx;

                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDraggedCardIdx(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverCardIdx !== idx) setDragOverCardIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverCardIdx === idx) setDragOverCardIdx(null);
                    }}
                    onDrop={(e) => handleShopCategoryDrop(e, idx)}
                    onDragEnd={() => {
                      setDraggedCardIdx(null);
                      setDragOverCardIdx(null);
                    }}
                    style={{
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: isOver ? '2px dashed #38BDF8' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: isDragging ? 0.35 : 1,
                      transition: 'all 0.15s ease',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {/* Top Image & Badge Preview */}
                    <div style={{ position: 'relative', width: '100%', height: '140px', background: '#0F172A', overflow: 'hidden' }}>
                      {card.image_url ? (
                        <img
                          src={card.image_url}
                          alt={card.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                          <ImageIcon size={32} />
                        </div>
                      )}

                      {/* Promo pill */}
                      {card.badge && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '8px',
                            background: '#680114',
                            color: '#F6E9C8',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                          }}
                        >
                          {card.badge}
                        </span>
                      )}

                      {/* Reorder drag handle indicator */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: 'rgba(0, 0, 0, 0.65)',
                          backdropFilter: 'blur(4px)',
                          color: '#CBD5E1',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Drag card to reorder position"
                      >
                        <GripVertical size={12} />
                        <span>#{idx + 1}</span>
                      </div>

                      {/* Status indicator */}
                      <span
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: card.is_active ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                          color: card.is_active ? '#10B981' : '#EF4444',
                          border: card.is_active ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        {card.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </div>

                    {/* Content Details */}
                    <div style={{ padding: '14px 16px', flex: 1 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                        {card.title}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px 0', minHeight: '1.2rem' }}>
                        {card.subtitle || 'No subtitle'}
                      </p>

                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LinkIcon size={12} color="#38BDF8" />
                        <code style={{ color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {card.link_url}
                        </code>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div
                      style={{
                        padding: '10px 16px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'rgba(0, 0, 0, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleShopCategoryActive(card)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: card.is_active ? '#10B981' : 'var(--text-muted)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        {card.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span>{card.is_active ? 'Visible' : 'Hidden'}</span>
                      </button>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setEditingShopCategoryCard(card)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Edit Card"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteShopCategoryCard(card.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Delete Card"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit / Create Category Card Modal */}
          {editingShopCategoryCard && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(5, 8, 16, 0.85)',
                backdropFilter: 'blur(8px)',
                padding: '20px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '620px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  borderRadius: '16px',
                  background: '#131A29',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '24px',
                  boxShadow: '0 24px 50px rgba(0, 0, 0, 0.7)',
                  color: '#F8FAFC',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: '20px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                      {editingShopCategoryCard.id ? 'Edit Shop By Category Card' : 'Create New Shop By Category Card'}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>
                      Configure the category feature card displayed in the homepage grid.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingShopCategoryCard(null)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editingShopCategoryCard.title) {
                      alert('Title is required.');
                      return;
                    }
                    if (!editingShopCategoryCard.image_url) {
                      alert('Please provide or upload a card image.');
                      return;
                    }
                    handleSaveShopCategoryCard(editingShopCategoryCard);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                        Card Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingShopCategoryCard.title || ''}
                        onChange={(e) => setEditingShopCategoryCard({ ...editingShopCategoryCard, title: e.target.value })}
                        placeholder="e.g. Cookware & Dining"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                        onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                        Pill Badge Text
                      </label>
                      <input
                        type="text"
                        value={editingShopCategoryCard.badge || ''}
                        onChange={(e) => setEditingShopCategoryCard({ ...editingShopCategoryCard, badge: e.target.value })}
                        placeholder="e.g. Up to 60% Off / Min 40% Off"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                        onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                      Subtitle / Product Highlights
                    </label>
                    <input
                      type="text"
                      value={editingShopCategoryCard.subtitle || ''}
                      onChange={(e) => setEditingShopCategoryCard({ ...editingShopCategoryCard, subtitle: e.target.value })}
                      placeholder="e.g. Non-stick, Pots & Bowls"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#0B101B',
                        border: '1px solid #2A364E',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#38BDF8')}
                      onBlur={(e) => (e.target.style.borderColor = '#2A364E')}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                        Link To Category
                      </label>
                      <select
                        value={editingShopCategoryCard.category || ''}
                        onChange={(e) => {
                          const catId = e.target.value ? Number(e.target.value) : null;
                          const found = categories.find((c) => c.id === catId);
                          setEditingShopCategoryCard({
                            ...editingShopCategoryCard,
                            category: catId,
                            link_url: found ? `/category/${found.slug || found.id}` : editingShopCategoryCard.link_url,
                            title: editingShopCategoryCard.title || (found ? found.name : ''),
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="">-- Custom Link / None --</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.items_count || 0} items)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                        Target Link URL *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingShopCategoryCard.link_url || ''}
                        onChange={(e) => setEditingShopCategoryCard({ ...editingShopCategoryCard, link_url: e.target.value })}
                        placeholder="e.g. /category/kitchen-appliances"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Image URL & Upload */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
                      Category Card Image *
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        required
                        value={editingShopCategoryCard.image_url || ''}
                        onChange={(e) => setEditingShopCategoryCard({ ...editingShopCategoryCard, image_url: e.target.value })}
                        placeholder="https://... or upload below"
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          background: '#0B101B',
                          border: '1px solid #2A364E',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '0.88rem',
                          outline: 'none',
                        }}
                      />
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 14px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: '8px',
                          color: '#38BDF8',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Upload size={14} />
                        <span>{uploadingShopCategoryImg ? 'Uploading...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadShopCategoryImg(file);
                          }}
                        />
                      </label>
                    </div>

                    {/* Image Preview Box */}
                    {editingShopCategoryCard.image_url && (
                      <div
                        style={{
                          width: '100%',
                          height: '120px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: '#0B101B',
                        }}
                      >
                        <img
                          src={editingShopCategoryCard.image_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#E2E8F0' }}>
                      <input
                        type="checkbox"
                        checked={editingShopCategoryCard.is_active}
                        onChange={(e) => setEditingShopCategoryCard({ ...editingShopCategoryCard, is_active: e.target.checked })}
                        style={{ accentColor: '#38BDF8', width: '16px', height: '16px' }}
                      />
                      <span>Active on storefront home page</span>
                    </label>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '10px',
                      marginTop: '8px',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setEditingShopCategoryCard(null)}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#CBD5E1',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingShopCategoryCard}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        background: '#0284C7',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: savingShopCategoryCard ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
                      }}
                    >
                      <Save size={15} />
                      <span>{savingShopCategoryCard ? 'Saving...' : 'Save Category Card'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


