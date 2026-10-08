import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Receipt,
  ShoppingCart,
  Barcode,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  RotateCcw,
  Sparkles,
  Split,
  Layers,
  MapPin,
  Calendar,
  Package,
  Clock,
  ArrowLeft,
  User,
  Phone,
  Store as StoreIcon,
  Tag,
  Percent,
  Crown,
  ZoomIn,
  MessageCircle,
  Bookmark,
  Copy,
  FileDown,
  FileText,
  Mail,
  Radio,
  Zap,
  RefreshCw,
  ArrowUp,
  ArrowUpRight,
  Wallet,
  Coins,
  Truck,
  Wrench,
  Coffee,
  Lightbulb,
  FileSpreadsheet,
  Edit3,
  Lock,
} from 'lucide-react';
import {
  fetchItems,
  processCheckout,
  lookupCustomer,
  getBarcodeUrl,
  rechargeVipCard,
  lookupCustomerByCardUid,
  getCounterPayouts,
  createCounterPayout,
  getCurrentRegisterShift,
  openRegisterShift,
  closeRegisterShift,
  getRegisterShifts,
  getSaleOrders,
  updateSaleOrder,
} from '../api';
import TimeRangeFilter, { filterLogsByTimeRange } from './TimeRangeFilter';
import ProductReturnModal from './ProductReturnModal';
import { getVipSettings } from '../utils/vipSettings';
import {
  connectRfidReader,
  disconnectRfidReader,
  isRfidConnected,
  getRfidStatus,
  onRfidStatusChange,
} from '../utils/rfidSerial';
import {
  playVipReadySound,
  playVipAcceptedSound,
  playVipRejectedSound,
} from '../utils/vipCardSounds';
import {
  getReceiptTermsText,
  getReceiptTermsFontSize,
  renderFormattedTerms,
  formatTermsForWhatsApp,
} from '../utils/receiptTermsSettings';
import WhatsAppIcon from './WhatsAppIcon';
import { sendWhatsAppReceipt } from '../utils/whatsappService';
import { saveReceiptAsPdf, generateReceiptPdfBlob } from '../utils/saveReceiptAsPdf';


