import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  ArrowUpDown,
  Plus,
  Phone,
  Mail,
  ShoppingBag,
  Calendar,
  Clock,
  Receipt,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Award,
  Sparkles,
  Printer,
  MessageCircle,
  Copy,
  MapPin,
  Crown,
  CreditCard,
  Radio,
  RefreshCw,
  Zap,
  Lock,
  Unlock,
  RotateCcw,
  Banknote,
  QrCode,
  FileDown,
  FileText,
} from 'lucide-react';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  detachVipCard,
  deleteCustomer,
  getCustomerHistory,
  assignVipCard,
  rechargeVipCard,
  inspectCard,
  recordOrderDuePayment,
} from '../api';
import CardLookupModal from './CardLookupModal';
import TimeRangeFilter, { filterLogsByTimeRange } from './TimeRangeFilter';
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



export default function CustomersView({
  currentUser,
  stores = [],
  effectiveStoreId = '',
  onBackToLauncher,
  onNavigateToBilling,
}) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('most_purchases');
  const [notification, setNotification] = useState(null);

  // Store filtering
  const [selectedStoreFilter, setSelectedStoreFilter] = useState(
    (!currentUser?.is_owner && currentUser?.store)
      ? String(currentUser.store)
      : (effectiveStoreId || (stores[0]?.id ? String(stores[0].id) : ''))
  );

  useEffect(() => {
    if (!currentUser?.is_owner && currentUser?.store) {
      setSelectedStoreFilter(String(currentUser.store));
    } else if (effectiveStoreId && !selectedStoreFilter) {
      setSelectedStoreFilter(String(effectiveStoreId));
    }
  }, [effectiveStoreId, currentUser]);

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    email: '',
    address: '',
    notes: '',
    store: '',
    vip_card_uid: '',
    vip_card_status: 'inactive',
    vip_card_balance: '',
  });

  // History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState(null);
  const [customerHistoryOrders, setCustomerHistoryOrders] = useState([]);
  const [customerHistoryTimeFilter, setCustomerHistoryTimeFilter] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Receipt Preview / Print Modal
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // VIP Card Modals State
  const [vipSettings, setVipSettings] = useState(getVipSettings);
  const [isCardLookupOpen, setIsCardLookupOpen] = useState(false);
  const [isAssignCardModalOpen, setIsAssignCardModalOpen] = useState(false);
  const [customerForAssign, setCustomerForAssign] = useState(null);
  const [assignCardUid, setAssignCardUid] = useState('');
  const [assignCardOwnership, setAssignCardOwnership] = useState(null);
  const [isCheckingAssignCard, setIsCheckingAssignCard] = useState(false);
  const [assignInitialCredit, setAssignInitialCredit] = useState('500');
  const [assignPaymentMethod, setAssignPaymentMethod] = useState('cash');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignManualModeOverride, setAssignManualModeOverride] = useState(true);

  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [customerForRecharge, setCustomerForRecharge] = useState(null);
  const [rechargeAmount, setRechargeAmount] = useState('500');
  const [rechargePaymentMethod, setRechargePaymentMethod] = useState('cash');
  const [rechargeNotes, setRechargeNotes] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);

  // Khata / Due Payment Settlement Modal State
  const [isDuePaymentModalOpen, setIsDuePaymentModalOpen] = useState(false);
  const [orderForDuePayment, setOrderForDuePayment] = useState(null);
  const [duePaymentAmount, setDuePaymentAmount] = useState('');
  const [duePaymentMethod, setDuePaymentMethod] = useState('cash');
  const [duePaymentNotes, setDuePaymentNotes] = useState('');
  const [duePaymentReference, setDuePaymentReference] = useState('');
  const [isSubmittingDuePayment, setIsSubmittingDuePayment] = useState(false);

  // USB RFID Reader Connection & Scan State
  const [rfidStatus, setRfidStatus] = useState(getRfidStatus());

  useEffect(() => {
    return onRfidStatusChange(setRfidStatus);
  }, []);

  const handleToggleRfidConnect = async () => {
    if (rfidStatus.isConnected) {
      await disconnectRfidReader();
      showNotification('info', 'Arduino RFID Reader disconnected.');
    } else {
      try {
        const connected = await connectRfidReader({ baudRate: 9600 });
        if (connected) {
          showNotification('success', 'Arduino RFID Reader connected on USB COM port at 9600 baud!');
        }
      } catch (err) {
        showNotification('error', err.message || 'Failed to connect USB RFID reader.');
      }
    }
  };

  // Live RFID Serial Scanner Listener (Auto-populate active card forms)
  useEffect(() => {
    const handleScan = (e) => {
      const scannedUid = e.detail?.uid;
      if (!scannedUid) return;

      if (isAssignCardModalOpen) {
        setAssignCardUid(scannedUid);
        playVipAcceptedSound();
        showNotification('success', `⚡ Card Scanned: ${scannedUid}`);
      } else if (isCustomerModalOpen) {
        setFormData((prev) => ({ ...prev, vip_card_uid: scannedUid }));
        playVipAcceptedSound();
        showNotification('success', `⚡ Card Scanned: ${scannedUid}`);
      } else {
        setSearchQuery(scannedUid);
        playVipAcceptedSound();
        showNotification('success', `⚡ Card Detected: ${scannedUid}`);
      }
    };

    window.addEventListener('wondersale_rfid_scan', handleScan);
    return () => window.removeEventListener('wondersale_rfid_scan', handleScan);
  }, [isAssignCardModalOpen, isCustomerModalOpen]);

  // Real-time live card validation & cross-domain conflict check when assigning VIP card
  useEffect(() => {
    if (!isAssignCardModalOpen || !assignCardUid.trim()) {
      setAssignCardOwnership(null);
      setIsCheckingAssignCard(false);
      return;
    }
    const cleanUid = assignCardUid.trim();
    let isMounted = true;
    setIsCheckingAssignCard(true);
    const timer = setTimeout(async () => {
      try {
        const res = await inspectCard(cleanUid);
        if (isMounted) {
          setAssignCardOwnership(res);
        }
      } catch (err) {
        console.error('VIP Card check failed:', err);
      } finally {
        if (isMounted) setIsCheckingAssignCard(false);
      }
    }, 280);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [assignCardUid, isAssignCardModalOpen]);

  // Sync settings when updated in SettingsView
  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail) setVipSettings(e.detail);
    };
    window.addEventListener('wondersale_vip_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('wondersale_vip_settings_updated', handleSettingsUpdated);
  }, []);

  const handleOpenAssignCardModal = (cust) => {
    const currentSettings = getVipSettings();
    setVipSettings(currentSettings);
    setCustomerForAssign(cust);
    setAssignCardUid('');
    setAssignInitialCredit(currentSettings.initialCredit || '500');
    setAssignPaymentMethod('cash');
    setAssignManualModeOverride(currentSettings.manualMode);
    setIsAssignCardModalOpen(true);
    playVipReadySound();
  };

  const handleConfirmAssignCard = async (e) => {
    e.preventDefault();
    if (!customerForAssign) return;
    const cleanUid = assignCardUid.trim();
    if (!cleanUid) {
      showNotification('error', 'Please tap an RFID card or enter a valid Card UID.');
      return;
    }

    setIsAssigning(true);
    try {
      const updatedCust = await assignVipCard(customerForAssign.id, {
        card_uid: cleanUid,
        initial_credit: parseFloat(assignInitialCredit) || 500,
        payment_method: assignPaymentMethod,
      });
      playVipAcceptedSound();
      showNotification('success', `VIP Card "${cleanUid}" assigned to ${updatedCust.display_name} with ₹${updatedCust.vip_card_balance} credits (${assignPaymentMethod.toUpperCase()})!`);
      setIsAssignCardModalOpen(false);
      setCustomerForAssign(null);
      loadCustomers();
    } catch (err) {
      console.error('Failed to assign card:', err);
      playVipRejectedSound();
      showNotification('error', err.message || 'Failed to assign VIP Card.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenRechargeModal = (cust) => {
    const currentSettings = getVipSettings();
    setVipSettings(currentSettings);
    setCustomerForRecharge(cust);
    setRechargeAmount(currentSettings.rechargePresets?.[0] || '500');
    setRechargePaymentMethod('cash');
    setRechargeNotes('In-store recharge');
    setIsRechargeModalOpen(true);
  };

  const handleConfirmRecharge = async (e) => {
    e.preventDefault();
    if (!customerForRecharge) return;
    const amt = parseFloat(rechargeAmount);
    if (isNaN(amt) || amt <= 0) {
      showNotification('error', 'Please enter a valid recharge amount greater than 0.');
      return;
    }

    setIsRecharging(true);
    try {
      const updatedCust = await rechargeVipCard(customerForRecharge.id, {
        amount: amt,
        payment_method: rechargePaymentMethod,
        notes: rechargeNotes.trim() || `In-store ${rechargePaymentMethod.toUpperCase()} recharge`,
      });
      playVipAcceptedSound();
      showNotification('success', `Recharged ₹${amt} credits via ${rechargePaymentMethod.toUpperCase()}! New balance: ₹${updatedCust.vip_card_balance}`);
      setIsRechargeModalOpen(false);
      setCustomerForRecharge(null);
      loadCustomers();
    } catch (err) {
      console.error('Failed to recharge VIP card:', err);
      playVipRejectedSound();
      showNotification('error', err.message || 'Failed to recharge VIP card.');
    } finally {
      setIsRecharging(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [searchQuery, sortBy, selectedStoreFilter]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params = { search: searchQuery, sort: sortBy };
      if (selectedStoreFilter) {
        params.store = selectedStoreFilter;
      }
      const data = await getCustomers(params);
      const list = Array.isArray(data) ? data : data.results || [];
      setCustomers(list);
    } catch (err) {
      console.error('Failed to load customers:', err);
      showNotification('error', 'Could not load customer profiles.');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      phone: '',
      name: '',
      email: '',
      address: '',
      notes: '',
      store: selectedStoreFilter || effectiveStoreId || (currentUser?.store ? String(currentUser.store) : (stores[0]?.id ? String(stores[0].id) : '')),
      vip_card_uid: '',
      vip_card_status: 'inactive',
      vip_card_balance: '',
    });
    setIsCustomerModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cust) => {
    setEditingCustomer(cust);
    setFormData({
      phone: cust.phone || '',
      name: cust.name || '',
      email: cust.email || '',
      address: cust.address || '',
      notes: cust.notes || '',
      store: cust.store ? String(cust.store) : (selectedStoreFilter || effectiveStoreId || ''),
      vip_card_uid: cust.vip_card_uid || '',
      vip_card_status: cust.vip_card_status || 'inactive',
      vip_card_balance: cust.vip_card_balance !== undefined && cust.vip_card_balance !== null ? String(cust.vip_card_balance) : '',
    });
    setIsCustomerModalOpen(true);
  };

  // Save Customer (Create / Edit)
  const handleSaveCustomer = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanPhone = formData.phone.replace(/\D/g, '').trim();
    if (cleanPhone.length !== 10) {
      showNotification('error', 'Customer phone number must be exactly 10 digits (no more, no less).');
      return null;
    }

    try {
      const cleanUid = formData.vip_card_uid && formData.vip_card_uid.trim() ? formData.vip_card_uid.trim().toUpperCase() : null;
      const payload = {
        ...formData,
        phone: cleanPhone,
        vip_card_uid: cleanUid,
        vip_card_status: cleanUid ? (formData.vip_card_status || 'active') : 'inactive',
      };

      if (!payload.store) {
        payload.store = selectedStoreFilter || effectiveStoreId || (currentUser?.store ? String(currentUser.store) : null);
      }

      if (cleanUid) {
        if (payload.vip_card_balance !== '' && payload.vip_card_balance !== undefined && payload.vip_card_balance !== null) {
          payload.vip_card_balance = parseFloat(payload.vip_card_balance) || 0;
        } else {
          payload.vip_card_balance = 0;
        }
      } else {
        payload.vip_card_balance = 0;
      }

      let savedCustomer;
      if (editingCustomer) {
        savedCustomer = await updateCustomer(editingCustomer.id, payload);
        showNotification('success', `Customer ${payload.name || payload.phone} updated.`);
      } else {
        savedCustomer = await createCustomer(payload);
        showNotification('success', `Customer ${payload.name || payload.phone} registered.`);
      }
      setIsCustomerModalOpen(false);
      loadCustomers();
      return savedCustomer;
    } catch (err) {
      showNotification('error', err.message || 'Failed to save customer.');
      return null;
    }
  };

  // Detach VIP Card from customer
  const handleDetachCard = async () => {
    if (!window.confirm('Are you sure you want to detach and remove this VIP Card from the customer?')) {
      return;
    }

    if (editingCustomer?.id) {
      try {
        const updated = await detachVipCard(editingCustomer.id);
        setEditingCustomer(updated);
        setFormData((prev) => ({
          ...prev,
          vip_card_uid: '',
          vip_card_balance: '',
          vip_card_status: 'inactive',
        }));
        showNotification('success', `VIP Card detached successfully from ${updated.display_name}.`);
        loadCustomers();
      } catch (err) {
        showNotification('error', err.message || 'Failed to detach VIP Card.');
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        vip_card_uid: '',
        vip_card_balance: '',
        vip_card_status: 'inactive',
      }));
      showNotification('info', 'VIP Card removed from form.');
    }
  };

  // Assign VIP RFID Card directly from customer modal
  const handleAssignCardFromModal = async () => {
    if (editingCustomer) {
      setIsCustomerModalOpen(false);
      handleOpenAssignCardModal(editingCustomer);
    } else {
      const cleanPhone = formData.phone.replace(/\D/g, '').trim();
      if (cleanPhone.length !== 10) {
        showNotification('error', 'Please enter a valid 10-digit phone number before assigning a VIP card.');
        return;
      }
      const saved = await handleSaveCustomer();
      if (saved) {
        handleOpenAssignCardModal(saved);
      }
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (cust) => {
    if (window.confirm(`Are you sure you want to delete customer profile "${cust.name || cust.phone}"?`)) {
      try {
        await deleteCustomer(cust.id);
        showNotification('success', 'Customer deleted successfully.');
        loadCustomers();
      } catch (err) {
        showNotification('error', err.message || 'Failed to delete customer.');
      }
    }
  };

  // Open Purchase History Modal
  const handleViewHistory = async (cust) => {
    setSelectedCustomerForHistory(cust);
    setIsHistoryOpen(true);
    setLoadingHistory(true);
    try {
      // Re-fetch customer list in background to sync updated lifetime spend post-returns
      getCustomers().then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setCustomers(list);
        const freshCust = list.find((c) => c.id === cust.id);
        if (freshCust) setSelectedCustomerForHistory(freshCust);
      }).catch(() => {});

      const params = {};
      if (customerHistoryTimeFilter?.active) {
        if (customerHistoryTimeFilter.startTime) params.start_time = customerHistoryTimeFilter.startTime;
        if (customerHistoryTimeFilter.endTime) params.end_time = customerHistoryTimeFilter.endTime;
      }
      const orders = await getCustomerHistory(cust.id, params);
      setCustomerHistoryOrders(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.error('Failed to load history:', err);
      showNotification('error', 'Could not load customer purchase history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isHistoryOpen && selectedCustomerForHistory) {
      handleViewHistory(selectedCustomerForHistory);
    }
  }, [customerHistoryTimeFilter]);

  // ---------------- Receipt & WhatsApp Actions for Customer Invoices ----------------

  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [waCooldownActive, setWaCooldownActive] = useState(false);

  const handleSendWhatsApp = async (order, force = false) => {
    if (!order || isSendingWhatsApp) return;
    setIsSendingWhatsApp(true);
    showNotification('info', force ? 'Force dispatching bill PDF to WhatsApp...' : 'Generating bill PDF and sending directly to WhatsApp...');

    const storeObj = stores?.find((s) => s.id === order.store_id || s.name === order.store_name);
    const targetCustomer = selectedCustomerForHistory || {
      phone: order.customer_phone || (order.customer && order.customer.phone) || '',
      name: order.customer_name || (order.customer && order.customer.name) || 'Dear Customer'
    };

    let pdfBlob = null;
    // Capture visual receipt element if modal is currently open for this order
    const receiptEl = document.getElementById('printable-pos-receipt');
    if (receiptEl && selectedOrderForReceipt && selectedOrderForReceipt.id === order.id) {
      try {
        pdfBlob = await generateReceiptPdfBlob(order.invoice_number || 'bill', receiptEl);
      } catch (e) {
        console.warn('Could not capture onscreen receipt blob:', e);
      }
    }

    try {
      await sendWhatsAppReceipt(
        order,
        storeObj,
        targetCustomer,
        (feedback) => {
          const isReturnOrder = Boolean(
            order.is_return ||
            (order.invoice_number && String(order.invoice_number).startsWith('RET-')) ||
            order.return_reference ||
            order.status === 'refunded'
          );
          const typeLabel = isReturnOrder ? 'Return voucher' : 'Bill';
          if (feedback.success) {
            setWaCooldownActive(false);
            showNotification('success', feedback.message || `${typeLabel} #${order.invoice_number} sent directly to WhatsApp!`);
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


  // ---------------- Khata Due Payment Settlement Handlers ----------------
  const handleOpenDuePaymentModal = (order) => {
    setOrderForDuePayment(order);
    setDuePaymentAmount(parseFloat(order.balance_due || 0).toFixed(2));
    setDuePaymentMethod('cash');
    setDuePaymentNotes('');
    setDuePaymentReference('');
    setIsDuePaymentModalOpen(true);
  };

  const handleSubmitDuePayment = async (e) => {
    e?.preventDefault();
    if (!orderForDuePayment) return;
    const amt = parseFloat(duePaymentAmount) || 0;
    const maxDue = parseFloat(orderForDuePayment.balance_due || 0);
    if (amt <= 0) {
      showNotification('error', 'Payment amount must be greater than zero.');
      return;
    }
    if (amt > maxDue) {
      showNotification('error', `Amount cannot exceed current outstanding due of ₹${maxDue.toFixed(2)}.`);
      return;
    }

    setIsSubmittingDuePayment(true);
    try {
      const res = await recordOrderDuePayment(orderForDuePayment.id, {
        amount: amt.toFixed(2),
        payment_method: duePaymentMethod,
        notes: duePaymentNotes.trim() || `Customer settlement via ${duePaymentMethod.toUpperCase()}`,
        transaction_reference: duePaymentReference.trim(),
      });

      // Update customerHistoryOrders
      const updatedOrder = res.order;
      setCustomerHistoryOrders((prev) =>
        prev.map((o) => (o.id === orderForDuePayment.id ? { ...o, ...updatedOrder } : o))
      );

      // Update customer's total_outstanding_dues in customers list
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === selectedCustomerForHistory?.id) {
            const newDues = Math.max(0, parseFloat(c.total_outstanding_dues || 0) - amt);
            return { ...c, total_outstanding_dues: newDues };
          }
          return c;
        })
      );

      // Update selectedCustomerForHistory
      if (selectedCustomerForHistory) {
        setSelectedCustomerForHistory((prev) => ({
          ...prev,
          total_outstanding_dues: Math.max(0, parseFloat(prev.total_outstanding_dues || 0) - amt),
        }));
      }

      showNotification(
        'success',
        `Collected ₹${amt.toFixed(2)} (${duePaymentMethod.toUpperCase()}) for #${orderForDuePayment.invoice_number}! Remaining Due: ₹${Math.max(0, maxDue - amt).toFixed(2)}`
      );
      setIsDuePaymentModalOpen(false);
      setOrderForDuePayment(null);
    } catch (err) {
      showNotification('error', err.message || 'Failed to record due payment');
    } finally {
      setIsSubmittingDuePayment(false);
    }
  };

  const handleOpenReceipt = (order) => {
    setSelectedOrderForReceipt(order);
    setIsReceiptModalOpen(true);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleSaveAsPdf = (order = selectedOrderForReceipt) => {
    if (!order) return;
    saveReceiptAsPdf(order.invoice_number || 'bill');
  };

  const handleCopyBillText = (order) => {
    if (!order) return;
    const itemsList =
      order.items
        ?.map((item, idx) => `${idx + 1}. ${item.item_name} (Qty: ${item.quantity} × ₹${item.unit_selling_price} = ₹${item.total_price})`)
        .join('\n') || '';
    const storeName = order.store_name || 'Wondersale';
    const custName = selectedCustomerForHistory?.name || order.customer_name || (selectedCustomerForHistory?.display_name && !selectedCustomerForHistory?.display_name.startsWith('Customer (') ? selectedCustomerForHistory?.display_name : '') || selectedCustomerForHistory?.phone || '';
    const isReturn = Boolean(
      order.is_return ||
      (order.invoice_number && order.invoice_number.startsWith('RET-')) ||
      order.return_reference ||
      order.status === 'refunded'
    );
    const titleLine = isReturn ? `Return Voucher #${order.invoice_number}` : `Invoice #${order.invoice_number}`;
    const totalLine = isReturn
      ? `Total Refund: -₹${order.total_amount} (Refunded)`
      : `Total Bill: ₹${order.total_amount}` +
        (parseFloat(order.balance_due || 0) > 0
          ? `\nPaid So Far: ₹${parseFloat(order.amount_paid || 0).toFixed(2)}\nOutstanding Due (Khata): ₹${parseFloat(order.balance_due).toFixed(2)}`
          : `\nStatus: Paid in Full`);
    const termsRaw = !isReturn ? getReceiptTermsText() : '';
    const termsSection = termsRaw ? `\n\nTERMS & CONDITIONS\n${termsRaw.replace(/\*\*/g, '')}` : '';

    const text =
      `${storeName} - ${titleLine}\n` +
      (order.return_reference ? `Original Bill: #${order.return_reference}\n` : '') +
      (custName ? `Customer: ${custName}\n` : '') +
      `Date: ${new Date(order.created_at).toLocaleString()}\n` +
      `Items:\n${itemsList}\n` +
      `${totalLine}\n` +
      `Thank you for shopping with us!` +
      termsSection;

    navigator.clipboard?.writeText(text);
    showNotification('success', isReturn ? 'Return voucher summary copied!' : 'Invoice details (with Terms & Conditions & Dues) copied to clipboard!');
  };

  // Calculate Metrics
  const totalCustomersCount = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.total_spent || 0), 0);
  const totalOrdersCount = customers.reduce((sum, c) => sum + (c.total_purchases_count || 0), 0);
  const avgOrderValue = totalOrdersCount > 0 ? (totalRevenue / totalOrdersCount).toFixed(2) : '0.00';
  const repeatCustomersCount = customers.filter((c) => c.total_purchases_count > 1).length;
  const totalCustomerDues = customers.reduce((sum, c) => sum + parseFloat(c.total_outstanding_dues || 0), 0);
  const customersWithDuesCount = customers.filter((c) => parseFloat(c.total_outstanding_dues || 0) > 0).length;

  return (
    <div
      className="customers-view-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        gap: '20px',
        padding: '20px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Customers Main Content Section (Hidden completely when printing receipt) */}
      <div className="customers-view-main-content no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        {/* Top Header */}
      <div
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBackToLauncher}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Menu</span>
          </button>

          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(8, 145, 178, 0.2))',
              color: '#06B6D4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(6, 182, 212, 0.3)',
            }}
          >
            <Users size={20} />
          </div>

          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Customer Directory &amp; Profiles
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Customer accounts, purchase frequency, lifetime spend &amp; bill history
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {onNavigateToBilling && (
            <button
              type="button"
              onClick={onNavigateToBilling}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Receipt size={14} />
              <span>Go to Billing &amp; POS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCardLookupOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Scan or enter any card to inspect owner, details & status across system"
          >
            <CreditCard size={14} />
            <span>Check Card</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="btn btn-primary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #06B6D4, #0284C7)',
            }}
          >
            <Plus size={15} />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            fontWeight: 600,
            background: notification.type === 'error' ? 'var(--color-danger-bg)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${notification.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            color: notification.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ flex: 1 }}>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Summary KPI Cards Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(6, 182, 212, 0.15)',
              color: '#06B6D4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Customers
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              {totalCustomersCount}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Customer Revenue
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
              ₹{totalRevenue.toFixed(2)}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingBag size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Avg Order Value
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              ₹{avgOrderValue}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#A855F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Award size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Repeat Customers
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              {repeatCustomersCount}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: totalCustomerDues > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: totalCustomerDues > 0 ? '#F59E0B' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Outstanding Dues (Khata)
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: totalCustomerDues > 0 ? '#F59E0B' : 'var(--text-main)', marginTop: '2px' }}>
              ₹{totalCustomerDues.toFixed(2)}
              {customersWithDuesCount > 0 && (
                <span style={{ fontSize: '0.70rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '6px' }}>
                  ({customersWithDuesCount} debtor{customersWithDuesCount !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Sorting Bar (Matching Inventory View Theme) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer phone, name, email..."
            className="form-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              paddingLeft: '38px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.86rem',
              height: '38px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
          <ArrowUpDown size={15} style={{ color: 'var(--text-muted)' }} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="form-select"
            style={{
              width: '230px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.84rem',
              padding: '0 14px',
              height: '38px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
            }}
          >
            <option value="most_purchases">Sort: Most Purchases (Total Spent)</option>
            <option value="frequently_bought">Sort: Frequently Bought (Order Count)</option>
            <option value="recent">Sort: Recently Active (Last Visit)</option>
            <option value="name">Sort: Name (A → Z)</option>
            <option value="newest">Sort: Newest Registered</option>
          </select>
        </div>

        {/* Location / Branch Filter */}
        {currentUser?.is_owner ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <MapPin size={15} style={{ color: '#06B6D4' }} />
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="form-select"
              style={{
                width: '210px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.84rem',
                padding: '0 14px',
                height: '38px',
                background: 'var(--bg-input)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                color: 'var(--text-main)',
                fontWeight: 600,
              }}
            >
              <option value="">🌐 All Branches (Owner View)</option>
              {stores.map((st) => (
                <option key={st.id} value={String(st.id)}>
                  📍 {st.name} {st.city ? `(${st.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              color: '#06B6D4',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            <MapPin size={14} />
            <span>
              {stores.find((s) => String(s.id) === String(currentUser?.store))?.name || 'Assigned Branch'}
            </span>
          </div>
        )}
      </div>

      {/* Customer Directory Table */}
      <div
        style={{
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-muted)',
                  fontSize: '0.74rem',
                  textTransform: 'uppercase',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '12px 18px' }}>Customer Profile</th>
                <th style={{ padding: '12px 16px' }}>Phone Number</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Total Orders</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Lifetime Spend</th>
                <th style={{ padding: '12px 16px' }}>Last Purchase</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length > 0 ? (
                customers.map((cust) => {
                  const initial = (cust.name?.trim() || cust.phone.slice(-4) || 'C').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={cust.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      {/* Name & Avatar */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(8, 145, 178, 0.25))',
                              color: '#06B6D4',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              border: '1px solid rgba(6, 182, 212, 0.3)',
                            }}
                          >
                            {initial}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                {cust.name ? cust.name : <span style={{ color: 'var(--text-muted)' }}>Name Not Specified</span>}
                              </span>
                              {cust.store_name && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-pill)',
                                    background: 'rgba(6, 182, 212, 0.12)',
                                    color: '#06B6D4',
                                    border: '1px solid rgba(6, 182, 212, 0.25)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <MapPin size={10} />
                                  {cust.store_name}
                                </span>
                              )}
                            </div>
                            {cust.email && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {cust.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone & Badges */}
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                        <div>{cust.phone}</div>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                          {parseFloat(cust.total_outstanding_dues || 0) > 0 ? (
                            <span
                              style={{
                                fontSize: '0.70rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(245, 158, 11, 0.18)',
                                color: '#F59E0B',
                                border: '1px solid rgba(245, 158, 11, 0.45)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleViewHistory(cust)}
                              title={`Click to view bill history & settle pending dues of ₹${parseFloat(cust.total_outstanding_dues).toFixed(2)}`}
                            >
                              <AlertCircle size={11} />
                              <span>Khata Due: ₹{parseFloat(cust.total_outstanding_dues).toFixed(2)}</span>
                            </span>
                          ) : null}
                          {cust.vip_card_uid ? (
                            <span
                              style={{
                                fontSize: '0.70rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#F59E0B',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title={`Assigned RFID Card: ${cust.vip_card_uid}`}
                            >
                              <Crown size={11} />
                              <span>₹{parseFloat(cust.vip_card_balance || 0).toFixed(2)} Credits</span>
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Total Orders */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-pill)',
                            background: cust.total_purchases_count > 0 ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-surface-hover)',
                            color: cust.total_purchases_count > 0 ? '#06B6D4' : 'var(--text-muted)',
                          }}
                        >
                          {cust.total_purchases_count} order{cust.total_purchases_count !== 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Lifetime Spend */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#10B981', fontSize: '0.96rem' }}>
                        ₹{parseFloat(cust.total_spent || 0).toFixed(2)}
                      </td>

                      {/* Last Purchase */}
                      <td style={{ padding: '14px 16px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {cust.last_purchase_date
                          ? new Date(cust.last_purchase_date).toLocaleDateString()
                          : <span style={{ color: 'var(--text-muted)' }}>Never</span>}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* VIP Card Assign / Recharge Button */}
                          {cust.vip_card_uid ? (
                            <button
                              type="button"
                              onClick={() => handleOpenRechargeModal(cust)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.74rem',
                                padding: '4px 10px',
                                color: '#F59E0B',
                                borderColor: 'rgba(245, 158, 11, 0.4)',
                                background: 'rgba(245, 158, 11, 0.08)',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Recharge VIP Card balance"
                            >
                              <CreditCard size={13} />
                              <span>Recharge</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenAssignCardModal(cust)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.74rem',
                                padding: '4px 10px',
                                color: '#F59E0B',
                                borderColor: 'rgba(245, 158, 11, 0.4)',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Assign new VIP RFID Card to this customer"
                            >
                              <Crown size={13} />
                              <span>+ VIP Card</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleViewHistory(cust)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: '0.74rem',
                              padding: '4px 8px',
                              borderColor: parseFloat(cust.total_outstanding_dues || 0) > 0 ? 'rgba(245, 158, 11, 0.45)' : undefined,
                              color: parseFloat(cust.total_outstanding_dues || 0) > 0 ? '#F59E0B' : undefined,
                              background: parseFloat(cust.total_outstanding_dues || 0) > 0 ? 'rgba(245, 158, 11, 0.08)' : undefined,
                              fontWeight: parseFloat(cust.total_outstanding_dues || 0) > 0 ? 800 : 500,
                            }}
                            title={parseFloat(cust.total_outstanding_dues || 0) > 0 ? `View bills and collect outstanding due: ₹${parseFloat(cust.total_outstanding_dues).toFixed(2)}` : 'View past receipts & bills'}
                          >
                            <Receipt size={13} style={{ marginRight: '4px' }} />
                            <span>{parseFloat(cust.total_outstanding_dues || 0) > 0 ? `Khata (₹${parseFloat(cust.total_outstanding_dues).toFixed(0)})` : 'Bills'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cust)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px' }}
                            title="Edit customer details"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(cust)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', color: 'var(--color-danger)' }}
                            title="Delete customer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={38} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>No Customers Found</div>
                    <p style={{ fontSize: '0.78rem', maxWidth: '300px', margin: '4px auto 0', lineHeight: 1.4 }}>
                      Customers registered during checkout or added manually will appear in this directory.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      {isCustomerModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setIsCustomerModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '540px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface-solid, #161B2C)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: editingCustomer?.vip_card_uid
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.35))'
                      : 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(2, 132, 199, 0.35))',
                    border: editingCustomer?.vip_card_uid ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(6, 182, 212, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: editingCustomer?.vip_card_uid ? '#F59E0B' : 'var(--color-primary, #06B6D4)',
                  }}
                >
                  {editingCustomer?.vip_card_uid ? <Crown size={18} /> : <Users size={18} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                    {editingCustomer ? 'Edit Customer Profile' : 'Add New Customer'}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {editingCustomer
                      ? (editingCustomer.vip_card_uid ? `VIP Member Profile #${editingCustomer.id}` : `Customer #${editingCustomer.id}`)
                      : 'Create a new customer account'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSaveCustomer}
              style={{
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Phone size={12} color="var(--text-muted)" />
                  Phone Number <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="10-digit phone (e.g. 9876543210)"
                    className="form-input"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      paddingLeft: '34px',
                      fontWeight: 600,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <Phone size={14} color="var(--text-muted)" />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Customer Name <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Email Address <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. rahul@example.com"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Address / Notes
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, Pincode or customer preferences..."
                  rows={2}
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              {currentUser?.is_owner && stores.length > 0 && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Assigned Store / Branch
                  </label>
                  <select
                    value={formData.store || ''}
                    onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                    className="form-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Auto-detect / Current Store --</option>
                    {stores.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        📍 {s.name} {s.city ? `(${s.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* VIP CARD SETTINGS SECTION */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: formData.vip_card_uid ? 'rgba(245, 158, 11, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                  border: formData.vip_card_uid ? '1px solid rgba(245, 158, 11, 0.3)' : '1px dashed var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: formData.vip_card_uid ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: formData.vip_card_uid ? '#000' : 'var(--text-muted)',
                        boxShadow: formData.vip_card_uid ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 'none',
                      }}
                    >
                      <Crown size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: formData.vip_card_uid ? '#FCD34D' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        VIP Card & Membership
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formData.vip_card_uid ? 'RFID card credentials, balance and status' : 'Loyalty membership and RFID smart card'}
                      </div>
                    </div>
                  </div>

                  {formData.vip_card_uid ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background:
                            formData.vip_card_status === 'active'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : formData.vip_card_status === 'blocked'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            formData.vip_card_status === 'active'
                              ? '#10B981'
                              : formData.vip_card_status === 'blocked'
                              ? '#EF4444'
                              : '#F59E0B',
                          border: `1px solid ${
                            formData.vip_card_status === 'active'
                              ? 'rgba(16, 185, 129, 0.3)'
                              : formData.vip_card_status === 'blocked'
                              ? 'rgba(239, 68, 68, 0.3)'
                              : 'rgba(245, 158, 11, 0.3)'
                          }`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        ● {formData.vip_card_status || 'active'}
                      </span>
                      <button
                        type="button"
                        onClick={handleDetachCard}
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '3px 9px',
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          color: '#EF4444',
                          borderColor: 'rgba(239, 68, 68, 0.35)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Detach VIP card from customer"
                      >
                        <Trash2 size={11} /> Detach Card
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAssignCardFromModal}
                      className="btn btn-secondary"
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        color: '#F59E0B',
                        borderColor: 'rgba(245, 158, 11, 0.4)',
                        background: 'rgba(245, 158, 11, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Crown size={13} /> Assign VIP RFID Card
                    </button>
                  )}
                </div>

                {formData.vip_card_uid ? (
                  <>
                    {/* Card UID field */}
                    <div>
                      <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                        Card RFID UID
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={formData.vip_card_uid}
                          onChange={(e) => setFormData({ ...formData, vip_card_uid: e.target.value.toUpperCase() })}
                          placeholder="e.g. E280689400005001"
                          className="form-input"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            paddingLeft: '32px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            borderColor: 'rgba(245, 158, 11, 0.4)',
                          }}
                        />
                        <CreditCard
                          size={14}
                          color="#F59E0B"
                          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Status and Balance in 2 columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {/* Card Status */}
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                          Card Status
                        </label>
                        <select
                          value={formData.vip_card_status || 'active'}
                          onChange={(e) => setFormData({ ...formData, vip_card_status: e.target.value })}
                          className="form-select"
                          style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700 }}
                        >
                          <option value="active">🟢 Active (Ready)</option>
                          <option value="inactive">🟡 Inactive (Frozen)</option>
                          <option value="blocked">🔴 Blocked (Lost / Suspended)</option>
                        </select>
                      </div>

                      {/* Card Balance */}
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                          Credit Balance (₹)
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.vip_card_balance}
                            onChange={(e) => setFormData({ ...formData, vip_card_balance: e.target.value })}
                            placeholder="0.00"
                            className="form-input"
                            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '24px', fontWeight: 700 }}
                          />
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#F59E0B', fontWeight: 800, fontSize: '0.85rem' }}>
                            ₹
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick balance topup buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Adjust:</span>
                      {[100, 200, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            const current = parseFloat(formData.vip_card_balance) || 0;
                            setFormData({ ...formData, vip_card_balance: String((current + amt).toFixed(2)) });
                          }}
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            background: 'rgba(245, 158, 11, 0.08)',
                            color: '#FCD34D',
                            cursor: 'pointer',
                          }}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>

                    {/* Savings banner */}
                    {editingCustomer?.total_vip_savings > 0 && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: '#10B981',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                        }}
                      >
                        <Award size={13} />
                        <span>Customer has saved <strong>₹{editingCustomer.total_vip_savings}</strong> with this card.</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    No VIP Card assigned yet. Standard customer account will be created. Click <strong>"Assign VIP RFID Card"</strong> above at any time to issue an RFID card.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px', flexShrink: 0 }}>
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #06B6D4, #0284C7)', fontWeight: 800 }}
                >
                  {editingCustomer ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* CUSTOMER PURCHASE HISTORY MODAL */}
      {isHistoryOpen && selectedCustomerForHistory && (
        <div
          className="customer-history-modal-backdrop no-print"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface-solid, #161B2C)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Purchase &amp; Return History: {selectedCustomerForHistory.display_name}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Phone: {selectedCustomerForHistory.phone}</span>
                  <span>•</span>
                  <span>Lifetime Spend: ₹{parseFloat(selectedCustomerForHistory.total_spent || 0).toFixed(2)}</span>
                  {parseFloat(selectedCustomerForHistory.total_outstanding_dues || 0) > 0 && (
                    <span
                      style={{
                        padding: '1px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'rgba(245, 158, 11, 0.18)',
                        color: '#F59E0B',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertCircle size={11} />
                      Pending Khata: ₹{parseFloat(selectedCustomerForHistory.total_outstanding_dues).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TimeRangeFilter
                  compact={true}
                  filterState={customerHistoryTimeFilter}
                  onFilterChange={setCustomerHistoryTimeFilter}
                />
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Invoices List */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {loadingHistory ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading customer bills...
                </div>
              ) : filterLogsByTimeRange(customerHistoryOrders, customerHistoryTimeFilter, ['created_at']).length > 0 ? (
                filterLogsByTimeRange(customerHistoryOrders, customerHistoryTimeFilter, ['created_at']).map((order) => {
                  const isReturn = Boolean(
                    order.is_return ||
                    (order.invoice_number && order.invoice_number.startsWith('RET-')) ||
                    order.return_reference ||
                    order.status === 'refunded'
                  );
                  const orderDueAmt = parseFloat(order.balance_due || 0);

                  return (
                    <div
                      key={order.id}
                      style={{
                        borderRadius: 'var(--radius-lg)',
                        background: isReturn
                          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(249, 115, 22, 0.02))'
                          : 'var(--bg-surface)',
                        border: isReturn
                          ? '1px solid rgba(239, 68, 68, 0.35)'
                          : orderDueAmt > 0
                          ? '1px solid rgba(245, 158, 11, 0.45)'
                          : '1px solid var(--border-subtle)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {isReturn ? (
                            <RotateCcw size={16} style={{ color: '#EF4444' }} />
                          ) : (
                            <Receipt size={16} style={{ color: orderDueAmt > 0 ? '#F59E0B' : 'var(--brand-primary)' }} />
                          )}
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isReturn ? '#EF4444' : 'var(--text-main)', fontFamily: 'monospace' }}>
                            {order.invoice_number}
                          </span>
                          {isReturn ? (
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(239, 68, 68, 0.16)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              PRODUCT RETURN / REFUND
                            </span>
                          ) : orderDueAmt > 0 ? (
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(245, 158, 11, 0.18)',
                                color: '#F59E0B',
                                border: '1px solid rgba(245, 158, 11, 0.45)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <AlertCircle size={10} />
                              DUE: ₹{orderDueAmt.toFixed(2)} (KHATA)
                            </span>
                          ) : (order.is_fully_paid && (order.payments?.length > 1 || order.payment_method === 'partial')) ? (
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(16, 185, 129, 0.16)',
                                color: '#10B981',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              KHATA SETTLED (PAID IN FULL)
                            </span>
                          ) : order.payment_method === 'partial' ? (
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(236, 72, 153, 0.16)',
                                color: '#EC4899',
                                border: '1px solid rgba(236, 72, 153, 0.4)',
                              }}
                            >
                              PARTIAL SALE
                            </span>
                          ) : null}
                          {order.return_reference && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              (Original Bill: <strong>#{order.return_reference}</strong>)
                            </span>
                          )}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            ({order.store_name})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            {new Date(order.created_at).toLocaleString()}
                          </span>
                          {isReturn ? (
                            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#EF4444' }}>
                              -₹{parseFloat(order.total_amount || 0).toFixed(2)} (Refunded)
                            </span>
                          ) : (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 900, fontSize: '1rem', color: '#10B981' }}>
                                ₹{order.total_amount}
                              </div>
                              {orderDueAmt > 0 && (
                                <div style={{ fontSize: '0.70rem', fontWeight: 800, color: '#F59E0B' }}>
                                  Due: ₹{orderDueAmt.toFixed(2)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Line Items List */}
                      <div style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '0.78rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                              <th style={{ padding: '4px' }}>{isReturn ? 'Returned Item' : 'Item'}</th>
                              <th style={{ padding: '4px', textAlign: 'center' }}>{isReturn ? 'Qty Returned' : 'Qty'}</th>
                              <th style={{ padding: '4px', textAlign: 'right' }}>Unit Price</th>
                              <th style={{ padding: '4px', textAlign: 'right' }}>{isReturn ? 'Refund' : 'Total'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items?.map((it, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px dotted rgba(255,255,255,0.06)' }}>
                                <td style={{ padding: '6px 4px', fontWeight: 600 }}>{it.item_name}</td>
                                <td style={{ padding: '6px 4px', textAlign: 'center' }}>{it.quantity}</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right' }}>₹{it.unit_selling_price}</td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: isReturn ? '#EF4444' : '#10B981' }}>
                                  {isReturn ? `-₹${it.total_price}` : `₹${it.total_price}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Optional Internal Remark (Store Internal Only) */}
                      {order.notes && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.22)',
                            borderRadius: 'var(--radius-sm, 6px)',
                            padding: '7px 10px',
                            fontSize: '0.75rem',
                          }}
                        >
                          <FileText size={15} color="#38BDF8" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <span style={{ fontWeight: 700, color: '#38BDF8', marginRight: '6px' }}>
                              Internal Remark:
                            </span>
                            <span style={{ color: 'var(--text-secondary, #CBD5E1)', wordBreak: 'break-word' }}>
                              {order.notes}
                            </span>
                            <span
                              style={{
                                marginLeft: '8px',
                                fontSize: '0.65rem',
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                              }}
                            >
                              (Not printed on bill)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Khata & Installment Payment Breakdown */}
                      {!isReturn && (order.payment_method === 'partial' || parseFloat(order.balance_due || 0) > 0 || (order.payments && order.payments.length > 0)) && (
                        <div
                          style={{
                            borderRadius: 'var(--radius-md)',
                            background: parseFloat(order.balance_due || 0) > 0 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                            border: `1px solid ${parseFloat(order.balance_due || 0) > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          {/* Summary Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Receipt size={14} color={parseFloat(order.balance_due || 0) > 0 ? '#F59E0B' : '#10B981'} />
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                Khata Settlement Status
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.76rem', flexWrap: 'wrap' }}>
                              <span>Total Bill: <strong>₹{parseFloat(order.total_amount || 0).toFixed(2)}</strong></span>
                              <span style={{ color: '#10B981' }}>Paid: <strong>₹{parseFloat(order.amount_paid || 0).toFixed(2)}</strong></span>
                              {parseFloat(order.balance_due || 0) > 0 ? (
                                <span style={{ color: '#F59E0B', fontWeight: 800 }}>Remaining Due: <strong>₹{parseFloat(order.balance_due).toFixed(2)}</strong></span>
                              ) : (
                                <span style={{ color: '#10B981', fontWeight: 800 }}>✓ Fully Settled</span>
                              )}
                            </div>
                          </div>

                          {/* Payments Installment Log */}
                          {order.payments && order.payments.length > 0 ? (
                            <div style={{ marginTop: '4px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '8px' }}>
                              <div style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Payment &amp; Settlement History ({order.payments.length} transaction{order.payments.length !== 1 ? 's' : ''}):
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {order.payments.map((tx) => (
                                  <div
                                    key={tx.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      fontSize: '0.74rem',
                                      background: 'var(--bg-main)',
                                      padding: '6px 10px',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid var(--border-subtle)',
                                      flexWrap: 'wrap',
                                      gap: '6px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span
                                        style={{
                                          fontSize: '0.64rem',
                                          fontWeight: 800,
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          background: tx.payment_method === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                          color: tx.payment_method === 'cash' ? '#10B981' : '#38BDF8',
                                          textTransform: 'uppercase',
                                        }}
                                      >
                                        {tx.payment_method}
                                      </span>
                                      <span style={{ color: 'var(--text-secondary)' }}>
                                        {new Date(tx.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                      </span>
                                      {tx.collected_by_name && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>
                                          (by {tx.collected_by_name})
                                        </span>
                                      )}
                                      {tx.notes && (
                                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.70rem' }}>
                                          — {tx.notes}
                                        </span>
                                      )}
                                      {tx.transaction_reference && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>
                                          [Ref: {tx.transaction_reference}]
                                        </span>
                                      )}
                                    </div>
                                    <strong style={{ color: '#10B981', fontFamily: 'monospace', fontSize: '0.84rem' }}>
                                      +₹{parseFloat(tx.amount || 0).toFixed(2)}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              No payments recorded yet (100% full udhar/khata).
                            </div>
                          )}
                        </div>
                      )}

                      {/* Invoice Actions: WhatsApp & Print & Copy & Collect Due */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '8px',
                          flexWrap: 'wrap',
                          paddingTop: '6px',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        {!isReturn && parseFloat(order.balance_due || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenDuePaymentModal(order)}
                            className="btn btn-sm"
                            style={{
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                              color: '#000000',
                              borderColor: '#F59E0B',
                              fontWeight: 800,
                              padding: '5px 14px',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                            }}
                            title="Collect payment to settle customer outstanding due"
                          >
                            <DollarSign size={14} />
                            <span>Collect Due (₹{parseFloat(order.balance_due).toFixed(2)})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyBillText(order)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px' }}
                          title={isReturn ? 'Copy return voucher summary' : 'Copy bill summary to clipboard'}
                        >
                          <Copy size={13} />
                          <span>Copy</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(order)}
                          className="btn btn-primary btn-sm"
                          style={{
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: isReturn ? '#DC2626' : '#111827',
                            color: '#FFFFFF',
                            borderColor: isReturn ? '#DC2626' : '#111827',
                            fontWeight: 700,
                            padding: '5px 12px',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                          }}
                          title={isReturn ? 'View and print return voucher' : 'View and print POS receipt'}
                        >
                          {isReturn ? <RotateCcw size={14} /> : <Printer size={14} />}
                          <span>{isReturn ? 'Print Return Voucher' : 'Print Bill'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No past purchase bills found for this customer.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE THERMAL RECEIPT MODAL FOR CUSTOMER BILLS */}
      {isReceiptModalOpen && selectedOrderForReceipt && (
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
          onClick={() => setIsReceiptModalOpen(false)}
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
                const d = new Date(selectedOrderForReceipt.created_at);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const dateStr = `${day}-${month}-${year}`;
                const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                const totalUnits = selectedOrderForReceipt.items?.reduce((sum, it) => sum + it.quantity, 0) || selectedOrderForReceipt.items?.length || 1;
                const totalMrp = selectedOrderForReceipt.items?.reduce((sum, it) => {
                  const mrpVal = parseFloat(it.mrp || it.item_mrp || it.unit_mrp || it.unit_selling_price || 0);
                  return sum + mrpVal * it.quantity;
                }, 0) || parseFloat(selectedOrderForReceipt.subtotal || 0);
                const totalSavings = Math.max(0, totalMrp - parseFloat(selectedOrderForReceipt.total_amount || 0));
                const payMethod = (selectedOrderForReceipt.payment_method || 'cash').toLowerCase();
                const totalAmtFormatted = parseFloat(selectedOrderForReceipt.total_amount || 0).toFixed(2);
                const storeName = selectedOrderForReceipt.store_details?.name || selectedOrderForReceipt.store_name || '';
                const storeAddress = selectedOrderForReceipt.store_details?.address || selectedOrderForReceipt.store_address || '';
                const storePhone = selectedOrderForReceipt.store_details?.phone || selectedOrderForReceipt.store_phone || '';
                const storeGst = selectedOrderForReceipt.store_details?.gst_number || selectedOrderForReceipt.store_gst_number || '';

                const storeContactParts = [];
                if (storeAddress) storeContactParts.push(storeAddress);
                if (storePhone) storeContactParts.push(`M-${storePhone}`);
                const storeContactLine = storeContactParts.join('. ');

                const customerDisplayName = selectedCustomerForHistory?.name || selectedOrderForReceipt.customer_name || (selectedOrderForReceipt.customer_display_name && !selectedOrderForReceipt.customer_display_name.startsWith('Customer (') ? selectedOrderForReceipt.customer_display_name : '') || 'Dear Customer';
                const isReceiptReturn = Boolean(
                  selectedOrderForReceipt.is_return ||
                  selectedOrderForReceipt.invoice_number?.startsWith('RET-') ||
                  selectedOrderForReceipt.return_reference ||
                  selectedOrderForReceipt.status === 'refunded'
                );

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
                      <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '2px', color: isReceiptReturn ? '#EF4444' : '#4B5563', textTransform: 'uppercase', marginTop: '2px' }}>
                        {isReceiptReturn ? 'RETURN & REFUND VOUCHER' : 'FOR BETTER NATION'}
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
                          <div><strong>{isReceiptReturn ? 'VOUCHER NO.' : 'INVOICE NO.'} {selectedOrderForReceipt.invoice_number}</strong></div>
                          {isReceiptReturn && selectedOrderForReceipt.return_reference && (
                            <div><strong>Original Bill:</strong> #{selectedOrderForReceipt.return_reference}</div>
                          )}
                          <div>Name :- {customerDisplayName}</div>
                          <div>Mobile No: {selectedCustomerForHistory?.phone || selectedOrderForReceipt.customer_phone || ''}</div>
                          <div>GST NO : {storeGst}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                          <div>Date:{dateStr}</div>
                          <div>Time:{timeStr}</div>
                          <div style={{ textTransform: 'capitalize' }}>
                            {isReceiptReturn
                              ? 'Refund Mode'
                              : 'Payment mode'}- {
                              payMethod === 'vip_card'
                                ? `VIP Card (${selectedOrderForReceipt.vip_card_uid || 'RFID'})`
                                : payMethod === 'split'
                                ? 'Split (Cash + UPI)'
                                : payMethod === 'partial'
                                ? `Partial / Due (${(selectedOrderForReceipt.initial_payment_method || 'Cash').toUpperCase()})`
                                : (payMethod === 'card' ? 'Card' : (selectedOrderForReceipt.payment_method || 'Cash'))
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
                          {selectedOrderForReceipt.items?.map((item, i) => {
                            const mrpVal = parseFloat(item.mrp || item.item_mrp || item.unit_mrp || item.unit_selling_price || 0);
                            const rateVal = parseFloat(item.unit_selling_price || 0);
                            const discountVal = Math.max(0, (mrpVal - rateVal) * item.quantity);
                            const lineTotal = parseFloat(item.total_price || (rateVal * item.quantity));
                            return (
                              <React.Fragment key={i}>
                                <tr>
                                  <td colSpan={5} style={{ paddingTop: '5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', lineHeight: 1.25 }}>
                                    {item.item_name}
                                  </td>
                                </tr>
                                <tr style={{ borderBottom: i < selectedOrderForReceipt.items.length - 1 ? '1px dotted #E5E7EB' : 'none' }}>
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
                        <div>Cash : {payMethod === 'cash' ? totalAmtFormatted : payMethod === 'split' ? parseFloat(selectedOrderForReceipt.split_cash_amount || 0).toFixed(2) : (payMethod === 'partial' && (selectedOrderForReceipt.initial_payment_method === 'cash' || !selectedOrderForReceipt.initial_payment_method)) ? parseFloat(selectedOrderForReceipt.amount_paid || 0).toFixed(2) : '0.00'}</div>
                        <div>Card : {payMethod === 'vip_card' ? `${totalAmtFormatted} (VIP)` : (payMethod === 'card' ? totalAmtFormatted : (payMethod === 'partial' && selectedOrderForReceipt.initial_payment_method === 'card') ? parseFloat(selectedOrderForReceipt.amount_paid || 0).toFixed(2) : '0')}</div>
                        <div>UPI - {payMethod === 'upi' || payMethod === 'qr' ? totalAmtFormatted : payMethod === 'split' ? parseFloat(selectedOrderForReceipt.split_upi_amount || 0).toFixed(2) : (payMethod === 'partial' && selectedOrderForReceipt.initial_payment_method === 'upi') ? parseFloat(selectedOrderForReceipt.amount_paid || 0).toFixed(2) : '0'}</div>
                        {(payMethod === 'partial' || parseFloat(selectedOrderForReceipt.balance_due || 0) > 0) && (
                          <div style={{ marginTop: '3px', paddingTop: '3px', borderTop: '1px dotted #000000', fontWeight: 900, color: '#DC2626' }}>
                            DUE / KHATA: ₹{parseFloat(selectedOrderForReceipt.balance_due || 0).toFixed(2)}
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
                          <span>{parseFloat(selectedOrderForReceipt.subtotal || selectedOrderForReceipt.total_amount).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 900, fontSize: '0.82rem', borderTop: '1px dashed #000000', paddingTop: '3px', marginTop: '2px' }}>
                          <span>Payable Amount :</span>
                          <span>{totalAmtFormatted}</span>
                        </div>
                        {(payMethod === 'partial' || parseFloat(selectedOrderForReceipt.balance_due || 0) > 0) && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 800, color: '#059669' }}>
                              <span>Paid So Far :</span>
                              <span>₹{parseFloat(selectedOrderForReceipt.amount_paid || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 900, fontSize: '0.82rem', color: '#DC2626', borderTop: '1px dotted #000000', paddingTop: '2px' }}>
                              <span>Balance Due :</span>
                              <span>₹{parseFloat(selectedOrderForReceipt.balance_due || 0).toFixed(2)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Settlement / Installments breakdown on thermal receipt if any */}
                    {selectedOrderForReceipt.payments && selectedOrderForReceipt.payments.length > 0 && (
                      <div style={{ padding: '6px 0', borderBottom: '1px dashed #000000', fontSize: '0.68rem', color: '#000000' }}>
                        <div style={{ fontWeight: 800, marginBottom: '2px' }}>SETTLEMENT / KHATA PAYMENTS:</div>
                        {selectedOrderForReceipt.payments.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', fontSize: '0.65rem' }}>
                            <span>{new Date(p.created_at || p.payment_date || Date.now()).toLocaleDateString('en-IN')} ({(p.payment_method || 'cash').toUpperCase()})</span>
                            <span style={{ fontWeight: 700, color: '#059669' }}>+₹{parseFloat(p.amount || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer Details & Cashier Info */}
                    <div style={{ paddingTop: '8px', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '2px', color: '#000000' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cashier Name - {selectedOrderForReceipt.cashier_name || ''}</span>
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
                              color: '#111827',
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
                  onClick={() => handleSendWhatsApp(selectedOrderForReceipt, false)}
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
                    onClick={() => handleSendWhatsApp(selectedOrderForReceipt, true)}
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
                  onClick={() => handleSaveAsPdf(selectedOrderForReceipt)}
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
                  onClick={() => setIsReceiptModalOpen(false)}
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
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN VIP RFID CARD MODAL */}
      {isAssignCardModalOpen && customerForAssign && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => !isAssigning && setIsAssignCardModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), transparent)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                  }}
                >
                  <Crown size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Assign VIP RFID Card
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Issue a member card to {customerForAssign.name || customerForAssign.phone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isAssigning && setIsAssignCardModalOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                disabled={isAssigning}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmAssignCard} style={{ padding: '24px' }}>
              {/* Card Terms Banner */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#F59E0B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    VIP Membership Package
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-main)', fontWeight: 700, marginTop: '2px' }}>
                    Card Price: ₹{vipSettings.cardPrice || '500'} → Loaded with ₹{assignInitialCredit || '500'} Credits
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    1 Credit = ₹1.00 &bull; Auto {vipSettings.discountPercent || 5}% bill discount on POS checkout.
                  </div>
                </div>
                <Zap size={22} style={{ color: '#F59E0B', flexShrink: 0 }} />
              </div>

              {/* RFID Reader Simulation / Input Box */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px',
                  textAlign: 'center',
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
                    background: rfidStatus.isConnected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface-hover)',
                    border: `1px solid ${rfidStatus.isConnected ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                    marginBottom: '14px',
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
                      {rfidStatus.isConnected ? 'Arduino RFID Reader Connected' : 'USB RFID Reader Disconnected'}
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
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: assignCardUid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: assignCardUid ? '#10B981' : '#F59E0B',
                    border: `1px solid ${assignCardUid ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <Radio size={28} className={assignCardUid ? '' : 'pulse'} />
                </div>

                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {assignCardUid ? `Card UID Detected: ${assignCardUid}` : 'Tap Card on USB Module or Enter Manual UID'}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '380px', margin: '4px auto 14px' }}>
                  {rfidStatus.isConnected
                    ? 'Arduino is listening at 9600 baud. Tap your physical RFID card on the reader.'
                    : 'Click "Connect USB Reader" above to link Arduino Uno (COM5), or type manual UID.'}
                </div>

                {/* UID Input */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={assignCardUid}
                    onChange={(e) => setAssignCardUid(e.target.value)}
                    placeholder="Tap RFID card on reader or enter UID"
                    className="form-input"
                    style={{
                      flex: 1,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.8px',
                      fontSize: '0.92rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-input)',
                      border: assignCardOwnership?.is_assigned
                        ? '1px solid var(--color-danger, #EF4444)'
                        : assignCardOwnership && !assignCardOwnership.is_assigned
                        ? '1px solid var(--color-success, #10B981)'
                        : '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      padding: '10px 14px',
                      textAlign: 'center',
                    }}
                    required
                  />
                </div>

                {/* Real-Time Ownership & Conflict Feedback Banner */}
                {isCheckingAssignCard && (
                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Verifying card across system...
                  </div>
                )}
                {!isCheckingAssignCard && assignCardOwnership && assignCardOwnership.is_assigned && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#EF4444',
                      fontSize: '0.78rem',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontWeight: 600,
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      {assignCardOwnership.assigned_type === 'employee' ? (
                        <>
                          <div style={{ fontWeight: 800 }}>⛔ Card Conflict (Employee Attendance Card)</div>
                          <div>
                            This card is currently assigned to employee{' '}
                            <strong>{assignCardOwnership.employee?.name}</strong> ({assignCardOwnership.employee?.employee_code || 'Staff'}). Attendance cards cannot be assigned as VIP cards.
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 800 }}>⛔ Card Already Assigned</div>
                          <div>
                            This card is currently registered to customer{' '}
                            <strong>{assignCardOwnership.customer?.name}</strong> ({assignCardOwnership.customer?.phone || 'Customer'}).
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {!isCheckingAssignCard && assignCardOwnership && !assignCardOwnership.is_assigned && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#10B981',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>Card is unassigned and available across the entire system.</span>
                  </div>
                )}
              </div>

              {/* Initial Credit Fixed Display (Non-editable, strict settings default) */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Initial Credits Loaded (Fixed in Settings)
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F59E0B', marginTop: '2px' }}>
                    ₹{vipSettings.initialCredit || '500'} Credits
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    1 Credit = ₹1.00 &bull; Card Purchase Price: ₹{vipSettings.cardPrice || '500'}
                  </div>
                </div>
                <div
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#F59E0B',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                  }}
                >
                  Locked
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                  Card Purchase Payment Method:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setAssignPaymentMethod('cash')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: assignPaymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.18)' : 'var(--bg-surface)',
                      border: assignPaymentMethod === 'cash' ? '2px solid #10B981' : '1px solid var(--border-subtle)',
                      color: assignPaymentMethod === 'cash' ? '#10B981' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Banknote size={16} />
                    <span>Cash Payment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignPaymentMethod('upi')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: assignPaymentMethod === 'upi' ? 'rgba(56, 189, 248, 0.18)' : 'var(--bg-surface)',
                      border: assignPaymentMethod === 'upi' ? '2px solid #38BDF8' : '1px solid var(--border-subtle)',
                      color: assignPaymentMethod === 'upi' ? '#38BDF8' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <QrCode size={16} />
                    <span>UPI / Online</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsAssignCardModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isAssigning}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isAssigning || !assignCardUid.trim() || assignCardOwnership?.is_assigned}
                  style={{
                    minWidth: '170px',
                    background: assignCardOwnership?.is_assigned
                      ? 'var(--bg-surface-hover, #64748B)'
                      : 'linear-gradient(135deg, #F59E0B, #D97706)',
                    borderColor: assignCardOwnership?.is_assigned ? 'transparent' : '#F59E0B',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: assignCardOwnership?.is_assigned ? 0.6 : 1,
                    cursor: assignCardOwnership?.is_assigned ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isAssigning ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Issuing Card...</span>
                    </>
                  ) : (
                    <>
                      <Crown size={15} />
                      <span>Issue & Assign Card</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECHARGE VIP CARD MODAL */}
      {isRechargeModalOpen && customerForRecharge && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => !isRecharging && setIsRechargeModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '500px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), transparent)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                  }}
                >
                  <CreditCard size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Recharge VIP Card
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {customerForRecharge.name || 'Customer'} &bull; UID: <span style={{ fontFamily: 'monospace', color: '#F59E0B' }}>{customerForRecharge.vip_card_uid}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isRecharging && setIsRechargeModalOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                disabled={isRecharging}
              >
                <X size={16} />
              </button>
            </div>

            {/* Recharge Form */}
            <form onSubmit={handleConfirmRecharge} style={{ padding: '24px' }}>
              {/* Balance Card */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Current Available Balance
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
                    ₹{parseFloat(customerForRecharge.vip_card_balance || 0).toFixed(2)} Credits
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    New Total After
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#F59E0B', marginTop: '2px' }}>
                    ₹{(parseFloat(customerForRecharge.vip_card_balance || 0) + (parseFloat(rechargeAmount) || 0)).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Quick Recharge Preset Buttons (Strict Presets Only) */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>
                    Select Recharge Package:
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    (Configured in Settings)
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, (vipSettings.rechargePresets || ['500', '1000', '2000']).length)}, 1fr)`, gap: '10px' }}>
                  {(vipSettings.rechargePresets || ['500', '1000', '2000']).map((preset) => {
                    const isSelected = String(rechargeAmount) === String(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRechargeAmount(String(preset))}
                        style={{
                          padding: '12px 10px',
                          borderRadius: 'var(--radius-lg)',
                          border: isSelected ? '2px solid #F59E0B' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(245, 158, 11, 0.22)' : 'var(--bg-surface)',
                          color: isSelected ? '#F59E0B' : 'var(--text-main)',
                          fontWeight: 800,
                          fontSize: '1rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <span>+₹{preset}</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.8 }}>
                          {preset} Credits
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                  Recharge Payment Mode:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRechargePaymentMethod('cash')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: rechargePaymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.18)' : 'var(--bg-surface)',
                      border: rechargePaymentMethod === 'cash' ? '2px solid #10B981' : '1px solid var(--border-subtle)',
                      color: rechargePaymentMethod === 'cash' ? '#10B981' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Banknote size={16} />
                    <span>Cash Payment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRechargePaymentMethod('upi')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: rechargePaymentMethod === 'upi' ? 'rgba(56, 189, 248, 0.18)' : 'var(--bg-surface)',
                      border: rechargePaymentMethod === 'upi' ? '2px solid #38BDF8' : '1px solid var(--border-subtle)',
                      color: rechargePaymentMethod === 'upi' ? '#38BDF8' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <QrCode size={16} />
                    <span>UPI / Online</span>
                  </button>
                </div>
              </div>

              {/* Recharge Notes */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  Payment / Reference Notes
                </label>
                <input
                  type="text"
                  value={rechargeNotes}
                  onChange={(e) => setRechargeNotes(e.target.value)}
                  placeholder="e.g. Cash payment at POS counter, GPay ref #1234"
                  className="form-input"
                  style={{
                    fontSize: '0.84rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsRechargeModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isRecharging}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isRecharging || !rechargeAmount || parseFloat(rechargeAmount) <= 0}
                  style={{
                    minWidth: '160px',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    borderColor: '#10B981',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {isRecharging ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Recharging...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={15} />
                      <span>Confirm Recharge</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KHATA / DUE PAYMENT SETTLEMENT MODAL */}
      {isDuePaymentModalOpen && orderForDuePayment && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmittingDuePayment && setIsDuePaymentModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #1E293B)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 'var(--radius-lg, 14px)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              color: 'var(--text-main, #F8FAFC)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                  <Receipt size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Collect Khata / Due Payment</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #94A3B8)' }}>
                    Invoice #{orderForDuePayment.invoice_number} • Customer: {selectedCustomerForHistory?.name || 'Customer'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDuePaymentModalOpen(false)}
                disabled={isSubmittingDuePayment}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94A3B8)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Bill Summary Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md, 8px)',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                marginBottom: '18px',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>Total Bill</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main, #F8FAFC)', marginTop: '2px' }}>
                  ₹{parseFloat(orderForDuePayment.total_amount || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#10B981', textTransform: 'uppercase', fontWeight: 700 }}>Paid So Far</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>
                  ₹{parseFloat(orderForDuePayment.amount_paid || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#F59E0B', textTransform: 'uppercase', fontWeight: 700 }}>Outstanding Due</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#F59E0B', marginTop: '2px' }}>
                  ₹{parseFloat(orderForDuePayment.balance_due || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitDuePayment}>
              {/* Payment Amount Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main, #F8FAFC)' }}>
                  Amount to Collect (₹)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={parseFloat(orderForDuePayment.balance_due || 0)}
                    value={duePaymentAmount}
                    onChange={(e) => setDuePaymentAmount(e.target.value)}
                    required
                    placeholder="Enter amount"
                    className="form-input"
                    style={{
                      flex: 1,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md, 8px)',
                      background: 'var(--bg-input, #0F172A)',
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                      color: '#F59E0B',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setDuePaymentAmount(parseFloat(orderForDuePayment.balance_due || 0).toFixed(2))}
                    style={{
                      padding: '0 12px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#F59E0B',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Full Due
                  </button>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main, #F8FAFC)' }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote, color: '#10B981' },
                    { id: 'upi', label: 'UPI / QR', icon: QrCode, color: '#38BDF8' },
                    { id: 'card', label: 'Card', icon: CreditCard, color: '#818CF8' },
                  ].map((m) => {
                    const isSelected = duePaymentMethod === m.id;
                    const IconComponent = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDuePaymentMethod(m.id)}
                        style={{
                          padding: '10px 6px',
                          borderRadius: 'var(--radius-md, 8px)',
                          background: isSelected ? `${m.color}25` : 'var(--bg-surface, #0F172A)',
                          border: isSelected ? `2px solid ${m.color}` : '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                          color: isSelected ? m.color : 'var(--text-main, #F8FAFC)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <IconComponent size={18} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transaction Ref / Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted, #94A3B8)' }}>
                    Ref / UTR No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={duePaymentReference}
                    onChange={(e) => setDuePaymentReference(e.target.value)}
                    placeholder="e.g. UTR 4021..."
                    className="form-input"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '0.82rem',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md, 8px)',
                      background: 'var(--bg-input, #0F172A)',
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                      color: 'var(--text-main, #F8FAFC)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted, #94A3B8)' }}>
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={duePaymentNotes}
                    onChange={(e) => setDuePaymentNotes(e.target.value)}
                    placeholder="e.g. Cleared at counter"
                    className="form-input"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '0.82rem',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md, 8px)',
                      background: 'var(--bg-input, #0F172A)',
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                      color: 'var(--text-main, #F8FAFC)',
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsDuePaymentModalOpen(false)}
                  disabled={isSubmittingDuePayment}
                  className="btn btn-secondary"
                  style={{ minWidth: '90px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDuePayment || !duePaymentAmount || parseFloat(duePaymentAmount) <= 0}
                  className="btn btn-primary"
                  style={{
                    minWidth: '160px',
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    borderColor: '#F59E0B',
                    color: '#000000',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {isSubmittingDuePayment ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Record Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIVERSAL CARD INSPECTOR MODAL */}
      <CardLookupModal
        isOpen={isCardLookupOpen}
        onClose={() => setIsCardLookupOpen(false)}
        sourceArea="customer"
      />
    </div>
  );
}
