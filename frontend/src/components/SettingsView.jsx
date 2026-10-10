import React, { useState, useEffect, useMemo } from 'react';
import {
  Store as StoreIcon,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Building2,
  Package,
  Users,
  Settings,
  Sliders,
  Printer,
  ShieldCheck,
  Globe,
  Tag,
  Clock,
  Folder,
  FolderPlus,
  Layers,
  ChevronRight,
  Sparkles,
  KeyRound,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  Crown,
  CreditCard,
  Radio,
  RefreshCw,
  Smartphone,
  Percent,
  Receipt,
  Briefcase,
  GitBranch,
} from 'lucide-react';
import {
  fetchStores,
  createStore,
  updateStore,
  deleteStore,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  testGeminiApiKey,
  toggleStakeholdersSystem,
} from '../api';
import { SkeletonStoreGrid } from './Skeleton';
import { getVipSettings, saveVipSettings } from '../utils/vipSettings';
import {
  isStakeholdersEnabled,
  setStakeholdersEnabled,
  onStakeholdersSettingChange,
} from '../utils/stakeholdersSettings';
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
  saveReceiptTermsText,
  getReceiptTermsFontSize,
  saveReceiptTermsFontSize,
  renderFormattedTerms,
  DEFAULT_TERMS_AND_CONDITIONS,
} from '../utils/receiptTermsSettings';