// Helper to get device local date and time formatted for <input type="datetime-local"> (YYYY-MM-DDTHH:mm)
const getDeviceLocalDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function BillingView({
  currentUser,
  stores = [],
  effectiveStoreId = '',
  onBackToLauncher,
  onNavigateToCustomers,
}) {
  // Store Selection
  const activeStore = stores.find((s) => String(s.id) === String(effectiveStoreId)) || stores[0] || null;

  // Head Cashier / Owner Authorization Detection
  const isHeadCashierOrOwner = Boolean(
    currentUser?.is_owner ||
    currentUser?.is_head_cashier ||
    currentUser?.cashier_role === 'head_cashier' ||
    currentUser?.role_details?.cashier_role === 'head_cashier' ||
    currentUser?.role_details?.is_head_cashier
  );

  // Inventory & Search State
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);

  // Cart State
  const [cart, setCart] = useState([]);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error' | 'warning', message: '' }

  // Checkout State (Inline Checkout Station)
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitUpiAmount, setSplitUpiAmount] = useState('');
  const [splitCashReceived, setSplitCashReceived] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [partialAmountPaid, setPartialAmountPaid] = useState('');
  const [partialPaymentMethod, setPartialPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'rupee'
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // VIP RFID Card & Credit Balance State
  const [vipSettings, setVipSettings] = useState(getVipSettings);
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [vipCardScannedUid, setVipCardScannedUid] = useState('');
  const [quickRechargePaymentMethod, setQuickRechargePaymentMethod] = useState('cash');
  const [isQuickRecharging, setIsQuickRecharging] = useState(false);
  const [isVipTapModalOpen, setIsVipTapModalOpen] = useState(false);

  // Product Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Counter Cash / Stock Payout State
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutActiveTab, setPayoutActiveTab] = useState('record'); // 'record' | 'ledger'
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    paid_to: '',
    category: 'stock_purchase',
    payment_method: 'cash',
    paid_by_name: currentUser?.name || currentUser?.username || 'Cashier',
    paid_at: getDeviceLocalDateTime(),
    reason: '',
    receipt_number: '',
  });
  const [payoutsList, setPayoutsList] = useState([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [payoutSearchQuery, setPayoutSearchQuery] = useState('');
  const [selectedPayoutForSlip, setSelectedPayoutForSlip] = useState(null);
  const [isPayoutSlipModalOpen, setIsPayoutSlipModalOpen] = useState(false);

  // Cash Register / Shift State (Shift-Start Opening Float & Shift-End Closing Cash)
  const [activeShift, setActiveShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [showRegisterHistory, setShowRegisterHistory] = useState(false);
  const [shiftEntryType, setShiftEntryType] = useState('shift_start'); // 'shift_start' | 'shift_end'
  const [shiftCashierName, setShiftCashierName] = useState('');
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [openingNotesInput, setOpeningNotesInput] = useState('');
  const [closingCashCountedInput, setClosingCashCountedInput] = useState('');
  const [closingNotesInput, setClosingNotesInput] = useState('');
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);
  const [registerHistoryList, setRegisterHistoryList] = useState([]);
  const [loadingRegisterHistory, setLoadingRegisterHistory] = useState(false);
  const [selectedShiftForSlip, setSelectedShiftForSlip] = useState(null);
  const [isShiftSlipModalOpen, setIsShiftSlipModalOpen] = useState(false);

  // Active Shift Cashier Billing Records State
  const [shiftBillingOrders, setShiftBillingOrders] = useState([]);
  const [loadingShiftOrders, setLoadingShiftOrders] = useState(false);
  const [shiftBillsTimeFilter, setShiftBillsTimeFilter] = useState(null);
  const [payoutsTimeFilter, setPayoutsTimeFilter] = useState(null);
  const [shiftsHistoryTimeFilter, setShiftsHistoryTimeFilter] = useState(null);
  const [editingOrderForPayment, setEditingOrderForPayment] = useState(null);
  const [editOrderItems, setEditOrderItems] = useState([]);
  const [editAddItemSearch, setEditAddItemSearch] = useState('');
  const [isEditAddItemDropdownOpen, setIsEditAddItemDropdownOpen] = useState(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');
  const [editSplitCash, setEditSplitCash] = useState('');
  const [editSplitUpi, setEditSplitUpi] = useState('');
  const [editPaymentNotes, setEditPaymentNotes] = useState('');
  const [isSavingPaymentMethod, setIsSavingPaymentMethod] = useState(false);
  const [paymentUpdateError, setPaymentUpdateError] = useState('');

  // USB RFID Reader Connection & Scan State
  const [rfidStatus, setRfidStatus] = useState(getRfidStatus());

  useEffect(() => {
    return onRfidStatusChange(setRfidStatus);
  }, []);

  const handleToggleRfidConnect = async () => {
    if (rfidStatus.isConnected) {
      await disconnectRfidReader();
      setNotification({ type: 'warning', message: 'Arduino RFID Reader disconnected.' });
    } else {
      try {
        const connected = await connectRfidReader({ baudRate: 9600 });
        if (connected) {
          setNotification({ type: 'success', message: 'Arduino RFID Reader connected on USB COM port at 9600 baud!' });
        }
      } catch (err) {
        setNotification({ type: 'error', message: err.message || 'Failed to connect USB RFID reader.' });
      }
    }
  };

  // Live RFID Serial Scanner Listener in Billing POS
  useEffect(() => {
    const handleScan = async (e) => {
      const scannedUid = e.detail?.uid;
      if (!scannedUid) return;

      if (isVipTapModalOpen) {
        setVipCardScannedUid(scannedUid);
        if (matchedCustomer?.vip_card_uid && scannedUid.trim().toLowerCase() === matchedCustomer.vip_card_uid.toLowerCase()) {
          playVipAcceptedSound();
          showNotification('success', `⚡ VIP Card Verified: ${scannedUid}`);
        } else {
          playVipRejectedSound();
          showNotification('error', `Card UID mismatch! Tapped card (${scannedUid}) does not match customer's registered card.`);
        }
      } else {
        // Auto-detect VIP card on POS billing screen
        setVipCardScannedUid(scannedUid);
        try {
          const cust = await lookupCustomerByCardUid(scannedUid);
          if (cust && cust.id) {
            setMatchedCustomer(cust);
            setCustomerPhone(cust.phone);
            if (cust.name) setCustomerName(cust.name);
            if (cust.email) setCustomerEmail(cust.email);
            setPaymentMethod('vip_card');
            const vipDisc = vipSettings.discountPercent || '5';
            setDiscountType('percent');
            setDiscountPercent(String(vipDisc));
            playVipAcceptedSound();
            showNotification('success', `⚡ VIP Member Identified: ${cust.display_name} (Balance: ₹${cust.vip_card_balance || '0.00'})`);
          } else {
            playVipRejectedSound();
            showNotification('warning', `⚠️ Unregistered or Unassigned VIP Card: ${scannedUid}`);
          }
        } catch {
          playVipRejectedSound();
          showNotification('warning', `⚠️ Unregistered RFID Card: ${scannedUid}`);
        }
      }
    };

    window.addEventListener('wondersale_rfid_scan', handleScan);
    return () => window.removeEventListener('wondersale_rfid_scan', handleScan);
  }, [isVipTapModalOpen, matchedCustomer, vipSettings]);

  // Sync settings when modified in SettingsView
  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail) setVipSettings(e.detail);
    };
    window.addEventListener('wondersale_vip_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('wondersale_vip_settings_updated', handleSettingsUpdated);
  }, []);

  // Sale Confirmation Modal State
  const [isConfirmSaleModalOpen, setIsConfirmSaleModalOpen] = useState(false);
  const isConfirmSaleModalOpenRef = useRef(false);
  isConfirmSaleModalOpenRef.current = isConfirmSaleModalOpen;

  const handleInitiateCheckoutRef = useRef();
  const handleCompleteCheckoutRef = useRef();

  // Digital Receipt Modal State
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Held Draft Bills State (Multi-Customer Bill Parking)
  const [draftCarts, setDraftCarts] = useState(() => {
    try {
      const saved = localStorage.getItem('wondersale_billing_drafts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);

  // Full-Size Image Lightbox State
  const [lightboxImage, setLightboxImage] = useState(null); // { src, name, uid }

  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const phoneInputRef = useRef(null);
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const lastScanProcessedRef = useRef({ code: '', time: 0 });

  // Load Inventory for Active Store
  useEffect(() => {
    loadStoreItems();
  }, [effectiveStoreId]);

  const loadStoreItems = async () => {
    setLoadingItems(true);
    try {
      const data = await fetchItems({ store: effectiveStoreId || undefined });
      const list = Array.isArray(data) ? data : data.results || [];
      setItems(list);
    } catch (err) {
      console.error('Failed to load store inventory for POS:', err);
      showNotification('error', 'Could not load store inventory. Please refresh.');
    } finally {
      setLoadingItems(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Search Filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const filtered = items.filter((item) => {
      const nameMatch = item.name?.toLowerCase().includes(q);
      const uidMatch = item.uid?.toLowerCase().includes(q);
      const sectionMatch = item.location_section?.toLowerCase().includes(q);
      const catMatch = item.subcategories?.some((sc) => sc.name?.toLowerCase().includes(q));
      return nameMatch || uidMatch || sectionMatch || catMatch;
    });

    setSearchResults(filtered.slice(0, 10));
    setIsDropdownOpen(true);
  }, [searchQuery, items]);

  // Click Outside Dropdown Handler
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Barcode Scanner Listener (Detects USB barcode guns, 2D imagers, Bluetooth & serial wedges)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape to close image lightbox or confirmation modal
      if (e.key === 'Escape') {
        if (lightboxImage) {
          setLightboxImage(null);
          return;
        }
        if (isConfirmSaleModalOpenRef.current) {
          setIsConfirmSaleModalOpen(false);
          return;
        }
      }

      // Alt + X (or F2): Initiate complete sale & print receipt (opens confirmation modal)
      const isAltX = e.altKey && !e.ctrlKey && (e.key === 'x' || e.key === 'X' || e.code === 'KeyX');
      if (isAltX || e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        if (!isConfirmSaleModalOpenRef.current) {
          handleInitiateCheckoutRef.current?.();
        }
        return;
      }

      // Alt + C: Progress further / Confirm sale & complete checkout in confirmation modal
      const isAltC = e.altKey && !e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC');
      if (isAltC) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        if (isConfirmSaleModalOpenRef.current) {
          handleCompleteCheckoutRef.current?.();
        }
        return;
      }

      // If user is actively typing in modal inputs or textareas (except the main search bar), don't intercept standard Enter
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
      const isSearchInput = activeEl === searchInputRef.current;

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Handle barcode termination keys: Enter or Tab (configured by different barcode scanner manufacturers)
      if (e.key === 'Enter' || e.key === 'Tab') {
        const buffer = barcodeBufferRef.current.trim();
        // Hardware scanners typically burst characters within <70ms per key
        // A valid barcode/UID is >= 3 characters
        if (buffer.length >= 3 && diff < 85) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
          }
          barcodeBufferRef.current = '';
          // If the search input received characters from this scan burst, clear it
          if (isSearchInput || searchInputRef.current) {
            setSearchQuery('');
            setIsDropdownOpen(false);
            if (searchInputRef.current) {
              searchInputRef.current.value = '';
            }
          }
          handleBarcodeScanned(buffer);
          return;
        }
        barcodeBufferRef.current = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Most handheld scanners send keys with interval <= 50ms (Bluetooth/virtual COM can reach 60-70ms)
        // Reset buffer if delay between keystrokes exceeds 100ms (human typing)
        if (diff > 100) {
          barcodeBufferRef.current = e.key;
        } else {
          barcodeBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [items, cart]);

  // Handle scanned or searched Barcode / UID (works with all 1D/2D symbologies, Code128, EAN-13, QR, and legacy codes)
  const handleBarcodeScanned = (code) => {
    if (!code) return;
    const now = Date.now();
    // Strip common scanner control prefixes/suffixes like AIM symbology identifiers (e.g. ]C1, ]e0, \r, \n)
    let cleaned = String(code).trim().replace(/^\][A-Za-z0-9]{2}/, '').trim().toLowerCase();
    if (!cleaned) return;

    // Strict Debounce & Rate Limiting Guard:
    // 1. Same barcode scanned within 800ms: Ignore duplicate (hardware trigger bounce / repeat pulse / \r\n double fire)
    if (
      lastScanProcessedRef.current.code === cleaned &&
      now - lastScanProcessedRef.current.time < 800
    ) {
      return;
    }
    // 2. Rate limit ANY barcode scan within 300ms to prevent buffer overlap or noise bursts
    if (now - lastScanProcessedRef.current.time < 300) {
      return;
    }
    lastScanProcessedRef.current = { code: cleaned, time: now };

    // 1. Direct exact match by UID or legacy_uid
    let foundItem = items.find(
      (item) => item.uid?.toLowerCase() === cleaned || item.legacy_uid?.toLowerCase() === cleaned
    );

    // 2. Fallback: match without leading zeroes (e.g. UPC-A / EAN-13 conversions where scanner drops or prepends 0)
    if (!foundItem && /^0+[0-9a-z]+$/i.test(cleaned)) {
      const stripped = cleaned.replace(/^0+/, '');
      foundItem = items.find(
        (item) => item.uid?.toLowerCase() === stripped || item.legacy_uid?.toLowerCase() === stripped
      );
    }

    // 3. Fallback: match by padded 7-digit UID if scanner sent numeric string
    if (!foundItem && /^\d+$/.test(cleaned) && cleaned.length < 7) {
      const padded = cleaned.padStart(7, '0');
      foundItem = items.find(
        (item) => item.uid?.toLowerCase() === padded || item.legacy_uid?.toLowerCase() === padded
      );
    }

    if (!foundItem) {
      playVipRejectedSound();
      showNotification('error', `No product assigned to barcode / UID "${code}".`);
      return;
    }

    // Direct-to-Cart Flow: Never open the staging "selected product" card on barcode scan
    setSelectedProduct(null);
    setProductQuantity(1);

    // Strict Out-of-Stock Check
    if (foundItem.quantity <= 0) {
      playVipRejectedSound();
      showNotification('error', `Cannot add "${foundItem.name}": Out of Stock (0 units in inventory).`);
      return;
    }

    // Check if ALL stock units are already in the cart
    const existingInCart = cart.find((ci) => ci.item.id === foundItem.id);
    const inCartQty = existingInCart ? existingInCart.quantity : 0;
    if (inCartQty >= foundItem.quantity) {
      playVipRejectedSound();
      showNotification(
        'warning',
        `Cannot add more: All ${foundItem.quantity} available units of "${foundItem.name}" are already in the cart.`
      );
      return;
    }

    // Add directly to cart with audio chime
    playVipReadySound();
    handleAddToCart(foundItem, 1);
  };

  // Add Item to Cart
  const handleAddToCart = (itemToAdd, qtyToAdd = 1) => {
    if (!itemToAdd) return;

    // Strict Out of stock verification
    if (itemToAdd.quantity <= 0) {
      playVipRejectedSound();
      showNotification('error', `Cannot add "${itemToAdd.name}": Out of Stock (0 available units).`);
      return;
    }

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((ci) => ci.item.id === itemToAdd.id);
      if (existingIdx >= 0) {
        const currentCartQty = prevCart[existingIdx].quantity;
        const currentPrice = prevCart[existingIdx].unit_price || itemToAdd.selling_price;
        const newTotalQty = currentCartQty + qtyToAdd;

        // Check if exceeds stock
        if (newTotalQty > itemToAdd.quantity) {
          showNotification(
            'warning',
            `Cannot add more: All ${itemToAdd.quantity} available units of "${itemToAdd.name}" are already in the cart.`
          );
          return prevCart;
        }

        const updated = [...prevCart];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newTotalQty,
          total: (parseFloat(currentPrice) * newTotalQty).toFixed(2),
        };
        showNotification('success', `Added another "${itemToAdd.name}" (Qty: ${newTotalQty} in bill).`);
        return updated;
      } else {
        if (qtyToAdd > itemToAdd.quantity) {
          showNotification(
            'warning',
            `Cannot add ${qtyToAdd}: Only ${itemToAdd.quantity} units of "${itemToAdd.name}" available.`
          );
          return prevCart;
        }

        showNotification('success', `Added "${itemToAdd.name}" directly to bill.`);
        return [
          ...prevCart,
          {
            item: itemToAdd,
            quantity: qtyToAdd,
            unit_price: parseFloat(itemToAdd.selling_price).toFixed(2),
            total: (parseFloat(itemToAdd.selling_price) * qtyToAdd).toFixed(2),
          },
        ];
      }
    });

    // Clear selected product so it never lingers on screen
    setSelectedProduct(null);
    setProductQuantity(1);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  // Update Cart Quantity
  const handleUpdateCartQty = (itemId, newQty) => {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      handleRemoveFromCart(itemId);
      return;
    }

    setCart((prev) =>
      prev.map((ci) => {
        if (ci.item.id === itemId) {
          if (qty > ci.item.quantity) {
            showNotification(
              'warning',
              `Cannot exceed stock: Only ${ci.item.quantity} units of "${ci.item.name}" available.`
            );
            return ci;
          }
          const uPrice = parseFloat(ci.unit_price || ci.item.selling_price || 0);
          return {
            ...ci,
            quantity: qty,
            total: (uPrice * qty).toFixed(2),
          };
        }
        return ci;
      })
    );
  };

  // Update Cart Unit Price (Head Cashier & Owner Privilege)
  const handleUpdateUnitPrice = (itemId, newPrice) => {
    setCart((prev) =>
      prev.map((ci) => {
        if (ci.item.id === itemId) {
          const parsed = parseFloat(newPrice);
          const validPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
          return {
            ...ci,
            unit_price: newPrice,
            total: (validPrice * ci.quantity).toFixed(2),
          };
        }
        return ci;
      })
    );
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (itemId) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  // Clear Cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Are you sure you want to clear the current bill cart?')) {
      setCart([]);
      setSelectedProduct(null);
    }
  };

  // Cart Calculations (Discount percentage or flat rupee amount applied to Total Price of bill)
  const cartSubtotal = Number((cart.reduce((sum, ci) => {
    const price = parseFloat(ci.unit_price || ci.item.selling_price || 0);
    return sum + (price * ci.quantity);
  }, 0)).toFixed(2));

  let cartDiscount = 0;
  if (discountType === 'rupee') {
    const rawRupeeDisc = Math.max(0, parseFloat(discountAmount) || 0);
    cartDiscount = Number(Math.min(cartSubtotal, rawRupeeDisc).toFixed(2));
  } else {
    const parsedDiscPct = Math.max(0, Math.min(100, parseFloat(discountPercent) || 0));
    cartDiscount = Number(Math.min(cartSubtotal, (cartSubtotal * parsedDiscPct) / 100).toFixed(2));
  }

  const cartGrandTotal = Math.max(0, Number((cartSubtotal - cartDiscount).toFixed(2)));
  const cartTotalItems = cart.length;
  const cartTotalUnits = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  // Live Customer Lookup by Phone or Name
  useEffect(() => {
    const clean = customerPhone.replace(/\D/g, '').trim();
    if (clean.length >= 3) {
      const targetStoreId = activeStore?.id || effectiveStoreId || undefined;
      lookupCustomer(clean, targetStoreId)
        .then((res) => {
          const list = res || [];
          setCustomerSuggestions(list);
          setShowCustomerDropdown(list.length > 0);

          if (clean.length === 10) {
            const exact = list.find((c) => c.phone === clean) || (list.length === 1 && list[0].phone === clean ? list[0] : null);
            if (exact) {
              setMatchedCustomer(exact);
              if (!customerName) setCustomerName(exact.name || '');
              if (!customerEmail) setCustomerEmail(exact.email || '');
            } else {
              setMatchedCustomer(null);
            }
          } else {
            setMatchedCustomer(null);
          }
        })
        .catch(() => {
          setCustomerSuggestions([]);
          setShowCustomerDropdown(false);
          setMatchedCustomer(null);
        });
    } else {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      setMatchedCustomer(null);
    }
  }, [customerPhone, activeStore?.id, effectiveStoreId]);

  const handleSelectCustomerSuggestion = (cust) => {
    setCustomerPhone(cust.phone);
    setCustomerName(cust.name || '');
    setCustomerEmail(cust.email || '');
    setMatchedCustomer(cust);
    setShowCustomerDropdown(false);
  };

  // VIP Eligibility Check
  const customerHasVipCard = Boolean(matchedCustomer?.vip_card_uid && matchedCustomer?.vip_card_status === 'active');

  // Fallback to cash if customer is not a VIP member
  useEffect(() => {
    if (!customerHasVipCard && paymentMethod === 'vip_card') {
      setPaymentMethod('cash');
    }
  }, [customerHasVipCard, paymentMethod]);

  // Handle Payment Method Selection (with VIP 5% Discount Auto-Apply)
  const handleSelectPaymentMethod = (pmId) => {
    if (pmId === 'vip_card') {
      if (!customerHasVipCard) {
        playVipRejectedSound();
        showNotification('warning', 'This customer does not have an active VIP Card. Please issue a VIP card in the Customers app first.');
        return;
      }
      playVipReadySound();
      setPaymentMethod('vip_card');
      // Auto-apply configured VIP card discount percent (default 5%)
      const vipDisc = vipSettings.discountPercent || '5';
      setDiscountType('percent');
      setDiscountPercent(String(vipDisc));
    } else if (pmId === 'split') {
      setPaymentMethod('split');
      if (cartGrandTotal > 0 && !splitCashAmount && !splitUpiAmount) {
        const half = (cartGrandTotal / 2).toFixed(2);
        setSplitCashAmount(half);
        setSplitUpiAmount((cartGrandTotal - parseFloat(half)).toFixed(2));
      }
    } else if (pmId === 'partial') {
      setPaymentMethod('partial');
      if (cartGrandTotal > 0 && !partialAmountPaid) {
        setPartialAmountPaid('');
      }
    } else {
      setPaymentMethod(pmId);
    }
  };

  // Inline Quick Recharge for VIP Card
  const handleInlineRecharge = async (amount, customPaymentMethod = null) => {
    if (!matchedCustomer?.id) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    const payMethod = customPaymentMethod || quickRechargePaymentMethod || 'cash';

    setIsQuickRecharging(true);
    try {
      const updatedCust = await rechargeVipCard(matchedCustomer.id, {
        amount: amt,
        payment_method: payMethod,
        notes: `Inline POS counter quick recharge (${payMethod.toUpperCase()})`,
      });
      setMatchedCustomer(updatedCust);
      playVipAcceptedSound();
      showNotification('success', `Recharged ₹${amt} credits via ${payMethod.toUpperCase()}! New VIP balance: ₹${updatedCust.vip_card_balance}`);
    } catch (err) {
      console.error('Quick recharge error:', err);
      playVipRejectedSound();
      showNotification('error', err.message || 'Failed to recharge VIP card.');
    } finally {
      setIsQuickRecharging(false);
    }
  };

  // ---------------- Counter Stock & Expense Payout Handlers ----------------

  const handleOpenPayoutModal = () => {
    setPayoutForm({
      amount: '',
      paid_to: '',
      category: 'stock_purchase',
      payment_method: 'cash',
      paid_by_name: currentUser?.name || currentUser?.username || 'Cashier',
      paid_at: getDeviceLocalDateTime(),
      reason: '',
      receipt_number: '',
    });
    setPayoutActiveTab('record');
    setIsPayoutModalOpen(true);
    loadRecentPayouts();
  };

  const loadRecentPayouts = async () => {
    setLoadingPayouts(true);
    try {
      const params = {};
      if (activeStore?.id) params.store = activeStore.id;
      if (payoutsTimeFilter?.active) {
        if (payoutsTimeFilter.startTime) params.start_time = payoutsTimeFilter.startTime;
        if (payoutsTimeFilter.endTime) params.end_time = payoutsTimeFilter.endTime;
      }
      const data = await getCounterPayouts(params);
      const list = Array.isArray(data) ? data : data.results || [];
      setPayoutsList(list);
    } catch (err) {
      console.error('Failed to load counter payouts:', err);
    } finally {
      setLoadingPayouts(false);
    }
  };

  useEffect(() => {
    if (isPayoutModalOpen) {
      loadRecentPayouts();
    }
  }, [payoutsTimeFilter]);

  const handleSubmitPayout = async (e) => {
    e.preventDefault();
    const amt = parseFloat(payoutForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showNotification('error', 'Please enter a valid payout amount greater than 0.');
      return;
    }
    if (!payoutForm.paid_to.trim()) {
      showNotification('error', 'Please specify who the payment was made to (Paid To / Payee).');
      return;
    }
    if (!payoutForm.reason.trim()) {
      showNotification('error', 'Please provide a reason or purpose for this counter payout.');
      return;
    }

    setIsSubmittingPayout(true);
    try {
      const payload = {
        store: activeStore?.id || undefined,
        store_id: activeStore?.id || undefined,
        amount: amt,
        paid_to: payoutForm.paid_to.trim(),
        paid_by_name: payoutForm.paid_by_name.trim() || currentUser?.name || currentUser?.username || 'Cashier',
        category: payoutForm.category || 'stock_purchase',
        payment_method: payoutForm.payment_method || 'cash',
        reason: payoutForm.reason.trim(),
        receipt_number: payoutForm.receipt_number.trim(),
        paid_at: payoutForm.paid_at ? new Date(payoutForm.paid_at).toISOString() : new Date().toISOString(),
      };

      const created = await createCounterPayout(payload);
      showNotification('success', `💸 Counter Payout #${created.payout_number} of ₹${amt.toFixed(2)} recorded in audit log!`);
      setSelectedPayoutForSlip(created);
      loadRecentPayouts();
      loadActiveRegisterShift();
      setPayoutActiveTab('ledger');
    } catch (err) {
      console.error('Counter payout error:', err);
      showNotification('error', err.message || 'Failed to record counter payout.');
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handlePrintPayoutSlip = (payout) => {
    setSelectedPayoutForSlip(payout);
    setIsPayoutSlipModalOpen(true);
  };

  // ---------------- Daily Cash Register Shift Handlers ----------------

  const loadActiveRegisterShift = async () => {
    const storeId = activeStore?.id || effectiveStoreId;
    if (!storeId) {
      setActiveShift(null);
      return;
    }
    setLoadingShift(true);
    try {
      const data = await getCurrentRegisterShift({ store: storeId });
      const current = data?.shift || data?.active_shift || null;
      setActiveShift(current);
    } catch (err) {
      console.error('Failed to load active register shift:', err);
      setActiveShift(null);
    } finally {
      setLoadingShift(false);
    }
  };

  useEffect(() => {
    loadActiveRegisterShift();
  }, [activeStore?.id, effectiveStoreId]);

  const loadShiftBillingOrders = async () => {
    const storeId = activeStore?.id || effectiveStoreId;
    if (!storeId || !activeShift || activeShift.status !== 'open') {
      setShiftBillingOrders([]);
      return;
    }
    setLoadingShiftOrders(true);
    try {
      const params = {
        store: storeId,
        current_shift: 'true',
      };
      if (activeShift?.opened_at) {
        params.since = activeShift.opened_at;
      }
      if (activeShift?.cashier) {
        params.cashier = activeShift.cashier;
      }
      const data = await getSaleOrders(params);
      let list = Array.isArray(data) ? data : data?.results || [];
      // Client-side safeguard: strictly filter only orders on or after activeShift.opened_at
      if (activeShift?.opened_at) {
        const openTime = new Date(activeShift.opened_at).getTime();
        list = list.filter((o) => {
          const orderTime = new Date(o.created_at).getTime();
          return orderTime >= openTime - 1000;
        });
      }
      setShiftBillingOrders(list);
    } catch (err) {
      console.error('Failed to load shift billing orders:', err);
      setShiftBillingOrders([]);
    } finally {
      setLoadingShiftOrders(false);
    }
  };

  useEffect(() => {
    if (activeShift && activeShift.status === 'open') {
      loadShiftBillingOrders();
    } else {
      setShiftBillingOrders([]);
    }
  }, [activeStore?.id, effectiveStoreId, activeShift?.id, activeShift?.status, activeShift?.opened_at, activeShift?.cashier]);

  const handleOpenEditPaymentModal = (order) => {
    if (order.is_editable === false) {
      showNotification('warning', 'This bill belongs to a closed register shift and cannot be modified.');
      return;
    }
    setEditingOrderForPayment(order);
    setEditPaymentMethod(order.payment_method || 'cash');
    setEditSplitCash(order.split_cash_amount ? String(order.split_cash_amount) : '');
    setEditSplitUpi(order.split_upi_amount ? String(order.split_upi_amount) : '');
    setEditPaymentNotes(order.notes || '');
    setPaymentUpdateError('');
    setEditAddItemSearch('');
    setIsEditAddItemDropdownOpen(false);

    // Initial items copy
    const mapped = (order.items || []).map((soi) => ({
      item_id: soi.item || soi.item_id || soi.id,
      item_name: soi.item_name || soi.name || 'Item',
      item_uid: soi.item_uid || soi.uid || '',
      quantity: soi.quantity || 1,
      unit_selling_price: parseFloat(soi.unit_selling_price || 0),
      unit_mrp: parseFloat(soi.unit_mrp || soi.mrp || soi.unit_selling_price || 0),
      total_price: parseFloat(soi.total_price || 0),
    }));
    setEditOrderItems(mapped);
  };

  const handleEditItemQtyChange = (idx, delta) => {
    setEditOrderItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[idx] };
      if (!target) return prev;
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        if (copy.length <= 1) {
          showNotification('warning', 'An invoice must contain at least one item.');
          return prev;
        }
        return copy.filter((_, i) => i !== idx);
      }
      target.quantity = newQty;
      target.total_price = parseFloat((target.unit_selling_price * newQty).toFixed(2));
      copy[idx] = target;
      return copy;
    });
  };

  const handleEditItemRemove = (idx) => {
    if (editOrderItems.length <= 1) {
      showNotification('warning', 'An invoice must contain at least one item.');
      return;
    }
    setEditOrderItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEditAddItem = (itemToAdd) => {
    if (!itemToAdd) return;
    setEditOrderItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.item_id === itemToAdd.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        const target = { ...copy[existingIdx] };
        target.quantity += 1;
        target.total_price = parseFloat((target.unit_selling_price * target.quantity).toFixed(2));
        copy[existingIdx] = target;
        return copy;
      } else {
        return [
          ...prev,
          {
            item_id: itemToAdd.id,
            item_name: itemToAdd.name,
            item_uid: itemToAdd.uid,
            quantity: 1,
            unit_selling_price: parseFloat(itemToAdd.selling_price || 0),
            unit_mrp: parseFloat(itemToAdd.effective_mrp || itemToAdd.mrp || itemToAdd.selling_price || 0),
            total_price: parseFloat(itemToAdd.selling_price || 0),
          },
        ];
      }
    });
    setEditAddItemSearch('');
    setIsEditAddItemDropdownOpen(false);
  };

  const handleSavePaymentMethod = async () => {
    if (!editingOrderForPayment) return;
    if (editOrderItems.length === 0) {
      setPaymentUpdateError('The bill must contain at least one item.');
      return;
    }
    setPaymentUpdateError('');
    setIsSavingPaymentMethod(true);

    try {
      const newSubtotal = editOrderItems.reduce((sum, it) => sum + (it.unit_selling_price * it.quantity), 0);
      const taxAmt = parseFloat(editingOrderForPayment.tax_amount || 0);
      const discAmt = parseFloat(editingOrderForPayment.discount_amount || 0);
      const computedTotal = Math.max(0, newSubtotal + taxAmt - discAmt);

      const patchData = {
        payment_method: editPaymentMethod,
        notes: editPaymentNotes,
        items: editOrderItems.map((it) => ({
          item_id: it.item_id,
          quantity: it.quantity,
          unit_selling_price: it.unit_selling_price,
        })),
      };

      if (editPaymentMethod === 'split') {
        const cashVal = parseFloat(editSplitCash) || 0;
        const upiVal = parseFloat(editSplitUpi) || 0;

        if (Math.abs((cashVal + upiVal) - computedTotal) > 0.05) {
          throw new Error(`Split sum (Cash ₹${cashVal.toFixed(2)} + UPI ₹${upiVal.toFixed(2)} = ₹${(cashVal + upiVal).toFixed(2)}) must equal invoice total ₹${computedTotal.toFixed(2)}.`);
        }
        patchData.split_cash_amount = cashVal.toFixed(2);
        patchData.split_upi_amount = upiVal.toFixed(2);
      }

      const updated = await updateSaleOrder(editingOrderForPayment.id, patchData);
      showNotification('success', `Invoice #${editingOrderForPayment.invoice_number} updated! (New Total: ₹${parseFloat(updated.total_amount || computedTotal).toFixed(2)})`);
      setEditingOrderForPayment(null);
      await Promise.all([
        loadShiftBillingOrders(),
        loadActiveRegisterShift(),
        loadStoreItems(),
      ]);
    } catch (err) {
      console.error('Failed to update sale order:', err);
      setPaymentUpdateError(err.message || 'Failed to update sale order.');
    } finally {
      setIsSavingPaymentMethod(false);
    }
  };

  const loadRegisterHistory = async () => {
    setLoadingRegisterHistory(true);
    try {
      const storeId = activeStore?.id || effectiveStoreId;
      const params = {};
      if (storeId) params.store = storeId;
      if (shiftsHistoryTimeFilter?.active) {
        if (shiftsHistoryTimeFilter.startTime) params.start_time = shiftsHistoryTimeFilter.startTime;
        if (shiftsHistoryTimeFilter.endTime) params.end_time = shiftsHistoryTimeFilter.endTime;
      }
      const data = await getRegisterShifts(params);
      const list = Array.isArray(data) ? data : data.results || [];
      setRegisterHistoryList(list);
    } catch (err) {
      console.error('Failed to load register shift history:', err);
    } finally {
      setLoadingRegisterHistory(false);
    }
  };

  useEffect(() => {
    if (isRegisterModalOpen && showRegisterHistory) {
      loadRegisterHistory();
    }
  }, [shiftsHistoryTimeFilter]);

  const handleOpenRegisterModal = () => {
    setOpeningCashInput('');
    setOpeningNotesInput('');
    setClosingCashCountedInput('');
    setClosingNotesInput('');
    setShiftCashierName(currentUser?.name || currentUser?.username || 'Cashier');
    setShiftEntryType(activeShift ? 'shift_end' : 'shift_start');
    setShowRegisterHistory(false);
    setIsRegisterModalOpen(true);
    loadActiveRegisterShift();
  };

  const handleQuickAddCash = (val) => {
    const curr = parseFloat(openingCashInput) || 0;
    setOpeningCashInput((curr + val).toFixed(2));
  };

  const handleStartShiftSubmit = async (e) => {
    e?.preventDefault();
    const amt = parseFloat(openingCashInput);
    if (isNaN(amt) || amt < 0) {
      showNotification('error', 'Please enter a valid starting cash amount (₹0.00 or more).');
      return;
    }
    const storeId = activeStore?.id || effectiveStoreId;
    if (!storeId) {
      showNotification('error', 'No store selected.');
      return;
    }

    setIsSubmittingShift(true);
    try {
      const payload = {
        store: storeId,
        store_id: storeId,
        opening_cash: amt,
        opened_at: new Date().toISOString(),
        opened_by_name: shiftCashierName.trim() || currentUser?.name || currentUser?.username || 'Cashier',
        cashier_name: shiftCashierName.trim() || currentUser?.name || currentUser?.username || 'Cashier',
        opening_notes: openingNotesInput.trim(),
      };
      const newShift = await openRegisterShift(payload);
      setActiveShift(newShift);
      showNotification('success', `🪙 Register Shift #${newShift.shift_number} Started! Starting Cash: ₹${amt.toFixed(2)}`);
      setIsRegisterModalOpen(false);
      loadActiveRegisterShift();
    } catch (err) {
      console.error('Open shift error:', err);
      showNotification('error', err.message || 'Failed to start register shift.');
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handleCloseShiftSubmit = async (e) => {
    e?.preventDefault();
    if (!activeShift?.id) {
      showNotification('error', 'No active register shift to close. Please select Shift Start from the dropdown to open a shift.');
      return;
    }
    const amt = parseFloat(closingCashCountedInput);
    if (isNaN(amt) || amt < 0) {
      showNotification('error', 'Please enter physical cash counted in the drawer (₹0.00 or more).');
      return;
    }

    setIsSubmittingShift(true);
    try {
      const payload = {
        closing_cash_counted: amt,
        closed_at: new Date().toISOString(),
        closed_by_name: shiftCashierName.trim() || currentUser?.name || currentUser?.username || 'Cashier',
        closing_notes: closingNotesInput.trim(),
      };
      const closedShift = await closeRegisterShift(activeShift.id, payload);
      setActiveShift(null);
      setSelectedShiftForSlip(closedShift);
      setIsShiftSlipModalOpen(true);
      setIsRegisterModalOpen(false);

      const diff = parseFloat(closedShift.cash_difference || 0);
      let diffMsg = 'Cash drawer balanced perfectly (₹0.00 difference).';
      if (diff > 0) diffMsg = `Cash Overage of +₹${diff.toFixed(2)}.`;
      if (diff < 0) diffMsg = `Cash Shortage of -₹${Math.abs(diff).toFixed(2)}.`;

      showNotification('success', `🪙 Register Shift #${closedShift.shift_number} closed & reconciled. ${diffMsg}`);
      loadRegisterHistory();
    } catch (err) {
      console.error('Close shift error:', err);
      showNotification('error', err.message || 'Failed to close register shift.');
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handlePrintShiftSlip = (shift) => {
    setSelectedShiftForSlip(shift);
    setIsShiftSlipModalOpen(true);
  };

  // Step 1: Trigger Sale Confirmation Modal
  const handleInitiateCheckout = (e) => {
    e?.preventDefault();

    if (cart.length === 0) {
      showNotification('warning', 'Active cart is empty. Add products before completing sale.');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '').trim();
    if (cleanPhone.length !== 10) {
      showNotification('error', 'Customer mobile number must be exactly 10 digits (no more, no less).');
      phoneInputRef.current?.focus();
      return;
    }

    if (!activeStore) {
      showNotification('error', 'No active store branch selected.');
      return;
    }

    // Split Payment Validation
    if (paymentMethod === 'split') {
      const cAmt = parseFloat(splitCashAmount) || 0;
      const uAmt = parseFloat(splitUpiAmount) || 0;
      if (cAmt <= 0 && uAmt <= 0) {
        showNotification('error', 'Please enter the Cash and UPI split amounts.');
        return;
      }
      const sum = (cAmt + uAmt).toFixed(2);
      if (Math.abs(parseFloat(sum) - cartGrandTotal) > 0.05) {
        showNotification('error', `Split amounts must equal bill total (₹${cartGrandTotal.toFixed(2)}). Current sum is ₹${sum}.`);
        return;
      }
    }

    // VIP Card Validation
    if (paymentMethod === 'vip_card') {
      if (!customerHasVipCard) {
        playVipRejectedSound();
        showNotification('error', 'Selected payment method is VIP Card, but customer has no active VIP card.');
        return;
      }
      const cleanScannedUid = vipCardScannedUid.trim();
      if (!cleanScannedUid) {
        playVipRejectedSound();
        showNotification('error', "Please tap the customer's VIP Card or enter the Card UID.");
        return;
      }
      if (cleanScannedUid.toLowerCase() !== matchedCustomer.vip_card_uid.toLowerCase()) {
        playVipRejectedSound();
        showNotification(
          'error',
          `Card UID mismatch! Tapped card (${cleanScannedUid}) does not match this customer's registered card (${matchedCustomer.vip_card_uid}).`
        );
        return;
      }
      if (parseFloat(matchedCustomer.vip_card_balance || 0) < cartGrandTotal) {
        playVipRejectedSound();
        showNotification(
          'error',
          `Insufficient VIP Card balance (Available: ₹${parseFloat(matchedCustomer.vip_card_balance || 0).toFixed(2)}, Required: ₹${cartGrandTotal.toFixed(2)}). Please use quick recharge.`
        );
        return;
      }
    }

    // Partial Payment Validation
    if (paymentMethod === 'partial') {
      const pAmt = parseFloat(partialAmountPaid) || 0;
      if (pAmt < 0) {
        showNotification('error', 'Initial paid amount cannot be negative.');
        return;
      }
      if (pAmt > cartGrandTotal) {
        showNotification('error', `Initial paid amount (₹${pAmt.toFixed(2)}) cannot exceed the bill total (₹${cartGrandTotal.toFixed(2)}).`);
        return;
      }
    }

    setIsConfirmSaleModalOpen(true);
  };

  // Step 2: Finalize Checkout API call after confirmation
  const handleCompleteCheckout = async () => {
    if (isSubmitting) return;
    const cleanPhone = customerPhone.replace(/\D/g, '').trim();
    if (cleanPhone.length !== 10) {
      showNotification('error', 'Customer mobile number must be exactly 10 digits.');
      return;
    }

    if (!activeStore) {
      showNotification('error', 'No active store branch selected.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        store_id: activeStore.id,
        customer_phone: cleanPhone,
        customer_name: customerName.trim(), // Optional
        customer_email: customerEmail.trim(),
        payment_method: paymentMethod,
        split_cash_amount: paymentMethod === 'split' ? Number((parseFloat(splitCashAmount) || 0).toFixed(2)) : undefined,
        split_upi_amount: paymentMethod === 'split' ? Number((parseFloat(splitUpiAmount) || 0).toFixed(2)) : undefined,
        vip_card_uid: paymentMethod === 'vip_card' ? vipCardScannedUid.trim() : undefined,
        initial_payment_method: paymentMethod === 'partial' ? partialPaymentMethod : undefined,
        amount_paid: Number((
          paymentMethod === 'split'
            ? (splitCashReceived ? parseFloat(splitCashReceived) : (parseFloat(splitCashAmount) || 0))
            : paymentMethod === 'partial'
            ? (parseFloat(partialAmountPaid) || 0)
            : (parseFloat(amountPaid) || cartGrandTotal)
        ).toFixed(2)),
        discount_amount: Number(cartDiscount.toFixed(2)),
        tax_amount: 0,
        notes: checkoutNotes,
        items: cart.map((ci) => ({
          item_id: ci.item.id,
          quantity: ci.quantity,
          unit_price: Number((parseFloat(ci.unit_price) || parseFloat(ci.item.selling_price) || 0).toFixed(2)),
        })),
      };

      const completed = await processCheckout(payload);
      if (paymentMethod === 'vip_card') {
        playVipAcceptedSound();
      }

      // Successfully checked out - close confirmation, open receipt & reset form
      setIsConfirmSaleModalOpen(false);
      setCompletedOrder(completed);
      setIsReceiptOpen(true);
      setCart([]);
      setSelectedProduct(null);
      setProductQuantity(1);
      setCustomerPhone('');
      setCustomerName('');
      setCustomerEmail('');
      setDiscountAmount('0');
      setDiscountPercent('0');
      setDiscountType('percent');
      setCheckoutNotes('');
      setAmountPaid('');
      setSplitCashAmount('');
      setSplitUpiAmount('');
      setSplitCashReceived('');
      setPartialAmountPaid('');
      setPartialPaymentMethod('cash');
      setVipCardScannedUid('');
      setMatchedCustomer(null);

      // Refresh store inventory to reflect updated stock levels
      loadStoreItems();
      loadActiveRegisterShift();
      loadShiftBillingOrders();
      showNotification('success', `Sale completed successfully! Invoice #${completed.invoice_number}`);
    } catch (err) {
      console.error('Checkout error:', err);
      showNotification('error', err.message || 'Failed to complete checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  handleInitiateCheckoutRef.current = handleInitiateCheckout;
  handleCompleteCheckoutRef.current = handleCompleteCheckout;

  // ---------------- Draft / Hold Cart (Park Bill) Handlers ----------------

  const handleSaveDraftCart = () => {
    if (cart.length === 0) {
      showNotification('warning', 'Active cart is empty. Add items first before saving draft.');
      return;
    }

    const draftId = `draft_${Date.now()}`;
    const newDraft = {
      id: draftId,
      timestamp: new Date().toISOString(),
      customerPhone: customerPhone.trim(),
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      paymentMethod,
      discountAmount,
      discountPercent,
      discountType,
      checkoutNotes,
      items: [...cart],
      totalAmount: cartGrandTotal,
      totalItems: cartTotalItems,
    };

    const updated = [newDraft, ...draftCarts];
    setDraftCarts(updated);
    try {
      localStorage.setItem('wondersale_billing_drafts', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // Clear active cart and input fields for next customer
    setCart([]);
    setSelectedProduct(null);
    setProductQuantity(1);
    setCustomerPhone('');
    setCustomerName('');
    setCustomerEmail('');
    setDiscountAmount('0');
    setDiscountPercent('0');
    setDiscountType('percent');
    setCheckoutNotes('');
    setAmountPaid('');

    showNotification(
      'success',
      `Bill held & saved as Draft (${cartTotalItems} items)! Active cart is now free for the next customer.`
    );
  };

  const handleRestoreDraftCart = (draft) => {
    let updated = draftCarts.filter((d) => d.id !== draft.id);

    // If current cart currently has items, automatically park current cart as draft
    if (cart.length > 0) {
      const currentDraft = {
        id: `draft_${Date.now()}`,
        timestamp: new Date().toISOString(),
        customerPhone: customerPhone.trim(),
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        paymentMethod,
        discountAmount,
        discountPercent,
        discountType,
        checkoutNotes,
        items: [...cart],
        totalAmount: cartGrandTotal,
        totalItems: cartTotalItems,
      };
      updated = [currentDraft, ...updated];
    }

    setDraftCarts(updated);
    try {
      localStorage.setItem('wondersale_billing_drafts', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // Restore selected draft into active cart and inputs
    setCart(draft.items || []);
    setCustomerPhone(draft.customerPhone || '');
    setCustomerName(draft.customerName || '');
    setCustomerEmail(draft.customerEmail || '');
    setPaymentMethod(draft.paymentMethod || 'cash');
    setDiscountAmount(draft.discountAmount || '0');
    setDiscountPercent(draft.discountPercent || '0');
    setDiscountType(draft.discountType || 'percent');
    setCheckoutNotes(draft.checkoutNotes || '');
    setSelectedProduct(null);

    setIsDraftsModalOpen(false);

    if (cart.length > 0) {
      showNotification(
        'success',
        `Active bill saved to draft! Loaded draft for ${draft.customerName || draft.customerPhone || 'Customer'} (${draft.totalItems || draft.items?.length} items).`
      );
    } else {
      showNotification(
        'success',
        `Restored draft bill for ${draft.customerName || draft.customerPhone || 'Customer'} (${draft.totalItems || draft.items?.length} items).`
      );
    }
  };

  const handleDeleteDraftCart = (draftId) => {
    const updated = draftCarts.filter((d) => d.id !== draftId);
    setDraftCarts(updated);
    try {
      localStorage.setItem('wondersale_billing_drafts', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    showNotification('warning', 'Draft bill removed.');
  };

  // ---------------- Receipt & WhatsApp Actions ----------------

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleSaveAsPdf = () => {
    if (!completedOrder) return;
    saveReceiptAsPdf(completedOrder.invoice_number || 'bill');
  };

  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [waCooldownActive, setWaCooldownActive] = useState(false);

  const handleSendWhatsApp = async (force = false) => {
    if (!completedOrder || isSendingWhatsApp) return;
    setIsSendingWhatsApp(true);
    showNotification('info', force ? 'Force dispatching bill PDF to WhatsApp...' : 'Generating bill PDF and sending directly to WhatsApp...');

    const targetCustomer = {
      phone: completedOrder.customer_phone || (completedOrder.customer && completedOrder.customer.phone) || customerPhone || '',
      name: completedOrder.customer_name || (completedOrder.customer && completedOrder.customer.name) || customerName || 'Dear Customer'
    };

    let pdfBlob = null;
    try {
      // Capture the exact visual receipt element currently rendered onscreen (identical to Save as PDF)
      pdfBlob = await generateReceiptPdfBlob(completedOrder.invoice_number || 'bill');
    } catch (e) {
      console.warn('Failed to capture onscreen visual receipt PDF:', e);
    }

    try {
      await sendWhatsAppReceipt(
        completedOrder,
        activeStore,
        targetCustomer,
        (feedback) => {
          const isReturnOrder = Boolean(
            completedOrder.is_return ||
            (completedOrder.invoice_number && String(completedOrder.invoice_number).startsWith('RET-')) ||
            completedOrder.return_reference ||
            completedOrder.status === 'refunded'
          );
          const typeLabel = isReturnOrder ? 'Return voucher' : 'Bill';
          if (feedback.success) {
            setWaCooldownActive(false);
            showNotification('success', feedback.message || `${typeLabel} #${completedOrder.invoice_number} sent directly to WhatsApp!`);
          } else {
            const msg = feedback.message || `Failed to send ${typeLabel.toLowerCase()} via WhatsApp.`;
            if (msg.toLowerCase().includes('wait') || msg.toLowerCase().includes('cooldown') || msg.toLowerCase().includes('recently')) {
              setWaCooldownActive(true);
            }
            showNotification('error', msg);
          }
        },
        pdfBlob,
        force
      );
    } finally {
      setIsSendingWhatsApp(false);
    }
  };




  const handleCopyBillText = () => {
    if (!completedOrder) return;
    const itemsList =
      completedOrder.items
        ?.map((item, idx) => `${idx + 1}. ${item.item_name} (Qty: ${item.quantity} × ₹${item.unit_selling_price} = ₹${item.total_price})`)
        .join('\n') || '';
    const storeName = completedOrder.store_name || activeStore?.name || 'Wondersale';
    const custName = completedOrder.customer_name || (completedOrder.customer_display_name && !completedOrder.customer_display_name.startsWith('Customer (') ? completedOrder.customer_display_name : '') || completedOrder.customer_phone || '';
    const termsRaw = getReceiptTermsText();
    const text =
      `${storeName} - Invoice #${completedOrder.invoice_number}\n` +
      (custName ? `Customer: ${custName}\n` : '') +
      `Items:\n${itemsList}\n` +
      `Total: ₹${completedOrder.total_amount}\n` +
      `Thank you for shopping with us!\n\n` +
      `TERMS & CONDITIONS\n` +
      `${termsRaw.replace(/\*\*/g, '')}`;

    navigator.clipboard?.writeText(text);
    showNotification('success', 'Bill summary (with Terms & Conditions) copied to clipboard!');
  };

  return (
    <div
      className="billing-view-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        gap: '20px',
        padding: '20px',
        maxWidth: '1500px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Station Header */}
      <div
        className="billing-top-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          padding: '14px 20px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div className="billing-header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBackToLauncher}
            className="btn btn-secondary btn-sm billing-back-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Menu</span>
          </button>

          <div
            className="billing-header-icon-box"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2))',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            <Receipt size={20} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="billing-header-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Billing &amp; POS Station
              </h1>
              <span
                className="billing-online-badge"
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                ONLINE
              </span>
            </div>
            <p className="billing-header-sub" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Fast retail cashier checkout, barcode scan listener &amp; customer receipt billing
            </p>
          </div>
        </div>

        {/* Store & Cashier Badges */}
        <div className="billing-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Daily Cash Register Shift Button */}
          <button
            type="button"
            onClick={handleOpenRegisterModal}
            className="btn btn-secondary btn-sm billing-shift-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: activeShift
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(5, 150, 105, 0.08))'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(217, 119, 6, 0.08))',
              borderColor: activeShift ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.45)',
              color: activeShift ? '#34D399' : '#FBBF24',
              fontWeight: 800,
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              boxShadow: activeShift ? '0 2px 10px rgba(16, 185, 129, 0.15)' : '0 2px 10px rgba(245, 158, 11, 0.15)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={
              activeShift
                ? `Shift #${activeShift.shift_number} Active • Starting Cash: ₹${parseFloat(activeShift.opening_cash).toFixed(2)}`
                : 'Register Closed: Click to start shift and enter opening counter cash'
            }
          >
            <Coins size={15} style={{ color: activeShift ? '#10B981' : '#F59E0B' }} />
            <span>
              {activeShift
                ? `Register: Shift #${activeShift.shift_number} (Open)`
                : '🪙 Start Register Shift'}
            </span>
          </button>

          {/* Counter Payout Button (Near store location on its left) */}
          <button
            type="button"
            onClick={handleOpenPayoutModal}
            className="btn btn-secondary btn-sm billing-payout-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(220, 38, 38, 0.06))',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: '#F87171',
              fontWeight: 800,
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              boxShadow: '0 2px 10px rgba(239, 68, 68, 0.15)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Record on-counter stock purchase, logistics or expense payout"
          >
            <ArrowUpRight size={15} style={{ color: '#EF4444' }} />
            <span>Counter Payout</span>
          </button>

          {/* Product Return Button */}
          <button
            type="button"
            onClick={() => setIsReturnModalOpen(true)}
            className="btn btn-secondary btn-sm billing-return-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.14), rgba(194, 65, 12, 0.06))',
              borderColor: 'rgba(234, 88, 12, 0.45)',
              color: '#FB923C',
              fontWeight: 800,
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              boxShadow: '0 2px 10px rgba(234, 88, 12, 0.15)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Return products from an existing bill / invoice and issue refund"
          >
            <RotateCcw size={15} style={{ color: '#FB923C' }} />
            <span>Bill Return</span>
          </button>

          {activeStore && (
            <div
              className="billing-store-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(218, 41, 28, 0.1)',
                border: '1px solid rgba(218, 41, 28, 0.25)',
                fontSize: '0.8rem',
                color: 'var(--text-main)',
              }}
            >
              <StoreIcon size={14} style={{ color: 'var(--brand-primary)' }} />
              <span>
                Branch: <strong>{activeStore.name}</strong>
              </span>
            </div>
          )}

          <div
            className="billing-cashier-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
            }}
          >
            <User size={14} style={{ color: 'var(--text-muted)' }} />
            <span>
              Cashier: <strong>{currentUser?.name || currentUser?.username || 'Admin'}</strong>
            </span>
          </div>

          {draftCarts.length > 0 && (
            <button
              type="button"
              onClick={() => setIsDraftsModalOpen(true)}
              className="btn btn-secondary btn-sm billing-drafts-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(245, 158, 11, 0.15)',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                color: '#F59E0B',
                fontWeight: 700,
              }}
            >
              <Bookmark size={14} />
              <span>Held Bills ({draftCarts.length})</span>
            </button>
          )}

          {onNavigateToCustomers && (
            <button
              type="button"
              onClick={onNavigateToCustomers}
              className="btn btn-secondary btn-sm billing-cust-dir-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <User size={13} />
              <span>Customer Directory</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Notification Floating Toast Banner (Always pinned to top of screen regardless of scroll) */}
      {notification && (
        <div
          role="alert"
          className="billing-notification-toast"
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999999,
            minWidth: '360px',
            maxWidth: 'min(90vw, 680px)',
            padding: '14px 20px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.94rem',
            fontWeight: 600,
            boxShadow: '0 20px 45px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            background:
              notification.type === 'error'
                ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95))'
                : notification.type === 'warning'
                ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.95), rgba(180, 83, 9, 0.95))'
                : 'linear-gradient(135deg, rgba(5, 150, 105, 0.95), rgba(4, 120, 87, 0.95))',
            border: `1px solid ${
              notification.type === 'error'
                ? 'rgba(252, 165, 165, 0.4)'
                : notification.type === 'warning'
                ? 'rgba(253, 230, 138, 0.4)'
                : 'rgba(167, 243, 208, 0.4)'
            }`,
            color: '#FFFFFF',
            animation: 'slideDownFade 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: 'default',
          }}
        >
          {notification.type === 'error' ? (
            <AlertCircle size={20} style={{ flexShrink: 0, color: '#FEE2E2' }} />
          ) : (
            <CheckCircle2 size={20} style={{ flexShrink: 0, color: '#D1FAE5' }} />
          )}
          <span style={{ flex: 1, lineHeight: 1.4 }}>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            title="Dismiss notification"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* POS Top Section: Inventory-Themed Search Bar with Dropdown */}
      <div
        ref={searchContainerRef}
        className="billing-search-card"
        style={{
          position: 'relative',
          padding: '16px 20px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="billing-search-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          {/* Search Input matching Inventory Search Bar Styling */}
          <div className="billing-search-input-wrap" style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const q = searchQuery.trim().toLowerCase();
                  if (!q) return;

                  // Check if this query is an exact barcode/UID match
                  const exactMatch = items.find(
                    (it) => it.uid?.toLowerCase() === q || it.legacy_uid?.toLowerCase() === q
                  );
                  if (exactMatch) {
                    handleBarcodeScanned(q);
                    return;
                  }

                  if (searchResults.length > 0) {
                    const topItem = searchResults[0];
                    setSelectedProduct(topItem);
                    if (topItem.quantity <= 0) {
                      showNotification('error', `Out of Stock: "${topItem.name}" has 0 available units in inventory.`);
                      return;
                    }
                    const existingInCart = cart.find((ci) => ci.item.id === topItem.id);
                    const inCartQty = existingInCart ? existingInCart.quantity : 0;
                    if (inCartQty >= topItem.quantity) {
                      showNotification(
                        'warning',
                        `All ${topItem.quantity} available units of "${topItem.name}" are already added to this bill.`
                      );
                      return;
                    }
                    handleAddToCart(topItem, 1);
                  } else {
                    handleBarcodeScanned(q);
                  }
                }
              }}
              placeholder="Search product name, UID, barcode, section... (or scan barcode)"
              className="form-input billing-search-input"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                paddingLeft: '44px',
                paddingRight: searchQuery ? '36px' : '16px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.92rem',
                height: '46px',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsDropdownOpen(false);
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick Scanner Ready Indicator */}
          <div
            className="billing-scanner-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              height: '46px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.78rem',
              color: '#60A5FA',
              whiteSpace: 'nowrap',
            }}
          >
            <Barcode size={18} />
            <span style={{ fontWeight: 600 }}>Scanner Active</span>
          </div>
        </div>

        {/* Live Search Results Dropdown List */}
        {isDropdownOpen && searchResults.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: '20px',
              right: '20px',
              zIndex: 100,
              background: 'var(--bg-surface-solid)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '6px',
            }}
          >
            <div
              style={{
                padding: '6px 12px',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '4px',
              }}
            >
              Matching Products ({searchResults.length})
            </div>

            {searchResults.map((item) => {
              const isOutOfStock = item.quantity <= 0;
              const primaryImg = item.images?.find((img) => img.is_primary) || item.images?.[0];

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedProduct(item);
                    setProductQuantity(1);
                    setIsDropdownOpen(false);
                    if (isOutOfStock) {
                      showNotification('error', `Out of Stock: "${item.name}" has 0 available stock.`);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                    gap: '12px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    {/* Thumbnail */}
                    <div
                      onClick={(e) => {
                        if (primaryImg) {
                          e.stopPropagation();
                          setLightboxImage({
                            src: primaryImg.image_url || primaryImg.image,
                            name: item.name,
                            uid: item.uid,
                          });
                        }
                      }}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: primaryImg ? 'zoom-in' : 'pointer',
                      }}
                      title={primaryImg ? 'Click to view larger image' : undefined}
                    >
                      {primaryImg ? (
                        <img
                          src={primaryImg.image_url || primaryImg.image}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Package size={20} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          color: 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '2px',
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', color: 'var(--brand-primary)', fontWeight: 600 }}>
                          {item.uid}
                        </span>
                        {item.location_section && <span>• {item.location_section}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Price & Stock Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        ₹{parseFloat(item.selling_price || 0).toFixed(2)}
                      </div>
                      {item.effective_mrp && parseFloat(item.effective_mrp) > parseFloat(item.selling_price) && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          MRP ₹{parseFloat(item.effective_mrp).toFixed(2)}
                        </div>
                      )}
                    </div>

                    {isOutOfStock ? (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#EF4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        Out of Stock
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: item.quantity <= 5 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: item.quantity <= 5 ? '#F59E0B' : '#10B981',
                        }}
                      >
                        {item.quantity} in stock
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(item, 1);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        opacity: isOutOfStock ? 0.4 : 1,
                      }}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vertical Stack Layout: Full-Width Selected Product Card followed by Full-Width Cart Card & Inline Checkout */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '100%',
        }}
      >
        {/* 1. TOP: FULL-WIDTH SELECTED PRODUCT PREVIEW (Large 180px Image, Bold Typography, Solid Button) */}
        <div
          className="billing-selected-product-card"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-surface)',
            border: selectedProduct ? '1px solid var(--border-subtle)' : '1px dashed var(--border-subtle)',
            padding: '24px 30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: selectedProduct ? '0 8px 32px rgba(0, 0, 0, 0.28)' : '0 4px 16px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Top Header: Label & Dismiss Button */}
          <div className="billing-selected-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: selectedProduct ? 'var(--brand-primary)' : 'var(--text-muted)' }} />
              <span
                className="billing-selected-badge-title"
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: selectedProduct ? 'var(--text-main)' : 'var(--text-muted)',
                  letterSpacing: '0.6px',
                }}
              >
                Selected Product Preview
              </span>
              {!selectedProduct && (
                <span className="billing-selected-standby-text" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  (Standby — Scan barcode or search above)
                </span>
              )}
            </div>
            {selectedProduct && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(null);
                  setProductQuantity(1);
                }}
                className="btn btn-secondary btn-sm billing-selected-dismiss-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.82rem',
                  padding: '5px 14px',
                }}
              >
                <X size={15} />
                <span>Dismiss</span>
              </button>
            )}
          </div>

          {/* Main Layout Row: Large Image + Expanded Details + Price/Cart Block */}
          <div
            className="billing-selected-main-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '28px',
            }}
          >
            {/* Left Area: Big 180px Photo + Titles & Badges */}
            <div className="billing-selected-info-wrap" style={{ display: 'flex', alignItems: 'center', gap: '26px', flex: '1 1 540px', minWidth: 0 }}>
              {/* Product Thumbnail (Large 180x180px with Lightbox click) */}
              <div
                onClick={() => {
                  if (selectedProduct?.images?.[0]) {
                    setLightboxImage({
                      src: selectedProduct.images[0].image_url || selectedProduct.images[0].image,
                      name: selectedProduct.name,
                      uid: selectedProduct.uid,
                    });
                  }
                }}
                className="billing-selected-photo-box"
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '18px',
                  background: 'var(--bg-main)',
                  border: selectedProduct ? '1px solid var(--border-subtle)' : '2px dashed var(--border-subtle)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: selectedProduct ? '0 10px 30px rgba(0, 0, 0, 0.45)' : 'none',
                  cursor: selectedProduct?.images?.[0] ? 'zoom-in' : 'default',
                  position: 'relative',
                }}
                title={selectedProduct?.images?.[0] ? 'Click to view full-size image' : undefined}
              >
                {selectedProduct?.images?.[0] ? (
                  <>
                    <img
                      src={selectedProduct.images[0].image_url || selectedProduct.images[0].image}
                      alt={selectedProduct.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      className="billing-selected-zoom-badge"
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: 'rgba(0, 0, 0, 0.72)',
                        backdropFilter: 'blur(4px)',
                        color: '#ffffff',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-pill)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <ZoomIn size={12} />
                      <span>Zoom</span>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-muted)',
                      opacity: 0.65,
                    }}
                  >
                    <Package size={56} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      {selectedProduct ? 'No Image' : 'No Product'}
                    </span>
                  </div>
                )}
              </div>

              {/* Product Name, Barcode & Location Badges */}
              <div className="billing-selected-meta-col" style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, flex: 1 }}>
                <h3
                  className="billing-selected-product-title"
                  style={{
                    fontSize: '1.85rem',
                    fontWeight: 800,
                    margin: 0,
                    color: selectedProduct ? 'var(--text-main)' : 'var(--text-muted)',
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={selectedProduct?.name || 'No Product Selected'}
                >
                  {selectedProduct?.name || 'No Product Selected'}
                </h3>

                {/* Badges: UID, Section, Expiry */}
                <div className="billing-selected-tags-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* UID / Barcode Tag */}
                  <span
                    className="billing-selected-uid-tag"
                    style={{
                      fontSize: '0.92rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: selectedProduct ? 'rgba(218, 41, 28, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                      color: selectedProduct ? 'var(--brand-primary)' : 'var(--text-muted)',
                      border: `1px solid ${selectedProduct ? 'rgba(218, 41, 28, 0.3)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    UID: {selectedProduct?.uid || '—'}
                  </span>

                  {/* Section Tag */}
                  <span
                    className="billing-selected-sec-tag"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.88rem',
                      color: selectedProduct?.location_section ? 'var(--text-secondary)' : 'var(--text-muted)',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-hover)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <MapPin size={14} />
                    <span>{selectedProduct?.location_section || 'Section: —'}</span>
                  </span>

                  {/* Expiry Tag */}
                  <span
                    className="billing-selected-exp-tag"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.88rem',
                      color: selectedProduct?.expiry_date ? 'var(--text-secondary)' : 'var(--text-muted)',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-hover)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Calendar size={14} />
                    <span>Exp: {selectedProduct?.expiry_date || '—'}</span>
                  </span>
                </div>

                {/* Subcategory Pills */}
                <div className="billing-selected-subcats-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '28px', marginTop: '2px' }}>
                  {selectedProduct?.subcategories && selectedProduct.subcategories.length > 0 ? (
                    selectedProduct.subcategories.map((sc) => (
                      <span
                        key={sc.id}
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--bg-surface-hover)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {sc.name}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {selectedProduct ? 'No category tags' : 'Category tags will appear here'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Area: Pricing, Stock, Confidential Cost Price & Add to Cart */}
            <div
              className="billing-selected-right-col"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '16px',
                flexShrink: 0,
              }}
            >
              {/* Pricing & Stock Card */}
              <div
                className="billing-selected-price-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  padding: '12px 24px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Exclusive Head Cashier / Owner Confidential Cost Price & Profit Margin (Shown on the Left of Selling Price) */}
                {isHeadCashierOrOwner && selectedProduct && (
                  <div className="billing-selected-cost-col" style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#F59E0B', textTransform: 'uppercase', display: 'block', fontWeight: 800 }}>
                        Cost Price
                      </span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F59E0B', marginTop: '4px' }}>
                      ₹{parseFloat(selectedProduct.cost_price || 0).toFixed(2)}
                    </div>
                    {parseFloat(selectedProduct.cost_price || 0) > 0 && (
                      <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, marginTop: '2px' }}>
                        Margin: +₹{(parseFloat(selectedProduct.selling_price || 0) - parseFloat(selectedProduct.cost_price || 0)).toFixed(2)} ({(((parseFloat(selectedProduct.selling_price || 0) - parseFloat(selectedProduct.cost_price || 0)) / parseFloat(selectedProduct.cost_price || 1)) * 100).toFixed(1)}%)
                      </div>
                    )}
                  </div>
                )}

                <div className="billing-selected-selling-col">
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                    Selling Price
                  </span>
                  <div className="billing-selected-selling-price" style={{ fontSize: '2.1rem', fontWeight: 900, color: selectedProduct ? '#10B981' : 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedProduct ? `₹${parseFloat(selectedProduct.selling_price || 0).toFixed(2)}` : '₹ --.--'}
                  </div>
                </div>

                <div className="billing-selected-mrp-col" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                    MRP
                  </span>
                  <div
                    className="billing-selected-mrp-price"
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textDecoration: selectedProduct?.effective_mrp ? 'line-through' : 'none',
                      marginTop: '4px',
                    }}
                  >
                    {selectedProduct?.effective_mrp ? `₹${parseFloat(selectedProduct.effective_mrp).toFixed(2)}` : '₹ --.--'}
                  </div>
                </div>

                <div className="billing-selected-stock-col" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                    Available Stock
                  </span>
                  <div style={{ marginTop: '4px' }}>
                    {!selectedProduct ? (
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>-- units</span>
                    ) : selectedProduct.quantity <= 0 ? (
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#EF4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        Out of Stock (0)
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 800,
                          color: selectedProduct.quantity <= 5 ? '#F59E0B' : '#10B981',
                        }}
                      >
                        {selectedProduct.quantity} units
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity Controls & Solid Add to Cart Button (No Gradient) */}
              <div className="billing-selected-qty-row" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {!selectedProduct ? (
                  <div className="billing-selected-qty-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.4 }}>
                      <button type="button" disabled className="btn btn-secondary btn-sm" style={{ width: '42px', height: '44px', padding: 0 }}>
                        <Minus size={16} />
                      </button>
                      <input
                        type="text"
                        disabled
                        value="0"
                        style={{
                          width: '58px',
                          textAlign: 'center',
                          height: '44px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: '1rem',
                        }}
                      />
                      <button type="button" disabled className="btn btn-secondary btn-sm" style={{ width: '42px', height: '44px', padding: 0 }}>
                        <Plus size={16} />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="billing-add-to-cart-btn"
                      style={{
                        height: '44px',
                        padding: '0 26px',
                        fontWeight: 800,
                        fontSize: '1rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)',
                        cursor: 'not-allowed',
                        opacity: 0.5,
                      }}
                    >
                      <ShoppingCart size={18} />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                ) : selectedProduct.quantity <= 0 ? (
                  <div
                    className="billing-selected-out-of-stock-box"
                    style={{
                      padding: '12px 24px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      textAlign: 'center',
                    }}
                  >
                    Product is Out of Stock
                  </div>
                ) : (
                  <div className="billing-selected-qty-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Quantity Spinner */}
                    <div className="billing-selected-spinner-box" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setProductQuantity((q) => Math.max(1, q - 1))}
                        className="btn btn-secondary btn-sm"
                        style={{ width: '42px', height: '44px', padding: 0 }}
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={selectedProduct.quantity}
                        value={productQuantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setProductQuantity(Math.min(selectedProduct.quantity, Math.max(1, val)));
                          }
                        }}
                        style={{
                          width: '58px',
                          textAlign: 'center',
                          height: '44px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          fontWeight: 800,
                          fontSize: '1.05rem',
                          MozAppearance: 'textfield',
                          appearance: 'textfield',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProductQuantity((q) => Math.min(selectedProduct.quantity, q + 1))
                        }
                        className="btn btn-secondary btn-sm"
                        style={{ width: '42px', height: '44px', padding: 0 }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Solid Add to Cart Button (NO GRADIENT) */}
                    <button
                      type="button"
                      onClick={() => handleAddToCart(selectedProduct, productQuantity)}
                      className="billing-add-to-cart-btn"
                      style={{
                        height: '44px',
                        padding: '0 28px',
                        fontWeight: 800,
                        fontSize: '1.02rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '9px',
                        borderRadius: 'var(--radius-md)',
                        background: '#DC2626',
                        border: '1px solid #DC2626',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(220, 38, 38, 0.4)',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.15s ease, transform 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#B91C1C')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#DC2626')}
                    >
                      <ShoppingCart size={19} />
                      <span>
                        Add to Cart (₹{(parseFloat(selectedProduct.selling_price) * productQuantity).toFixed(2)})
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. MIDDLE: FULL-WIDTH ACTIVE BILL CART CARD */}
        <div
          className="billing-cart-card"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.22)',
          }}
        >
          {/* Cart Header */}
          <div
            className="billing-cart-header"
            style={{
              padding: '18px 28px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-surface-solid, #161B2C)',
            }}
          >
            <div className="billing-cart-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShoppingCart size={24} style={{ color: 'var(--brand-primary)' }} />
              <h2 className="billing-cart-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Active Bill Cart ({cartTotalItems} {cartTotalItems === 1 ? 'item' : 'items'})
              </h2>
            </div>

            <div className="billing-cart-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {draftCarts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDraftsModalOpen(true)}
                  className="btn btn-secondary btn-sm billing-cart-held-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                    color: '#F59E0B',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    padding: '7px 14px',
                  }}
                  title="View and resume parked draft bills"
                >
                  <Bookmark size={15} />
                  <span>Held Drafts ({draftCarts.length})</span>
                </button>
              )}

              {cart.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveDraftCart}
                    className="btn btn-secondary btn-sm billing-cart-hold-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      borderColor: 'rgba(59, 130, 246, 0.35)',
                      color: '#3B82F6',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      padding: '7px 14px',
                    }}
                    title="Park this cart so customer can pick more items while you bill other customers"
                  >
                    <Bookmark size={15} />
                    <span>Hold / Save Draft</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="btn btn-secondary btn-sm billing-cart-clear-btn"
                    style={{
                      color: 'var(--color-danger)',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      fontSize: '0.84rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Clear Bill</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="billing-cart-table-wrap" style={{ flex: 1, minHeight: cart.length > 0 ? '240px' : 'auto', maxHeight: '480px', overflowY: cart.length > 0 ? 'auto' : 'visible' }}>
            {cart.length > 0 ? (
              <table className="billing-cart-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.96rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-muted)',
                      fontSize: '0.84rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '14px 26px', width: '44%' }}># Item Description</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', width: '18%' }}>Unit Price</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', width: '16%' }}>Quantity</th>
                    <th style={{ padding: '14px 26px', textAlign: 'right', width: '18%' }}>Line Total</th>
                    <th style={{ padding: '14px 18px', textAlign: 'center', width: '54px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((ci) => {
                    const primaryImg = ci.item.images?.find((img) => img.is_primary) || ci.item.images?.[0];
                    return (
                      <tr
                        key={ci.item.id}
                        className="billing-cart-row"
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Item Name & UID with Large 68px Thumbnail + Lightbox */}
                        <td className="billing-cart-cell-item" style={{ padding: '16px 26px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                            <div
                              onClick={() => {
                                if (primaryImg) {
                                  setLightboxImage({
                                    src: primaryImg.image_url || primaryImg.image,
                                    name: ci.item.name,
                                    uid: ci.item.uid,
                                  });
                                }
                              }}
                              className="billing-cart-thumb-box"
                              style={{
                                width: '68px',
                                height: '68px',
                                borderRadius: '12px',
                                background: 'var(--bg-main)',
                                border: '1px solid var(--border-subtle)',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                                cursor: primaryImg ? 'zoom-in' : 'default',
                              }}
                              title={primaryImg ? 'Click to view full-size image' : undefined}
                            >
                              {primaryImg ? (
                                <img
                                  src={primaryImg.image_url || primaryImg.image}
                                  alt={ci.item.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <Package size={30} style={{ color: 'var(--text-muted)' }} />
                              )}
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="billing-cart-item-name" style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.22rem', lineHeight: 1.3 }}>
                                {ci.item.name}
                              </div>
                              <div
                                className="billing-cart-item-submeta"
                                style={{
                                  marginTop: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  className="billing-cart-uid-tag"
                                  style={{
                                    fontSize: '1.05rem',
                                    fontFamily: 'monospace',
                                    fontWeight: 800,
                                    padding: '3px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(218, 41, 28, 0.15)',
                                    color: 'var(--brand-primary)',
                                    border: '1px solid rgba(218, 41, 28, 0.3)',
                                    letterSpacing: '0.5px',
                                  }}
                                >
                                  UID: {ci.item.uid}
                                </span>
                                {ci.item.location_section && (
                                  <span className="billing-cart-sec-tag" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    Section: {ci.item.location_section}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Unit Selling Price (Editable for Head Cashier & Owner) */}
                        <td className="billing-cart-cell-price" style={{ padding: '16px 20px', textAlign: 'right' }}>
                          {isHeadCashierOrOwner ? (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={ci.unit_price}
                                  onChange={(e) => handleUpdateUnitPrice(ci.item.id, e.target.value)}
                                  className="billing-cart-price-input"
                                  style={{
                                    width: '90px',
                                    textAlign: 'right',
                                    height: '36px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-main)',
                                    color: 'var(--text-main)',
                                    fontWeight: 800,
                                    fontSize: '1.02rem',
                                    padding: '0 8px',
                                  }}
                                  title="Edit unit price (Head Cashier & Owner override)"
                                />
                              </div>
                              {parseFloat(ci.unit_price) !== parseFloat(ci.item.selling_price) && (
                                <span style={{ fontSize: '0.68rem', color: '#F59E0B', fontWeight: 700 }}>
                                  Modified (Orig: ₹{parseFloat(ci.item.selling_price).toFixed(2)})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="billing-cart-price-text" style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '1.08rem' }}>
                              ₹{ci.unit_price}
                            </span>
                          )}
                        </td>

                        {/* Quantity Controls (Enlarged) */}
                        <td className="billing-cart-cell-qty" style={{ padding: '16px 20px', textAlign: 'center' }}>
                          <div className="billing-cart-qty-spinner" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(ci.item.id, ci.quantity - 1)}
                              className="btn btn-secondary btn-sm"
                              style={{ width: '38px', height: '38px', padding: 0 }}
                            >
                              <Minus size={15} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={ci.item.quantity}
                              value={ci.quantity}
                              onChange={(e) => handleUpdateCartQty(ci.item.id, e.target.value)}
                              className="billing-cart-qty-input"
                              style={{
                                width: '54px',
                                textAlign: 'center',
                                height: '38px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-main)',
                                color: 'var(--text-main)',
                                fontWeight: 800,
                                fontSize: '1.02rem',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(ci.item.id, ci.quantity + 1)}
                              className="btn btn-secondary btn-sm"
                              style={{ width: '38px', height: '38px', padding: 0 }}
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </td>

                        {/* Line Total */}
                        <td className="billing-cart-cell-total" style={{ padding: '16px 26px', textAlign: 'right', fontWeight: 900, color: '#10B981', fontSize: '1.25rem' }}>
                          ₹{ci.total}
                        </td>

                        {/* Remove Action */}
                        <td className="billing-cart-cell-action" style={{ padding: '16px 18px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(ci.item.id)}
                            className="billing-cart-remove-btn"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '8px',
                              borderRadius: 'var(--radius-sm)',
                              transition: 'all 0.12s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-danger)';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                            title="Remove item from bill"
                          >
                            <Trash2 size={20} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div
                className="billing-cart-empty-box"
                style={{
                  padding: '54px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <ShoppingCart size={52} style={{ opacity: 0.3 }} />
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-main)' }}>Bill Cart is Empty</div>
                <p style={{ fontSize: '0.9rem', maxWidth: '360px', margin: 0, lineHeight: 1.45 }}>
                  Scan product barcode with scanner or search product above to add items to the customer bill.
                </p>
              </div>
            )}
          </div>

          {/* Active Bill Cart Summary Row / Footer (Total Price, Discount % Row & Net Payable) */}
          {cart.length > 0 && (
            <div
              className="billing-cart-summary-footer"
              style={{
                padding: '16px 26px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div className="billing-cart-summary-counts" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.86rem', fontWeight: 700 }}>
                <span>{cartTotalItems} {cartTotalItems === 1 ? 'item' : 'items'}</span>
                <span>•</span>
                <span>{cartTotalUnits} total units</span>
              </div>

              {/* Totals & Discount % on Total Price */}
              <div className="billing-cart-summary-totals-wrap" style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
                {/* Total Price */}
                <div className="billing-cart-summary-subtotal-box" style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>
                    Total Price
                  </span>
                  <div className="billing-cart-summary-subtotal-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    ₹{cartSubtotal.toFixed(2)}
                  </div>
                </div>

                {/* Row for Discount (% or ₹ Rupee on Total Price) */}
                <div className="billing-cart-summary-discount-box" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '18px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#F59E0B', textTransform: 'uppercase', display: 'block', fontWeight: 800 }}>
                      Discount on Total
                    </span>
                    {/* Mode Toggle: % vs ₹ */}
                    <div
                      style={{
                        display: 'inline-flex',
                        background: 'var(--bg-main)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '1px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        style={{
                          padding: '1px 7px',
                          borderRadius: 'var(--radius-pill)',
                          border: 'none',
                          background: discountType === 'percent' ? '#F59E0B' : 'transparent',
                          color: discountType === 'percent' ? '#000000' : 'var(--text-muted)',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('rupee')}
                        style={{
                          padding: '1px 7px',
                          borderRadius: 'var(--radius-pill)',
                          border: 'none',
                          background: discountType === 'rupee' ? '#F59E0B' : 'transparent',
                          color: discountType === 'rupee' ? '#000000' : 'var(--text-muted)',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        ₹
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'var(--bg-surface)',
                        border: cartDiscount > 0 ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: discountType === 'rupee' ? '0 8px 0 8px' : '0 8px 0 4px',
                        height: '36px',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      {discountType === 'rupee' ? (
                        <>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: cartDiscount > 0 ? '#F59E0B' : 'var(--text-muted)', marginRight: '2px' }}>
                            ₹
                          </span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={cartSubtotal}
                            value={discountAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setDiscountAmount('');
                              } else {
                                const num = parseFloat(val);
                                if (!isNaN(num)) {
                                  // Cannot exceed cart subtotal
                                  setDiscountAmount(String(Math.max(0, Math.min(cartSubtotal, num))));
                                }
                              }
                            }}
                            placeholder="0"
                            className="billing-cart-discount-input"
                            style={{
                              width: '74px',
                              textAlign: 'center',
                              height: '100%',
                              border: 'none',
                              background: 'transparent',
                              color: cartDiscount > 0 ? '#F59E0B' : 'var(--text-main)',
                              fontWeight: 800,
                              fontSize: '1rem',
                              outline: 'none',
                            }}
                            title={`Enter discount amount in ₹ (Max: ₹${cartSubtotal.toFixed(2)})`}
                          />
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={discountPercent}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setDiscountPercent('');
                              } else {
                                const num = parseFloat(val);
                                if (!isNaN(num)) {
                                  setDiscountPercent(String(Math.max(0, Math.min(100, num))));
                                }
                              }
                            }}
                            placeholder="0"
                            className="billing-cart-discount-input"
                            style={{
                              width: '56px',
                              textAlign: 'center',
                              height: '100%',
                              border: 'none',
                              background: 'transparent',
                              color: cartDiscount > 0 ? '#F59E0B' : 'var(--text-main)',
                              fontWeight: 800,
                              fontSize: '1rem',
                              outline: 'none',
                            }}
                            title="Enter discount percentage for total bill (0 - 100%)"
                          />
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: cartDiscount > 0 ? '#F59E0B' : 'var(--text-muted)' }}>
                            %
                          </span>
                        </>
                      )}
                    </div>

                    {cartDiscount > 0 && (
                      <span
                        className="billing-cart-discount-tag"
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          color: '#F59E0B',
                          background: 'rgba(245, 158, 11, 0.15)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        -₹{cartDiscount.toFixed(2)} off
                        {discountType === 'rupee' && cartSubtotal > 0 && (
                          <span style={{ fontSize: '0.72rem', opacity: 0.85, marginLeft: '4px' }}>
                            ({((cartDiscount / cartSubtotal) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Net Payable Amount */}
                <div className="billing-cart-summary-net-box" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '18px', textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: '#10B981', textTransform: 'uppercase', display: 'block', fontWeight: 800 }}>
                    Net Payable
                  </span>
                  <div className="billing-cart-summary-net-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
                    ₹{cartGrandTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. BOTTOM: INLINE QUICK CHECKOUT STATION */}
        <div
          className="billing-checkout-card"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.22)',
          }}
        >
          {/* Header */}
          <div className="billing-checkout-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="billing-checkout-header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Receipt size={22} style={{ color: 'var(--brand-primary)' }} />
              <h2 className="billing-checkout-header-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Fast Checkout &amp; Customer Billing
              </h2>
            </div>
            <div className="billing-checkout-header-right" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  searchInputRef.current?.focus();
                }}
                className="btn btn-secondary btn-sm billing-checkout-scroll-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-main)',
                }}
                title="Scroll back up to product catalog and barcode search"
              >
                <ArrowUp size={14} />
                <span>Scroll Up to Search</span>
              </button>
              <div className="billing-checkout-cart-status" style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {cart.length > 0 ? (
                  <span style={{ color: '#10B981', fontWeight: 700 }}>● {cartTotalUnits} units ready for billing</span>
                ) : (
                  <span>Add products to cart to complete sale</span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleInitiateCheckout} className="billing-checkout-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
            {/* Column 1: Customer Information */}
            <div className="billing-checkout-col billing-customer-col" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. Customer Details
              </div>

              {/* Phone Number (Required) with Live Lookup */}
              <div className="billing-customer-input-wrap" style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>
                  Mobile Phone Number <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone
                    size={16}
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    required
                    maxLength={10}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile (e.g. 9876543210)"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '40px', height: '44px', fontSize: '0.94rem', fontWeight: 600 }}
                  />
                </div>

                {/* Returning Customer Autocomplete Dropdown */}
                {showCustomerDropdown && customerSuggestions.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      zIndex: 110,
                      background: 'var(--bg-surface-solid)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.4)',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      padding: '4px',
                    }}
                  >
                    {customerSuggestions.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => handleSelectCustomerSuggestion(cust)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.84rem',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {cust.name ? `${cust.name} (${cust.phone})` : cust.phone}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 700 }}>
                          {cust.total_purchases_count} visits
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* VIP Status Badge under Phone Input */}
                {customerHasVipCard ? (
                  <div
                    className="billing-vip-status-badge"
                    style={{
                      marginTop: '6px',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#F59E0B', fontWeight: 800 }}>
                      <Crown size={14} />
                      <span>VIP Member: {matchedCustomer.vip_card_uid}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#10B981' }}>
                      ₹{parseFloat(matchedCustomer.vip_card_balance || 0).toFixed(2)} Credits
                    </div>
                  </div>
                ) : customerPhone.replace(/\D/g, '').length === 10 ? (
                  <div style={{ marginTop: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Regular Customer (No VIP Card assigned)
                  </div>
                ) : null}
              </div>

              {/* Customer Name (Optional) */}
              <div className="billing-customer-name-wrap">
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>
                  Customer Name <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>(Optional)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={16}
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '40px', height: '44px', fontSize: '0.94rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Payment Mode & Cash Calculator */}
            <div className="billing-checkout-col billing-payment-col" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. Payment Method
              </div>

              {/* Payment Mode Buttons: Cash, UPI / QR, Split, VIP Card */}
              <div className="billing-payment-methods-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote, enabled: true },
                  { id: 'upi', label: 'UPI / QR', icon: QrCode, enabled: true },
                  { id: 'split', label: 'Split (Cash+UPI)', icon: Split, enabled: true },
                  { id: 'partial', label: 'Partial / Due', icon: Receipt, enabled: true },
                  { id: 'vip_card', label: 'VIP Card', icon: Crown, enabled: customerHasVipCard },
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSelected = paymentMethod === pm.id;
                  const isDisabled = !pm.enabled;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectPaymentMethod(pm.id)}
                      title={
                        pm.id === 'vip_card'
                          ? customerHasVipCard
                            ? `Pay with VIP card credits (${vipSettings.discountPercent || 5}% Discount auto-applied)`
                            : 'Enter mobile number of a customer with an active VIP card to unlock'
                          : pm.id === 'partial'
                          ? 'Customer pays part now (Cash/UPI/Card) and owes the remaining balance (Khata / Due)'
                          : undefined
                      }
                      style={{
                        padding: '12px 10px',
                        borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${
                          isSelected
                            ? pm.id === 'vip_card'
                              ? '#F59E0B'
                              : pm.id === 'split'
                              ? '#38BDF8'
                              : pm.id === 'partial'
                              ? '#EC4899'
                              : 'var(--brand-primary)'
                            : 'var(--border-subtle)'
                        }`,
                        background: isSelected
                          ? pm.id === 'vip_card'
                            ? 'rgba(245, 158, 11, 0.18)'
                            : pm.id === 'split'
                            ? 'rgba(56, 189, 248, 0.18)'
                            : pm.id === 'partial'
                            ? 'rgba(236, 72, 153, 0.18)'
                            : 'rgba(218, 41, 28, 0.15)'
                          : 'var(--bg-main)',
                        color: isSelected
                          ? pm.id === 'vip_card'
                            ? '#F59E0B'
                            : pm.id === 'split'
                            ? '#38BDF8'
                            : pm.id === 'partial'
                            ? '#EC4899'
                            : 'var(--brand-primary)'
                          : isDisabled ? 'var(--text-muted)' : 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: isSelected ? 800 : 600,
                        fontSize: '0.88rem',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.45 : 1,
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Icon size={17} />
                      <span>{pm.label}</span>
                      {pm.id === 'vip_card' && customerHasVipCard && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 900,
                            padding: '1px 5px',
                            borderRadius: 'var(--radius-pill)',
                            background: '#F59E0B',
                            color: '#000000',
                          }}
                        >
                          -{vipSettings.discountPercent || 5}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* VIP Card Active Indicator in Column 2 */}
              {paymentMethod === 'vip_card' && matchedCustomer && (
                <div
                  className="billing-vip-card-panel"
                  style={{
                    marginTop: '4px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#F59E0B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        flexShrink: 0,
                      }}
                    >
                      <Crown size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        VIP Card: <span style={{ fontFamily: 'monospace', color: '#F59E0B' }}>{vipCardScannedUid || matchedCustomer.vip_card_uid}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 700, marginTop: '2px' }}>
                        Balance: ₹{parseFloat(matchedCustomer.vip_card_balance || 0).toFixed(2)} Credits &bull; {vipSettings.discountPercent || 5}% Discount Active
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsVipTapModalOpen(true);
                      playVipReadySound();
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#F59E0B',
                      borderColor: 'rgba(245, 158, 11, 0.4)',
                      padding: '7px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                    }}
                    title="Tap or test RFID Card"
                  >
                    <Radio size={13} className="pulse" />
                    <span>Tap / Scan Card</span>
                  </button>
                </div>
              )}

              {/* Cash Tendered & Change Return Calculator */}
              {paymentMethod === 'cash' && (
                <div className="billing-cash-calculator-row" style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Cash Received (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={cartGrandTotal.toFixed(2)}
                      className="form-input"
                      style={{ width: '100%', boxSizing: 'border-box', fontWeight: 800, height: '42px', fontSize: '0.94rem' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Change to Return
                    </label>
                    <div
                      style={{
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10B981',
                        fontWeight: 900,
                        fontSize: '1.1rem',
                      }}
                    >
                      ₹{Math.max(0, (parseFloat(amountPaid || 0) - cartGrandTotal)).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Split Payment (Cash + UPI) Interface */}
              {paymentMethod === 'split' && (
                <div
                  className="billing-split-panel"
                  style={{
                    marginTop: '4px',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(56, 189, 248, 0.06)',
                    border: '1px solid rgba(56, 189, 248, 0.28)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    animation: 'fadeIn 0.15s ease',
                  }}
                >
                  {/* Top Header & Quick Presets */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: 'rgba(56, 189, 248, 0.2)',
                          color: '#38BDF8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Split size={15} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          Split Bill (Total: ₹{cartGrandTotal.toFixed(2)})
                        </div>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                          Customer pays part in Cash and remaining via UPI
                        </div>
                      </div>
                    </div>

                    {/* Quick Split Presets */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const half = (cartGrandTotal / 2).toFixed(2);
                          setSplitCashAmount(half);
                          setSplitUpiAmount((cartGrandTotal - parseFloat(half)).toFixed(2));
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.14)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38BDF8',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Split bill 50% in Cash and 50% in UPI"
                      >
                        50 / 50 Split
                      </button>

                      {[100, 200, 500, 1000].map((presetAmt) => {
                        if (presetAmt >= cartGrandTotal) return null;
                        return (
                          <button
                            key={presetAmt}
                            type="button"
                            onClick={() => {
                              setSplitCashAmount(presetAmt.toFixed(2));
                              setSplitUpiAmount((cartGrandTotal - presetAmt).toFixed(2));
                            }}
                            style={{
                              padding: '4px 7px',
                              borderRadius: '6px',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ₹{presetAmt} Cash
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Two Synchronized Input Cards: Cash & UPI */}
                  <div className="billing-split-inputs-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Cash Portion */}
                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 800, color: '#10B981', marginBottom: '6px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Banknote size={14} />
                          Cash Portion (₹)
                        </span>
                        {splitCashAmount && cartGrandTotal > 0 && (
                          <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                            {Math.min(100, ((parseFloat(splitCashAmount) / cartGrandTotal) * 100)).toFixed(0)}%
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={cartGrandTotal}
                        value={splitCashAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSplitCashAmount(val);
                          const num = parseFloat(val);
                          if (!isNaN(num) && num >= 0 && num <= cartGrandTotal) {
                            setSplitUpiAmount((cartGrandTotal - num).toFixed(2));
                          } else if (val === '') {
                            setSplitUpiAmount('');
                          }
                        }}
                        placeholder="0.00"
                        className="form-input"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontWeight: 800,
                          fontSize: '1rem',
                          height: '38px',
                          color: '#10B981',
                        }}
                      />
                    </div>

                    {/* UPI Portion */}
                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 800, color: '#38BDF8', marginBottom: '6px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <QrCode size={14} />
                          UPI Portion (₹)
                        </span>
                        {splitUpiAmount && cartGrandTotal > 0 && (
                          <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                            {Math.min(100, ((parseFloat(splitUpiAmount) / cartGrandTotal) * 100)).toFixed(0)}%
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={cartGrandTotal}
                        value={splitUpiAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSplitUpiAmount(val);
                          const num = parseFloat(val);
                          if (!isNaN(num) && num >= 0 && num <= cartGrandTotal) {
                            setSplitCashAmount((cartGrandTotal - num).toFixed(2));
                          } else if (val === '') {
                            setSplitCashAmount('');
                          }
                        }}
                        placeholder="0.00"
                        className="form-input"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontWeight: 800,
                          fontSize: '1rem',
                          height: '38px',
                          color: '#38BDF8',
                        }}
                      />
                    </div>
                  </div>

                  {/* Real-Time Balance Status Indicator */}
                  {(() => {
                    const cVal = parseFloat(splitCashAmount) || 0;
                    const uVal = parseFloat(splitUpiAmount) || 0;
                    const sum = (cVal + uVal).toFixed(2);
                    const diff = (cartGrandTotal - parseFloat(sum)).toFixed(2);
                    const isBalanced = Math.abs(parseFloat(diff)) < 0.05 && (cVal > 0 || uVal > 0);

                    if (isBalanced) {
                      return (
                        <div
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#10B981',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={14} />
                            <span>Split Balanced: ₹{cVal.toFixed(2)} (Cash) + ₹{uVal.toFixed(2)} (UPI)</span>
                          </span>
                          <strong>₹{cartGrandTotal.toFixed(2)}</strong>
                        </div>
                      );
                    }

                    if (parseFloat(diff) > 0) {
                      return (
                        <div
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#F59E0B',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <AlertCircle size={14} />
                          <span>₹{diff} remaining to allocate to reach bill total of ₹{cartGrandTotal.toFixed(2)}</span>
                        </div>
                      );
                    }

                    if (parseFloat(diff) < 0) {
                      return (
                        <div
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#EF4444',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <AlertCircle size={14} />
                          <span>Split total exceeds bill by ₹{Math.abs(parseFloat(diff)).toFixed(2)}</span>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* Cash Tendered & Change Return for the Cash Share (Optional) */}
                  {parseFloat(splitCashAmount) > 0 && (
                    <div style={{ display: 'flex', gap: '10px', paddingTop: '4px', borderTop: '1px dashed rgba(56, 189, 248, 0.2)' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>
                          Physical Cash Tendered (Optional)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={splitCashReceived}
                          onChange={(e) => setSplitCashReceived(e.target.value)}
                          placeholder={splitCashAmount || '0.00'}
                          className="form-input"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            height: '34px',
                          }}
                        />
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>
                          Change to Return
                        </label>
                        <div
                          style={{
                            height: '34px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border-subtle)',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            color:
                              splitCashReceived && parseFloat(splitCashReceived) > (parseFloat(splitCashAmount) || 0)
                                ? '#10B981'
                                : 'var(--text-muted)',
                          }}
                        >
                          ₹
                          {splitCashReceived && parseFloat(splitCashReceived) > (parseFloat(splitCashAmount) || 0)
                            ? (parseFloat(splitCashReceived) - parseFloat(splitCashAmount)).toFixed(2)
                            : '0.00'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Partial Payment (Due / Khata) Interface */}
              {paymentMethod === 'partial' && (
                <div
                  className="billing-partial-panel"
                  style={{
                    marginTop: '4px',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(236, 72, 153, 0.06)',
                    border: '1px solid rgba(236, 72, 153, 0.28)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    animation: 'fadeIn 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: 'rgba(236, 72, 153, 0.2)',
                          color: '#EC4899',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Receipt size={15} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          Partial / Due Sale (Bill: ₹{cartGrandTotal.toFixed(2)})
                        </div>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                          Receive partial payment now and record remaining balance as customer due
                        </div>
                      </div>
                    </div>

                    {/* Quick percentage or full pay shortcuts */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setPartialAmountPaid('0')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(236, 72, 153, 0.12)',
                          border: '1px solid rgba(236, 72, 153, 0.28)',
                          color: '#EC4899',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ₹0 (Full Due)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartialAmountPaid((cartGrandTotal / 2).toFixed(2))}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(236, 72, 153, 0.12)',
                          border: '1px solid rgba(236, 72, 153, 0.28)',
                          color: '#EC4899',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        50% Paid
                      </button>
                    </div>
                  </div>

                  {/* Input Card: Paid Now & Auto-Calculated Due Balance */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(236, 72, 153, 0.35)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 800, color: '#EC4899', marginBottom: '6px' }}>
                        <span>Amount Paid Now (₹)</span>
                        {partialAmountPaid !== '' && cartGrandTotal > 0 && (
                          <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                            {Math.min(100, Math.max(0, ((parseFloat(partialAmountPaid) / cartGrandTotal) * 100))).toFixed(0)}%
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={cartGrandTotal}
                        value={partialAmountPaid}
                        onChange={(e) => setPartialAmountPaid(e.target.value)}
                        placeholder="0.00"
                        className="form-input"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontWeight: 800,
                          fontSize: '1rem',
                          height: '38px',
                          color: '#EC4899',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 800, color: '#F59E0B', marginBottom: '6px' }}>
                        <span>Balance Due / Khata (₹)</span>
                        <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Owed Later</span>
                      </label>
                      <div
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontWeight: 900,
                          fontSize: '1.05rem',
                          height: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(245, 158, 11, 0.08)',
                          color: '#F59E0B',
                        }}
                      >
                        ₹{Math.max(0, cartGrandTotal - (parseFloat(partialAmountPaid) || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Initial Payment Method Picker: ONLY shown when amount paid now is > 0 */}
                  {(parseFloat(partialAmountPaid) || 0) > 0 ? (
                    <div style={{ animation: 'fadeIn 0.15s ease' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>
                        Payment Method For Amount Paid Now (₹{(parseFloat(partialAmountPaid) || 0).toFixed(2)}):
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                          { id: 'cash', label: 'Cash', icon: Banknote },
                          { id: 'upi', label: 'UPI / QR', icon: QrCode },
                          { id: 'card', label: 'Card', icon: CreditCard },
                        ].map((m) => {
                          const Icon = m.icon;
                          const isMSelected = partialPaymentMethod === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setPartialPaymentMethod(m.id)}
                              style={{
                                flex: 1,
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${isMSelected ? '#EC4899' : 'var(--border-subtle)'}`,
                                background: isMSelected ? 'rgba(236, 72, 153, 0.18)' : 'var(--bg-surface)',
                                color: isMSelected ? '#EC4899' : 'var(--text-main)',
                                fontSize: '0.76rem',
                                fontWeight: isMSelected ? 800 : 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifySelf: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                              }}
                            >
                              <Icon size={13} />
                              <span>{m.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Clean notice when ₹0 is paid now */
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(236, 72, 153, 0.08)',
                        border: '1px dashed rgba(236, 72, 153, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.74rem',
                        color: '#EC4899',
                        fontWeight: 600,
                      }}
                    >
                      <CreditCard size={14} style={{ flexShrink: 0 }} />
                      <span>
                        <strong>₹0 Paid Upfront (100% Udhar / Khata):</strong> Payment method hidden because no cash or online payment is collected right now.
                      </span>
                    </div>
                  )}

                  {/* Summary Status Banner */}
                  {(() => {
                    const paid = parseFloat(partialAmountPaid) || 0;
                    const due = Math.max(0, cartGrandTotal - paid);
                    return (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: due > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          border: `1px solid ${due > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                          color: due > 0 ? '#F59E0B' : '#10B981',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertCircle size={14} />
                          <span>
                            {due > 0
                              ? (paid > 0
                                  ? `Collecting ₹${paid.toFixed(2)} via ${partialPaymentMethod.toUpperCase()} • ₹${due.toFixed(2)} will remain as customer balance due (Khata).`
                                  : `100% Khata (Udhar) • Full ₹${due.toFixed(2)} will be recorded as customer balance due.`)
                              : `Fully paid now: ₹${paid.toFixed(2)}`}
                          </span>
                        </span>
                        <strong>{due > 0 ? `DUE: ₹${due.toFixed(2)}` : 'CLEAR'}</strong>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Column 3: Order Summary & Checkout Action */}
            <div className="billing-checkout-col billing-totals-col" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                3. Total &amp; Finalize
              </div>

              {/* Total Price & Discount Input Card */}
              <div
                className="billing-checkout-summary-card"
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Total Price Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Total Price (Subtotal)
                  </span>
                  <span style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    ₹{cartSubtotal.toFixed(2)}
                  </span>
                </div>

                {/* Discount (% or ₹ on Total) Input Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px dashed var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={15} style={{ color: '#F59E0B' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#F59E0B' }}>
                      Discount:
                    </span>
                    {/* Mode Toggle: % vs ₹ */}
                    <div
                      style={{
                        display: 'inline-flex',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '1px',
                        border: '1px solid var(--border-subtle)',
                        marginLeft: '4px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        style={{
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-pill)',
                          border: 'none',
                          background: discountType === 'percent' ? '#F59E0B' : 'transparent',
                          color: discountType === 'percent' ? '#000000' : 'var(--text-muted)',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('rupee')}
                        style={{
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-pill)',
                          border: 'none',
                          background: discountType === 'rupee' ? '#F59E0B' : 'transparent',
                          color: discountType === 'rupee' ? '#000000' : 'var(--text-muted)',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        ₹
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'var(--bg-surface)',
                        border: cartDiscount > 0 ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: discountType === 'rupee' ? '0 6px 0 6px' : '0 6px 0 2px',
                        height: '32px',
                      }}
                    >
                      {discountType === 'rupee' ? (
                        <>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: cartDiscount > 0 ? '#F59E0B' : 'var(--text-muted)', marginRight: '2px' }}>
                            ₹
                          </span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max={cartSubtotal}
                            value={discountAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setDiscountAmount('');
                              } else {
                                const num = parseFloat(val);
                                if (!isNaN(num)) {
                                  setDiscountAmount(String(Math.max(0, Math.min(cartSubtotal, num))));
                                }
                              }
                            }}
                            placeholder="0"
                            style={{
                              width: '60px',
                              textAlign: 'center',
                              height: '100%',
                              border: 'none',
                              background: 'transparent',
                              color: cartDiscount > 0 ? '#F59E0B' : 'var(--text-main)',
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              outline: 'none',
                            }}
                            title={`Discount amount in ₹ (Max: ₹${cartSubtotal.toFixed(2)})`}
                          />
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={discountPercent}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setDiscountPercent('');
                              } else {
                                const num = parseFloat(val);
                                if (!isNaN(num)) {
                                  setDiscountPercent(String(Math.max(0, Math.min(100, num))));
                                }
                              }
                            }}
                            placeholder="0"
                            style={{
                              width: '46px',
                              textAlign: 'center',
                              height: '100%',
                              border: 'none',
                              background: 'transparent',
                              color: cartDiscount > 0 ? '#F59E0B' : 'var(--text-main)',
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              outline: 'none',
                            }}
                          />
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: cartDiscount > 0 ? '#F59E0B' : 'var(--text-muted)' }}>
                            %
                          </span>
                        </>
                      )}
                    </div>

                    {cartDiscount > 0 && (
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#F59E0B', whiteSpace: 'nowrap' }}>
                        -₹{cartDiscount.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Discount Presets (Percentage or Rupee Presets) */}
                <div className="billing-discount-presets-row" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {discountType === 'rupee' ? (
                    <>
                      {['0', '50', '100', '200', '500'].map((amt) => {
                        const numericAmt = parseFloat(amt);
                        const isApplicable = numericAmt <= cartSubtotal;
                        return (
                          <button
                            key={amt}
                            type="button"
                            disabled={!isApplicable && numericAmt > 0}
                            onClick={() => setDiscountAmount(String(Math.min(cartSubtotal, numericAmt)))}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-pill)',
                              border: String(discountAmount) === amt ? '1px solid #F59E0B' : '1px solid var(--border-subtle)',
                              background: String(discountAmount) === amt ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                              color: String(discountAmount) === amt ? '#F59E0B' : isApplicable ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: isApplicable || numericAmt === 0 ? 'pointer' : 'not-allowed',
                              transition: 'all 0.1s ease',
                              opacity: isApplicable || numericAmt === 0 ? 1 : 0.4,
                            }}
                            title={!isApplicable && numericAmt > 0 ? `Exceeds bill subtotal of ₹${cartSubtotal.toFixed(2)}` : undefined}
                          >
                            ₹{amt}
                          </button>
                        );
                      })}
                      {cartSubtotal > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            // Round off: reduce by change paise to round bill down to nearest integer
                            const roundedPayable = Math.floor(cartSubtotal);
                            const roundDiscount = Number((cartSubtotal - roundedPayable).toFixed(2));
                            if (roundDiscount > 0) {
                              setDiscountAmount(String(roundDiscount));
                            }
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-pill)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            background: 'rgba(56, 189, 248, 0.12)',
                            color: '#38BDF8',
                            fontSize: '0.70rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Round off bill by discounting decimal change"
                        >
                          Round Off
                        </button>
                      )}
                    </>
                  ) : (
                    ['0', '5', '10', '15', '20'].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(pct)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          border: String(discountPercent) === pct ? '1px solid #F59E0B' : '1px solid var(--border-subtle)',
                          background: String(discountPercent) === pct ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                          color: String(discountPercent) === pct ? '#F59E0B' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        {pct}%
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Internal Sale Remark (Optional - Internal Only, Not on Bill) */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <FileText size={13} color="#38BDF8" style={{ flexShrink: 0 }} />
                    <span>Internal Sale Remark</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '1px 6px', borderRadius: '4px' }}>Internal Only</span>
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'none', fontWeight: 500 }}>
                    (Not on customer bill)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved discount by manager, VIP client, gift box requested..."
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Payable Highlight Banner */}
              <div
                className="billing-net-payable-banner"
                style={{
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Net Amount Payable
                  </span>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {cartTotalItems} items ({cartTotalUnits} units)
                  </div>
                </div>
                <div className="billing-net-payable-value" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#10B981' }}>
                  ₹{cartGrandTotal.toFixed(2)}
                </div>
              </div>

              {/* Big Complete Sale Button */}
              <button
                type="submit"
                disabled={isSubmitting || cart.length === 0}
                className="btn btn-primary billing-complete-sale-btn"
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  fontWeight: 900,
                  fontSize: '1.05rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: cart.length > 0 ? 'linear-gradient(135deg, #10B981, #059669)' : undefined,
                  boxShadow: cart.length > 0 ? '0 6px 24px rgba(16, 185, 129, 0.4)' : undefined,
                  opacity: (isSubmitting || cart.length === 0) ? 0.4 : 1,
                  cursor: (isSubmitting || cart.length === 0) ? 'not-allowed' : 'pointer',
                }}
              >
                <CreditCard size={20} />
                <span>{isSubmitting ? 'Processing Sale...' : `Complete Sale & Print Receipt`}</span>
              </button>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Press <strong>Enter</strong> in phone field or <strong>Alt + X</strong> to finalize
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ACTIVE SHIFT CASHIER BILLING REGISTER (FULL WIDTH, 5 ROWS SCROLLABLE) */}
      {/* ================================================================== */}
      <div
        className="billing-register-card"
        style={{
          width: '100%',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          marginTop: '6px',
        }}
      >
        {/* Register Section Header */}
        <div
          className="billing-register-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 100%)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {/* Left Title & Cashier Info */}
          <div className="billing-register-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div
              className="billing-register-icon-box"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <Receipt size={18} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="billing-register-title" style={{ fontWeight: 900, fontSize: '0.98rem', color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                  Current Shift Billing Register
                </span>
                {activeShift ? (
                  <span
                    className="billing-register-shift-badge"
                    style={{
                      background: 'rgba(16, 185, 129, 0.14)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#10B981',
                      borderRadius: 'var(--radius-full)',
                      padding: '2px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    Shift #{activeShift.shift_number}
                  </span>
                ) : (
                  <span
                    className="billing-register-shift-badge"
                    style={{
                      background: 'rgba(239, 68, 68, 0.14)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#EF4444',
                      borderRadius: 'var(--radius-full)',
                      padding: '2px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    No Active Shift
                  </span>
                )}
              </div>
              <div className="billing-register-submeta" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Cashier: <strong>{activeShift?.cashier_name || currentUser?.name || 'Active Cashier'}</strong>
                {activeShift?.opened_at && (
                  <span> · Shift Started: {new Date(activeShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Summary Metrics & Controls */}
          <div className="billing-register-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              className="billing-register-metrics-box"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.80rem',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Bills Done:</span>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{shiftBillingOrders.length}</strong>
              <span style={{ color: 'var(--border-subtle)' }}>|</span>
              <span style={{ color: 'var(--text-muted)' }}>Total Billed:</span>
              <strong style={{ color: '#10B981', fontWeight: 900 }}>
                ₹{shiftBillingOrders.reduce((acc, o) => acc + (parseFloat(o.total_amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>

            <TimeRangeFilter
              compact={true}
              filterState={shiftBillsTimeFilter}
              onFilterChange={setShiftBillsTimeFilter}
            />

            <button
              type="button"
              onClick={loadShiftBillingOrders}
              disabled={loadingShiftOrders}
              title="Refresh Shift Invoices"
              className="btn btn-secondary billing-register-refresh-btn"
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <RefreshCw size={13} style={{ animation: loadingShiftOrders ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Scrollable Table Container (Full Width, Displays exactly 5 rows then scrolls) */}
        <div
          className="billing-register-table-wrap"
          style={{
            width: '100%',
            maxHeight: '278px',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          <table className="billing-register-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                background: 'var(--bg-surface-solid, #181A20)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <tr style={{ color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 800 }}>Invoice & Time</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 800 }}>Customer (Phone / Name)</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 800 }}>Items</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 800 }}>Payment Method</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 800 }}>Total Paid</th>
                <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 800 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingShiftOrders && shiftBillingOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                    <div>Loading shift billing records...</div>
                  </td>
                </tr>
              ) : !activeShift ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      No Cash Register Shift Active
                    </div>
                    <div style={{ fontSize: '0.78rem', marginBottom: '12px' }}>
                      Start your daily register shift to automatically log and review all bills processed at this counter.
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenRegisterModal}
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 800 }}
                    >
                      Open Register Shift
                    </button>
                  </td>
                </tr>
              ) : shiftBillingOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                      No bills processed yet in this shift
                    </div>
                    <div style={{ fontSize: '0.78rem' }}>
                      Every checkout completed by this cashier during Shift #{activeShift.shift_number} will appear here.
                    </div>
                  </td>
                </tr>
              ) : filterLogsByTimeRange(shiftBillingOrders, shiftBillsTimeFilter, ['created_at']).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                      No bills found matching selected time range
                    </div>
                    <div style={{ fontSize: '0.78rem' }}>
                      Adjust the time window or click Clear on the time filter.
                    </div>
                  </td>
                </tr>
              ) : (
                filterLogsByTimeRange(shiftBillingOrders, shiftBillsTimeFilter, ['created_at']).map((order) => {
                  const isReturn = Boolean(
                    order.is_return ||
                    (order.invoice_number && order.invoice_number.startsWith('RET-')) ||
                    order.return_reference ||
                    order.status === 'refunded'
                  );
                  const payMethod = (order.payment_method || 'cash').toLowerCase();
                  const totalFormatted = parseFloat(order.total_amount || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                  const orderTimeStr = order.created_at
                    ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                    : '-';
                  const itemsCount = order.items?.length || 0;
                  const itemsPreview = order.items && order.items.length > 0
                    ? order.items.slice(0, 2).map((i) => `${i.item_name} (x${i.quantity})`).join(', ') + (order.items.length > 2 ? '...' : '')
                    : '';

                  return (
                    <tr
                      key={order.id}
                      className="billing-register-row"
                      style={{
                        height: '48px',
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Invoice & Time */}
                      <td style={{ padding: '8px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: isReturn ? '#EF4444' : 'var(--text-primary)' }}>
                            {order.invoice_number}
                          </span>
                          {isReturn && (
                            <span
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.16)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                letterSpacing: '0.5px',
                              }}
                            >
                              RETURN
                            </span>
                          )}
                        </div>
                        {order.return_reference && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Ref: #{order.return_reference}
                          </div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {orderTimeStr}
                        </div>
                      </td>

                      {/* Customer Phone & Optional Name */}
                      <td style={{ padding: '8px 16px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={12} color="var(--text-muted)" />
                          <span>{order.customer_phone || '-'}</span>
                        </div>
                        {(order.customer_name || order.customer_display_name) && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {order.customer_name || order.customer_display_name}
                          </div>
                        )}
                        {order.notes && (
                          <div
                            style={{
                              marginTop: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              color: '#38BDF8',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              maxWidth: '180px',
                            }}
                            title={`Internal Remark: ${order.notes}`}
                          >
                            <FileText size={11} color="#38BDF8" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {order.notes}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Items Summary */}
                      <td style={{ padding: '8px 16px' }}>
                        <span
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}
                        </span>
                        {itemsPreview && (
                          <div
                            style={{
                              fontSize: '0.71rem',
                              color: 'var(--text-muted)',
                              marginTop: '2px',
                              maxWidth: '220px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={order.items.map((i) => `${i.item_name} x${i.quantity}`).join('\n')}
                          >
                            {itemsPreview}
                          </div>
                        )}
                      </td>

                      {/* Payment Method Badge */}
                      <td style={{ padding: '8px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {payMethod === 'cash' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#10B981',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                              }}
                            >
                              <Banknote size={12} /> Cash
                            </span>
                          )}
                          {payMethod === 'upi' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(139, 92, 246, 0.12)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                color: '#8B5CF6',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                              }}
                            >
                              <QrCode size={12} /> UPI / QR
                            </span>
                          )}
                          {payMethod === 'card' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: '#3B82F6',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                              }}
                            >
                              <CreditCard size={12} /> Card
                            </span>
                          )}
                          {payMethod === 'split' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: '#F59E0B',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.73rem',
                                fontWeight: 800,
                              }}
                            >
                              <Split size={12} /> Split (Cash ₹{parseFloat(order.split_cash_amount || 0).toFixed(0)} + UPI ₹{parseFloat(order.split_upi_amount || 0).toFixed(0)})
                            </span>
                          )}
                          {payMethod === 'vip_card' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(234, 179, 8, 0.12)',
                                border: '1px solid rgba(234, 179, 8, 0.3)',
                                color: '#EAB308',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                              }}
                            >
                              <Crown size={12} /> VIP Card
                            </span>
                          )}
                          {payMethod === 'other' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(107, 114, 128, 0.12)',
                                border: '1px solid rgba(107, 114, 128, 0.3)',
                                color: 'var(--text-muted)',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                              }}
                            >
                              Other
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Paid */}
                      <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 900, color: isReturn ? '#EF4444' : '#10B981', fontSize: '0.90rem' }}>
                          {isReturn ? `-₹${totalFormatted}` : `₹${totalFormatted}`}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {!isReturn && order.is_editable !== false ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEditPaymentModal(order)}
                              title="Modify Items or Payment Method"
                              style={{
                                padding: '5px 10px',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: '#3B82F6',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                              }}
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                          ) : (
                            <span
                              title="Shift closed: This bill is finalized and permanently locked/immutable."
                              style={{
                                padding: '5px 8px',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(107, 114, 128, 0.14)',
                                border: '1px solid rgba(107, 114, 128, 0.25)',
                                color: 'var(--text-muted)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'not-allowed',
                              }}
                            >
                              <Lock size={11} />
                              <span>Locked</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setCompletedOrder(order);
                              setIsReceiptOpen(true);
                            }}
                            title="Reprint Receipt"
                            style={{
                              padding: '5px 10px',
                              borderRadius: 'var(--radius-md)',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}
                          >
                            <Printer size={12} />
                            <span>Receipt</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SALE CONFIRMATION MODAL */}
      {isConfirmSaleModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => setIsConfirmSaleModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--bg-surface)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface-solid)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Confirm Sale &amp; Complete Checkout
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Verify customer details and order total before finalizing
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsConfirmSaleModalOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%' }}
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Customer & Branch Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Customer
                  </span>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-main)', marginTop: '2px' }}>
                    {customerName.trim() || 'Walk-in Customer'}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--brand-primary)', fontWeight: 700, marginTop: '2px' }}>
                    {customerPhone}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Payment &amp; Branch
                  </span>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: paymentMethod === 'vip_card' ? '#F59E0B' : 'var(--text-main)', marginTop: '2px', textTransform: 'uppercase' }}>
                    Mode: {paymentMethod === 'vip_card' ? 'VIP RFID Card' : paymentMethod === 'split' ? 'SPLIT (CASH + UPI)' : paymentMethod.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {activeStore?.name || 'Branch'}
                  </div>
                  {paymentMethod === 'vip_card' && (
                    <div style={{ fontSize: '0.74rem', color: '#F59E0B', fontWeight: 700, marginTop: '2px', fontFamily: 'monospace' }}>
                      Card UID: {vipCardScannedUid || matchedCustomer?.vip_card_uid}
                    </div>
                  )}
                  {paymentMethod === 'split' && (
                    <div style={{ fontSize: '0.76rem', color: '#38BDF8', fontWeight: 700, marginTop: '2px' }}>
                      Cash: ₹{parseFloat(splitCashAmount || 0).toFixed(2)} | UPI: ₹{parseFloat(splitUpiAmount || 0).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Summary Table */}
              <div
                style={{
                  background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Price</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((ci) => (
                      <tr key={ci.item.id} style={{ borderBottom: '1px dotted var(--border-subtle)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-main)', fontWeight: 600 }}>
                          {ci.item.name}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>
                          {ci.quantity}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          ₹{parseFloat(ci.unit_price || ci.item.selling_price).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#10B981' }}>
                          ₹{ci.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Grand Total Highlight */}
              <div
                style={{
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Total Price (Subtotal):</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>₹{cartSubtotal.toFixed(2)}</span>
                </div>

                {cartDiscount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem', color: '#F59E0B' }}>
                    <span style={{ fontWeight: 700 }}>
                      Discount {discountType === 'rupee' ? `(Flat ₹${parseFloat(discountAmount || cartDiscount).toFixed(2)})` : `(${parseFloat(discountPercent)}%)`}:
                    </span>
                    <span style={{ fontWeight: 800 }}>-₹{cartDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px dashed rgba(16, 185, 129, 0.3)',
                    paddingTop: '8px',
                    marginTop: '2px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Total Payable Amount ({cartTotalItems} items / {cartTotalUnits} units)
                    </div>
                    {paymentMethod === 'cash' && amountPaid && parseFloat(amountPaid) > cartGrandTotal && (
                      <div style={{ fontSize: '0.76rem', color: '#10B981', fontWeight: 700, marginTop: '2px' }}>
                        Cash Received: ₹{parseFloat(amountPaid).toFixed(2)} | Change: ₹{(parseFloat(amountPaid) - cartGrandTotal).toFixed(2)}
                      </div>
                    )}
                    {paymentMethod === 'split' && (
                      <div style={{ fontSize: '0.76rem', color: '#38BDF8', fontWeight: 700, marginTop: '2px' }}>
                        Split: Cash ₹{parseFloat(splitCashAmount || 0).toFixed(2)} + UPI ₹{parseFloat(splitUpiAmount || 0).toFixed(2)}
                        {splitCashReceived && parseFloat(splitCashReceived) > (parseFloat(splitCashAmount) || 0) && (
                          <span style={{ color: '#10B981', marginLeft: '6px' }}>
                            (Cash Given: ₹{parseFloat(splitCashReceived).toFixed(2)} | Change: ₹{(parseFloat(splitCashReceived) - parseFloat(splitCashAmount)).toFixed(2)})
                          </span>
                        )}
                      </div>
                    )}
                    {paymentMethod === 'partial' && (
                      <div style={{ fontSize: '0.76rem', color: '#EC4899', fontWeight: 700, marginTop: '2px' }}>
                        {(parseFloat(partialAmountPaid) || 0) > 0 ? (
                          <>Partial: Paying ₹{parseFloat(partialAmountPaid || 0).toFixed(2)} via {(partialPaymentMethod || 'cash').toUpperCase()} | Balance Due: ₹{Math.max(0, cartGrandTotal - (parseFloat(partialAmountPaid) || 0)).toFixed(2)}</>
                        ) : (
                          <>100% Khata (Udhar): ₹0 Paid Now | Balance Due: ₹{cartGrandTotal.toFixed(2)}</>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10B981' }}>
                    ₹{cartGrandTotal.toFixed(2)}
                  </div>
                </div>

                {/* Optional Internal Sale Remark in Confirmation Modal */}
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <FileText size={13} color="#38BDF8" style={{ flexShrink: 0 }} />
                      <span>Internal Sale Remark</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '1px 6px', borderRadius: '4px' }}>Internal Only</span>
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      (Optional - Not printed on bill)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Add or edit remark before finalizing sale..."
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsConfirmSaleModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px', fontSize: '0.9rem', fontWeight: 700 }}
                >
                  Cancel / Edit
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCompleteCheckout}
                  className="btn btn-primary"
                  title="Press Alt + C to finalize sale"
                  style={{
                    padding: '10px 24px',
                    fontSize: '0.94rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{isSubmitting ? 'Finalizing Sale...' : 'Confirm & Complete Sale'}</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Alt + C
                  </span>
                </button>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
                Press <strong>Alt + C</strong> to confirm sale or <strong>Esc</strong> to cancel
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SIZE IMAGE LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '24px',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute',
                top: '-46px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                borderRadius: 'var(--radius-pill)',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
              title="Close image view (Esc)"
            >
              <X size={20} />
            </button>

            {/* High-Res Image Display */}
            <div
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#07090E',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxHeight: '76vh',
                maxWidth: '85vw',
              }}
            >
              <img
                src={lightboxImage.src}
                alt={lightboxImage.name || 'Product Image'}
                style={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '100%',
                  maxHeight: '76vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>

            {/* Image Details Banner */}
            {(lightboxImage.name || lightboxImage.uid) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(22, 27, 44, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {lightboxImage.name && (
                  <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem' }}>
                    {lightboxImage.name}
                  </span>
                )}
                {lightboxImage.uid && (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: 'var(--brand-primary)',
                      fontSize: '0.95rem',
                      background: 'rgba(218, 41, 28, 0.15)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    UID: {lightboxImage.uid}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIGITAL RECEIPT MODAL */}
      {isReceiptOpen && completedOrder && (
        <div
          className="receipt-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setIsReceiptOpen(false)}
        >
          <div
            className="receipt-modal-card"
            style={{
              width: '100%',
              maxWidth: '380px',
              maxHeight: '92vh',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid #D1D5DB',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.2s ease',
              background: '#FFFFFF',
              color: '#000000',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Printable Thermal Receipt Container matching exact 80mm Bixolon SRP-330 format (7.8cm - 8.0cm) */}
            <div
              id="printable-pos-receipt"
              style={{
                width: '100%',
                maxWidth: '360px',
                margin: '0 auto',
                padding: '12px 16px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                background: '#FFFFFF',
                color: '#000000',
                fontSize: '0.72rem',
                lineHeight: 1.35,
                boxSizing: 'border-box',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {(() => {
                const d = new Date(completedOrder.created_at);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const dateStr = `${day}-${month}-${year}`;
                const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                const totalUnits = completedOrder.items?.reduce((sum, it) => sum + it.quantity, 0) || completedOrder.items?.length || 1;
                const totalMrp = completedOrder.items?.reduce((sum, it) => {
                  const mrpVal = parseFloat(it.mrp || it.item_mrp || it.unit_mrp || it.unit_selling_price || 0);
                  return sum + mrpVal * it.quantity;
                }, 0) || parseFloat(completedOrder.subtotal || 0);
                const totalSavings = Math.max(0, totalMrp - parseFloat(completedOrder.total_amount || 0));
                const payMethod = (completedOrder.payment_method || 'cash').toLowerCase();
                const totalAmtFormatted = parseFloat(completedOrder.total_amount || 0).toFixed(2);
                const storeName = completedOrder.store_details?.name || completedOrder.store_name || activeStore?.name || '';
                const storeAddress = completedOrder.store_details?.address || completedOrder.store_address || activeStore?.address || '';
                const storePhone = completedOrder.store_details?.phone || completedOrder.store_phone || activeStore?.phone || '';
                const storeGst = completedOrder.store_details?.gst_number || completedOrder.store_gst_number || activeStore?.gst_number || '';

                const storeContactParts = [];
                if (storeAddress) storeContactParts.push(storeAddress);
                if (storePhone) storeContactParts.push(`M-${storePhone}`);
                const storeContactLine = storeContactParts.join('. ');

                const customerDisplayName = completedOrder.customer_name || (completedOrder.customer_display_name && !completedOrder.customer_display_name.startsWith('Customer (') ? completedOrder.customer_display_name : '') || 'Dear Customer';

                return (
                  <>
                    {/* Store Logo on Top & Tagline */}
                    <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                      <img
                        src="/assets/logo.svg"
                        alt="Wondersale Logo"
                        style={{ height: '62px', width: 'auto', objectFit: 'contain', margin: '0 auto 4px auto', display: 'block' }}
                      />
                      <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0, letterSpacing: '2px', color: '#DC2626', textTransform: 'uppercase' }}>
                        WONDER SALE
                      </h2>
                      <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '2px', color: '#000000', textTransform: 'uppercase', marginTop: '2px' }}>
                        FOR BETTER NATION
                      </div>
                    </div>

                    {/* Store Address & Contact */}
                    {storeContactLine ? (
                      <div style={{ textAlign: 'center', fontSize: '0.70rem', color: '#000000', paddingBottom: '6px', borderBottom: '1px dashed #000000', lineHeight: 1.35 }}>
                        <div>{storeContactLine}</div>
                      </div>
                    ) : (
                      <div style={{ borderBottom: '1px dashed #000000', marginBottom: '6px' }}></div>
                    )}

                    {/* Invoice Meta Grid */}
                    <div style={{ padding: '6px 0', borderBottom: '1px dashed #000000', fontSize: '0.70rem', color: '#000000' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div><strong>INVOICE NO. {completedOrder.invoice_number}</strong></div>
                          <div>Name :- {customerDisplayName}</div>
                          <div>Mobile No: {completedOrder.customer_phone || ''}</div>
                          <div>GST NO : {storeGst}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                          <div>Date:{dateStr}</div>
                          <div>Time:{timeStr}</div>
                          <div style={{ textTransform: 'capitalize' }}>
                            Payment mode- {
                              payMethod === 'vip_card'
                                ? `VIP Card (${completedOrder.vip_card_uid || 'RFID'})`
                                : payMethod === 'split'
                                ? 'Split (Cash + UPI)'
                                : payMethod === 'partial'
                                ? `Partial / Due (${(completedOrder.initial_payment_method || 'Cash').toUpperCase()})`
                                : (payMethod === 'card' ? 'Card' : (completedOrder.payment_method || 'Cash'))
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Line Items Table (Exact Physical Store Breakdown: Qty | MRP | Rate | Dis | Total) */}
                    <div style={{ padding: '4px 0', borderBottom: '1px dashed #000000' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px dashed #000000', color: '#000000', fontWeight: 800 }}>
                            <th style={{ width: '12%', textAlign: 'left', padding: '2px 0' }}>Qty</th>
                            <th style={{ width: '22%', textAlign: 'right', padding: '2px 0' }}>MRP</th>
                            <th style={{ width: '22%', textAlign: 'right', padding: '2px 0' }}>Rate</th>
                            <th style={{ width: '18%', textAlign: 'right', padding: '2px 0' }}>Dis</th>
                            <th style={{ width: '26%', textAlign: 'right', padding: '2px 0' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedOrder.items?.map((item, i) => {
                            const mrpVal = parseFloat(item.mrp || item.item_mrp || item.unit_mrp || item.unit_selling_price || 0);
                            const rateVal = parseFloat(item.unit_selling_price || 0);
                            const discountVal = Math.max(0, (mrpVal - rateVal) * item.quantity);
                            const lineTotal = parseFloat(item.total_price || (rateVal * item.quantity));
                            return (
                              <React.Fragment key={i}>
                                <tr>
                                  <td colSpan={5} style={{ paddingTop: '5px' }}>
                                    <div
                                      style={{
                                        fontWeight: 800,
                                        color: '#000000',
                                        textTransform: 'uppercase',
                                        lineHeight: 1.25,
                                        maxHeight: '2.5em',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        wordBreak: 'break-word',
                                      }}
                                      title={item.item_name}
                                    >
                                      {item.item_name}
                                    </div>
                                  </td>
                                </tr>
                                <tr style={{ borderBottom: i < completedOrder.items.length - 1 ? '1px dotted #E5E7EB' : 'none' }}>
                                  <td style={{ textAlign: 'left', padding: '2px 0 5px 0' }}>{item.quantity}</td>
                                  <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{mrpVal.toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{rateVal.toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{discountVal.toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', padding: '2px 0 5px 0', fontWeight: 800 }}>{lineTotal.toFixed(2)}</td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Side-by-Side: Payment Breakdown (Left) & Totals (Right) */}
                    <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.70rem', lineHeight: 1.45 }}>
                      {/* Left: Payment Mode Breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: '#000000' }}>
                        <div>Cash : {payMethod === 'cash' ? totalAmtFormatted : payMethod === 'split' ? parseFloat(completedOrder.split_cash_amount || 0).toFixed(2) : (payMethod === 'partial' && (completedOrder.initial_payment_method === 'cash' || !completedOrder.initial_payment_method)) ? parseFloat(completedOrder.amount_paid || 0).toFixed(2) : '0.00'}</div>
                        <div>Card : {payMethod === 'vip_card' ? `${totalAmtFormatted} (VIP)` : (payMethod === 'card' ? totalAmtFormatted : (payMethod === 'partial' && completedOrder.initial_payment_method === 'card') ? parseFloat(completedOrder.amount_paid || 0).toFixed(2) : '0')}</div>
                        <div>UPI - {payMethod === 'upi' || payMethod === 'qr' ? totalAmtFormatted : payMethod === 'split' ? parseFloat(completedOrder.split_upi_amount || 0).toFixed(2) : (payMethod === 'partial' && completedOrder.initial_payment_method === 'upi') ? parseFloat(completedOrder.amount_paid || 0).toFixed(2) : '0'}</div>
                        {(payMethod === 'partial' || parseFloat(completedOrder.balance_due || 0) > 0) && (
                          <div style={{ marginTop: '3px', paddingTop: '3px', borderTop: '1px dotted #000000', fontWeight: 900, color: '#DC2626' }}>
                            DUE / KHATA: ₹{parseFloat(completedOrder.balance_due || 0).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Right: Totals Breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'right', color: '#000000' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                          <span>Total Qty :</span>
                          <strong>{totalUnits}</strong>
                        </div>
                        {totalSavings > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', color: '#DC2626', fontWeight: 800 }}>
                            <span>Total Saving :</span>
                            <span>{totalSavings.toFixed(totalSavings % 1 === 0 ? 0 : 2)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                          <span>Total Amount :</span>
                          <span>{parseFloat(completedOrder.subtotal || completedOrder.total_amount).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 900, fontSize: '0.82rem', borderTop: '1px dashed #000000', paddingTop: '3px', marginTop: '2px' }}>
                          <span>Payable Amount :</span>
                          <span>{totalAmtFormatted}</span>
                        </div>
                        {(payMethod === 'partial' || parseFloat(completedOrder.balance_due || 0) > 0) && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 800, color: '#059669' }}>
                              <span>Paid Now :</span>
                              <span>₹{parseFloat(completedOrder.amount_paid || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 900, fontSize: '0.82rem', color: '#DC2626', borderTop: '1px dotted #000000', paddingTop: '2px' }}>
                              <span>Balance Due :</span>
                              <span>₹{parseFloat(completedOrder.balance_due || 0).toFixed(2)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Footer Details & Cashier Info */}
                    <div style={{ paddingTop: '8px', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '2px', color: '#000000' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cashier Name - {completedOrder.cashier_name || currentUser?.name || ''}</span>
                      </div>
                      {storeGst ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>GSTIN No - {storeGst}</span>
                        </div>
                      ) : null}
                      <div style={{ textAlign: 'center', marginTop: '10px', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.5px' }}>
                        THANK YOU AND VISIT AGAIN
                      </div>
                    </div>

                    {/* Terms & Conditions Section (Fixed Title + Configurable Clauses & Font Size) */}
                    {(() => {
                      const termsContent = getReceiptTermsText();
                      const termsFontSize = getReceiptTermsFontSize();
                      if (!termsContent) return null;
                      return (
                        <div
                          style={{
                            marginTop: '10px',
                            paddingTop: '8px',
                            borderTop: '1px dashed #000000',
                            color: '#000000',
                          }}
                        >
                          <div
                            style={{
                              textAlign: 'center',
                              fontWeight: 900,
                              fontSize: '0.76rem',
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              marginBottom: '6px',
                            }}
                          >
                            TERMS &amp; CONDITIONS
                          </div>
                          <div
                            style={{
                              fontSize: termsFontSize,
                              textAlign: 'left',
                              lineHeight: 1.35,
                              color: '#000000',
                              fontWeight: 700,
                            }}
                          >
                            {renderFormattedTerms(termsContent)}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>

            {/* High-Contrast Receipt Action Controls */}
            <div
              className="no-print"
              style={{
                padding: '16px 20px',
                background: 'var(--bg-surface-solid)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(false)}
                  disabled={isSendingWhatsApp}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: '#25D366',
                    border: '1px solid #1EBE5D',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
                    cursor: isSendingWhatsApp ? 'not-allowed' : 'pointer',
                    fontSize: '0.88rem',
                    transition: 'all 0.15s ease',
                    opacity: isSendingWhatsApp ? 0.75 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSendingWhatsApp) e.currentTarget.style.background = '#1EBE5D';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSendingWhatsApp) e.currentTarget.style.background = '#25D366';
                  }}
                >
                  <WhatsAppIcon size={19} color="#FFFFFF" />
                  <span>{isSendingWhatsApp ? 'Sending...' : 'Send via WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: '#3B82F6',
                    border: '1px solid #2563EB',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    padding: '11px 16px',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#2563EB')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#3B82F6')}
                >
                  <Printer size={18} />
                  <span>Print Receipt</span>
                </button>
              </div>

              {/* Force Send Option (Appears when standard send is blocked by cooldown) */}
              {waCooldownActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.74rem', color: '#FBBF24', flex: 1, lineHeight: 1.3 }}>
                    ⏳ <strong>Cooldown active:</strong> Order was recently sent. Need to bypass cooldown?
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(true)}
                    disabled={isSendingWhatsApp}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      background: '#F59E0B',
                      color: '#000000',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isSendingWhatsApp ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Force Send
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleSaveAsPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    color: '#60A5FA',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)')}
                  title="Save receipt as a PDF file"
                >
                  <FileDown size={14} />
                  <span>Save as PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(false)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#F87171',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#DC2626';
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                    e.currentTarget.style.color = '#F87171';
                  }}
                >
                  Close (New Sale)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HELD BILLS & DRAFTS MODAL */}
      {isDraftsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => setIsDraftsModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--bg-surface)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface-solid)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  <Bookmark size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Held Bills &amp; Parked Carts ({draftCarts.length})
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Parked customer carts while customers pick more items
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ width: '34px', height: '34px', padding: 0 }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drafts List */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {draftCarts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                  <Bookmark size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                    No Bills Currently on Hold
                  </p>
                  <p style={{ fontSize: '0.84rem', margin: 0 }}>
                    When a customer wants to bring more items, click "Hold / Save Draft" in the cart to park their cart and bill others.
                  </p>
                </div>
              ) : (
                draftCarts.map((draft, idx) => (
                  <div
                    key={draft.id || idx}
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#F59E0B',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                            }}
                          >
                            Draft #{idx + 1}
                          </span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            <User size={15} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                            <span>
                              {draft.customerName || (draft.customerPhone ? `Customer (${draft.customerPhone})` : 'Walk-in Customer')}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                            <span>Saved: {new Date(draft.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>

                          {draft.customerPhone && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: '#38BDF8',
                                background: 'rgba(56, 189, 248, 0.1)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                fontWeight: 700,
                              }}
                            >
                              <Phone size={12} />
                              <span>{draft.customerPhone}</span>
                            </span>
                          )}

                          {draft.customerEmail && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-surface-hover)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              <Mail size={12} />
                              <span>{draft.customerEmail}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10B981', letterSpacing: '-0.02em' }}>
                          ₹{parseFloat(draft.totalAmount || 0).toFixed(2)}
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <Package size={12} />
                          <span>{draft.totalItems || draft.items?.length} items ({draft.items?.reduce((s, c) => s + c.quantity, 0)} units)</span>
                        </div>
                      </div>
                    </div>

                    {/* Items Tabular Table */}
                    <div
                      style={{
                        background: 'var(--bg-surface-solid, #161B2C)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr
                            style={{
                              background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.03))',
                              borderBottom: '1px solid var(--border-subtle)',
                              color: 'var(--text-muted)',
                              fontSize: '0.72rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              textAlign: 'left',
                            }}
                          >
                            <th style={{ padding: '8px 14px' }}>Item Description</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '60px' }}>Qty</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', width: '90px' }}>Unit Price</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px' }}>Disc %</th>
                            <th style={{ padding: '8px 14px', textAlign: 'right', width: '100px' }}>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draft.items?.map((ci, itemIdx) => {
                            const unitPrice = parseFloat(ci.unit_price || ci.item.selling_price || 0);
                            const lineTotal = parseFloat(ci.total || (unitPrice * ci.quantity));
                            const discPct = parseFloat(ci.discount_percent || 0);
                            return (
                              <tr
                                key={itemIdx}
                                style={{
                                  borderBottom:
                                    itemIdx < draft.items.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                                }}
                              >
                                <td style={{ padding: '8px 14px', color: 'var(--text-main)', fontWeight: 600 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{ci.item.name}</span>
                                    {ci.item.uid && (
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          color: 'var(--brand-primary)',
                                          background: 'rgba(218, 41, 28, 0.1)',
                                          padding: '1px 6px',
                                          borderRadius: 'var(--radius-sm)',
                                          fontFamily: 'monospace',
                                        }}
                                      >
                                        {ci.item.uid}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      background: 'rgba(59, 130, 246, 0.15)',
                                      color: '#3B82F6',
                                      fontWeight: 800,
                                      padding: '2px 8px',
                                      borderRadius: 'var(--radius-pill)',
                                      fontSize: '0.74rem',
                                    }}
                                  >
                                    {ci.quantity}×
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                  ₹{unitPrice.toFixed(2)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: discPct > 0 ? '#F59E0B' : 'var(--text-muted)' }}>
                                  {discPct > 0 ? `${discPct}%` : '—'}
                                </td>
                                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>
                                  ₹{lineTotal.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Actions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '12px',
                        marginTop: '4px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteDraftCart(draft.id)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          color: 'var(--color-danger)',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Discard Draft</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRestoreDraftCart(draft)}
                        className="btn btn-primary btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'linear-gradient(135deg, #10B981, #059669)',
                          borderColor: '#10B981',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          padding: '7px 18px',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                        }}
                      >
                        <RotateCcw size={15} />
                        <span>Resume / Restore Bill</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* VIP CARD RFID TAP & VERIFICATION POPUP MODAL */}
      {isVipTapModalOpen && matchedCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '20px',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => setIsVipTapModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              background: 'var(--bg-surface)',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), transparent)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.22)',
                    color: '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                  }}
                >
                  <Crown size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Tap VIP RFID Card
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Customer: <strong>{matchedCustomer.name || matchedCustomer.phone}</strong> &bull; Card UID: <span style={{ fontFamily: 'monospace', color: '#F59E0B' }}>{matchedCustomer.vip_card_uid}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsVipTapModalOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* RFID Tap Zone Visual & Simulator Button */}
              <div
                style={{
                  padding: '24px 20px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* USB Serial Connection Toolbar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: rfidStatus.isConnected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface)',
                    border: `1px solid ${rfidStatus.isConnected ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                    width: '100%',
                    maxWidth: '420px',
                    boxSizing: 'border-box',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: rfidStatus.isConnected ? '#10B981' : '#94A3B8',
                        boxShadow: rfidStatus.isConnected ? '0 0 6px #10B981' : 'none',
                      }}
                    />
                    <span style={{ fontWeight: 700, color: rfidStatus.isConnected ? '#10B981' : 'var(--text-secondary)' }}>
                      {rfidStatus.isConnected ? 'Arduino Connected (9600 baud)' : 'USB RFID Disconnected'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleRfidConnect}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-pill)',
                      background: rfidStatus.isConnected ? 'transparent' : 'linear-gradient(135deg, #10B981, #059669)',
                      color: rfidStatus.isConnected ? 'var(--text-secondary)' : '#FFFFFF',
                      border: rfidStatus.isConnected ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    {rfidStatus.isConnecting ? 'Connecting...' : rfidStatus.isConnected ? 'Disconnect' : '⚡ Connect USB Reader'}
                  </button>
                </div>
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: vipCardScannedUid && vipCardScannedUid.trim().toLowerCase() === matchedCustomer.vip_card_uid.toLowerCase()
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(245, 158, 11, 0.15)',
                    color: vipCardScannedUid && vipCardScannedUid.trim().toLowerCase() === matchedCustomer.vip_card_uid.toLowerCase()
                      ? '#10B981'
                      : '#F59E0B',
                    border: `2px solid ${
                      vipCardScannedUid && vipCardScannedUid.trim().toLowerCase() === matchedCustomer.vip_card_uid.toLowerCase()
                        ? 'rgba(16, 185, 129, 0.4)'
                        : 'rgba(245, 158, 11, 0.4)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Radio size={34} className={vipCardScannedUid ? '' : 'pulse'} />
                </div>

                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {vipCardScannedUid
                      ? (vipCardScannedUid.trim().toLowerCase() === matchedCustomer.vip_card_uid.toLowerCase()
                          ? 'Card Scanned & UID Matched!'
                          : 'Scanned Card UID Mismatch!')
                      : 'Please Tap Card on RFID Reader'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {rfidStatus.isConnected
                      ? 'Hold the customer VIP RFID card near the connected Arduino USB reader.'
                      : 'Connect USB reader above, or tap customer card.'}
                  </div>
                </div>
              </div>

              {/* Tapped Card Verification Result */}
              {vipCardScannedUid && (
                <>
                  {vipCardScannedUid.trim().toLowerCase() !== matchedCustomer.vip_card_uid.toLowerCase() ? (
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-lg)',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#EF4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <AlertCircle size={22} style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>Card UID Mismatch!</div>
                        <div style={{ fontSize: '0.78rem', marginTop: '2px', opacity: 0.9 }}>
                          Tapped UID: <strong style={{ fontFamily: 'monospace' }}>{vipCardScannedUid}</strong> does not belong to customer {matchedCustomer.name || matchedCustomer.phone} (Expected: <strong style={{ fontFamily: 'monospace' }}>{matchedCustomer.vip_card_uid}</strong>).
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* UID Matched: Show Balance & Checkout Approval */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Balance Details Card */}
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-lg)',
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-subtle)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '12px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '8px' }}>
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Available Credits
                          </span>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
                            ₹{parseFloat(matchedCustomer.vip_card_balance || 0).toFixed(2)}
                          </div>
                        </div>

                        <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '8px' }}>
                          <span style={{ fontSize: '0.70rem', color: '#F59E0B', fontWeight: 800, textTransform: 'uppercase' }}>
                            Net Bill (-{vipSettings.discountPercent || 5}%)
                          </span>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                            ₹{cartGrandTotal.toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Balance After
                          </span>
                          <div
                            style={{
                              fontSize: '1.2rem',
                              fontWeight: 900,
                              color: parseFloat(matchedCustomer.vip_card_balance || 0) >= cartGrandTotal ? 'var(--text-main)' : '#EF4444',
                              marginTop: '2px',
                            }}
                          >
                            ₹{Math.max(0, parseFloat(matchedCustomer.vip_card_balance || 0) - cartGrandTotal).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* If Insufficient Balance: Quick Recharge presets */}
                      {parseFloat(matchedCustomer.vip_card_balance || 0) < cartGrandTotal ? (
                        <div
                          style={{
                            padding: '16px',
                            borderRadius: 'var(--radius-lg)',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{ fontSize: '0.82rem', color: '#EF4444', fontWeight: 800 }}>
                              ⚠️ Short by ₹{(cartGrandTotal - parseFloat(matchedCustomer.vip_card_balance || 0)).toFixed(2)} credits
                            </span>
                            
                            {/* Payment Method Selector for Quick Recharge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Pay via:</span>
                              <button
                                type="button"
                                onClick={() => setQuickRechargePaymentMethod('cash')}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: quickRechargePaymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.22)' : 'var(--bg-surface)',
                                  border: quickRechargePaymentMethod === 'cash' ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                                  color: quickRechargePaymentMethod === 'cash' ? '#10B981' : 'var(--text-muted)',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Banknote size={12} /> Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuickRechargePaymentMethod('upi')}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: quickRechargePaymentMethod === 'upi' ? 'rgba(56, 189, 248, 0.22)' : 'var(--bg-surface)',
                                  border: quickRechargePaymentMethod === 'upi' ? '1px solid #38BDF8' : '1px solid var(--border-subtle)',
                                  color: quickRechargePaymentMethod === 'upi' ? '#38BDF8' : 'var(--text-muted)',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <QrCode size={12} /> UPI
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, (vipSettings.rechargePresets || ['500', '1000', '2000']).length)}, 1fr)`, gap: '10px' }}>
                            {(vipSettings.rechargePresets || ['500', '1000', '2000']).map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                disabled={isQuickRecharging}
                                onClick={() => handleInlineRecharge(preset)}
                                style={{
                                  padding: '10px 8px',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'rgba(245, 158, 11, 0.2)',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  color: '#F59E0B',
                                  fontWeight: 800,
                                  fontSize: '0.88rem',
                                  cursor: isQuickRecharging ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                }}
                              >
                                {isQuickRecharging ? <RefreshCw size={13} className="spin" /> : <Zap size={13} />}
                                <span>+₹{preset}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Balance is Sufficient: Confirmation Button */
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod('vip_card');
                            setIsVipTapModalOpen(false);
                            showNotification('success', `VIP Card "${matchedCustomer.vip_card_uid}" verified! 5% discount applied to bill.`);
                          }}
                          style={{
                            width: '100%',
                            padding: '14px 20px',
                            borderRadius: 'var(--radius-lg)',
                            background: 'linear-gradient(135deg, #10B981, #059669)',
                            border: 'none',
                            color: '#FFFFFF',
                            fontWeight: 900,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <CheckCircle2 size={20} />
                          <span>Accept &amp; Apply VIP Card (₹{cartGrandTotal.toFixed(2)})</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COUNTER CASH & STOCK PAYOUT MODAL */}
      {/* ========================================================================= */}
      {isPayoutModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => !isSubmittingPayout && setIsPayoutModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(220, 38, 38, 0.04))',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.18)',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    flexShrink: 0,
                  }}
                >
                  <ArrowUpRight size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Counter Cash &amp; Stock Payout
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Record on-counter stock purchases, freight, repairs &amp; expenses with instant audit logging
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingPayout && setIsPayoutModalOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Tab Navigation & Shift Stats */}
            <div
              style={{
                padding: '12px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface-hover)',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPayoutActiveTab('record')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    border: '1px solid',
                    borderColor: payoutActiveTab === 'record' ? '#EF4444' : 'transparent',
                    background: payoutActiveTab === 'record' ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
                    color: payoutActiveTab === 'record' ? '#F87171' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Wallet size={14} />
                  <span>Record Payout</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPayoutActiveTab('ledger');
                    loadRecentPayouts();
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    border: '1px solid',
                    borderColor: payoutActiveTab === 'ledger' ? '#EF4444' : 'transparent',
                    background: payoutActiveTab === 'ledger' ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
                    color: payoutActiveTab === 'ledger' ? '#F87171' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FileSpreadsheet size={14} />
                  <span>Audit Ledger ({payoutsList.length})</span>
                </button>
              </div>

              {/* Total Payouts Recorded Banner */}
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Branch Outflow:</span>
                <strong style={{ color: '#EF4444', fontSize: '0.92rem' }}>
                  ₹{payoutsList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0).toFixed(2)}
                </strong>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {payoutActiveTab === 'record' ? (
                <form onSubmit={handleSubmitPayout} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Amount Field with Quick Presets */}
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Payout Amount (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={payoutForm.amount}
                        onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="form-input"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          paddingLeft: '36px',
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          color: '#EF4444',
                          borderColor: 'rgba(239, 68, 68, 0.35)',
                          height: '46px',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          left: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '1.15rem',
                          fontWeight: 900,
                          color: '#EF4444',
                        }}
                      >
                        ₹
                      </span>
                    </div>

                    {/* Quick Amount Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
                      {[100, 200, 500, 1000, 2000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            const current = parseFloat(payoutForm.amount) || 0;
                            setPayoutForm({ ...payoutForm, amount: String((current + amt).toFixed(2)) });
                          }}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#F87171',
                            cursor: 'pointer',
                          }}
                        >
                          +{amt}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPayoutForm({ ...payoutForm, amount: '' })}
                        style={{
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* 2 Column: Paid To & Category */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {/* Paid To */}
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Paid To (Payee / Vendor) <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={payoutForm.paid_to}
                        onChange={(e) => setPayoutForm({ ...payoutForm, paid_to: e.target.value })}
                        placeholder="e.g. Rajesh (Delhi Garments), Courier Driver..."
                        className="form-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Category / Purpose */}
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Payment Category / Purpose <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <select
                        value={payoutForm.category}
                        onChange={(e) => setPayoutForm({ ...payoutForm, category: e.target.value })}
                        className="form-select"
                        style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700 }}
                      >
                        <option value="stock_purchase">📦 Stock Delivery / Purchase</option>
                        <option value="freight_delivery">🚚 Freight &amp; Transport / Courier</option>
                        <option value="store_maintenance">🛠️ Store Repairs &amp; Maintenance</option>
                        <option value="daily_expense">☕ Tea &amp; Daily Supplies / Refreshments</option>
                        <option value="utility_bill">💡 Electricity / Internet / Utilities</option>
                        <option value="other">🏷️ Other Counter Expense</option>
                      </select>
                    </div>
                  </div>

                  {/* 2 Column: Payment Method & Paid By (Employee Name) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {/* Payment Mode */}
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Payment Method / Mode <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <select
                        value={payoutForm.payment_method}
                        onChange={(e) => setPayoutForm({ ...payoutForm, payment_method: e.target.value })}
                        className="form-select"
                        style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700 }}
                      >
                        <option value="cash">💵 Cash (From Counter Register)</option>
                        <option value="upi">📱 UPI / Online QR Code</option>
                        <option value="card">💳 Store Debit / Credit Card</option>
                        <option value="bank_transfer">🏦 Bank Transfer / NEFT</option>
                        <option value="other">📝 Other</option>
                      </select>
                    </div>

                    {/* Paid By (Cashier / Employee Name) */}
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Paid By (Cashier / Employee Name) <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={payoutForm.paid_by_name}
                        onChange={(e) => setPayoutForm({ ...payoutForm, paid_by_name: e.target.value })}
                        placeholder="Cashier / Staff Name"
                        className="form-input"
                        style={{ width: '100%', boxSizing: 'border-box', fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  {/* 2 Column: Date & Time + Bill/LR Ref No */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {/* When (Date & Time) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          Date &amp; Time (When Paid) <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setPayoutForm((prev) => ({ ...prev, paid_at: getDeviceLocalDateTime() }))}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontSize: '0.70rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '0 2px',
                          }}
                          title="Sync with current device date & time"
                        >
                          <Clock size={11} /> Current Device Time
                        </button>
                      </div>
                      <input
                        type="datetime-local"
                        required
                        value={payoutForm.paid_at}
                        onChange={(e) => setPayoutForm({ ...payoutForm, paid_at: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Bill / LR / Challan Ref No */}
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Invoice / LR / Bill Ref # <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={payoutForm.receipt_number}
                        onChange={(e) => setPayoutForm({ ...payoutForm, receipt_number: e.target.value })}
                        placeholder="e.g. INV-9872, LR-5541..."
                        className="form-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Reason / Purpose (Why) */}
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Reason / Description (Why) <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={payoutForm.reason}
                      onChange={(e) => setPayoutForm({ ...payoutForm, reason: e.target.value })}
                      placeholder="e.g. Received 5 cartons of cotton shirts from supplier on transport delivery. Cash paid upon arrival."
                      className="form-input"
                      style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>

                  {/* Submit Button Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setIsPayoutModalOpen(false)}
                      className="btn btn-secondary"
                      disabled={isSubmittingPayout}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSubmittingPayout || !payoutForm.amount || !payoutForm.paid_to}
                      style={{
                        background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                        borderColor: '#EF4444',
                        color: '#FFFFFF',
                        fontWeight: 900,
                        padding: '10px 24px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {isSubmittingPayout ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          <span>Recording Payout...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight size={16} />
                          <span>Record &amp; Audit Payout</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* AUDIT LEDGER TAB */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Search Bar for Payouts */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search
                        size={15}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                      />
                      <input
                        type="text"
                        value={payoutSearchQuery}
                        onChange={(e) => setPayoutSearchQuery(e.target.value)}
                        placeholder="Search payouts by voucher #, payee, cashier, or reason..."
                        className="form-input"
                        style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '34px', fontSize: '0.82rem' }}
                      />
                    </div>
                    <TimeRangeFilter
                      compact={true}
                      filterState={payoutsTimeFilter}
                      onFilterChange={setPayoutsTimeFilter}
                    />
                    <button
                      type="button"
                      onClick={loadRecentPayouts}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 12px' }}
                      title="Refresh ledger"
                    >
                      <RefreshCw size={13} className={loadingPayouts ? 'spin' : ''} />
                    </button>
                  </div>

                  {/* Ledger Table */}
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px' }}>Voucher / Date</th>
                          <th style={{ padding: '10px 14px' }}>Paid To (Payee)</th>
                          <th style={{ padding: '10px 14px' }}>Category &amp; Reason</th>
                          <th style={{ padding: '10px 14px' }}>Mode</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>Slip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterLogsByTimeRange(payoutsList, payoutsTimeFilter, ['paid_at', 'created_at'])
                          .filter((p) => {
                            if (!payoutSearchQuery.trim()) return true;
                            const q = payoutSearchQuery.toLowerCase();
                            return (
                              p.payout_number?.toLowerCase().includes(q) ||
                              p.paid_to?.toLowerCase().includes(q) ||
                              p.paid_by_name?.toLowerCase().includes(q) ||
                              p.reason?.toLowerCase().includes(q) ||
                              p.receipt_number?.toLowerCase().includes(q)
                            );
                          })
                          .map((payout) => (
                            <tr key={payout.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ fontWeight: 800, fontFamily: 'monospace', color: '#F87171' }}>
                                  {payout.payout_number}
                                </div>
                                <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {new Date(payout.paid_at || payout.created_at).toLocaleString()}
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>
                                <div>{payout.paid_to}</div>
                                <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  By: {payout.paid_by_name || 'Cashier'}
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    color: '#F87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                  }}
                                >
                                  {payout.category_display || payout.category}
                                </span>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '240px', lineHeight: 1.3 }}>
                                  {payout.reason}
                                </div>
                                {payout.receipt_number && (
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Ref: {payout.receipt_number}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textTransform: 'capitalize', fontWeight: 600 }}>
                                {payout.payment_method_display || payout.payment_method}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#EF4444', fontSize: '0.94rem' }}>
                                ₹{parseFloat(payout.amount).toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handlePrintPayoutSlip(payout)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 8px' }}
                                  title="Print thermal payout voucher"
                                >
                                  <Printer size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}

                        {payoutsList.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No counter payouts recorded for this branch yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THERMAL PAYOUT VOUCHER PRINT MODAL (80mm BIXOLON FORMAT) */}
      {/* ========================================================================= */}
      {isPayoutSlipModalOpen && selectedPayoutForSlip && (
        <div
          className="receipt-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
          onClick={() => setIsPayoutSlipModalOpen(false)}
        >
          <div
            className="receipt-modal-card"
            style={{
              width: '100%',
              maxWidth: '360px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid #D1D5DB',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
              background: '#FFFFFF',
              color: '#000000',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Printable Thermal Receipt Container matching exact 80mm Bixolon SRP-330 format */}
            <div
              id="printable-payout-voucher"
              style={{
                width: '100%',
                maxWidth: '340px',
                margin: '0 auto',
                padding: '20px 16px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                background: '#FFFFFF',
                color: '#000000',
                fontSize: '0.72rem',
                lineHeight: 1.35,
                boxSizing: 'border-box',
              }}
            >
              {/* Store Logo on Top & Tagline */}
              <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                <img
                  src="/assets/logo.svg"
                  alt="Wondersale Logo"
                  style={{ height: '46px', width: 'auto', objectFit: 'contain', margin: '0 auto 6px auto', display: 'block' }}
                />
                <h2 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0, letterSpacing: '2px', color: '#DC2626', textTransform: 'uppercase' }}>
                  WONDER SALE
                </h2>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '1.5px', color: '#4B5563', textTransform: 'uppercase', marginTop: '2px' }}>
                  {activeStore?.name || 'MAIN STORE'}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000000', paddingBottom: '6px', textAlign: 'center', fontWeight: 900, fontSize: '0.78rem', letterSpacing: '0.5px' }}>
                *** COUNTER PAYOUT VOUCHER ***
              </div>

              {/* Voucher Meta */}
              <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>VOUCHER NO:</span>
                  <strong>{selectedPayoutForSlip.payout_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>DATE &amp; TIME:</span>
                  <span>{new Date(selectedPayoutForSlip.paid_at || selectedPayoutForSlip.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>PAYMENT MODE:</span>
                  <strong style={{ textTransform: 'uppercase' }}>{selectedPayoutForSlip.payment_method_display || selectedPayoutForSlip.payment_method}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>CASHIER / STAFF:</span>
                  <span>{selectedPayoutForSlip.paid_by_name || 'Cashier'}</span>
                </div>
              </div>

              {/* Payee & Purpose Details */}
              <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>PAID TO (RECEIVER):</strong></div>
                <div style={{ fontSize: '0.80rem', fontWeight: 900, paddingLeft: '4px' }}>
                  {selectedPayoutForSlip.paid_to}
                </div>

                <div style={{ marginTop: '4px' }}><strong>CATEGORY / PURPOSE:</strong></div>
                <div style={{ paddingLeft: '4px' }}>
                  {selectedPayoutForSlip.category_display || selectedPayoutForSlip.category}
                </div>

                {selectedPayoutForSlip.receipt_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span>BILL / LR REF #:</span>
                    <strong>{selectedPayoutForSlip.receipt_number}</strong>
                  </div>
                )}

                <div style={{ marginTop: '4px' }}><strong>REASON / PARTICULARS:</strong></div>
                <div style={{ paddingLeft: '4px', fontStyle: 'italic', lineHeight: 1.3 }}>
                  {selectedPayoutForSlip.reason || 'On-counter expense payment'}
                </div>
              </div>

              {/* Amount Box */}
              <div style={{ padding: '10px 0', borderBottom: '1px dashed #000000', textAlign: 'center' }}>
                <div style={{ fontSize: '0.70rem', fontWeight: 800 }}>AMOUNT DISBURSED:</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#000000', marginTop: '2px' }}>
                  ₹{parseFloat(selectedPayoutForSlip.amount).toFixed(2)}
                </div>
              </div>

              {/* Signatures */}
              <div style={{ paddingTop: '24px', fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div>_________________</div>
                  <div style={{ marginTop: '4px', fontWeight: 700 }}>Cashier Signature</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div>_________________</div>
                  <div style={{ marginTop: '4px', fontWeight: 700 }}>Receiver Signature</div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.64rem', color: '#6B7280' }}>
                STORE AUDIT COPY &bull; WONDERSALE POS
              </div>
            </div>

            {/* Print Action Controls */}
            <div
              className="no-print"
              style={{
                padding: '14px 20px',
                background: 'var(--bg-surface-solid)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                  borderColor: '#EF4444',
                  fontWeight: 900,
                  padding: '10px',
                }}
              >
                <Printer size={16} />
                <span>Print Payout Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPayoutSlipModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '10px 16px', fontWeight: 800 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* CASH COUNTER DRAWER & RECONCILIATION MODAL (SIMPLIFIED & SLEEK) */}
      {/* ========================================================================= */}
      {isRegisterModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px',
          }}
          onClick={() => setIsRegisterModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: showRegisterHistory ? '820px' : '560px',
              maxHeight: '92vh',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
              transition: 'max-width 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface-hover)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: activeShift
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                    color: activeShift ? '#10B981' : '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${activeShift ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                  }}
                >
                  <Coins size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                      Cash Counter Entry
                    </h2>
                    {activeShift ? (
                      <span
                        style={{
                          fontSize: '0.70rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34D399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
                        SHIFT #{activeShift.shift_number} OPEN
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.70rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#FBBF24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
                        REGISTER CLOSED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {activeStore?.name || 'Main Branch'} &bull; {currentUser?.name || currentUser?.username || 'Cashier'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (showRegisterHistory) {
                      setShowRegisterHistory(false);
                    } else {
                      setShowRegisterHistory(true);
                      loadRegisterHistory();
                    }
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {showRegisterHistory ? (
                    <>
                      <ArrowLeft size={13} />
                      <span>Back to Entry</span>
                    </>
                  ) : (
                    <>
                      <Calendar size={13} />
                      <span>Shift History</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {showRegisterHistory ? (
                /* HISTORY LEDGER VIEW */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      Shift Audit History
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TimeRangeFilter
                        compact={true}
                        filterState={shiftsHistoryTimeFilter}
                        onFilterChange={setShiftsHistoryTimeFilter}
                      />
                      <button
                        type="button"
                        onClick={loadRegisterHistory}
                        disabled={loadingRegisterHistory}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <RefreshCw size={12} className={loadingRegisterHistory ? 'spin' : ''} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-subtle)',
                      overflow: 'hidden',
                      background: 'var(--bg-surface-hover)',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 800 }}>Shift / Timeline</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Starting Cash</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Sales (+)</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Payouts (-)</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Expected</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Counted</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Result</th>
                          <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Slip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterLogsByTimeRange(registerHistoryList, shiftsHistoryTimeFilter, ['opened_at', 'closed_at']).map((shift) => {
                          const diff = parseFloat(shift.cash_difference || 0);
                          const isClosed = shift.status === 'closed';

                          return (
                            <tr
                              key={shift.id}
                              style={{
                                borderBottom: '1px solid var(--border-subtle)',
                                color: 'var(--text-main)',
                              }}
                            >
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>Shift #{shift.shift_number}</div>
                                <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Cashier: <strong>{shift.cashier_name || shift.opened_by_name || 'Cashier'}</strong>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--color-primary)', marginTop: '2px' }}>
                                  Start: {new Date(shift.opened_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                                {shift.closed_at && (
                                  <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '1px' }}>
                                    End: {new Date(shift.closed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </div>
                                )}
                              </td>

                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>
                                ₹{parseFloat(shift.opening_cash || 0).toFixed(2)}
                              </td>

                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#34D399' }}>
                                +₹{parseFloat(shift.cash_sales_amount || 0).toFixed(2)}
                              </td>

                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F87171' }}>
                                -₹{parseFloat(shift.cash_payouts_amount || 0).toFixed(2)}
                              </td>

                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>
                                ₹{parseFloat(shift.expected_cash || 0).toFixed(2)}
                              </td>

                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>
                                {isClosed ? `₹${parseFloat(shift.closing_cash_counted || 0).toFixed(2)}` : '—'}
                              </td>

                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                {isClosed ? (
                                  <span
                                    style={{
                                      fontSize: '0.70rem',
                                      fontWeight: 800,
                                      padding: '2px 7px',
                                      borderRadius: '999px',
                                      background:
                                        Math.abs(diff) < 0.01
                                          ? 'rgba(16, 185, 129, 0.15)'
                                          : diff > 0
                                          ? 'rgba(59, 130, 246, 0.15)'
                                          : 'rgba(239, 68, 68, 0.15)',
                                      color:
                                        Math.abs(diff) < 0.01
                                          ? '#34D399'
                                          : diff > 0
                                          ? '#60A5FA'
                                          : '#F87171',
                                      border:
                                        Math.abs(diff) < 0.01
                                          ? '1px solid rgba(16, 185, 129, 0.3)'
                                          : diff > 0
                                          ? '1px solid rgba(59, 130, 246, 0.3)'
                                          : '1px solid rgba(239, 68, 68, 0.3)',
                                    }}
                                  >
                                    {Math.abs(diff) < 0.01 ? 'BALANCED' : diff > 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#34D399' }}>ACTIVE</span>
                                )}
                              </td>

                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                {isClosed && (
                                  <button
                                    type="button"
                                    onClick={() => handlePrintShiftSlip(shift)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                    title="Print 80mm closing slip"
                                  >
                                    <Printer size={12} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {registerHistoryList.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No shift history records for this store branch.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* UNIFIED SIMPLIFIED ENTRY FORM */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (shiftEntryType === 'shift_start') {
                      handleStartShiftSubmit(e);
                    } else {
                      handleCloseShiftSubmit(e);
                    }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  {/* 1. Dropdown Option for Shift Start vs Shift End */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.80rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                      Entry Type / Shift Operation <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <select
                      value={shiftEntryType}
                      onChange={(e) => setShiftEntryType(e.target.value)}
                      className="form-select"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        height: '42px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                      }}
                    >
                      <option value="shift_start">☀️ Shift Start (Opening Cash)</option>
                      <option value="shift_end">🔒 Shift End (Closing Cash &amp; Reconciliation)</option>
                    </select>
                  </div>

                  {/* 2. Cashier / Staff Name */}
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Cashier / Staff Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shiftCashierName}
                      onChange={(e) => setShiftCashierName(e.target.value)}
                      placeholder="Cashier Name"
                      className="form-input"
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', fontSize: '0.84rem' }}
                    />
                  </div>

                  {/* 3. Dynamic Section: Shift Start Form vs Shift End Form */}
                  {shiftEntryType === 'shift_start' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {activeShift && (
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            fontSize: '0.78rem',
                            color: '#93C5FD',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <AlertCircle size={16} style={{ color: '#60A5FA', flexShrink: 0 }} />
                          <span>
                            Shift #{activeShift.shift_number} is currently active. To reconcile and close this shift, select <strong>Shift End</strong> in the dropdown above.
                          </span>
                        </div>
                      )}

                      {/* Opening Cash Input */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.80rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          Opening Cash in Drawer (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span
                            style={{
                              position: 'absolute',
                              left: '14px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontWeight: 900,
                              color: '#F59E0B',
                              fontSize: '1.25rem',
                            }}
                          >
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            placeholder="0.00"
                            value={openingCashInput}
                            onChange={(e) => setOpeningCashInput(e.target.value)}
                            className="form-input"
                            autoFocus
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              paddingLeft: '34px',
                              fontSize: '1.25rem',
                              fontWeight: 800,
                              height: '48px',
                            }}
                          />
                        </div>

                        {/* Quick Add Chips */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '4px' }}>
                            Quick Add Cash:
                          </span>
                          {[500, 1000, 2000, 5000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleQuickAddCash(val)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, borderRadius: '6px' }}
                            >
                              +₹{val}
                            </button>
                          ))}
                          {openingCashInput !== '' && (
                            <button
                              type="button"
                              onClick={() => setOpeningCashInput('')}
                              className="btn btn-secondary btn-sm"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                color: 'var(--color-danger)',
                              }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Starting Cash Notes / Denominations */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          Starting Cash Notes / Denominations <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>(Optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ₹500x2, ₹200x5, ₹100x10..."
                          value={openingNotesInput}
                          onChange={(e) => setOpeningNotesInput(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', boxSizing: 'border-box', height: '38px', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Shift End Form (Blind Shift Close) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {activeShift ? (
                        <>
                          {/* Shift Starting Cash Card */}
                          <div
                            style={{
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--bg-surface-hover)',
                              border: '1px solid var(--border-subtle)',
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Shift #{activeShift.shift_number}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Cashier: <strong>{activeShift.cashier_name || activeShift.opened_by_name || 'Cashier'}</strong>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                STARTING CASH
                              </div>
                              <div style={{ fontSize: '1.20rem', fontWeight: 900, color: '#F59E0B', marginTop: '2px' }}>
                                ₹{parseFloat(activeShift.opening_cash || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Physical Counted Cash Input (Blind entry without showing expected cash or sales) */}
                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.80rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                              Physical Cash Counted in Drawer (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                              <span
                                style={{
                                  position: 'absolute',
                                  left: '14px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontWeight: 900,
                                  color: 'var(--color-primary)',
                                  fontSize: '1.25rem',
                                }}
                              >
                                ₹
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                placeholder="Enter physical cash counted in drawer"
                                value={closingCashCountedInput}
                                onChange={(e) => setClosingCashCountedInput(e.target.value)}
                                className="form-input"
                                autoFocus
                                style={{
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  paddingLeft: '34px',
                                  fontSize: '1.25rem',
                                  fontWeight: 800,
                                  height: '48px',
                                }}
                              />
                            </div>
                          </div>

                          {/* Closing Notes */}
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                              Closing Notes / Remarks <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>(Optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Reason for any discrepancy or closing remarks..."
                              value={closingNotesInput}
                              onChange={(e) => setClosingNotesInput(e.target.value)}
                              className="form-input"
                              style={{ width: '100%', boxSizing: 'border-box', height: '38px', fontSize: '0.82rem' }}
                            />
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            padding: '24px 16px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface-hover)',
                            border: '1px dashed var(--border-subtle)',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '0.84rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <AlertCircle size={24} style={{ color: 'var(--text-muted)' }} />
                          <div>No active shift is currently open to close.</div>
                          <button
                            type="button"
                            onClick={() => setShiftEntryType('shift_start')}
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: '4px', color: '#FBBF24' }}
                          >
                            Switch to Shift Start (Opening Cash)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Action Buttons Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsRegisterModalOpen(false)}
                      className="btn btn-secondary"
                      disabled={isSubmittingShift}
                      style={{ padding: '8px 18px', fontWeight: 700 }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={
                        isSubmittingShift ||
                        (shiftEntryType === 'shift_start' ? !openingCashInput : !activeShift || closingCashCountedInput === '')
                      }
                      style={{
                        padding: '8px 22px',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: shiftEntryType === 'shift_start'
                          ? 'linear-gradient(135deg, #10B981, #059669)'
                          : 'linear-gradient(135deg, #EF4444, #DC2626)',
                        borderColor: shiftEntryType === 'shift_start' ? '#10B981' : '#EF4444',
                      }}
                    >
                      {isSubmittingShift ? (
                        <>
                          <RefreshCw size={15} className="spin" />
                          <span>Saving Entry...</span>
                        </>
                      ) : shiftEntryType === 'shift_start' ? (
                        <>
                          <CheckCircle2 size={16} />
                          <span>Record Opening Cash &amp; Start Shift</span>
                        </>
                      ) : (
                        <>
                          <Banknote size={16} />
                          <span>Reconcile &amp; Close Shift</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THERMAL SHIFT RECONCILIATION PRINT SLIP (80mm BIXOLON FORMAT) */}
      {/* ========================================================================= */}
      {isShiftSlipModalOpen && selectedShiftForSlip && (
        <div
          className="receipt-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
          onClick={() => setIsShiftSlipModalOpen(false)}
        >
          <div
            className="receipt-modal-card"
            style={{
              width: '100%',
              maxWidth: '380px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid #D1D5DB',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
              background: '#FFFFFF',
              color: '#000000',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Printable Thermal Receipt Container matching exact 80mm Bixolon SRP-330 format */}
            <div
              id="printable-shift-reconciliation-slip"
              style={{
                width: '100%',
                maxWidth: '340px',
                margin: '0 auto',
                padding: '20px 16px',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                background: '#FFFFFF',
                color: '#000000',
                fontSize: '0.72rem',
                lineHeight: 1.35,
                boxSizing: 'border-box',
              }}
            >
              {/* Store Logo on Top & Tagline */}
              <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                <img
                  src="/assets/logo.svg"
                  alt="Wondersale Logo"
                  style={{ height: '46px', width: 'auto', objectFit: 'contain', margin: '0 auto 6px auto', display: 'block' }}
                />
                <h2 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0, letterSpacing: '2px', color: '#DC2626', textTransform: 'uppercase' }}>
                  WONDER SALE
                </h2>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '1.5px', color: '#4B5563', textTransform: 'uppercase', marginTop: '2px' }}>
                  {activeStore?.name || 'MAIN STORE'}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000000', paddingBottom: '6px', textAlign: 'center', fontWeight: 900, fontSize: '0.78rem', letterSpacing: '0.5px' }}>
                *** REGISTER SHIFT CLOSING SLIP ***
              </div>

              {/* Shift Meta */}
              <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SHIFT NO:</span>
                  <strong>{selectedShiftForSlip.shift_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SHIFT START:</span>
                  <span>{new Date(selectedShiftForSlip.opened_at).toLocaleString()}</span>
                </div>
                {selectedShiftForSlip.closed_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>SHIFT END:</span>
                    <span>{new Date(selectedShiftForSlip.closed_at).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>OPENED BY:</span>
                  <span>{selectedShiftForSlip.opened_by_name || 'Cashier'}</span>
                </div>
                {selectedShiftForSlip.closed_by_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>CLOSED BY:</span>
                    <span>{selectedShiftForSlip.closed_by_name}</span>
                  </div>
                )}
              </div>

              {/* Financial Breakdown Table */}
              <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>1. STARTING CASH:</span>
                  <strong>₹{parseFloat(selectedShiftForSlip.opening_cash || 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>2. (+) CASH SALES:</span>
                  <strong>+₹{parseFloat(selectedShiftForSlip.cash_sales_amount || 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>3. (-) CASH PAYOUTS:</span>
                  <strong>-₹{parseFloat(selectedShiftForSlip.cash_payouts_amount || 0).toFixed(2)}</strong>
                </div>
                <div style={{ borderTop: '1px dotted #6B7280', margin: '4px 0', paddingTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>EXPECTED DRAWER TOTAL:</span>
                  <strong>₹{parseFloat(selectedShiftForSlip.expected_cash || 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <span>COUNTED PHYSICAL CASH:</span>
                  <strong>₹{parseFloat(selectedShiftForSlip.closing_cash_counted || 0).toFixed(2)}</strong>
                </div>
              </div>

              {/* Discrepancy Amount Box */}
              <div style={{ padding: '10px 0', borderBottom: '1px dashed #000000', textAlign: 'center' }}>
                <div style={{ fontSize: '0.70rem', fontWeight: 800 }}>DRAWER RECONCILIATION RESULT:</div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    color:
                      Math.abs(parseFloat(selectedShiftForSlip.cash_difference || 0)) < 0.01
                        ? '#059669'
                        : parseFloat(selectedShiftForSlip.cash_difference || 0) > 0
                        ? '#2563EB'
                        : '#DC2626',
                    marginTop: '2px',
                  }}
                >
                  {Math.abs(parseFloat(selectedShiftForSlip.cash_difference || 0)) < 0.01
                    ? 'EXACT MATCH (₹0.00)'
                    : parseFloat(selectedShiftForSlip.cash_difference || 0) > 0
                    ? `OVERAGE (+₹${parseFloat(selectedShiftForSlip.cash_difference || 0).toFixed(2)})`
                    : `SHORTAGE (-₹${Math.abs(parseFloat(selectedShiftForSlip.cash_difference || 0)).toFixed(2)})`}
                </div>
              </div>

              {selectedShiftForSlip.closing_notes && (
                <div style={{ padding: '6px 0', borderBottom: '1px dashed #000000', fontSize: '0.68rem' }}>
                  <strong>NOTES / REMARKS:</strong>
                  <div style={{ fontStyle: 'italic', marginTop: '2px' }}>{selectedShiftForSlip.closing_notes}</div>
                </div>
              )}

              {/* Signatures */}
              <div style={{ paddingTop: '24px', fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div>_________________</div>
                  <div style={{ marginTop: '4px', fontWeight: 700 }}>Cashier Signature</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div>_________________</div>
                  <div style={{ marginTop: '4px', fontWeight: 700 }}>Store Manager Signature</div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.64rem', color: '#6B7280' }}>
                SHIFT AUDIT SLIP &bull; WONDERSALE POS
              </div>
            </div>

            {/* Print Action Controls */}
            <div
              className="no-print"
              style={{
                padding: '14px 20px',
                background: 'var(--bg-surface-solid)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  borderColor: '#10B981',
                  fontWeight: 900,
                  padding: '10px',
                }}
              >
                <Printer size={16} />
                <span>Print Shift Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setIsShiftSlipModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '10px 16px', fontWeight: 800 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* EDIT BILL ITEMS & PAYMENT METHOD MODAL (FOR CURRENT SHIFT BILLINGS) */}
      {/* ================================================================== */}
      {editingOrderForPayment && (() => {
        const editNewSubtotal = editOrderItems.reduce((sum, it) => sum + (it.unit_selling_price * it.quantity), 0);
        const editTaxAmount = parseFloat(editingOrderForPayment.tax_amount || 0);
        const editDiscountAmount = parseFloat(editingOrderForPayment.discount_amount || 0);
        const editNewTotal = Math.max(0, editNewSubtotal + editTaxAmount - editDiscountAmount);
        const editOriginalTotal = parseFloat(editingOrderForPayment.total_amount || 0);
        const editDiff = editNewTotal - editOriginalTotal;
        const totalUnitsInBill = editOrderItems.reduce((sum, it) => sum + it.quantity, 0);

        // Filtered products for quick add
        const addSearchQ = editAddItemSearch.trim().toLowerCase();
        const availableItemsToAdd = addSearchQ
          ? items.filter((item) => {
              return (
                item.name?.toLowerCase().includes(addSearchQ) ||
                item.uid?.toLowerCase().includes(addSearchQ)
              );
            }).slice(0, 6)
          : [];

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1200,
              padding: '20px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '92vh',
                backgroundColor: 'var(--bg-surface-solid, #181A20)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.02))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3B82F6',
                    }}
                  >
                    <Edit3 size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      Edit Shift Bill &amp; Payment
                    </h3>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Adjust quantities, add/remove items, or update payment mode before closing shift
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingOrderForPayment(null)}
                  disabled={isSavingPaymentMethod}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div
                style={{
                  padding: '20px 24px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Invoice Context & Financial Diff Card */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                      Invoice Reference
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {editingOrderForPayment.invoice_number}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Customer: <strong>{editingOrderForPayment.customer_phone || 'Walk-in'}</strong>
                      {editingOrderForPayment.customer_name && ` (${editingOrderForPayment.customer_name})`}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                      Revised Payable Total
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10B981', marginTop: '1px' }}>
                      ₹{editNewTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        marginTop: '2px',
                        color: Math.abs(editDiff) < 0.01 ? 'var(--text-muted)' : editDiff > 0 ? '#3B82F6' : '#F59E0B',
                      }}
                    >
                      {Math.abs(editDiff) < 0.01
                        ? 'No price difference'
                        : editDiff > 0
                        ? `+₹${editDiff.toFixed(2)} (Collect Extra)`
                        : `-₹${Math.abs(editDiff).toFixed(2)} (Refund to Customer)`}
                    </div>
                  </div>
                </div>

                {/* Section: Items in Bill */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Items in Bill ({editOrderItems.length} Products &bull; {totalUnitsInBill} Units)
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Stock automatically deducted/restored in ledger
                    </span>
                  </div>

                  {/* Items List Table */}
                  <div
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      background: 'rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 800 }}>Item Name &amp; Code</th>
                          <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'right' }}>Rate</th>
                          <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '8px 10px', fontWeight: 800, textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '8px 8px', fontWeight: 800, textAlign: 'center', width: '40px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editOrderItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.item_name}</div>
                              {item.item_uid && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    color: 'var(--brand-primary)',
                                    background: 'rgba(218, 41, 28, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontFamily: 'monospace',
                                    display: 'inline-block',
                                    marginTop: '2px',
                                  }}
                                >
                                  {item.item_uid}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              ₹{item.unit_selling_price.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                                <button
                                  type="button"
                                  onClick={() => handleEditItemQtyChange(idx, -1)}
                                  title="Decrease quantity (or remove if 1)"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px',
                                  }}
                                >
                                  <Minus size={12} />
                                </button>
                                <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800, fontFamily: 'monospace' }}>
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleEditItemQtyChange(idx, 1)}
                                  title="Increase quantity"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px',
                                  }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
                              ₹{(item.unit_selling_price * item.quantity).toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleEditItemRemove(idx)}
                                disabled={editOrderItems.length <= 1}
                                title={editOrderItems.length <= 1 ? 'Cannot delete only item' : 'Remove item from bill'}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: editOrderItems.length <= 1 ? 'var(--text-muted)' : '#EF4444',
                                  cursor: editOrderItems.length <= 1 ? 'not-allowed' : 'pointer',
                                  padding: '4px',
                                  opacity: editOrderItems.length <= 1 ? 0.3 : 1,
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Another Product Search Input */}
                  <div style={{ position: 'relative', marginTop: '4px' }}>
                    <div style={{ position: 'relative' }}>
                      <Search
                        size={14}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                      />
                      <input
                        type="text"
                        value={editAddItemSearch}
                        onChange={(e) => {
                          setEditAddItemSearch(e.target.value);
                          setIsEditAddItemDropdownOpen(true);
                        }}
                        onFocus={() => setIsEditAddItemDropdownOpen(true)}
                        placeholder="Search product name or barcode/UID to add to this bill..."
                        className="form-input"
                        style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '34px', fontSize: '0.80rem', height: '36px' }}
                      />
                      {editAddItemSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditAddItemSearch('');
                            setIsEditAddItemDropdownOpen(false);
                          }}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Results for Add Item */}
                    {isEditAddItemDropdownOpen && availableItemsToAdd.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 10,
                          marginTop: '4px',
                          background: 'var(--bg-surface-solid, #1F2330)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                          maxHeight: '200px',
                          overflowY: 'auto',
                        }}
                      >
                        {availableItemsToAdd.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleEditAddItem(p)}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                              <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                                UID: <span style={{ fontFamily: 'monospace' }}>{p.uid}</span> &bull; Stock: <strong>{p.quantity}</strong>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ color: '#10B981', fontSize: '0.84rem' }}>₹{parseFloat(p.selling_price || 0).toFixed(2)}</strong>
                              <div style={{ fontSize: '0.68rem', color: 'var(--color-primary)' }}>+ Click to add</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Method Selector Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Select Payment Mode
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {/* Cash */}
                    <button
                      type="button"
                      onClick={() => setEditPaymentMethod('cash')}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 'var(--radius-lg)',
                        border: editPaymentMethod === 'cash' ? '2px solid #10B981' : '1px solid var(--border-subtle)',
                        background: editPaymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface-hover)',
                        color: editPaymentMethod === 'cash' ? '#10B981' : 'var(--text-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Banknote size={18} />
                      <span>Cash</span>
                    </button>

                    {/* UPI */}
                    <button
                      type="button"
                      onClick={() => setEditPaymentMethod('upi')}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 'var(--radius-lg)',
                        border: editPaymentMethod === 'upi' ? '2px solid #8B5CF6' : '1px solid var(--border-subtle)',
                        background: editPaymentMethod === 'upi' ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-surface-hover)',
                        color: editPaymentMethod === 'upi' ? '#8B5CF6' : 'var(--text-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <QrCode size={18} />
                      <span>UPI / QR</span>
                    </button>

                    {/* Card */}
                    <button
                      type="button"
                      onClick={() => setEditPaymentMethod('card')}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 'var(--radius-lg)',
                        border: editPaymentMethod === 'card' ? '2px solid #3B82F6' : '1px solid var(--border-subtle)',
                        background: editPaymentMethod === 'card' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-surface-hover)',
                        color: editPaymentMethod === 'card' ? '#3B82F6' : 'var(--text-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <CreditCard size={18} />
                      <span>Card</span>
                    </button>

                    {/* Split */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditPaymentMethod('split');
                        if (!editSplitCash && !editSplitUpi) {
                          setEditSplitCash((editNewTotal / 2).toFixed(2));
                          setEditSplitUpi((editNewTotal - (editNewTotal / 2)).toFixed(2));
                        }
                      }}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 'var(--radius-lg)',
                        border: editPaymentMethod === 'split' ? '2px solid #F59E0B' : '1px solid var(--border-subtle)',
                        background: editPaymentMethod === 'split' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-surface-hover)',
                        color: editPaymentMethod === 'split' ? '#F59E0B' : 'var(--text-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Split size={18} />
                      <span>Split</span>
                    </button>
                  </div>
                </div>

                {/* Split Amount Breakdown Inputs if 'split' */}
                {editPaymentMethod === 'split' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'rgba(245, 158, 11, 0.05)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          Cash Portion (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editSplitCash}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditSplitCash(val);
                            const c = parseFloat(val) || 0;
                            setEditSplitUpi(Math.max(0, editNewTotal - c).toFixed(2));
                          }}
                          placeholder="0.00"
                          className="form-input"
                          style={{ marginTop: '4px', width: '100%', fontWeight: 800, fontFamily: 'monospace' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          UPI Portion (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editSplitUpi}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditSplitUpi(val);
                            const u = parseFloat(val) || 0;
                            setEditSplitCash(Math.max(0, editNewTotal - u).toFixed(2));
                          }}
                          placeholder="0.00"
                          className="form-input"
                          style={{ marginTop: '4px', width: '100%', fontWeight: 800, fontFamily: 'monospace' }}
                        />
                      </div>
                    </div>

                    {/* Validation Status */}
                    {(() => {
                      const c = parseFloat(editSplitCash) || 0;
                      const u = parseFloat(editSplitUpi) || 0;
                      const isMatch = Math.abs((c + u) - editNewTotal) <= 0.05;
                      return (
                        <div
                          style={{
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            color: isMatch ? '#10B981' : '#EF4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {isMatch ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                            <span>
                              Total: ₹{c.toFixed(2)} + ₹{u.toFixed(2)} = ₹{(c + u).toFixed(2)} {isMatch ? '(Matches Payable)' : `(Mismatch by ₹${Math.abs(editNewTotal - (c + u)).toFixed(2)})`}
                            </span>
                          </div>
                          {!isMatch && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditSplitCash((editNewTotal / 2).toFixed(2));
                                setEditSplitUpi((editNewTotal - (editNewTotal / 2)).toFixed(2));
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#F59E0B',
                                fontSize: '0.70rem',
                                fontWeight: 800,
                                textDecoration: 'underline',
                                cursor: 'pointer',
                              }}
                            >
                              Auto Split 50/50
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Notes / Reason */}
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                    Reason / Remark (Audited in Log)
                  </label>
                  <input
                    type="text"
                    value={editPaymentNotes}
                    onChange={(e) => setEditPaymentNotes(e.target.value)}
                    placeholder="e.g. Corrected quantity of sheet mask, customer paid via UPI"
                    className="form-input"
                    style={{ marginTop: '4px', width: '100%', fontSize: '0.80rem' }}
                  />
                </div>

                {/* Error Message */}
                {paymentUpdateError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{paymentUpdateError}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  padding: '14px 24px',
                  background: 'var(--bg-surface-solid)',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Total Items: <strong>{totalUnitsInBill} units</strong> &bull; Payable: <strong style={{ color: '#10B981' }}>₹{editNewTotal.toFixed(2)}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingOrderForPayment(null)}
                    disabled={isSavingPaymentMethod}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontWeight: 700 }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePaymentMethod}
                    disabled={isSavingPaymentMethod || editOrderItems.length === 0}
                    className="btn btn-primary"
                    style={{
                      padding: '8px 22px',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {isSavingPaymentMethod ? (
                      <>
                        <RefreshCw size={14} className="spin" />
                        <span>Updating Ledger...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Product / Bill Return Modal */}
      <ProductReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        activeShift={activeShift}
        currentUser={currentUser}
        onReturnSuccess={(result) => {
          showNotification('success', result.message || 'Return processed successfully!');
          loadShiftBillingOrders();
          loadActiveRegisterShift();
          loadStoreItems();
        }}
      />
    </div>
  );
}
