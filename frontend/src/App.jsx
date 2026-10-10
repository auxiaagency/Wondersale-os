import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import AppLauncher, { isModuleAccessible } from './components/AppLauncher';
import LoginView from './components/LoginView';
import ItemTable from './components/ItemTable';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import NotFoundView from './components/NotFoundView';
import { SkeletonStatsCards } from './components/Skeleton';
import { fetchStores, fetchCategories, fetchSubcategories, fetchSuppliers, fetchSections, fetchItems, fetchItem, fetchInventoryStats, getStaffMe, logoutStaff, previewExpiredStock, writeOffExpiredStock } from './api';
import { Package, AlertTriangle, Barcode, TrendingUp, LayoutGrid, ArrowLeft, Plus, Layers, Truck, FolderPlus, History, FileSpreadsheet, BarChart3, X } from 'lucide-react';

import { isStakeholdersEnabled, onStakeholdersSettingChange } from './utils/stakeholdersSettings';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy-loaded heavyweight view components (Code-Splitting for fast startup & low memory footprint)
const AddItemSection = lazyWithRetry(() => import('./components/AddItemSection'));
const StaffManagementView = lazyWithRetry(() => import('./components/StaffManagementView'));
const SettingsView = lazyWithRetry(() => import('./components/SettingsView'));
const CategorySection = lazyWithRetry(() => import('./components/CategorySection'));
const SupplierSection = lazyWithRetry(() => import('./components/SupplierSection'));
const SectionSection = lazyWithRetry(() => import('./components/SectionSection'));
const AuditLogSection = lazyWithRetry(() => import('./components/AuditLogSection'));
const ProductDetailView = lazyWithRetry(() => import('./components/ProductDetailView'));
const WorkstationView = lazyWithRetry(() => import('./components/WorkstationView'));
const BillingView = lazyWithRetry(() => import('./components/BillingView'));
const CustomersView = lazyWithRetry(() => import('./components/CustomersView'));
const StakeholdersView = lazyWithRetry(() => import('./components/StakeholdersView'));
const AccountsView = lazyWithRetry(() => import('./components/AccountsView'));
const DashboardView = lazyWithRetry(() => import('./components/DashboardView'));
const EmployeeManagementView = lazyWithRetry(() => import('./components/EmployeeManagementView'));
const EmployeePortalView = lazyWithRetry(() => import('./components/EmployeePortalView'));

// Lazy-loaded modals
const ItemDetailModal = lazyWithRetry(() => import('./components/ItemDetailModal'));
const ItemImageModal = lazyWithRetry(() => import('./components/ItemImageModal'));
const NewItemModal = lazyWithRetry(() => import('./components/NewItemModal'));
const StockAdjustmentModal = lazyWithRetry(() => import('./components/StockAdjustmentModal'));
const BarcodeModal = lazyWithRetry(() => import('./components/BarcodeModal'));
const ExportCsvModal = lazyWithRetry(() => import('./components/ExportCsvModal'));
const AIDescriptionProgressWidget = lazyWithRetry(() => import('./components/AIDescriptionProgressWidget'));
const AIDescriptionReviewModal = lazyWithRetry(() => import('./components/AIDescriptionReviewModal'));