export default function SettingsView({
  currentUser,
  selectedStore,
  onSelectStore,
  onBackToLauncher,
  onStoresUpdated,
}) {
  const [activeTab, setActiveTab] = useState('stores'); // 'stores', 'general', 'vip-card', 'gemini-ai'
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // VIP Card settings state
  const [vipSettings, setVipSettingsState] = useState(getVipSettings);
  const [newRechargePreset, setNewRechargePreset] = useState('');

  // Hardware RFID Reader connection & test state
  const [rfidStatus, setRfidStatus] = useState(getRfidStatus());
  const [lastScannedLiveUid, setLastScannedLiveUid] = useState(null);

  useEffect(() => {
    return onRfidStatusChange(setRfidStatus);
  }, []);

  useEffect(() => {
    const handleScan = (e) => {
      if (e.detail?.uid) {
        playVipAcceptedSound();
        setLastScannedLiveUid({
          uid: e.detail.uid,
          raw: e.detail.raw,
          time: new Date().toLocaleTimeString(),
        });
      }
    };
    window.addEventListener('wondersale_rfid_scan', handleScan);
    return () => window.removeEventListener('wondersale_rfid_scan', handleScan);
  }, []);

  const handleToggleRfidConnect = async () => {
    if (rfidStatus.isConnected) {
      await disconnectRfidReader();
      showFeedback('Arduino RFID Reader disconnected.');
    } else {
      try {
        const connected = await connectRfidReader({ baudRate: 9600 });
        if (connected) {
          playVipReadySound();
          showFeedback('Arduino RFID Reader connected on USB COM port at 9600 baud!');
        }
      } catch (err) {
        playVipRejectedSound();
        setError(err.message || 'Failed to connect USB RFID reader.');
      }
    }
  };

  // Store Modals
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [deletingStore, setDeletingStore] = useState(null);

  // Notifications
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // General Settings state (persisted in localStorage)
  const [currencySymbol, setCurrencySymbol] = useState(() => localStorage.getItem('wondersale_currency') || '₹');
  const [lowStockThreshold, setLowStockThreshold] = useState(() => localStorage.getItem('wondersale_low_stock_thresh') || '5');
  const [barcodeFormat, setBarcodeFormat] = useState(() => localStorage.getItem('wondersale_barcode_fmt') || 'Code128');
  const [receiptHeader, setReceiptHeader] = useState(() => localStorage.getItem('wondersale_receipt_hdr') || 'Thank you for shopping at Wondersale!');
  const [receiptTermsText, setReceiptTermsText] = useState(getReceiptTermsText);
  const [receiptTermsFontSize, setReceiptTermsFontSize] = useState(getReceiptTermsFontSize);
  const [previewTermsFormatted, setPreviewTermsFormatted] = useState(true);

  // Gemini AI Multi-Key Management state
  const [geminiKeys, setGeminiKeys] = useState(() => {
    try {
      const raw = localStorage.getItem('wondersale_gemini_api_keys');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [isAddKeyOpen, setIsAddKeyOpen] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [visibleKeys, setVisibleKeys] = useState({});
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  const saveKeysToStorage = (updated) => {
    setGeminiKeys(updated);
    try {
      localStorage.setItem('wondersale_gemini_api_keys', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAddGeminiKey = (e) => {
    e.preventDefault();
    if (!newKeyValue.trim()) return;

    const newKeyObj = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      label: newKeyLabel.trim() || `API Key #${geminiKeys.length + 1}`,
      key: newKeyValue.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const nextList = [...geminiKeys, newKeyObj];
    saveKeysToStorage(nextList);
    setNewKeyLabel('');
    setNewKeyValue('');
    setIsAddKeyOpen(false);
    showFeedback(`Gemini API key "${newKeyObj.label}" added to rotation pool.`);
  };

  const handleDeleteGeminiKey = (id) => {
    const nextList = geminiKeys.filter((k) => k.id !== id);
    saveKeysToStorage(nextList);
    showFeedback('API key removed from rotation pool.');
  };

  const handleToggleKeyActive = (id) => {
    const nextList = geminiKeys.map((k) =>
      k.id === id ? { ...k, isActive: !k.isActive } : k
    );
    saveKeysToStorage(nextList);
  };

  const handleTestKey = async (keyObj) => {
    setTestingKeyId(keyObj.id);
    setTestResults((prev) => ({ ...prev, [keyObj.id]: { loading: true } }));
    try {
      const res = await testGeminiApiKey(keyObj.key);
      setTestResults((prev) => ({
        ...prev,
        [keyObj.id]: { loading: false, success: true, message: res.message || 'Connected successfully!' },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [keyObj.id]: { loading: false, success: false, message: err.message || 'Connection failed' },
      }));
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleCopyKey = (id, keyStr) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const isOwner = currentUser?.is_owner;

  useEffect(() => {
    loadStoresData();
  }, []);

  const loadStoresData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchStores();
      setStores(data);
      if (Array.isArray(data) && data.length > 0) {
        const isShEnabled = data.some((s) => s.enable_stakeholders !== false);
        setStakeholdersEnabledState(isShEnabled);
        setStakeholdersEnabled(isShEnabled);
      }
      if (onStoresUpdated) {
        onStoresUpdated();
      }
    } catch (err) {
      setError(err.message || 'Failed to load store locations.');
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleSaveGeneralSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('wondersale_currency', currencySymbol);
    localStorage.setItem('wondersale_low_stock_thresh', lowStockThreshold);
    localStorage.setItem('wondersale_barcode_fmt', barcodeFormat);
    localStorage.setItem('wondersale_receipt_hdr', receiptHeader);
    saveReceiptTermsText(receiptTermsText);
    saveReceiptTermsFontSize(receiptTermsFontSize);
    showFeedback('System and store preferences (including Receipt Terms & Conditions) saved successfully.');
  };

  // Stakeholder Profit-Sharing Module Enable/Disable State
  const [stakeholdersEnabled, setStakeholdersEnabledState] = useState(() => isStakeholdersEnabled(selectedStore, stores));
  const [togglingStakeholders, setTogglingStakeholders] = useState(false);

  useEffect(() => {
    return onStakeholdersSettingChange((enabled) => {
      setStakeholdersEnabledState(enabled);
    });
  }, []);

  const handleToggleStakeholdersGlobal = async () => {
    setTogglingStakeholders(true);
    try {
      const nextVal = !stakeholdersEnabled;
      await toggleStakeholdersSystem({ enable_stakeholders: nextVal });
      setStakeholdersEnabledState(nextVal);
      setStakeholdersEnabled(nextVal);
      showFeedback(
        nextVal
          ? 'Stakeholders system has been re-enabled. Module and partner analytics are now active.'
          : 'Stakeholders system has been completely disabled across the full app. Module is hidden and net profit calculations have been updated.'
      );
      loadStoresData();
    } catch (err) {
      setError(err.message || 'Failed to toggle stakeholders setting.');
    } finally {
      setTogglingStakeholders(false);
    }
  };

  // Filtered stores
  const filteredStores = useMemo(() => {
    let list = [...stores];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.state?.toLowerCase().includes(q) ||
          s.pincode?.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'active') {
      list = list.filter((s) => s.is_active !== false);
    } else if (statusFilter === 'inactive') {
      list = list.filter((s) => s.is_active === false);
    }

    return list;
  }, [stores, searchQuery, statusFilter]);

  const handleDeleteStore = async () => {
    if (!deletingStore) return;
    try {
      await deleteStore(deletingStore.id);
      showFeedback(`Store branch "${deletingStore.name}" deleted.`);
      setDeletingStore(null);
      loadStoresData();
    } catch (err) {
      setError(err.message || 'Failed to delete store branch.');
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px', width: '100%' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onBackToLauncher && (
            <button
              type="button"
              onClick={onBackToLauncher}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
              }}
              title="Return to Menu"
              id="settings-back-to-menu"
            >
              <ArrowLeft size={16} />
              <span>Menu</span>
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
                Store &amp; System Settings
              </h1>
              <span className="badge badge-neutral" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                Management
              </span>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Configure physical store branches, retail preferences, categories, and AI API keys.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'stores' && (
            <button
              type="button"
              onClick={() => setIsAddStoreOpen(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
              id="btn-add-store-open"
            >
              <Plus size={16} />
              <span>Add Store Branch</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('stores')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'stores' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            color: activeTab === 'stores' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Building2 size={18} />
          <span>Store Branches ({stores.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'general' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            color: activeTab === 'general' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sliders size={18} />
          <span>General Preferences &amp; Defaults</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vip-card')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vip-card' ? '3px solid #F59E0B' : '3px solid transparent',
            color: activeTab === 'vip-card' ? '#F59E0B' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CreditCard size={18} style={{ color: '#F59E0B' }} />
          <span>VIP RFID Card &amp; Credits</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gemini-ai')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'gemini-ai' ? '3px solid #EC4899' : '3px solid transparent',
            color: activeTab === 'gemini-ai' ? '#F472B6' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={18} style={{ color: '#F472B6' }} />
          <span>Gemini AI / Bill OCR ({geminiKeys.length})</span>
        </button>
      </div>


      {/* Feedback & Error Notifications */}
      {feedback && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: Store Branches Management */}
      {activeTab === 'stores' && (
        <div>
          {/* Search and Filters */}
          <div
            className="glass-panel"
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by store name, city, state, pincode..."
                className="form-input"
                style={{
                  paddingLeft: '36px',
                  paddingRight: searchQuery ? '32px' : '12px',
                  fontSize: '0.88rem',
                  height: '38px',
                  width: '100%',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select"
                style={{ height: '38px', fontSize: '0.84rem', minWidth: '130px' }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active Branches</option>
                <option value="inactive">Inactive Branches</option>
              </select>
            </div>
          </div>

          {/* Stores Grid */}
          {loading ? (
            <SkeletonStoreGrid count={4} />
          ) : filteredStores.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <Building2 size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <h3 style={{ marginBottom: '6px' }}>No Store Branches Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                {searchQuery ? 'No stores match your search filters.' : 'Add your first retail store location.'}
              </p>
              <button
                type="button"
                onClick={() => setIsAddStoreOpen(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} />
                <span>Add Store Location</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '20px',
              }}
            >
              {filteredStores.map((store) => {
                const isCurrentSessionStore = String(store.id) === String(selectedStore);
                const fullAddress = [store.address, store.city, store.state, store.pincode]
                  .filter(Boolean)
                  .join(', ');

                return (
                  <div
                    key={store.id}
                    className="glass-panel"
                    style={{
                      padding: '24px',
                      borderRadius: 'var(--radius-xl)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: isCurrentSessionStore
                        ? '2px solid var(--brand-primary)'
                        : '1px solid var(--border-subtle)',
                      position: 'relative',
                    }}
                  >
                    <div>
                      {/* Top Bar: Name & Status */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '10px',
                          marginBottom: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--brand-ruby-glow)',
                              color: 'var(--brand-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <StoreIcon size={20} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                              {store.name}
                            </h3>
                            {isCurrentSessionStore && (
                              <span
                                className="badge badge-success"
                                style={{ fontSize: '0.68rem', marginTop: '3px', padding: '1px 6px' }}
                              >
                                Active Session
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          {store.is_active !== false ? (
                            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                              Active
                            </span>
                          ) : (
                            <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>
                              Disabled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Address & Location Specs */}
                      <div
                        style={{
                          background: 'var(--bg-surface-hover)',
                          borderRadius: 'var(--radius-md)',
                          padding: '14px',
                          marginBottom: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          fontSize: '0.84rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <MapPin size={15} style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {fullAddress || 'Address not specified'}
                          </span>
                        </div>

                        {store.city && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                            <Globe size={14} />
                            <span>
                              City: <strong>{store.city}</strong> &bull; State: <strong>{store.state || '—'}</strong> &bull; PIN: <strong>{store.pincode || '—'}</strong>
                            </span>
                          </div>
                        )}

                        {store.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                            <Phone size={14} />
                            <span>{store.phone}</span>
                          </div>
                        )}

                        {store.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                            <Mail size={14} />
                            <span>{store.email}</span>
                          </div>
                        )}

                        {store.gst_number && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                            <ShieldCheck size={14} style={{ color: 'var(--brand-primary)' }} />
                            <span>
                              GSTIN: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{store.gst_number}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Summary Metrics */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          marginBottom: '18px',
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <Package size={16} style={{ color: '#3B82F6' }} />
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Catalog Items</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{store.items_count || 0}</div>
                          </div>
                        </div>

                        <div
                          style={{
                            flex: 1,
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <Users size={16} style={{ color: '#FEC501' }} />
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Staff Assigned</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{store.staff_count || 0}</div>
                          </div>
                        </div>
                      </div>

                      {/* Manual UID Entry Setting Card */}
                      <div
                        style={{
                          background: 'var(--bg-surface)',
                          border: store.allow_manual_uid
                            ? '1px solid rgba(16, 185, 129, 0.45)'
                            : '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 12px',
                          marginBottom: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Tag
                            size={16}
                            style={{
                              color: store.allow_manual_uid ? 'var(--color-success)' : 'var(--text-muted)',
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              Manual UID Entry
                            </div>
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                              {store.allow_manual_uid
                                ? 'Custom & old UIDs can be edited in queue'
                                : 'Auto-generated sequential UIDs'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const nextVal = !store.allow_manual_uid;
                              await updateStore(store.id, { allow_manual_uid: nextVal });
                              setStores((prev) =>
                                prev.map((s) => (s.id === store.id ? { ...s, allow_manual_uid: nextVal } : s))
                              );
                              showFeedback(
                                nextVal
                                  ? `Manual UID editing ENABLED for "${store.name}".`
                                  : `Manual UID editing DISABLED for "${store.name}".`
                              );
                              onStoresUpdated?.();
                            } catch (err) {
                              setError(err.message || 'Failed to update store settings.');
                            }
                          }}
                          className="btn btn-sm"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: store.allow_manual_uid ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface-hover)',
                            border: store.allow_manual_uid
                              ? '1px solid rgba(16, 185, 129, 0.4)'
                              : '1px solid var(--border-subtle)',
                            color: store.allow_manual_uid ? 'var(--color-success)' : 'var(--text-secondary)',
                            borderRadius: 'var(--radius-pill)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                          title={store.allow_manual_uid ? 'Click to disable manual UID editing' : 'Click to enable manual UID editing'}
                        >
                          {store.allow_manual_uid ? (
                            <>
                              <CheckCircle2 size={12} />
                              <span>Enabled</span>
                            </>
                          ) : (
                            <>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: 'var(--text-muted)',
                                }}
                              />
                              <span>Disabled</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* GST Calculation Mode Setting Card */}
                      <div
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 12px',
                          marginBottom: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Percent
                              size={16}
                              style={{
                                color: store.enable_gst !== false ? '#38BDF8' : 'var(--text-muted)',
                                flexShrink: 0,
                              }}
                            />
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                GST Tax Reduction (18%)
                              </div>
                              <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                                {store.gst_calculation_mode === 'upi_only'
                                  ? '18% GST calculated on UPI payments only'
                                  : '18% GST calculated on whole revenue (Cash+UPI)'}
                              </div>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-pill)',
                              background: store.gst_calculation_mode === 'upi_only' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                              color: store.gst_calculation_mode === 'upi_only' ? '#C084FC' : '#38BDF8',
                              border: store.gst_calculation_mode === 'upi_only' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                            }}
                          >
                            {store.gst_calculation_mode === 'upi_only' ? 'UPI Only' : 'All Revenue'}
                          </span>
                        </div>

                        {/* Interactive Mode Switcher Buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '2px' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await updateStore(store.id, { gst_calculation_mode: 'all', enable_gst: true });
                                setStores((prev) =>
                                  prev.map((s) => (s.id === store.id ? { ...s, gst_calculation_mode: 'all', enable_gst: true } : s))
                                );
                                showFeedback(`GST Mode set to "All Revenue (18%)" for "${store.name}".`);
                                onStoresUpdated?.();
                              } catch (err) {
                                setError(err.message || 'Failed to update GST mode.');
                              }
                            }}
                            className="btn btn-sm"
                            style={{
                              padding: '5px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: store.gst_calculation_mode !== 'upi_only'
                                ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.15))'
                                : 'var(--bg-surface-hover)',
                              border: store.gst_calculation_mode !== 'upi_only'
                                ? '1px solid #38BDF8'
                                : '1px solid var(--border-subtle)',
                              color: store.gst_calculation_mode !== 'upi_only' ? '#38BDF8' : 'var(--text-secondary)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>Whole Revenue (18%)</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await updateStore(store.id, { gst_calculation_mode: 'upi_only', enable_gst: true });
                                setStores((prev) =>
                                  prev.map((s) => (s.id === store.id ? { ...s, gst_calculation_mode: 'upi_only', enable_gst: true } : s))
                                );
                                showFeedback(`GST Mode set to "UPI Only (18%)" for "${store.name}".`);
                                onStoresUpdated?.();
                              } catch (err) {
                                setError(err.message || 'Failed to update GST mode.');
                              }
                            }}
                            className="btn btn-sm"
                            style={{
                              padding: '5px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: store.gst_calculation_mode === 'upi_only'
                                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(147, 51, 234, 0.15))'
                                : 'var(--bg-surface-hover)',
                              border: store.gst_calculation_mode === 'upi_only'
                                ? '1px solid #C084FC'
                                : '1px solid var(--border-subtle)',
                              color: store.gst_calculation_mode === 'upi_only' ? '#C084FC' : 'var(--text-secondary)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>UPI Payments Only (18%)</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-subtle)',
                        gap: '8px',
                      }}
                    >
                      <div>
                        {!isCurrentSessionStore && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectStore(String(store.id));
                              localStorage.setItem('wondersale_logged_in_store', String(store.id));
                              showFeedback(`Switched active session to store: ${store.name}`);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.78rem' }}
                          >
                            Switch to this Location
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setEditingStore(store)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Store Location"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        {stores.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDeletingStore(store)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--color-danger)' }}
                            title="Delete Store Location"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: General & System Preferences */}
      {activeTab === 'general' && (
        <div style={{ maxWidth: '720px' }}>
          <form onSubmit={handleSaveGeneralSettings} className="glass-panel" style={{ padding: '32px', borderRadius: 'var(--radius-xl)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px' }}>
              Global System &amp; Retail Preferences
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginBottom: '24px' }}>
              These settings apply to product pricing, barcode label thermal printers, and stock warnings.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
              <div>
                <label className="form-label">Currency Symbol</label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="e.g. ₹ or $"
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Low Stock Warning Threshold</label>
                <input
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder="e.g. 5"
                  className="form-input"
                  min="1"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="form-label">Primary Barcode Symbology</label>
              <select
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value)}
                className="form-select"
              >
                <option value="Code128">Code128 (Standard Physical Retail)</option>
                <option value="EAN13">EAN-13 (International Retail GTIN)</option>
              </select>
            </div>

            <div style={{ marginBottom: '26px' }}>
              <label className="form-label">Default Receipt Header / Note</label>
              <textarea
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
                rows={2}
                className="form-input"
                placeholder="Printed on customer receipts and billing invoices..."
              />
            </div>

            {/* Receipt Terms & Conditions Customizer */}
            <div
              style={{
                marginBottom: '26px',
                padding: '20px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={17} style={{ color: 'var(--brand-primary)' }} />
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Bill / Receipt Terms &amp; Conditions
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '3px 0 0 0' }}>
                    Title <strong style={{ color: 'var(--text-primary)' }}>TERMS &amp; CONDITIONS</strong> is fixed &amp; prominent on thermal prints and WhatsApp. Supports markdown bolding via <code style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>**bold text**</code>.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Print Font Size:
                  </label>
                  <select
                    value={receiptTermsFontSize}
                    onChange={(e) => setReceiptTermsFontSize(e.target.value)}
                    className="form-select"
                    style={{ width: '135px', padding: '5px 10px', fontSize: '0.80rem', height: '34px' }}
                  >
                    <option value="0.52rem">Extra Small (0.52rem)</option>
                    <option value="0.58rem">Standard (0.58rem - Recommended)</option>
                    <option value="0.64rem">Medium (0.64rem)</option>
                    <option value="0.70rem">Large (0.70rem)</option>
                  </select>
                </div>
              </div>

              {/* Formatting Quick Help & Reset Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const selStart = 0;
                      setReceiptTermsText(prev => `**Important Notice:** ` + prev);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                    title="Insert **Bold** markup"
                  >
                    <strong>**Bold**</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTermsFormatted(!previewTermsFormatted)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '4px 10px', color: previewTermsFormatted ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
                  >
                    {previewTermsFormatted ? 'Show Editor' : 'Show Live Preview'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset terms & conditions to the standard 10 legal retail clauses?')) {
                      setReceiptTermsText(DEFAULT_TERMS_AND_CONDITIONS);
                      setReceiptTermsFontSize('0.58rem');
                    }
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '4px 10px', color: '#F87171' }}
                >
                  Reset to Default Clauses
                </button>
              </div>

              {!previewTermsFormatted ? (
                <textarea
                  value={receiptTermsText}
                  onChange={(e) => setReceiptTermsText(e.target.value)}
                  rows={12}
                  className="form-input mono"
                  style={{
                    fontSize: '0.80rem',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter numbered terms and conditions clauses. Use **word** to make text bold..."
                />
              ) : (
                <div
                  style={{
                    background: '#FFFFFF',
                    color: '#000000',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #D1D5DB',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '0.78rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #000000', paddingBottom: '4px' }}>
                    TERMS &amp; CONDITIONS
                  </div>
                  <div style={{ fontSize: receiptTermsFontSize, textAlign: 'left', color: '#111827' }}>
                    {renderFormattedTerms(receiptTermsText)}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                Save Preferences
              </button>
            </div>
          </form>

          {/* Stakeholder Profit-Sharing System Toggle Card */}
          <div
            className="glass-panel"
            style={{
              marginTop: '24px',
              padding: '28px 32px',
              borderRadius: 'var(--radius-xl)',
              border: stakeholdersEnabled
                ? '1px solid rgba(236, 72, 153, 0.25)'
                : '1px solid rgba(245, 158, 11, 0.35)',
              background: stakeholdersEnabled
                ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.04) 0%, rgba(30, 41, 59, 0.5) 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(30, 41, 59, 0.5) 100%)',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '520px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: stakeholdersEnabled ? 'rgba(236, 72, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: stakeholdersEnabled ? '#EC4899' : '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Briefcase size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Stakeholder Profit-Sharing System
                    </h3>
                    <span
                      className={`badge ${stakeholdersEnabled ? 'badge-success' : 'badge-warning'}`}
                      style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800 }}
                    >
                      {stakeholdersEnabled ? 'Active & Enabled' : 'Disabled & Hidden'}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
                    {stakeholdersEnabled
                      ? 'Contractual partner profit-sharing calculations and dedicated Stakeholders view are active across the app.'
                      : 'The Stakeholders section and all partner profit deductions are fully disabled throughout the entire system. Store operating profit serves directly as the true net profit.'}
                  </p>
                  <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {stakeholdersEnabled ? (
                      <span>• App Launcher icon is visible • P&amp;L charts display dual pre/post partner curves</span>
                    ) : (
                      <span>• App Launcher icon is hidden • Financial accounts bypass all stakeholder deductions</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Toggle Button */}
              <button
                type="button"
                id="btn-toggle-stakeholders-module"
                onClick={handleToggleStakeholdersGlobal}
                disabled={togglingStakeholders}
                className={stakeholdersEnabled ? 'btn btn-secondary' : 'btn btn-primary'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-pill)',
                  borderColor: stakeholdersEnabled ? '#F59E0B' : undefined,
                  color: stakeholdersEnabled ? '#F59E0B' : undefined,
                }}
              >
                {togglingStakeholders ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    <span>Updating...</span>
                  </>
                ) : stakeholdersEnabled ? (
                  <>
                    <EyeOff size={16} />
                    <span>Disable Stakeholders System</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Enable Stakeholders System</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* System & GitHub Version Card */}
          <div
            className="glass-panel"
            style={{
              marginTop: '24px',
              padding: '24px 28px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, var(--bg-surface) 100%)',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '540px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <GitBranch size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Wondersale OS &amp; GitHub Version
                    </h3>
                    <span
                      className="badge badge-success"
                      style={{ fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle2 size={12} />
                      Synced &amp; Active
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span>{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.0.0'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: '#3B82F6' }}>
                      Build #{typeof __APP_BUILD_NUMBER__ !== 'undefined' ? __APP_BUILD_NUMBER__ : '1'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        background: 'rgba(255, 255, 255, 0.08)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {typeof __APP_COMMIT_HASH__ !== 'undefined' ? __APP_COMMIT_HASH__ : 'dev'}
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Latest Update:</strong>{' '}
                    {typeof __APP_COMMIT_MSG__ !== 'undefined' ? __APP_COMMIT_MSG__ : 'Latest build'}
                  </p>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} />
                    <span>Updated: {typeof __APP_COMMIT_DATE__ !== 'undefined' ? __APP_COMMIT_DATE__ : 'Recent'}</span>
                  </div>
                </div>
              </div>

              <a
                href={
                  typeof __APP_COMMIT_HASH__ !== 'undefined' && __APP_COMMIT_HASH__ !== 'dev'
                    ? `https://github.com/auxiaagency/Wondersale-os/commit/${__APP_COMMIT_HASH__}`
                    : 'https://github.com/auxiaagency/Wondersale-os'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={14} />
                <span>View on GitHub</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Gemini Multimodal AI & Multi-Key Failover Pool */}
      {activeTab === 'gemini-ai' && (
        <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Header Card */}
          <div className="glass-panel" style={{ padding: '26px 30px', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, rgba(218, 41, 28, 0.18), rgba(168, 85, 247, 0.2))',
                    color: '#EC4899',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                  }}
                >
                  <Sparkles size={24} style={{ color: '#F472B6' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.28rem', fontWeight: 800, margin: 0 }}>
                      Google Gemini AI Key Management &amp; Failover
                    </h3>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: 'var(--color-success)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ShieldCheck size={12} />
                      <span>Multi-Key Rotation Active</span>
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 0' }}>
                    Powering handwritten bill deciphering, invoice extraction, and automatic price calculations.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddKeyOpen(true)}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  background: 'linear-gradient(135deg, #DC2626, #7C3AED)',
                  borderColor: 'transparent',
                }}
              >
                <Plus size={15} />
                <span>Add Gemini API Key</span>
              </button>
            </div>

            {/* Rotation Pool Strategy Card */}
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, color: '#60A5FA', marginBottom: '3px' }}>
                💡 Automated Zero-Downtime Rate Limit Protection:
              </div>
              <div>
                Google AI Studio provides generous free tier quotas (15 requests per minute, 1,000,000 tokens/day). If a key hits its per-minute rate limit or daily quota, Wondersale <strong>automatically shifts to the next key</strong> in your pool below. You can add multiple free keys from Google AI Studio.
              </div>
            </div>
          </div>

          {/* Add Key Inline Form Modal / Box */}
          {isAddKeyOpen && (
            <form
              onSubmit={handleAddGeminiKey}
              className="glass-panel"
              style={{
                padding: '22px 26px',
                borderRadius: 'var(--radius-xl)',
                border: '2px solid var(--brand-primary)',
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add New Gemini API Key</h4>
                <button
                  type="button"
                  onClick={() => setIsAddKeyOpen(false)}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label className="form-label">Key Label / Alias</label>
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="e.g. Backup Key 2"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Gemini API Key String *</label>
                  <input
                    type="text"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder="e.g. AIzaSy..."
                    className="form-input mono"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsAddKeyOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                  Save &amp; Add Key
                </button>
              </div>
            </form>
          )}

          {/* Configured Keys List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: '4px' }}>
              Configured API Keys ({geminiKeys.length}) — Priority Order (Top to Bottom)
            </div>

            {geminiKeys.map((k, idx) => {
              const isVisible = visibleKeys[k.id];
              const testResult = testResults[k.id];
              const isTesting = testingKeyId === k.id;
              const isCopied = copiedKeyId === k.id;

              return (
                <div
                  key={k.id}
                  className="glass-panel"
                  style={{
                    padding: '18px 22px',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    border: k.isActive ? '1px solid var(--border-subtle)' : '1px solid rgba(255,255,255,0.05)',
                    opacity: k.isActive ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        background: idx === 0 ? 'var(--brand-ruby-glow)' : 'var(--bg-surface)',
                        color: idx === 0 ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                      }}
                    >
                      #{idx + 1}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{k.label}</span>
                        {idx === 0 && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'var(--brand-ruby-glow)',
                              color: 'var(--brand-primary)',
                              textTransform: 'uppercase',
                            }}
                          >
                            Priority 1
                          </span>
                        )}
                      </div>

                      {/* Masked Key string with toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                        <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {isVisible
                            ? k.key
                            : k.key.length > 10
                            ? `${k.key.substring(0, 6)}••••••••••••••••${k.key.substring(k.key.length - 4)}`
                            : '••••••••••••'}
                        </span>

                        <button
                          type="button"
                          onClick={() => setVisibleKeys((prev) => ({ ...prev, [k.id]: !prev[k.id] }))}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                          title={isVisible ? 'Hide key' : 'Show full key'}
                        >
                          {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyKey(k.id, k.key)}
                          style={{ background: 'none', border: 'none', color: isCopied ? 'var(--color-success)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                          title="Copy key"
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Test Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {testResult && !testResult.loading && (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-xs)',
                          background: testResult.success ? 'rgba(16, 185, 129, 0.12)' : 'var(--color-danger-bg)',
                          color: testResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title={testResult.message}
                      >
                        {testResult.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        <span>{testResult.success ? 'Online' : 'Failed'}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTestKey(k)}
                      disabled={isTesting}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {isTesting ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      <span>{isTesting ? 'Testing...' : 'Test Key'}</span>
                    </button>

                    {geminiKeys.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGeminiKey(k.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--color-danger)', padding: '6px 8px' }}
                        title="Delete key"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Get Free Keys Link card */}
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              background: 'var(--bg-surface-hover)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Need more free Gemini API keys?</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Generate free keys instantly with your Google account on Google AI Studio.
              </div>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: '#60A5FA',
                borderColor: 'rgba(59, 130, 246, 0.4)',
              }}
            >
              <span>Open Google AI Studio</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      )}

      {/* 4. VIP RFID CARD & CREDITS SETTINGS TAB */}
      {activeTab === 'vip-card' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '24px 28px',
              borderRadius: 'var(--radius-xl)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.05))',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '14px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.25)',
                }}
              >
                <Crown size={28} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                    VIP RFID Card &amp; Credit Balance System
                  </h2>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#F59E0B',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    1 CREDIT = ₹1.00
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.45 }}>
                  Configure card purchase price, initial credits loaded, automated total order VIP discount %, preset recharge options, and Arduino USB RFID hardware reader.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const updated = saveVipSettings(vipSettings);
                setVipSettingsState(updated);
                showFeedback('VIP Card & RFID settings saved successfully!');
              }}
              className="btn btn-primary"
              style={{
                padding: '10px 22px',
                fontWeight: 800,
                fontSize: '0.92rem',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                borderColor: '#D97706',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={17} />
              <span>Save VIP Settings</span>
            </button>
          </div>

          {/* Settings Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Card 1: Pricing & Initial Balance */}
            <div
              style={{
                padding: '22px 24px',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <CreditCard size={20} style={{ color: '#F59E0B' }} />
                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Card Issue &amp; Credits
                </h3>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Card Purchase / Issuance Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={vipSettings.cardPrice}
                  onChange={(e) => setVipSettingsState({ ...vipSettings, cardPrice: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', fontWeight: 800, fontSize: '0.96rem' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  The one-time price charged to the customer to buy this card (e.g. ₹500).
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Initial Credits Loaded (Credits)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={vipSettings.initialCredit}
                  onChange={(e) => setVipSettingsState({ ...vipSettings, initialCredit: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box', fontWeight: 800, fontSize: '0.96rem' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Starting balance credited to the customer upon card registration. 1 credit = ₹1.00.
                </span>
              </div>
            </div>

            {/* Card 2: VIP Discount Percentage on Total Bill */}
            <div
              style={{
                padding: '22px 24px',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <Tag size={20} style={{ color: '#10B981' }} />
                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  VIP Card Discount Rate
                </h3>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Discount on Total Price (%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={vipSettings.discountPercent}
                    onChange={(e) => setVipSettingsState({ ...vipSettings, discountPercent: e.target.value })}
                    className="form-input"
                    style={{ width: '100px', fontWeight: 800, fontSize: '1.1rem', textAlign: 'center', color: '#10B981' }}
                  />
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10B981' }}>% off</span>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                  Whenever the customer pays using this card at checkout, this discount percentage is automatically deducted from the total bill amount.
                </span>
              </div>

              {/* Visual Example Preview */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-main)',
                  border: '1px dashed var(--border-subtle)',
                  fontSize: '0.8rem',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
                  💡 Live POS Preview:
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  On a bill of ₹1,000.00: <strong>{vipSettings.discountPercent || 5}% VIP Discount</strong> = -₹{((1000 * (parseFloat(vipSettings.discountPercent) || 5)) / 100).toFixed(2)}. Net payable from card: <strong>₹{(1000 - ((1000 * (parseFloat(vipSettings.discountPercent) || 5)) / 100)).toFixed(2)}</strong>.
                </div>
              </div>
            </div>

            {/* Card 3: Quick Recharge Preset Options */}
            <div
              style={{
                padding: '22px 24px',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <Layers size={20} style={{ color: '#38BDF8' }} />
                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Pre-decided Recharge Options
                </h3>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                These preset recharge amounts appear as 1-click top-up buttons in the Customers App and inline during POS billing.
              </div>

              {/* Current Presets Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {vipSettings.rechargePresets.map((preset, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38BDF8',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                    }}
                  >
                    <span>₹{preset}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = vipSettings.rechargePresets.filter((_, i) => i !== idx);
                        const updated = { ...vipSettings, rechargePresets: next };
                        setVipSettingsState(updated);
                        saveVipSettings(updated);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#38BDF8',
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Remove option"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Preset Input */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  type="number"
                  min="10"
                  step="100"
                  placeholder="e.g. 5000"
                  value={newRechargePreset}
                  onChange={(e) => setNewRechargePreset(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = newRechargePreset.trim();
                    if (clean && !vipSettings.rechargePresets.includes(clean)) {
                      const next = [...vipSettings.rechargePresets, clean].sort((a, b) => parseFloat(a) - parseFloat(b));
                      const updated = { ...vipSettings, rechargePresets: next };
                      setVipSettingsState(updated);
                      saveVipSettings(updated);
                      setNewRechargePreset('');
                    }
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontWeight: 800, padding: '0 16px' }}
                >
                  <Plus size={15} style={{ marginRight: '4px' }} />
                  Add
                </button>
              </div>
            </div>

            {/* Physical Arduino USB RFID Hardware Reader Link */}
            <div
              style={{
                padding: '22px 24px',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                gridColumn: '1 / -1',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Radio size={20} style={{ color: '#10B981' }} />
                  <div>
                    <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                      Physical Arduino USB RFID Hardware Reader (UART / COM5)
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      Native Web Serial API bridge connecting your Arduino Uno / Nano directly to Wondersale at 9600 baud.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      background: rfidStatus.isConnected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface-hover)',
                      color: rfidStatus.isConnected ? '#10B981' : 'var(--text-secondary)',
                      border: `1px solid ${rfidStatus.isConnected ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: rfidStatus.isConnected ? '#10B981' : '#94A3B8',
                        boxShadow: rfidStatus.isConnected ? '0 0 6px #10B981' : 'none',
                      }}
                    />
                    {rfidStatus.isConnected ? 'Connected & Listening (9600 Baud)' : 'Disconnected'}
                  </span>

                  <button
                    type="button"
                    onClick={handleToggleRfidConnect}
                    className="btn"
                    style={{
                      padding: '8px 18px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      borderRadius: 'var(--radius-pill)',
                      background: rfidStatus.isConnected ? 'rgba(239, 68, 68, 0.15)' : 'linear-gradient(135deg, #10B981, #059669)',
                      color: rfidStatus.isConnected ? '#EF4444' : '#FFFFFF',
                      border: rfidStatus.isConnected ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                      boxShadow: rfidStatus.isConnected ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    {rfidStatus.isConnecting ? 'Connecting...' : rfidStatus.isConnected ? 'Disconnect Reader' : '⚡ Connect Arduino USB Reader (COM5)'}
                  </button>
                </div>
              </div>

              {/* Hardware Instructions & Live Test Monitor */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Setup Instructions:
                  </div>
                  <ol style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '18px', margin: 0, lineHeight: 1.55 }}>
                    <li><strong>Important:</strong> Close the Serial Monitor inside Arduino IDE before connecting (Windows locks COM ports to a single app).</li>
                    <li>Click <strong>"Connect Arduino USB Reader"</strong> and pick your <em>Arduino Uno (COM5)</em> from the browser popup.</li>
                    <li>Tap your RFID card near the reader — the UID will automatically fill when assigning cards or checking out!</li>
                  </ol>
                </div>

                <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Live Hardware Tap Monitor
                  </div>
                  {lastScannedLiveUid ? (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'monospace', color: '#10B981' }}>
                          {lastScannedLiveUid.uid}
                        </span>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontWeight: 800 }}>
                          DETECTED
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Last tapped at {lastScannedLiveUid.time} &bull; Raw payload: <code>{lastScannedLiveUid.raw}</code>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                      {rfidStatus.isConnected ? 'Awaiting card tap on reader...' : 'Connect reader above to test live card taps.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Store Branch */}
      {isAddStoreOpen && (
        <StoreModal
          onClose={() => setIsAddStoreOpen(false)}
          onSuccess={(newStore) => {
            setIsAddStoreOpen(false);
            showFeedback(`Store branch "${newStore.name}" added successfully.`);
            loadStoresData();
          }}
        />
      )}

      {/* Modal: Edit Store Branch */}
      {editingStore && (
        <StoreModal
          store={editingStore}
          onClose={() => setEditingStore(null)}
          onSuccess={(updated) => {
            setEditingStore(null);
            showFeedback(`Store branch "${updated.name}" updated successfully.`);
            loadStoresData();
          }}
        />
      )}

      {/* Modal: Delete Store Confirmation */}
      {deletingStore && (
        <div className="modal-overlay" onClick={() => setDeletingStore(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <AlertCircle size={44} style={{ color: 'var(--color-danger)', margin: '0 auto 14px' }} />
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Delete Store Location?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Are you sure you want to remove <strong>{deletingStore.name}</strong>? Items and staff assigned to this branch may need reassignment.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button type="button" onClick={() => setDeletingStore(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteStore}
                  className="btn btn-primary"
                  style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- Store Modal (Add / Edit Store with Address, City, State, Pincode) -----------------


function StoreModal({ store, onClose, onSuccess }) {
  const isEditing = Boolean(store);

  const [name, setName] = useState(store?.name || '');
  const [address, setAddress] = useState(store?.address || '');
  const [city, setCity] = useState(store?.city || '');
  const [state, setState] = useState(store?.state || '');
  const [pincode, setPincode] = useState(store?.pincode || '');
  const [phone, setPhone] = useState(store?.phone || '');
  const [email, setEmail] = useState(store?.email || '');
  const [gstNumber, setGstNumber] = useState(store?.gst_number || '');
  const [isActive, setIsActive] = useState(store ? store.is_active !== false : true);
  const [allowManualUid, setAllowManualUid] = useState(store?.allow_manual_uid || false);
  const [enableGst, setEnableGst] = useState(store ? store.enable_gst !== false : true);
  const [enableStakeholders, setEnableStakeholders] = useState(store ? store.enable_stakeholders !== false : true);
  const [gstCalculationMode, setGstCalculationMode] = useState(store?.gst_calculation_mode || 'all');
  const [gstRate, setGstRate] = useState(store?.gst_rate !== undefined && store?.gst_rate !== null ? String(store.gst_rate) : '18.00');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Store Name is required.');
      return;
    }
    if (!city.trim()) {
      setError('City is required (e.g. Bhopal, Indore, Mumbai).');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gst_number: gstNumber.trim().toUpperCase(),
        is_active: isActive,
        allow_manual_uid: allowManualUid,
        enable_gst: enableGst,
        enable_stakeholders: enableStakeholders,
        gst_calculation_mode: gstCalculationMode,
        gst_rate: parseFloat(gstRate) || 18.00,
      };

      let res;
      if (isEditing) {
        res = await updateStore(store.id, payload);
      } else {
        res = await createStore(payload);
      }
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <StoreIcon size={20} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {isEditing ? `Edit Store: ${store.name}` : 'Add New Store Branch'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '16px',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Store Name */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Store / Branch Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bhopal Main Store, Indore Mega Store"
              className="form-input"
              required
              autoFocus
            />
          </div>

          {/* Street Address */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Street Address / Landmark</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Shop 14, MP Nagar Zone 1, Near Chetak Bridge"
              className="form-input"
            />
          </div>

          {/* City, State, Pincode Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="form-label">City *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bhopal"
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label">State / Province</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Madhya Pradesh"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Pincode</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 462011"
                className="form-input mono"
              />
            </div>
          </div>

          {/* Phone & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="form-label">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 755 244 1234"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Store Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. bhopal@wondersale.com"
                className="form-input"
              />
            </div>
          </div>

          {/* GSTIN / GST Number */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label">GSTIN / GST Registration Number</label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="e.g. 23ANGPK5446D2Z8"
              className="form-input mono"
              style={{ textTransform: 'uppercase', letterSpacing: '0.8px' }}
            />
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Printed on POS receipts and invoices for sales made at this branch.
            </div>
          </div>

          {/* Active Checkbox */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontWeight: 600 }}>Store is Active &amp; Operational</span>
            </label>
          </div>

          {/* Manual UID Toggle Checkbox */}
          <div
            style={{
              marginBottom: '20px',
              background: 'var(--bg-surface-hover)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: allowManualUid ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.86rem' }}>
              <input
                type="checkbox"
                checked={allowManualUid}
                onChange={(e) => setAllowManualUid(e.target.checked)}
                style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Allow Manual UID Entry</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  When enabled, staff can manually enter custom / old UIDs and barcodes in the Add Item staging queue for this store.
                </div>
              </div>
            </label>
          </div>

          {/* Stakeholder Profit-Sharing Toggle Checkbox */}
          <div
            style={{
              marginBottom: '24px',
              background: 'var(--bg-surface-hover)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: enableStakeholders ? '1px solid rgba(236, 72, 153, 0.35)' : '1px solid var(--border-subtle)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.86rem' }}>
              <input
                type="checkbox"
                checked={enableStakeholders}
                onChange={(e) => setEnableStakeholders(e.target.checked)}
                style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Enable Stakeholders Profit Sharing</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  When unchecked, profit-sharing partner allocations and deductions are completely disabled for this store branch.
                </div>
              </div>
            </label>
          </div>

          {/* GST Tax Calculation Configuration */}
          <div
            style={{
              marginBottom: '24px',
              background: 'var(--bg-surface-hover)',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: enableGst ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={enableGst}
                onChange={(e) => setEnableGst(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                Enable GST Tax Deduction in Financial Accounts
              </span>
            </label>

            {enableGst && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '2px', paddingLeft: '26px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.80rem', fontWeight: 700, marginBottom: '6px' }}>
                    GST Calculation Mode
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div
                      onClick={() => setGstCalculationMode('all')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: gstCalculationMode === 'all' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-surface)',
                        border: gstCalculationMode === 'all' ? '2px solid #38BDF8' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: gstCalculationMode === 'all' ? '#38BDF8' : 'var(--text-primary)' }}>
                        All Revenue (18%)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Deduct 18% GST on all product sales (Cash + UPI)
                      </div>
                    </div>

                    <div
                      onClick={() => setGstCalculationMode('upi_only')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: gstCalculationMode === 'upi_only' ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-surface)',
                        border: gstCalculationMode === 'upi_only' ? '2px solid #C084FC' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: gstCalculationMode === 'upi_only' ? '#C084FC' : 'var(--text-primary)' }}>
                        UPI Only (18%)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Deduct 18% GST only on UPI digital payments
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ maxWidth: '180px' }}>
                  <label className="form-label" style={{ fontSize: '0.80rem', fontWeight: 700, marginBottom: '4px' }}>
                    GST Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    className="form-input"
                    style={{ height: '36px', fontSize: '0.86rem', fontWeight: 700 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontWeight: 700 }}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Store Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------- Category Modal (Add / Edit Parent Category) -----------------

function CategoryModal({ category, onClose, onSuccess }) {
  const isEditing = Boolean(category);
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
      };
      let res;
      if (isEditing) {
        res = await updateCategory(category.id, payload);
      } else {
        res = await createCategory(payload);
      }
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderPlus size={18} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: '1.18rem', fontWeight: 800 }}>
              {isEditing ? `Edit Category: ${category.name}` : 'Add Parent Category'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '30px', height: '30px' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '22px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '14px',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apparel, Electronics, Footwear"
              className="form-input"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label className="form-label">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this category..."
              className="form-input"
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontWeight: 700 }}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------- Subcategory Modal (Add / Edit Subcategory) -----------------

function SubcategoryModal({ subcategory, categories = [], defaultParentCatId, onClose, onSuccess }) {
  const isEditing = Boolean(subcategory);
  const [parentId, setParentId] = useState(
    subcategory?.category || defaultParentCatId || categories[0]?.id || ''
  );
  const [name, setName] = useState(subcategory?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Subcategory name is required.');
      return;
    }
    if (!parentId) {
      setError('Parent category is required.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const payload = {
        category: parentId,
        name: name.trim(),
      };
      let res;
      if (isEditing) {
        res = await updateSubcategory(subcategory.id, payload);
      } else {
        res = await createSubcategory(payload);
      }
      onSuccess(res);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={18} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: '1.18rem', fontWeight: 800 }}>
              {isEditing ? `Edit Subcategory: ${subcategory.name}` : 'Add New Subcategory'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '30px', height: '30px' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '22px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '14px',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Parent Category *</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="form-select"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label className="form-label">Subcategory Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Men's Wear, Casual Shirts, Smartphones"
              className="form-input"
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontWeight: 700 }}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Subcategory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