function ModuleLoader({ label = 'Loading Station…' }) {
  return (
    <div style={{
      minHeight: '400px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '14px',
      padding: '48px 24px',
      color: 'var(--text-muted, #94a3b8)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '3px solid var(--border-color, rgba(255,255,255,0.1))',
        borderTopColor: 'var(--brand-primary, #C52224)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</span>
    </div>
  );
}


export default function App() {
  // Theme state persisted in localStorage
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('wondersale-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wondersale-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const cached = localStorage.getItem('wondersale_staff_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState('');

  // Active View: 'launcher', 'inventory', 'staff'
  const [activeView, setActiveView] = useState('launcher');

  // Stakeholders Profit-Sharing Module Active State
  const [stakeholdersActive, setStakeholdersActive] = useState(() => isStakeholdersEnabled());

  useEffect(() => {
    return onStakeholdersSettingChange((enabled) => {
      setStakeholdersActive(enabled);
      if (!enabled && window.location.hash.includes('stakeholders')) {
        setActiveView('launcher');
        window.location.hash = 'launcher';
      }
    });
  }, []);

  const validViews = [
    'launcher', 'inventory', 'staff', 'settings', 'employee_management',
    'billing', 'customers', ...(stakeholdersActive ? ['stakeholders'] : []),
    'accounting', 'dashboard', 'assets', 'employee_portal',
  ];

  // Verify auth session with backend on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const staff = await getStaffMe();
        if (staff) {
          setCurrentUser(staff);
        } else {
          setCurrentUser(null);
        }
      } catch (e) {
        console.warn('Session check failed', e);
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  // Listen for instant session termination (password changed or revoked from another device)
  useEffect(() => {
    const handleSessionExpired = (e) => {
      setCurrentUser(null);
      setSessionExpiredMessage(
        e.detail?.message ||
          'Your session has ended because your password was changed or your session was revoked from another device. Please log in again.'
      );
      setActiveView('launcher');
      window.location.hash = '';
    };
    window.addEventListener('wondersale_session_expired', handleSessionExpired);
    return () => window.removeEventListener('wondersale_session_expired', handleSessionExpired);
  }, []);

  // Background heartbeat verification: promptly kicks out any device if password changed on another device
  useEffect(() => {
    if (!currentUser) return;
    const verifySession = async () => {
      try {
        const staff = await getStaffMe();
        if (!staff) {
          setCurrentUser(null);
        }
      } catch (err) {
        // Network dropout: do not force logout on offline
      }
    };
    const interval = setInterval(verifySession, 25000);
    window.addEventListener('focus', verifySession);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', verifySession);
    };
  }, [currentUser]);

  const handleNavigate = useCallback((viewId) => {
    if (!viewId || viewId === 'launcher') {
      setActiveView('launcher');
      window.location.hash = 'launcher';
      return;
    }
    if (isModuleAccessible(currentUser, viewId)) {
      setActiveView(viewId);
      window.location.hash = viewId;
    } else {
      // Unauthorized module: treat as non-existent, redirect directly to launcher
      setActiveView('launcher');
      window.location.hash = 'launcher';
    }
  }, [currentUser]);

  // URL Hash Listener: Even if someone manually types #accounting or #staff into the address bar,
  // this strictly verifies their role permission. If unauthorized, silently redirect to launcher as if it does not exist!
  useEffect(() => {
    if (!currentUser) return;

    const checkHashAccess = () => {
      const raw = window.location.hash.replace('#', '').trim();
      if (!raw || raw === 'launcher') {
        setActiveView('launcher');
        return;
      }
      if (isModuleAccessible(currentUser, raw)) {
        setActiveView(raw);
      } else {
        // Module does not exist for this user - silently redirect to launcher
        setActiveView('launcher');
        window.location.hash = 'launcher';
      }
    };

    window.addEventListener('hashchange', checkHashAccess);
    if (window.location.hash) {
      checkHashAccess();
    }
    return () => window.removeEventListener('hashchange', checkHashAccess);
  }, [currentUser]);

  // If currentUser permissions change or an unauthorized view is targeted, immediately bounce back to launcher
  useEffect(() => {
    if (currentUser && activeView !== 'launcher' && !isModuleAccessible(currentUser, activeView)) {
      handleNavigate('launcher');
    }
  }, [currentUser, activeView, handleNavigate]);

  const handleLoginSuccess = (staff, storeId) => {
    setCurrentUser(staff);
    setSessionExpiredMessage('');
    const effectiveStoreId = (!staff.is_owner && staff.store) ? String(staff.store) : (storeId ? String(storeId) : '');
    if (effectiveStoreId) {
      setSelectedStore(effectiveStoreId);
      localStorage.setItem('wondersale_logged_in_store', effectiveStoreId);
    }
    handleNavigate('launcher');
  };

  // Enforce assigned store lock for non-owner staff
  useEffect(() => {
    if (currentUser && !currentUser.is_owner && currentUser.store) {
      const assignedStoreId = String(currentUser.store);
      setSelectedStore(assignedStoreId);
      localStorage.setItem('wondersale_logged_in_store', assignedStoreId);
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await logoutStaff();
    setCurrentUser(null);
    setSelectedStore('');
    localStorage.removeItem('wondersale_logged_in_store');
    setActiveView('launcher');
    window.location.hash = '';
  };

  // Domain data for inventory
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for inventory
  const [inventorySubTab, setInventorySubTab] = useState('management'); // 'management', 'add_item', 'add_category', 'suppliers', 'sections', 'audit_log', 'product_detail'
  const [selectedProductDetailItem, setSelectedProductDetailItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState(() => {
    return localStorage.getItem('wondersale_logged_in_store') || '';
  });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [hasNoSupplierFilter, setHasNoSupplierFilter] = useState(false);
  const [selectedSection, setSelectedSection] = useState('');
  const [hasNoSectionFilter, setHasNoSectionFilter] = useState(false);
  const [selectedStockStatus, setSelectedStockStatus] = useState('');
  const [minStockFilter, setMinStockFilter] = useState('');
  const [maxStockFilter, setMaxStockFilter] = useState('');
  const [needsBarcodeFilter, setNeedsBarcodeFilter] = useState(false);
  const [hasNoImageFilter, setHasNoImageFilter] = useState(false);
  const [hasNoSubcategoryFilter, setHasNoSubcategoryFilter] = useState(false);
  const [hasNoWeightFilter, setHasNoWeightFilter] = useState(false);
  const [hasNoVolumeFilter, setHasNoVolumeFilter] = useState(false);
  const [inventorySortBy, setInventorySortBy] = useState('');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPageSize, setInventoryPageSize] = useState(() => {
    const saved = localStorage.getItem('wondersale_inventory_page_size');
    return saved ? parseInt(saved, 10) || 25 : 25;
  });
  const [inventoryPaginationMeta, setInventoryPaginationMeta] = useState({
    count: 0,
    totalPages: 1,
    currentPage: 1,
    pageSize: 25,
  });

  // Modal dialog states
  const [activeDetailItem, setActiveDetailItem] = useState(null);
  const [activeImageItem, setActiveImageItem] = useState(null);
  const [activeStockItem, setActiveStockItem] = useState(null);
  const [activeBarcodeItem, setActiveBarcodeItem] = useState(null);
  const [isNewItemOpen, setIsNewItemOpen] = useState(false);
  const [isExportCsvOpen, setIsExportCsvOpen] = useState(false);
  const [exportItems, setExportItems] = useState([]);
  const [reviewJobId, setReviewJobId] = useState(null);

  // Expired stock write-off UI state (declared at top to strictly follow React Rules of Hooks)
  const [expiredPreview, setExpiredPreview] = useState(null);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [writingOffExpired, setWritingOffExpired] = useState(false);
  const [expiredWriteOffResult, setExpiredWriteOffResult] = useState(null);


  // Reload taxonomy, suppliers, sections & stores metadata
  const reloadMeta = useCallback(async () => {
    try {
      const [storesData, categoriesData, subcategoriesData, suppliersData, sectionsData] = await Promise.all([
        fetchStores(),
        fetchCategories(),
        fetchSubcategories(),
        fetchSuppliers(),
        fetchSections(),
      ]);
      setStores(storesData);
      setCategories(categoriesData);
      setSubcategories(subcategoriesData);
      setSuppliers(suppliersData);
      setSections(sectionsData);

      if (Array.isArray(storesData) && storesData.length > 0) {
        const isShEnabled = storesData.some((s) => s.enable_stakeholders !== false);
        setStakeholdersActive(isShEnabled);
      }
    } catch (err) {
      console.error('Failed to reload metadata', err);
    }
  }, []);

  // Load stores, categories, subcategories, suppliers, and sections metadata whenever logged in
  useEffect(() => {
    if (!currentUser) return;
    reloadMeta();
  }, [currentUser, reloadMeta]);

  // Reset selectedSubcategories if parent selectedCategory changes and subcategories don't belong to it
  useEffect(() => {
    if (selectedCategory && selectedSubcategories.length > 0) {
      setSelectedSubcategories((prev) =>
        prev.filter((id) => {
          const sub = subcategories.find((s) => String(s.id) === String(id));
          return sub && String(sub.category) === String(selectedCategory);
        })
      );
    }
  }, [selectedCategory, selectedSubcategories, subcategories]);

  // Compute if current user is restricted to only their assigned section
  const isSectionRestricted = Boolean(
    !currentUser?.is_owner &&
    !currentUser?.role_details?.is_owner &&
    (currentUser?.effective_inventory_scope === 'assigned_section' ||
      currentUser?.role_details?.inventory_scope === 'assigned_section' ||
      currentUser?.inventory_scope === 'assigned_section') &&
    currentUser?.section
  );

  // If section-restricted staff attempts to access Sections tab, redirect to management
  useEffect(() => {
    if (isSectionRestricted && inventorySubTab === 'sections') {
      setInventorySubTab('management');
    }
  }, [isSectionRestricted, inventorySubTab]);

  // Inventory aggregate stats (calculated live by server in ~5ms)
  const [inventoryStats, setInventoryStats] = useState(null);

  // Fetch items with true server-side pagination & lazy loading
  const loadItems = useCallback(async (targetPage = null) => {
    if (!currentUser || !isModuleAccessible(currentUser, 'inventory')) return;
    setLoading(true);
    try {
      const activePage = targetPage !== null ? targetPage : inventoryPage;
      // 1. Common filter params
      const filterParams = {};
      if (searchQuery.trim()) filterParams.search = searchQuery.trim();
      if (selectedStore) filterParams.store = selectedStore;
      if (selectedCategory) filterParams.category = selectedCategory;
      if (selectedSubcategories && selectedSubcategories.length > 0) {
        filterParams.subcategories = selectedSubcategories.join(',');
      }
      if (selectedSupplier) filterParams.supplier = selectedSupplier;
      if (hasNoSupplierFilter) filterParams.has_no_supplier = 'true';
      if (isSectionRestricted) {
        filterParams.section = currentUser.section;
      } else {
        if (selectedSection) filterParams.section = selectedSection;
        if (hasNoSectionFilter) filterParams.has_no_section = 'true';
      }
      if (selectedStockStatus) filterParams.stock_status = selectedStockStatus;
      if (minStockFilter !== '') filterParams.min_stock = minStockFilter;
      if (maxStockFilter !== '') filterParams.max_stock = maxStockFilter;
      if (needsBarcodeFilter) filterParams.needs_new_barcode_printed = 'true';
      if (hasNoImageFilter) filterParams.has_no_image = 'true';
      if (hasNoSubcategoryFilter) filterParams.has_no_subcategory = 'true';
      if (hasNoWeightFilter) filterParams.has_no_weight = 'true';
      if (hasNoVolumeFilter) filterParams.has_no_volume = 'true';

      // 2. Paginated item query params
      const itemParams = {
        ...filterParams,
        page: activePage,
        page_size: inventoryPageSize,
      };
      if (inventorySortBy) itemParams.sort = inventorySortBy;

      const [data, statsData] = await Promise.all([
        fetchItems(itemParams),
        fetchInventoryStats(filterParams).catch(() => null),
      ]);

      if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.results)) {
        setItems(data.results);
        setInventoryPaginationMeta({
          count: data.count || 0,
          totalPages: data.total_pages || 1,
          currentPage: data.current_page || activePage,
          pageSize: data.page_size || inventoryPageSize,
        });
      } else {
        const list = Array.isArray(data) ? data : (data?.results || []);
        setItems(list);
        setInventoryPaginationMeta({
          count: list.length,
          totalPages: Math.max(1, Math.ceil(list.length / inventoryPageSize)),
          currentPage: 1,
          pageSize: inventoryPageSize,
        });
      }

      if (statsData) {
        setInventoryStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching inventory items', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isSectionRestricted, searchQuery, selectedStore, selectedCategory, selectedSubcategories, selectedSupplier, hasNoSupplierFilter, selectedSection, hasNoSectionFilter, selectedStockStatus, minStockFilter, maxStockFilter, needsBarcodeFilter, hasNoImageFilter, hasNoSubcategoryFilter, hasNoWeightFilter, hasNoVolumeFilter, inventoryPageSize, inventorySortBy]);

  // Reset to page 1 whenever any filter or search changes
  useEffect(() => {
    setInventoryPage(1);
  }, [searchQuery, selectedStore, selectedCategory, selectedSubcategories, selectedSupplier, hasNoSupplierFilter, selectedSection, hasNoSectionFilter, selectedStockStatus, minStockFilter, maxStockFilter, needsBarcodeFilter, hasNoImageFilter, hasNoSubcategoryFilter, hasNoWeightFilter, hasNoVolumeFilter, inventorySortBy]);

  // Fetch data on search or filter change with debounce
  useEffect(() => {
    if (!currentUser) return;
    const delay = searchQuery ? 150 : 0;
    const handler = setTimeout(() => {
      loadItems(1);
    }, delay);
    return () => clearTimeout(handler);
  }, [searchQuery, selectedStore, selectedCategory, selectedSubcategories, selectedSupplier, hasNoSupplierFilter, selectedSection, hasNoSectionFilter, selectedStockStatus, minStockFilter, maxStockFilter, needsBarcodeFilter, hasNoImageFilter, hasNoSubcategoryFilter, hasNoWeightFilter, hasNoVolumeFilter, inventorySortBy]);

  // Fetch data when user navigates page
  useEffect(() => {
    if (!currentUser) return;
    loadItems(inventoryPage);
  }, [inventoryPage, inventoryPageSize]);

  // Handle single item update
  const handleItemUpdated = (updatedItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
    );
    if (activeDetailItem?.id === updatedItem.id) {
      setActiveDetailItem(updatedItem);
    }
  };

  // Refresh single item after stock adjustment
  const handleStockAdjustmentSuccess = async () => {
    loadItems();
    if (activeDetailItem) {
      try {
        const refreshed = await fetchItem(activeDetailItem.id);
        setActiveDetailItem(refreshed);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Fast scan lookup from BarcodeScannerInput
  const handleBarcodeScanned = (foundItem) => {
    setActiveView('inventory');
    setActiveDetailItem(foundItem);
  };

  // While validating auth session on initial load, show clean loader
  if (authChecking) {
    return <ModuleLoader label="Verifying session…" />;
  }

  // If not logged in, render Login View
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={toggleTheme}
        notificationMessage={sessionExpiredMessage}
      />
    );
  }

  // Compute summary stats for inventory (prefers instant server aggregate, falls back to loaded list)
  const totalItemsCount = inventoryStats ? inventoryStats.total_items : items.length;
  const totalQuantity = inventoryStats ? inventoryStats.total_quantity : items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const lowStockCount = inventoryStats ? inventoryStats.low_stock_count : items.filter((i) => i.quantity > 0 && i.quantity <= 5).length;
  const outOfStockCount = inventoryStats ? inventoryStats.out_of_stock_count : items.filter((i) => i.quantity <= 0).length;
  const needsBarcodeCount = inventoryStats ? inventoryStats.needs_barcode_count : items.filter((i) => i.needs_new_barcode_printed).length;
  // Expired items with stock > 0
  const today = new Date(); today.setHours(0,0,0,0);
  const expiredWithStock = items.filter((i) => i.expiry_date && i.quantity > 0 && new Date(i.expiry_date) <= today);
  const expiredCount = inventoryStats ? inventoryStats.expired_count : expiredWithStock.length;

  // Derive effectiveStoreId for current session
  const effectiveStoreId = (!currentUser?.is_owner && currentUser?.store)
    ? String(currentUser.store)
    : (selectedStore || (stores[0] ? String(stores[0].id) : ''));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Global Offline / Reconnection Banner */}
      <NetworkStatusBanner />

      {/* Top Navigation Bar */}
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenNewItem={() => setIsNewItemOpen(true)}
        onItemFound={handleBarcodeScanned}
        stores={stores}
        selectedStore={selectedStore}
        onSelectStore={setSelectedStore}
        currentUser={currentUser}
        activeView={activeView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      {/* Main App Content Viewport (Under Navbar) */}
      <div className="app-content-viewport" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ErrorBoundary onHome={() => handleNavigate('launcher')}>
          <Suspense fallback={<ModuleLoader />}>
          {activeView === 'launcher' && (
            <AppLauncher
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {activeView === 'staff' && isModuleAccessible(currentUser, 'staff') && (
            <StaffManagementView
              currentUser={currentUser}
              onBackToLauncher={() => handleNavigate('launcher')}
            />
          )}

          {activeView === 'settings' && isModuleAccessible(currentUser, 'settings') && (
            <SettingsView
              currentUser={currentUser}
              selectedStore={selectedStore}
              onSelectStore={setSelectedStore}
              categories={categories}
              subcategories={subcategories}
              onTaxonomyUpdated={reloadMeta}
              onBackToLauncher={() => handleNavigate('launcher')}
              onStoresUpdated={async () => {
                try {
                  const storesData = await fetchStores();
                  setStores(storesData);
                } catch (e) {
                  console.error('Failed to reload stores', e);
                }
              }}
            />
          )}

          {activeView === 'employee_management' && isModuleAccessible(currentUser, 'employee_management') && (
            <EmployeeManagementView
              currentUser={currentUser}
              stores={stores}
              selectedStore={selectedStore}
              onBackToLauncher={() => handleNavigate('launcher')}
            />
          )}

          {/* Phase 1: Employee Portal — accessible by ALL authenticated staff */}
          {activeView === 'employee_portal' && currentUser && (
            <EmployeePortalView
              currentUser={currentUser}
              onBackToLauncher={() => handleNavigate('launcher')}
            />
          )}

          {activeView === 'billing' && isModuleAccessible(currentUser, 'billing') && (
            <BillingView
              currentUser={currentUser}
              stores={stores}
              effectiveStoreId={effectiveStoreId}
              onBackToLauncher={() => handleNavigate('launcher')}
              onNavigateToCustomers={isModuleAccessible(currentUser, 'customers') ? () => handleNavigate('customers') : undefined}
            />
          )}

          {activeView === 'customers' && isModuleAccessible(currentUser, 'customers') && (
            <CustomersView
              currentUser={currentUser}
              stores={stores}
              effectiveStoreId={(!currentUser?.is_owner && currentUser?.store) ? String(currentUser.store) : (selectedStore || (stores[0]?.id ? String(stores[0].id) : ''))}
              onBackToLauncher={() => handleNavigate('launcher')}
              onNavigateToBilling={isModuleAccessible(currentUser, 'billing') ? () => handleNavigate('billing') : undefined}
            />
          )}

          {activeView === 'stakeholders' && isModuleAccessible(currentUser, 'stakeholders') && stakeholdersActive && (
            <StakeholdersView
              currentUser={currentUser}
              selectedStore={selectedStore}
              stores={stores}
              onBackToLauncher={() => handleNavigate('launcher')}
            />
          )}

          {activeView === 'accounting' && isModuleAccessible(currentUser, 'accounting') && (
            <AccountsView
              currentUser={currentUser}
              stores={stores}
              selectedStore={selectedStore}
              onBackToLauncher={() => handleNavigate('launcher')}
            />
          )}

          {activeView === 'dashboard' && isModuleAccessible(currentUser, 'dashboard') && (
            <DashboardView
              currentUser={currentUser}
              selectedStore={selectedStore}
              onNavigate={handleNavigate}
              onBackToLauncher={() => handleNavigate('launcher')}
            />
          )}

          {activeView === 'assets' && isModuleAccessible(currentUser, activeView) && (
            <WorkstationView
              viewId={activeView}
              currentUser={currentUser}
              onBackToLauncher={() => handleNavigate('launcher')}
            />
          )}

          {activeView === 'inventory' && isModuleAccessible(currentUser, 'inventory') && (
        <main className="inv-station-main" style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px' }}>
          {/* Top Header matching Staff section */}
          <div
            className="inv-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '28px',
            }}
          >
            <div className="inv-header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                type="button"
                onClick={() => handleNavigate('launcher')}
                className="btn btn-secondary inv-back-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                }}
                title="Return to Menu"
              >
                <ArrowLeft size={16} />
                <span>Menu</span>
              </button>
              <div className="inv-header-title-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="inv-header-title" style={{ fontSize: '1.6rem', fontWeight: 800 }}>Inventory Station</h2>
                </div>
                <p className="inv-header-subtitle" style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  Manage store stock, register products, and organize categories &amp; subcategories.
                </p>
              </div>
            </div>
          </div>


          {/* Sub-Navigation Tabs matching Staff Section style */}
          <div
            className="inv-tabs-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '24px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div className="inv-tabs-scroll" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="inv-tab-btn"
                onClick={() => setInventorySubTab('management')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: inventorySubTab === 'management' ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  color: inventorySubTab === 'management' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Package size={18} />
                <span>Inventory Management ({totalItemsCount})</span>
              </button>

              <button
                type="button"
                className="inv-tab-btn"
                onClick={() => setInventorySubTab('add_item')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: inventorySubTab === 'add_item' ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  color: inventorySubTab === 'add_item' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Plus size={18} />
                <span>Add Item</span>
              </button>

              <button
                type="button"
                className="inv-tab-btn"
                onClick={() => setInventorySubTab('add_category')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: inventorySubTab === 'add_category' ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  color: inventorySubTab === 'add_category' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Layers size={18} />
                <span>Add Category ({categories.length})</span>
              </button>

              <button
                type="button"
                className="inv-tab-btn"
                onClick={() => setInventorySubTab('suppliers')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: inventorySubTab === 'suppliers' ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  color: inventorySubTab === 'suppliers' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Truck size={18} />
                <span>Suppliers ({suppliers.length})</span>
              </button>

              {!isSectionRestricted && (
                <button
                  type="button"
                  className="inv-tab-btn"
                  onClick={() => setInventorySubTab('sections')}
                  style={{
                    padding: '12px 20px',
                    background: 'none',
                    border: 'none',
                    borderBottom: inventorySubTab === 'sections' ? '3px solid var(--brand-primary)' : '3px solid transparent',
                    color: inventorySubTab === 'sections' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.94rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <FolderPlus size={18} />
                  <span>Sections ({sections.length})</span>
                </button>
              )}

              <button
                type="button"
                className="inv-tab-btn"
                onClick={() => setInventorySubTab('audit_log')}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: inventorySubTab === 'audit_log' ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  color: inventorySubTab === 'audit_log' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <History size={18} />
                <span>Audit Log</span>
              </button>

              {inventorySubTab === 'product_detail' && selectedProductDetailItem && (
                <button
                  type="button"
                  className="inv-tab-btn"
                  onClick={() => setInventorySubTab('product_detail')}
                  style={{
                    padding: '12px 20px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '3px solid var(--brand-primary)',
                    color: 'var(--brand-primary)',
                    fontWeight: 700,
                    fontSize: '0.94rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <BarChart3 size={18} />
                  <span>Product: {selectedProductDetailItem.name}</span>
                </button>
              )}
            </div>
          </div>


          {/* Sub-Section 1: Inventory Management (Stat Cards + Item Table) */}
          {inventorySubTab === 'management' && (
            <>
              {/* Antigravity Stat Cards Grid */}
              {loading && items.length === 0 ? (
                <SkeletonStatsCards count={4} />
              ) : (
                <div
                  className="inv-stats-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px',
                  }}
                >
                  {/* Total Catalog Items */}
                  <div className="glass-panel inv-stat-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      className="inv-stat-icon-box"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#3B82F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Package size={22} />
                    </div>
                    <div className="inv-stat-content">
                      <div className="inv-stat-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Products
                      </div>
                      <div className="inv-stat-value" style={{ fontSize: '1.45rem', fontWeight: 800 }}>{totalItemsCount}</div>
                    </div>
                  </div>

                  {/* Total Units in Stock */}
                  <div className="glass-panel inv-stat-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      className="inv-stat-icon-box"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10B981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TrendingUp size={22} />
                    </div>
                    <div className="inv-stat-content">
                      <div className="inv-stat-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Total Stock Units
                      </div>
                      <div className="inv-stat-value" style={{ fontSize: '1.45rem', fontWeight: 800 }}>{totalQuantity}</div>
                    </div>
                  </div>

                  {/* Low & Out of Stock Alert */}
                  <div className="glass-panel inv-stat-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      className="inv-stat-icon-box"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: '#F59E0B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AlertTriangle size={22} />
                    </div>
                    <div className="inv-stat-content">
                      <div className="inv-stat-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Attention Needed
                      </div>
                      <div className="inv-stat-value" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
                        {outOfStockCount > 0 && (
                          <span style={{ color: 'var(--color-danger)' }}>{outOfStockCount} Out </span>
                        )}
                        <span style={{ color: 'var(--color-warning)', fontSize: '1.1rem' }}>
                          ({lowStockCount} Low)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Barcode Labels Needing Print */}
                  <div
                    className="glass-panel glass-panel-interactive inv-stat-card"
                    onClick={() => setNeedsBarcodeFilter(!needsBarcodeFilter)}
                    style={{
                      padding: '18px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      cursor: 'pointer',
                      borderColor: needsBarcodeFilter ? 'var(--brand-primary)' : 'var(--border-subtle)',
                    }}
                  >
                    <div
                      className="inv-stat-icon-box"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--brand-ruby-glow)',
                        color: 'var(--brand-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Barcode size={22} />
                    </div>
                    <div className="inv-stat-content">
                      <div className="inv-stat-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Labels to Print
                      </div>
                      <div className="inv-stat-value" style={{ fontSize: '1.45rem', fontWeight: 800, color: needsBarcodeCount > 0 ? 'var(--brand-primary)' : 'inherit' }}>
                        {needsBarcodeCount}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Expired Stock Alert Banner */}
              {expiredCount > 0 && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 20px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-danger)' }}>
                        {expiredCount} expired product{expiredCount > 1 ? 's' : ''} with remaining stock
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        These items have passed their expiry date but still show inventory. Write them off to record the loss accurately.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        try {
                          const preview = await previewExpiredStock(effectiveStoreId);
                          setExpiredPreview(preview);
                          setShowExpiredModal(true);
                          setExpiredWriteOffResult(null);
                        } catch (e) { alert('Failed to load preview: ' + e.message); }
                      }}
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ background: 'var(--color-danger)', color: '#fff', border: 'none' }}
                      disabled={writingOffExpired}
                      onClick={async () => {
                        if (!window.confirm(`Write off all ${expiredCount} expired item(s)? This will set their stock to 0 and record the loss.`)) return;
                        setWritingOffExpired(true);
                        try {
                          const result = await writeOffExpiredStock({ storeId: effectiveStoreId });
                          setExpiredWriteOffResult(result);
                          await loadItems();
                        } catch (e) { alert('Write-off failed: ' + e.message); } finally { setWritingOffExpired(false); }
                      }}
                    >
                      {writingOffExpired ? 'Writing Off…' : 'Write Off All'}
                    </button>
                  </div>
                </div>
              )}

              {expiredWriteOffResult && (
                <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-lg)', padding: '12px 18px', marginBottom: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✅ {expiredWriteOffResult.items_written_off_count} item(s) written off — {expiredWriteOffResult.total_units_written_off} units — Total loss recorded: ₹{Number(expiredWriteOffResult.total_financial_loss).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                </div>
              )}

              {/* Item Table & Filters */}
              <ItemTable
                items={items}
                loading={loading}
                categories={categories}
                subcategories={subcategories}
                suppliers={suppliers}
                sections={sections}
                currentUser={currentUser}
                isSectionRestricted={isSectionRestricted}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedSubcategories={selectedSubcategories}
                onSubcategoriesChange={setSelectedSubcategories}
                selectedSupplier={selectedSupplier}
                onSupplierChange={setSelectedSupplier}
                hasNoSupplierFilter={hasNoSupplierFilter}
                onHasNoSupplierFilterChange={setHasNoSupplierFilter}
                selectedSection={selectedSection}
                onSectionChange={setSelectedSection}
                hasNoSectionFilter={hasNoSectionFilter}
                onHasNoSectionFilterChange={setHasNoSectionFilter}
                selectedStockStatus={selectedStockStatus}
                onStockStatusChange={setSelectedStockStatus}
                minStockFilter={minStockFilter}
                onMinStockFilterChange={setMinStockFilter}
                maxStockFilter={maxStockFilter}
                onMaxStockFilterChange={setMaxStockFilter}
                needsBarcodeFilter={needsBarcodeFilter}
                onNeedsBarcodeFilterChange={setNeedsBarcodeFilter}
                hasNoImageFilter={hasNoImageFilter}
                onHasNoImageFilterChange={setHasNoImageFilter}
                hasNoSubcategoryFilter={hasNoSubcategoryFilter}
                onHasNoSubcategoryFilterChange={setHasNoSubcategoryFilter}
                hasNoWeightFilter={hasNoWeightFilter}
                onHasNoWeightFilterChange={setHasNoWeightFilter}
                hasNoVolumeFilter={hasNoVolumeFilter}
                onHasNoVolumeFilterChange={setHasNoVolumeFilter}
                onViewItem={(item) => {
                  fetchItem(item.id)
                    .then((fullItem) => {
                      setSelectedProductDetailItem(fullItem);
                      setInventorySubTab('product_detail');
                    })
                    .catch(() => {
                      setSelectedProductDetailItem(item);
                      setInventorySubTab('product_detail');
                    });
                }}
                onEditItem={(item) => setActiveDetailItem(item)}
                onPrintBarcode={(item) => setActiveBarcodeItem(item)}
                onOpenImageModal={(item) => setActiveImageItem(item)}
                onQuickAdjust={(item) => setActiveStockItem(item)}
                onOpenExportCsv={async () => {
                  try {
                    const exportFilterParams = {};
                    if (searchQuery.trim()) exportFilterParams.search = searchQuery.trim();
                    if (selectedStore) exportFilterParams.store = selectedStore;
                    if (selectedCategory) exportFilterParams.category = selectedCategory;
                    if (selectedSubcategories && selectedSubcategories.length > 0) {
                      exportFilterParams.subcategories = selectedSubcategories.join(',');
                    }
                    if (selectedSupplier) exportFilterParams.supplier = selectedSupplier;
                    if (hasNoSupplierFilter) exportFilterParams.has_no_supplier = 'true';
                    if (isSectionRestricted) {
                      exportFilterParams.section = currentUser.section;
                    } else {
                      if (selectedSection) exportFilterParams.section = selectedSection;
                      if (hasNoSectionFilter) exportFilterParams.has_no_section = 'true';
                    }
                    if (selectedStockStatus) exportFilterParams.stock_status = selectedStockStatus;
                    if (minStockFilter !== '') exportFilterParams.min_stock = minStockFilter;
                    if (maxStockFilter !== '') exportFilterParams.max_stock = maxStockFilter;
                    if (needsBarcodeFilter) exportFilterParams.needs_new_barcode_printed = 'true';
                    if (hasNoImageFilter) exportFilterParams.has_no_image = 'true';
                    if (hasNoSubcategoryFilter) exportFilterParams.has_no_subcategory = 'true';
                    if (hasNoWeightFilter) exportFilterParams.has_no_weight = 'true';
                    if (hasNoVolumeFilter) exportFilterParams.has_no_volume = 'true';

                    // Fetch unpaginated dataset (backward-compatible, no page param)
                    const fullData = await fetchItems(exportFilterParams);
                    const fullList = Array.isArray(fullData) ? fullData : (fullData?.results || []);
                    setExportItems(fullList);
                  } catch (e) {
                    console.error('Error preparing CSV export data', e);
                    setExportItems(items);
                  }
                  setIsExportCsvOpen(true);
                }}
                onItemsChanged={loadItems}
                onStartAIDescriptionJob={(job) => {
                  if (job?.id) setReviewJobId(job.id);
                  loadItems();
                }}
                serverPagination={true}
                serverPage={inventoryPage}
                serverPageSize={inventoryPageSize}
                serverTotalCount={inventoryPaginationMeta.count}
                serverTotalPages={inventoryPaginationMeta.totalPages}
                onPageChange={(p) => setInventoryPage(p)}
                onPageSizeChange={(sz) => {
                  setInventoryPageSize(sz);
                  setInventoryPage(1);
                }}
                sortBy={inventorySortBy}
                onSortByChange={(s) => setInventorySortBy(s)}
              />
            </>
          )}

          {/* Sub-Section 2: Add Item Workspace */}
          {inventorySubTab === 'add_item' && (
            <AddItemSection
              stores={stores}
              categories={categories}
              subcategories={subcategories}
              suppliers={suppliers}
              sections={sections}
              currentUser={currentUser}
              isSectionRestricted={isSectionRestricted}
              selectedStore={selectedStore}
              onProductCreated={(newItem) => {
                loadItems();
              }}
              onGoToManagement={() => setInventorySubTab('management')}
              onMetaUpdated={reloadMeta}
              onOpenSettings={() => handleNavigate('settings')}
            />
          )}

          {/* Sub-Section 3: Add Category & Subcategory Workspace */}
          {inventorySubTab === 'add_category' && (
            <CategorySection
              categories={categories}
              subcategories={subcategories}
              loading={loading}
              onTaxonomyUpdated={reloadMeta}
            />
          )}

          {/* Sub-Section 3.5: Suppliers & Vendors Directory */}
          {inventorySubTab === 'suppliers' && (
            <SupplierSection
              suppliers={suppliers}
              stores={stores}
              currentStore={stores.find((s) => String(s.id) === String(selectedStore))}
              loading={loading}
              onSuppliersUpdated={reloadMeta}
            />
          )}

          {/* Sub-Section 3.6: Store Sections & Departments Directory */}
          {inventorySubTab === 'sections' && !isSectionRestricted && (
            <SectionSection
              sections={sections}
              stores={stores}
              currentStore={stores.find((s) => String(s.id) === String(selectedStore))}
              loading={loading}
              onSectionsUpdated={reloadMeta}
            />
          )}

          {/* Sub-Section 4: Store-Wide Stock Movement Ledger & Audit Log */}
          {inventorySubTab === 'audit_log' && (
            <AuditLogSection
              currentUser={currentUser}
              stores={stores}
              selectedStore={selectedStore}
              onSelectStore={setSelectedStore}
              onViewItem={(item) => {
                fetchItem(item.id)
                  .then((fullItem) => {
                    setSelectedProductDetailItem(fullItem);
                    setInventorySubTab('product_detail');
                  })
                  .catch(() => {
                    setSelectedProductDetailItem(item);
                    setInventorySubTab('product_detail');
                  });
              }}
              onQuickAdjust={(item) => setActiveStockItem(item)}
            />
          )}

          {/* Sub-Section 5: Dedicated Product Detail & Analytics View */}
          {inventorySubTab === 'product_detail' && selectedProductDetailItem && (
            <ProductDetailView
              item={selectedProductDetailItem}
              currentUser={currentUser}
              stores={stores}
              suppliers={suppliers}
              onBack={() => {
                setInventorySubTab('management');
                setSelectedProductDetailItem(null);
              }}
              onUpdateItem={(updatedItem) => {
                handleItemUpdated(updatedItem);
                setSelectedProductDetailItem(updatedItem);
              }}
              onOpenEditModal={(item) => setActiveDetailItem(item)}
              onOpenBarcode={(item) => setActiveBarcodeItem(item)}
              onOpenImageModal={(item) => setActiveImageItem(item)}
              onQuickAdjust={(item) => setActiveStockItem(item)}
            />
          )}
        </main>
      )}

      {/* Fallback: 404 Station Not Found */}
      {!validViews.includes(activeView) && (
        <NotFoundView
          invalidPath={activeView}
          onBackToLauncher={() => handleNavigate('launcher')}
        />
      )}

      {/* Modal: View / Edit Item & Gallery & Stock Ledger */}
      {activeDetailItem && (
        <ItemDetailModal
          item={activeDetailItem}
          stores={stores}
          categories={categories}
          subcategories={subcategories}
          suppliers={suppliers}
          sections={sections}
          currentUser={currentUser}
          isSectionRestricted={isSectionRestricted}
          selectedStore={selectedStore}
          onClose={() => setActiveDetailItem(null)}
          onUpdateItem={handleItemUpdated}
          onMetaUpdated={reloadMeta}
          onOpenBarcode={(item) => setActiveBarcodeItem(item)}
          onQuickAdjust={(item) => setActiveStockItem(item)}
          onSwitchItem={async (targetId) => {
            const found = items.find((x) => x.id === targetId);
            if (found) {
              setActiveDetailItem(found);
            } else {
              try {
                const fresh = await fetchItem(targetId);
                if (fresh) setActiveDetailItem(fresh);
              } catch (err) {
                console.error('Failed to switch item', err);
              }
            }
          }}
          onItemsChanged={loadItems}
        />
      )}

      {/* Modal: Photo Gallery & Uploads */}
      {activeImageItem && (
        <ItemImageModal
          item={activeImageItem}
          onClose={() => setActiveImageItem(null)}
          onUpdateItem={handleItemUpdated}
        />
      )}

      {/* Modal: Add New Item */}
      {isNewItemOpen && (
        <NewItemModal
          stores={stores}
          categories={categories}
          subcategories={subcategories}
          suppliers={suppliers}
          sections={sections}
          currentUser={currentUser}
          isSectionRestricted={isSectionRestricted}
          selectedStore={selectedStore}
          onClose={() => setIsNewItemOpen(false)}
          onMetaUpdated={reloadMeta}
          onSuccess={(newItem) => {
            loadItems();
            setActiveDetailItem(newItem);
          }}
        />
      )}


      {/* Modal: Quick Stock Adjustment */}
      {activeStockItem && (
        <StockAdjustmentModal
          item={activeStockItem}
          onClose={() => setActiveStockItem(null)}
          onSuccess={handleStockAdjustmentSuccess}
        />
      )}

      {/* Modal: Barcode Preview & Print Label */}
      {activeBarcodeItem && (
        <BarcodeModal
          item={activeBarcodeItem}
          onClose={() => setActiveBarcodeItem(null)}
          onUpdateItem={handleItemUpdated}
        />
      )}

      {/* Modal: Export Inventory to CSV */}
      {isExportCsvOpen && (
        <ExportCsvModal
          isOpen={isExportCsvOpen}
          onClose={() => setIsExportCsvOpen(false)}
          items={exportItems.length > 0 ? exportItems : items}
          categories={categories}
          subcategories={subcategories}
          suppliers={suppliers}
          sections={sections}
          currentFilters={{
            searchQuery,
            selectedSubcategories,
            selectedSupplier,
            hasNoSupplierFilter,
            selectedSection,
            hasNoSectionFilter,
            selectedStockStatus,
            hasNoImageFilter,
            hasNoSubcategoryFilter,
            needsBarcodeFilter,
            hasNoWeightFilter,
            hasNoVolumeFilter,
          }}
          currentStoreName={
            stores.find((s) => String(s.id) === String(selectedStore))?.name || 'Active Store'
          }
        />
      )}

      {/* Floating AI Description Generation Progress Bar & Studio Widget */}
      {currentUser && (
        <AIDescriptionProgressWidget
          activeStoreId={selectedStore}
          onOpenReview={(jobId) => setReviewJobId(jobId)}
          onJobStatusChange={() => {}}
        />
      )}

      {/* AI Description Review & Tweak Modal Drawer */}
      {reviewJobId && (
        <AIDescriptionReviewModal
          jobId={reviewJobId}
          isOpen={Boolean(reviewJobId)}
          onClose={() => setReviewJobId(null)}
          onItemUpdated={() => {
            loadItems();
          }}
        />
      )}

      {/* Modal: Expired Stock Write-Off Preview & Confirmation */}
      {showExpiredModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setShowExpiredModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface, #111422)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl, 16px)',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
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
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--color-danger-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-danger)',
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Expired Stock Write-Off Preview
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Review expired inventory items before writing them off to store loss.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 8px' }}
                onClick={() => setShowExpiredModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Summary Metrics Banner */}
            {expiredPreview && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  padding: '16px 24px',
                  background: 'var(--bg-base, #0b0e17)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Expired Products
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: '2px' }}>
                    {expiredPreview.total_items}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Units Expired
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {expiredPreview.total_units}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Financial Loss (At Cost)
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f97316', marginTop: '2px' }}>
                    ₹{Number(expiredPreview.total_financial_loss || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {!expiredPreview || expiredPreview.items?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No expired items with stock remaining found.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 10px' }}>Product</th>
                      <th style={{ padding: '8px 10px' }}>Barcode / UID</th>
                      <th style={{ padding: '8px 10px' }}>Expiry Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Stock Units</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cost Price</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Estimated Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiredPreview.items.map((it) => (
                      <tr key={it.item_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {it.name}
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {it.uid}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                            {it.expiry_date}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-danger)' }}>
                          {it.current_stock}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          ₹{Number(it.cost_price || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#f97316' }}>
                          ₹{Number(it.potential_loss || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-base, #0b0e17)',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Writing off sets stock to 0 and records an official financial loss in the P&amp;L ledger.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowExpiredModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', fontWeight: 600 }}
                  disabled={writingOffExpired || !expiredPreview || expiredPreview.total_items === 0}
                  onClick={async () => {
                    if (!window.confirm(`Are you sure you want to write off ${expiredPreview.total_items} expired item(s)? Stock will be zeroed out.`)) return;
                    setWritingOffExpired(true);
                    try {
                      const result = await writeOffExpiredStock({ storeId: effectiveStoreId });
                      setExpiredWriteOffResult(result);
                      setShowExpiredModal(false);
                      await loadItems();
                    } catch (e) {
                      alert('Write-off failed: ' + e.message);
                    } finally {
                      setWritingOffExpired(false);
                    }
                  }}
                >
                  {writingOffExpired ? 'Processing Write-Off…' : `Confirm Write-Off (${expiredPreview?.total_items || 0} items)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </Suspense>
      </ErrorBoundary>
      </div>
    </div>
  );
}
