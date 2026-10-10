import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Barcode,
  Package,
  Layers,
  Printer,
  Edit,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  MapPin,
  Trash2,
  Check,
  Edit3,
  X,
  Plus,
  Save,
  RotateCcw,
  ArrowUpDown,
  Filter,
  ChevronDown,
  FileSpreadsheet,
  TrendingUp,
  Ruler,
  Scale,
  FileText,
  Box,
  Truck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Folder,
  FolderOpen,
  Lock,
  AlertOctagon,
} from 'lucide-react';
import { updateItem, deleteItem, bulkAIGenerateDescriptions } from '../api';
import { SkeletonInventoryRows } from './Skeleton';
import SubcategoryPickerPopover from './SubcategoryPickerPopover';
import SubcategoryViewerDropdown, { SubcategoriesBadgeList } from './SubcategoryViewerDropdown';
import BrokenItemModal from './BrokenItemModal';

// Helper to calculate volume and volumetric weight metrics
export const calculateVolumeMetrics = (length, width, height) => {
  const l = parseFloat(length);
  const w = parseFloat(width);
  const h = parseFloat(height);
  if (isNaN(l) || isNaN(w) || isNaN(h) || l <= 0 || w <= 0 || h <= 0) {
    return {
      hasDimensions: false,
      dimensionsStr: null,
      volumeCm3: null,
      volumeLiters: null,
      volumetricWeightKg: null,
    };
  }
  const vol = l * w * h;
  const volWt = vol / 5000;
  return {
    hasDimensions: true,
    dimensionsStr: `${l} × ${w} × ${h} cm`,
    volumeCm3: vol >= 1000 ? vol.toLocaleString(undefined, { maximumFractionDigits: 1 }) : vol.toFixed(1),
    volumeLiters: (vol / 1000).toFixed(2),
    volumetricWeightKg: volWt.toFixed(3),
  };
};

export default function ItemTable({
  items = [],
  loading = false,
  categories = [],
  subcategories = [],
  suppliers = [],
  sections = [],
  currentUser,
  isSectionRestricted: propIsSectionRestricted,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedSubcategories = [],
  onSubcategoriesChange,
  selectedSubcategory,
  onSubcategoryChange,
  selectedSupplier = '',
  onSupplierChange,
  hasNoSupplierFilter = false,
  onHasNoSupplierFilterChange,
  selectedSection = '',
  onSectionChange,
  hasNoSectionFilter = false,
  onHasNoSectionFilterChange,
  selectedStockStatus,
  onStockStatusChange,
  minStockFilter = '',
  onMinStockFilterChange,
  maxStockFilter = '',
  onMaxStockFilterChange,
  needsBarcodeFilter,
  onNeedsBarcodeFilterChange,
  hasNoImageFilter = false,
  onHasNoImageFilterChange,
  hasNoSubcategoryFilter = false,
  onHasNoSubcategoryFilterChange,
  hasNoWeightFilter = false,
  onHasNoWeightFilterChange,
  hasNoVolumeFilter = false,
  onHasNoVolumeFilterChange,
  onViewItem,
  onEditItem,
  onPrintBarcode,
  onOpenImageModal,
  onQuickAdjust,
  onOpenExportCsv,
  onItemsChanged,
  onStartAIDescriptionJob,
  // Server-side pagination & sorting props
  serverPagination = false,
  serverPage = 1,
  serverPageSize = 25,
  serverTotalCount = 0,
  serverTotalPages = 1,
  onPageChange: propOnPageChange,
  onPageSizeChange: propOnPageSizeChange,
  sortBy: propSortBy,
  onSortByChange: propOnSortByChange,
}) {
  const isSectionRestricted = Boolean(
    propIsSectionRestricted ?? (
      !currentUser?.is_owner &&
      !currentUser?.role_details?.is_owner &&
      (currentUser?.effective_inventory_scope === 'assigned_section' ||
        currentUser?.role_details?.inventory_scope === 'assigned_section' ||
        currentUser?.inventory_scope === 'assigned_section') &&
      currentUser?.section
    )
  );

  // Inline Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [dirtyItemIds, setDirtyItemIds] = useState(() => new Set());
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [editBuffer, setEditBuffer] = useState({}); // { [itemId]: { name, cost_price, selling_price, mrp, location_section, expiry_date, weight, subcategory_ids } }
  const [savingEdits, setSavingEdits] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [subcatPickerAnchor, setSubcatPickerAnchor] = useState(null); // { itemId, anchorRect }
  const [activeSubcatViewer, setActiveSubcatViewer] = useState(null); // { itemId, itemName, anchorEl, anchorRect, primarySubcat, allSubcategories }
  const [internalSortBy, setInternalSortBy] = useState('');
  const sortBy = propSortBy !== undefined ? propSortBy : internalSortBy;
  const setSortBy = propOnSortByChange || setInternalSortBy;
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isSubcatFilterOpen, setIsSubcatFilterOpen] = useState(false);
  const [subcatFilterQuery, setSubcatFilterQuery] = useState('');
  const subcatFilterDropdownRef = useRef(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [aiErrorDialogMessage, setAiErrorDialogMessage] = useState(null);

  // Toggle subcategories viewer dropdown popover
  const handleToggleSubcatViewer = (itemId, itemName, anchorEl, primSub, allSubs) => {
    if (activeSubcatViewer?.itemId === itemId) {
      setActiveSubcatViewer(null);
    } else {
      setActiveSubcatViewer({
        itemId,
        itemName,
        anchorEl,
        anchorRect: anchorEl.getBoundingClientRect(),
        primarySubcat: primSub,
        allSubcategories: allSubs,
      });
    }
  };

  // Image Lightbox Modal State for Inventory Table
  const [lightboxImage, setLightboxImage] = useState(null); // { src, name, uid }
  const [brokenItemTarget, setBrokenItemTarget] = useState(null);

  // Barcode Scanner Timing & Buffer Refs for Inventory View
  const barcodeScanBufferRef = useRef('');
  const lastScanKeyTimeRef = useRef(0);
  const lastScanProcessedRef = useRef({ code: '', time: 0 });

  // Variant Family folder/tree expansion state & active variant per group
  const [expandedVariantGroups, setExpandedVariantGroups] = useState({});
  const [activeVariantIdByGroup, setActiveVariantIdByGroup] = useState({});

  const searchInputRef = useRef(null);

  // Keyboard shortcut (Escape to close Lightbox modal) & Barcode Scanner Detection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null);
        return;
      }

      const activeEl = document.activeElement;
      const isSearchInput = activeEl === searchInputRef.current;
      const isOtherInputFocused = activeEl && !isSearchInput && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
      
      // Do not intercept if user is typing in other inputs (e.g. inline cell editors, category inputs)
      if (isOtherInputFocused) {
        return;
      }

      const now = Date.now();
      const diff = now - lastScanKeyTimeRef.current;
      lastScanKeyTimeRef.current = now;

      // Handle barcode scanner terminator (Enter or Tab)
      if (e.key === 'Enter' || e.key === 'Tab') {
        const buffer = barcodeScanBufferRef.current.trim();
        // Hardware scanners burst characters with rapid keystrokes (<300ms)
        if (buffer.length >= 2 && diff < 300) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
          }
          barcodeScanBufferRef.current = '';
          // Normalize barcode (strip AIM symbology headers like ]C1, ]e0)
          const cleaned = buffer.replace(/^\][A-Za-z0-9]{2}/, '').trim().toLowerCase();

          // Debounce & Rate Limit: ignore duplicate scans within 800ms, rate-limit to 200ms
          if (
            lastScanProcessedRef.current.code === cleaned &&
            now - lastScanProcessedRef.current.time < 800
          ) {
            return;
          }
          if (now - lastScanProcessedRef.current.time < 200) {
            return;
          }
          lastScanProcessedRef.current = { code: cleaned, time: now };

          if (onSearchChange) {
            onSearchChange(cleaned);
          }
          return;
        }
        barcodeScanBufferRef.current = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (diff > 120) {
          barcodeScanBufferRef.current = e.key;
        } else {
          barcodeScanBufferRef.current += e.key;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [lightboxImage, onSearchChange]);

  // Normalize selected subcategory IDs
  const activeSubcatIds = useMemo(() => {
    if (Array.isArray(selectedSubcategories) && selectedSubcategories.length > 0) {
      return selectedSubcategories.map(String);
    }
    if (selectedSubcategory) {
      return String(selectedSubcategory).split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }, [selectedSubcategories, selectedSubcategory]);

  // Multi-select subcategory filter dropdown coords & ref
  const [subcatCoords, setSubcatCoords] = useState({ top: 0, left: 0 });
  const subcatMenuRef = useRef(null);

  const updateSubcatCoords = () => {
    if (subcatFilterDropdownRef.current) {
      const rect = subcatFilterDropdownRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;
      setSubcatCoords({ top: rect.bottom + 6, left });
    }
  };

  // Click outside to close multi-select subcategory filter dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        subcatFilterDropdownRef.current &&
        !subcatFilterDropdownRef.current.contains(event.target) &&
        subcatMenuRef.current &&
        !subcatMenuRef.current.contains(event.target)
      ) {
        setIsSubcatFilterOpen(false);
      }
    };
    if (isSubcatFilterOpen) {
      updateSubcatCoords();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', updateSubcatCoords);
      window.addEventListener('scroll', updateSubcatCoords, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updateSubcatCoords);
      window.removeEventListener('scroll', updateSubcatCoords, true);
    };
  }, [isSubcatFilterOpen]);

  // Custom Stock Level Range Filter Popover state
  const [isStockPopoverOpen, setIsStockPopoverOpen] = useState(false);
  const stockPopoverRef = useRef(null);
  const [stockCoords, setStockCoords] = useState({ top: 0, left: 0 });
  const stockMenuRef = useRef(null);

  const updateStockCoords = () => {
    if (stockPopoverRef.current) {
      const rect = stockPopoverRef.current.getBoundingClientRect();
      const popoverWidth = 270;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;
      setStockCoords({ top: rect.bottom + 6, left });
    }
  };

  // Click outside to close custom stock popover
  useEffect(() => {
    const handleClickOutsideStock = (event) => {
      if (
        stockPopoverRef.current &&
        !stockPopoverRef.current.contains(event.target) &&
        stockMenuRef.current &&
        !stockMenuRef.current.contains(event.target)
      ) {
        setIsStockPopoverOpen(false);
      }
    };
    if (isStockPopoverOpen) {
      updateStockCoords();
      document.addEventListener('mousedown', handleClickOutsideStock);
      window.addEventListener('resize', updateStockCoords);
      window.addEventListener('scroll', updateStockCoords, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideStock);
      window.removeEventListener('resize', updateStockCoords);
      window.removeEventListener('scroll', updateStockCoords, true);
    };
  }, [isStockPopoverOpen]);

  const toggleSubcatFilterItem = (id) => {
    const idStr = String(id);
    let next;
    if (activeSubcatIds.includes(idStr)) {
      next = activeSubcatIds.filter((x) => x !== idStr);
    } else {
      next = [...activeSubcatIds, idStr];
    }
    if (onSubcategoriesChange) {
      onSubcategoriesChange(next);
    } else if (onSubcategoryChange) {
      onSubcategoryChange(next.join(','));
    }
  };

  const handleSelectAllSubcats = () => {
    const all = subcategories.map((s) => String(s.id));
    if (onSubcategoriesChange) {
      onSubcategoriesChange(all);
    } else if (onSubcategoryChange) {
      onSubcategoryChange(all.join(','));
    }
  };

  const handleClearAllSubcats = () => {
    if (onSubcategoriesChange) {
      onSubcategoriesChange([]);
    } else if (onSubcategoryChange) {
      onSubcategoryChange('');
    }
  };

  const filteredFilterSubcats = useMemo(() => {
    if (!subcatFilterQuery.trim()) return subcategories;
    const q = subcatFilterQuery.toLowerCase().trim();
    return subcategories.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.category_name && s.category_name.toLowerCase().includes(q))
    );
  }, [subcategories, subcatFilterQuery]);

  // Pagination State (supports serverPagination mode or internal fallback)
  const [internalPageSize, setInternalPageSize] = useState(() => {
    const saved = localStorage.getItem('wondersale_inventory_page_size');
    return saved ? parseInt(saved, 10) || 25 : 25;
  });
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);

  const pageSize = serverPagination ? serverPageSize : internalPageSize;
  const currentPage = serverPagination ? serverPage : internalCurrentPage;

  const handlePageChange = (newPage) => {
    if (serverPagination && propOnPageChange) {
      propOnPageChange(newPage);
    } else {
      setInternalCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize) => {
    const sizeNum = parseInt(newSize, 10) || 25;
    localStorage.setItem('wondersale_inventory_page_size', String(sizeNum));
    if (serverPagination && propOnPageSizeChange) {
      propOnPageSizeChange(sizeNum);
    } else {
      setInternalPageSize(sizeNum);
      setInternalCurrentPage(1);
    }
  };

  // Draggable Floating Action Toolbar State (Smooth Horizontal Snapping)
  const [dockSide, setDockSide] = useState(() => {
    try {
      return localStorage.getItem('wondersale_edit_bar_dock_side') || 'right';
    } catch (e) {
      return 'right';
    }
  });
  const [isDraggingEditBar, setIsDraggingEditBar] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const floatingBarRef = useRef(null);
  const dragInfoRef = useRef({ isDown: false, startX: 0, moved: false });
  const justDraggedRef = useRef(false);

  useEffect(() => {
    const handleWindowPointerMove = (e) => {
      if (!dragInfoRef.current.isDown) return;
      const dx = e.clientX - dragInfoRef.current.startX;
      if (Math.abs(dx) > 6 || dragInfoRef.current.moved) {
        dragInfoRef.current.moved = true;
        setIsDraggingEditBar(true);
        setDragDeltaX(dx);
      }
    };

    const handleWindowPointerUp = () => {
      if (!dragInfoRef.current.isDown) return;
      const hadMoved = dragInfoRef.current.moved;
      dragInfoRef.current.isDown = false;

      if (hadMoved && floatingBarRef.current) {
        const rect = floatingBarRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const newDock = centerX < window.innerWidth / 2 ? 'left' : 'right';
        setDockSide(newDock);
        try {
          localStorage.setItem('wondersale_edit_bar_dock_side', newDock);
        } catch (err) {}

        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 80);
      }

      setIsDraggingEditBar(false);
      setDragDeltaX(0);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, []);

  const handleStartDrag = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragInfoRef.current = {
      isDown: true,
      startX: e.clientX,
      moved: false,
    };
  };

  // Synchronize initial editBuffer when items change or edit mode opens
  useEffect(() => {
    if (isEditMode) {
      const initial = {};
      items.forEach((item) => {
        initial[item.id] = {
          name: item.name || '',
          cost_price: item.cost_price || '',
          selling_price: item.selling_price || '',
          mrp: item.mrp !== null && item.mrp !== undefined ? item.mrp : '',
          section_id: isSectionRestricted && currentUser?.section ? String(currentUser.section) : (item.section ? (typeof item.section === 'object' ? item.section.id : item.section) : (item.section_details?.id || '')),
          expiry_date: item.expiry_date || '',
          weight: item.weight || '',
          length: item.length !== null && item.length !== undefined ? item.length : '',
          width: item.width !== null && item.width !== undefined ? item.width : '',
          height: item.height !== null && item.height !== undefined ? item.height : '',
          description: item.description || '',
          supplier_id: item.supplier ? (typeof item.supplier === 'object' ? item.supplier.id : item.supplier) : '',
          subcategory_ids: (item.subcategories || []).map((sc) => sc.id),
          primary_subcategory_id:
            item.primary_subcategory?.id ||
            item.primary_subcategory_id ||
            (item.subcategories?.[0]?.id || null),
        };
      });
      setEditBuffer(initial);
    } else {
      setSelectedItemIds([]);
      setDirtyItemIds(new Set());
      setEditBuffer({});
      setSubcatPickerAnchor(null);
    }
  }, [isEditMode, items]);

  // Reset to page 1 whenever search, filters, or sorting change
  useEffect(() => {
    handlePageChange(1);
  }, [searchQuery, activeSubcatIds, selectedSupplier, hasNoSupplierFilter, selectedSection, hasNoSectionFilter, selectedStockStatus, minStockFilter, maxStockFilter, hasNoImageFilter, hasNoSubcategoryFilter, needsBarcodeFilter, hasNoWeightFilter, hasNoVolumeFilter, sortBy]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeSubcatIds.length > 0) count += 1;
    if (selectedSupplier) count += 1;
    if (hasNoSupplierFilter) count += 1;
    if (selectedSection) count += 1;
    if (hasNoSectionFilter) count += 1;
    if (selectedStockStatus || minStockFilter !== '' || maxStockFilter !== '') count += 1;
    if (hasNoImageFilter) count += 1;
    if (hasNoSubcategoryFilter) count += 1;
    if (needsBarcodeFilter) count += 1;
    if (hasNoWeightFilter) count += 1;
    if (hasNoVolumeFilter) count += 1;
    return count;
  }, [activeSubcatIds, selectedSupplier, hasNoSupplierFilter, selectedSection, hasNoSectionFilter, selectedStockStatus, minStockFilter, maxStockFilter, hasNoImageFilter, hasNoSubcategoryFilter, needsBarcodeFilter, hasNoWeightFilter, hasNoVolumeFilter]);

  const handleResetFilters = () => {
    onSubcategoriesChange && onSubcategoriesChange([]);
    onSubcategoryChange && onSubcategoryChange('');
    onSupplierChange && onSupplierChange('');
    onHasNoSupplierFilterChange && onHasNoSupplierFilterChange(false);
    if (!isSectionRestricted) {
      onSectionChange && onSectionChange('');
      onHasNoSectionFilterChange && onHasNoSectionFilterChange(false);
    }
    onStockStatusChange && onStockStatusChange('');
    onMinStockFilterChange && onMinStockFilterChange('');
    onMaxStockFilterChange && onMaxStockFilterChange('');
    onHasNoImageFilterChange && onHasNoImageFilterChange(false);
    onHasNoSubcategoryFilterChange && onHasNoSubcategoryFilterChange(false);
    onNeedsBarcodeFilterChange && onNeedsBarcodeFilterChange(false);
    onHasNoWeightFilterChange && onHasNoWeightFilterChange(false);
    onHasNoVolumeFilterChange && onHasNoVolumeFilterChange(false);
  };

  // Sort items and apply client-side filter fallbacks
  const sortedItems = useMemo(() => {
    let list = [...items];

    if (hasNoImageFilter) {
      list = list.filter((item) => !item.primary_image_url && (!item.images || item.images.length === 0));
    }
    if (hasNoSubcategoryFilter) {
      list = list.filter((item) => !item.subcategories || item.subcategories.length === 0);
    }
    if (hasNoSupplierFilter) {
      list = list.filter((item) => !item.supplier && !item.supplier_name);
    }
    if (selectedSupplier) {
      list = list.filter((item) => {
        const sId = item.supplier ? (typeof item.supplier === 'object' ? item.supplier.id : item.supplier) : null;
        return String(sId) === String(selectedSupplier);
      });
    }
    if (isSectionRestricted && currentUser?.section) {
      list = list.filter((item) => {
        const secId = item.section ? (typeof item.section === 'object' ? item.section.id : item.section) : null;
        return String(secId) === String(currentUser.section);
      });
    } else {
      if (hasNoSectionFilter) {
        list = list.filter((item) => !item.section && !item.section_name);
      }
      if (selectedSection) {
        list = list.filter((item) => {
          const secId = item.section ? (typeof item.section === 'object' ? item.section.id : item.section) : null;
          return String(secId) === String(selectedSection);
        });
      }
    }
    if (activeSubcatIds.length > 0) {
      list = list.filter((item) =>
        (item.subcategories || []).some((sc) => activeSubcatIds.includes(String(sc.id || sc)))
      );
    }

    if (selectedStockStatus === 'out') {
      list = list.filter((item) => (parseInt(item.quantity) || 0) <= 0);
    } else if (selectedStockStatus === 'low') {
      list = list.filter((item) => (parseInt(item.quantity) || 0) > 0 && (parseInt(item.quantity) || 0) <= 5);
    } else if (selectedStockStatus === 'in_stock') {
      list = list.filter((item) => (parseInt(item.quantity) || 0) > 0);
    }

    if (minStockFilter !== '') {
      const minVal = parseInt(minStockFilter, 10);
      if (!isNaN(minVal)) {
        list = list.filter((item) => (parseInt(item.quantity) || 0) >= minVal);
      }
    }
    if (maxStockFilter !== '') {
      const maxVal = parseInt(maxStockFilter, 10);
      if (!isNaN(maxVal)) {
        list = list.filter((item) => (parseInt(item.quantity) || 0) <= maxVal);
      }
    }

    if (needsBarcodeFilter) {
      list = list.filter((item) => Boolean(item.needs_new_barcode_printed));
    }

    if (hasNoWeightFilter) {
      list = list.filter(
        (item) => item.weight === null || item.weight === undefined || item.weight === '' || parseFloat(item.weight) <= 0 || isNaN(parseFloat(item.weight))
      );
    }

    if (hasNoVolumeFilter) {
      list = list.filter(
        (item) => !item.length || !item.width || !item.height || parseFloat(item.length) <= 0 || parseFloat(item.width) <= 0 || parseFloat(item.height) <= 0
      );
    }

    // ── Variant Family Grouping: Show only ONE active variant per product family ──
    const allVariantsByGroup = {};
    items.forEach((it) => {
      if (it.variant_group_id) {
        if (!allVariantsByGroup[it.variant_group_id]) allVariantsByGroup[it.variant_group_id] = [];
        allVariantsByGroup[it.variant_group_id].push(it);
      }
    });

    const seenVariantGroups = new Set();
    const groupedList = [];

    for (const item of list) {
      if (!item.variant_group_id) {
        groupedList.push(item);
        continue;
      }

      if (seenVariantGroups.has(item.variant_group_id)) {
        continue; // Sibling already represented by active variant
      }
      seenVariantGroups.add(item.variant_group_id);

      // Collect all siblings in the family
      let familyItems = [...(allVariantsByGroup[item.variant_group_id] || [item])];
      if (item.sibling_variants && item.sibling_variants.length > familyItems.length) {
        const existingIds = new Set(familyItems.map((f) => f.id));
        item.sibling_variants.forEach((sv) => {
          if (!existingIds.has(sv.id)) {
            familyItems.push({
              ...item,
              id: sv.id,
              uid: sv.uid,
              name: sv.name,
              variant_name: sv.variant_name,
              quantity: sv.quantity,
              cost_price: sv.cost_price,
              selling_price: sv.selling_price,
              mrp: sv.mrp,
              effective_mrp: sv.effective_mrp || sv.mrp || sv.selling_price,
              expiry_date: sv.expiry_date,
              weight: sv.weight,
              length: sv.length,
              width: sv.width,
              height: sv.height,
              location_section: sv.location_section,
              supplier_name: sv.supplier_name,
              description: sv.description,
              needs_new_barcode_printed: sv.needs_new_barcode_printed,
              subcategories: sv.subcategories || item.subcategories,
              is_master_variant: sv.is_master_variant,
              primary_image_url: sv.primary_image_url || item.primary_image_url,
            });
          }
        });
      }

      // Sort family items: master first, then by id
      familyItems.sort((a, b) => (b.is_master_variant ? 1 : 0) - (a.is_master_variant ? 1 : 0) || a.id - b.id);

      // Determine active representative variant: user selected > master variant > first item
      const chosenActiveId = activeVariantIdByGroup[item.variant_group_id];
      const activeVariant = familyItems.find((f) => f.id === chosenActiveId)
        || familyItems.find((f) => f.is_master_variant)
        || familyItems[0]
        || item;

      // Attach group metadata to the representative item
      const repItem = {
        ...activeVariant,
        _isVariantGroupParent: familyItems.length > 1,
        _variantGroupId: item.variant_group_id,
        _groupItems: familyItems,
      };

      groupedList.push(repItem);
    }

    list = groupedList;

    if (!sortBy) return list;
    if (sortBy === 'name_asc') {
      return list.sort((a, b) => {
        const aN = (a.name || '').toLowerCase();
        const bN = (b.name || '').toLowerCase();
        return aN < bN ? -1 : (aN > bN ? 1 : 0);
      });
    }
    if (sortBy === 'name_desc') {
      return list.sort((a, b) => {
        const aN = (a.name || '').toLowerCase();
        const bN = (b.name || '').toLowerCase();
        return aN > bN ? -1 : (aN < bN ? 1 : 0);
      });
    }
    if (sortBy === 'selling_price' || sortBy === 'selling_price_asc') {
      return list.sort(
        (a, b) => (parseFloat(a.selling_price) || 0) - (parseFloat(b.selling_price) || 0)
      );
    }
    if (sortBy === 'selling_price_desc') {
      return list.sort(
        (a, b) => (parseFloat(b.selling_price) || 0) - (parseFloat(a.selling_price) || 0)
      );
    }
    if (sortBy === 'stock' || sortBy === 'stock_desc') {
      return list.sort((a, b) => (parseInt(b.quantity) || 0) - (parseInt(a.quantity) || 0));
    }
    if (sortBy === 'stock_asc') {
      return list.sort((a, b) => (parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0));
    }
    return list;
  }, [items, sortBy, hasNoImageFilter, hasNoSubcategoryFilter, hasNoSupplierFilter, selectedSupplier, activeSubcatIds, selectedStockStatus, minStockFilter, maxStockFilter, needsBarcodeFilter, hasNoWeightFilter, hasNoVolumeFilter, activeVariantIdByGroup]);

  // Pagination calculations (supports server-side pagination with client fallback)
  const totalItems = serverPagination ? serverTotalCount : sortedItems.length;
  const totalPages = serverPagination ? Math.max(1, serverTotalPages) : Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    if (serverPagination) {
      // In serverPagination mode, sortedItems is already the single requested page from backend!
      return sortedItems;
    }
    const start = (safePage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [serverPagination, sortedItems, safePage, pageSize]);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleFieldChange = (itemId, field, value) => {
    if (isSectionRestricted && field === 'section_id') {
      return;
    }
    setDirtyItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    setEditBuffer((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value,
      },
    }));
  };

  const toggleSubcategory = (itemId, subcatId) => {
    setDirtyItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    setEditBuffer((prev) => {
      const currentIds = prev[itemId]?.subcategory_ids || [];
      let currentPrimary = prev[itemId]?.primary_subcategory_id;
      let updated;

      if (currentIds.includes(subcatId)) {
        updated = currentIds.filter((id) => id !== subcatId);
        if (currentPrimary === subcatId) {
          currentPrimary = updated.length > 0 ? updated[0] : null;
        }
      } else {
        updated = [...currentIds, subcatId];
        if (!currentPrimary) {
          currentPrimary = subcatId;
        }
      }

      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          subcategory_ids: updated,
          primary_subcategory_id: currentPrimary,
        },
      };
    });
  };

  const setItemPrimarySubcategory = (itemId, subcatId) => {
    setDirtyItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    setEditBuffer((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        primary_subcategory_id: subcatId,
      },
    }));
  };

  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return;
    const confirmMsg = `Are you sure you want to permanently delete ${selectedItemIds.length} selected product(s)?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingBulk(true);
    setError('');
    try {
      await Promise.all(selectedItemIds.map((id) => deleteItem(id)));
      showFeedback(`Successfully deleted ${selectedItemIds.length} product(s).`);
      setSelectedItemIds([]);
      onItemsChanged?.();
    } catch (err) {
      setError(err.message || 'Failed to delete selected products.');
    } finally {
      setDeletingBulk(false);
    }
  };

  // Helper to test if an edited item has genuine differences compared to original item
  const hasItemChanged = (original, edited) => {
    if (!original || !edited) return false;
    const norm = (val) => (val === null || val === undefined ? '' : String(val).trim());
    const normNum = (val) => {
      if (val === null || val === undefined || val === '') return '';
      const num = parseFloat(val);
      return isNaN(num) ? '' : String(num);
    };

    if (norm(edited.name) !== norm(original.name)) return true;
    if (normNum(edited.cost_price) !== normNum(original.cost_price)) return true;
    if (normNum(edited.selling_price) !== normNum(original.selling_price)) return true;
    if (normNum(edited.mrp) !== normNum(original.mrp)) return true;
    if (norm(edited.expiry_date) !== norm(original.expiry_date)) return true;
    if (normNum(edited.weight) !== normNum(original.weight)) return true;
    if (normNum(edited.length) !== normNum(original.length)) return true;
    if (normNum(edited.width) !== normNum(original.width)) return true;
    if (normNum(edited.height) !== normNum(original.height)) return true;
    if (norm(edited.description) !== norm(original.description)) return true;

    // Supplier comparison
    const origSupplierId = original.supplier ? (typeof original.supplier === 'object' ? original.supplier.id : original.supplier) : '';
    if (norm(edited.supplier_id) !== norm(origSupplierId)) return true;

    // Section comparison
    if (!isSectionRestricted) {
      const origSectionId = original.section ? (typeof original.section === 'object' ? original.section.id : original.section) : (original.section_details?.id || '');
      if (norm(edited.section_id) !== norm(origSectionId)) return true;
    }

    // Subcategories comparison
    const origSubcatIds = (original.subcategories || []).map((sc) => String(sc.id || sc)).sort().join(',');
    const editedSubcatIds = (edited.subcategory_ids || []).map(String).sort().join(',');
    if (origSubcatIds !== editedSubcatIds) return true;

    const origPrimId = original.primary_subcategory?.id || original.primary_subcategory_id || '';
    if (norm(edited.primary_subcategory_id) !== norm(origPrimId)) return true;

    return false;
  };

  // Save All Changes made in Edit Mode (stocks are managed via immutable ledger in StockAdjustmentModal)
  const handleSaveAllEdits = async () => {
    setSavingEdits(true);
    setError('');
    try {
      // Find candidate items: either marked dirty or whose values actually differ
      const itemsToSave = [];
      for (const item of items) {
        const edited = editBuffer[item.id];
        if (!edited) continue;
        const isDirty = dirtyItemIds.has(item.id);
        if (isDirty || hasItemChanged(item, edited)) {
          const payload = {
            name: edited.name.trim(),
            cost_price: edited.cost_price,
            selling_price: edited.selling_price,
            mrp: edited.mrp === '' ? null : edited.mrp,
            section: isSectionRestricted && currentUser?.section ? currentUser.section : (edited.section_id || null),
            expiry_date: edited.expiry_date || null,
            weight: edited.weight === '' ? null : edited.weight,
            length: edited.length === '' ? null : edited.length,
            width: edited.width === '' ? null : edited.width,
            height: edited.height === '' ? null : edited.height,
            description: (edited.description || '').trim(),
            supplier: edited.supplier_id || null,
            subcategories: edited.subcategory_ids,
            primary_subcategory: edited.primary_subcategory_id || null,
          };
          itemsToSave.push({ id: item.id, payload });
        }
      }

      if (itemsToSave.length === 0) {
        showFeedback('No changes detected to save.');
        setIsEditMode(false);
        setDirtyItemIds(new Set());
        return;
      }

      // Execute updates in parallel batches of 5 for blazing speed without overwhelming server
      const BATCH_SIZE = 5;
      for (let i = 0; i < itemsToSave.length; i += BATCH_SIZE) {
        const batch = itemsToSave.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(({ id, payload }) => updateItem(id, payload)));
      }

      showFeedback(`Saved changes for ${itemsToSave.length} product(s) successfully.`);
      setIsEditMode(false);
      setDirtyItemIds(new Set());
      onItemsChanged?.();
    } catch (err) {
      setError(err.message || 'Failed to save product changes.');
    } finally {
      setSavingEdits(false);
    }
  };

  // Bulk AI Product Description Generator for selected or filtered items
  const handleGenerateAIDescriptions = async () => {
    if (justDraggedRef.current) return;
    const targetIds = selectedItemIds.length > 0 ? selectedItemIds : paginatedItems.map((it) => it.id);
    if (!targetIds || targetIds.length === 0) {
      setError('No items available to generate descriptions for.');
      return;
    }

    const confirmMsg = selectedItemIds.length > 0
      ? `Generate AI product descriptions for ${selectedItemIds.length} selected item(s) in background using Gemini Vision?`
      : `Generate AI product descriptions for ${targetIds.length} item(s) on this page in background using Gemini Vision?`;

    if (!window.confirm(confirmMsg)) return;

    setGeneratingAI(true);
    setError('');
    setAiErrorDialogMessage(null);
    try {
      const res = await bulkAIGenerateDescriptions({ item_ids: targetIds });
      showFeedback(res.message || 'Background AI description generation started!');
      if (res.job) {
        window.dispatchEvent(new CustomEvent('ai-job-started', { detail: res.job }));
        if (onStartAIDescriptionJob) {
          onStartAIDescriptionJob(res.job);
        }
      }
      onItemsChanged?.();
    } catch (err) {
      console.error("AI Generation error:", err);
      const errMsg = err.message || 'Failed to connect to AI Description server. Please verify your connection or Gemini API keys.';
      setError(errMsg);
      setAiErrorDialogMessage(errMsg);
    } finally {
      setGeneratingAI(false);
    }
  };

  const getStockBadge = (qty) => {
    if (qty <= 0) {
      return (
        <span
          className="badge badge-danger"
          style={{ fontSize: '0.7rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
        >
          <XCircle size={10} /> 0 Out
        </span>
      );
    }
    if (qty <= 5) {
      return (
        <span
          className="badge badge-warning"
          style={{ fontSize: '0.7rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
        >
          <AlertTriangle size={10} /> {qty} Low
        </span>
      );
    }
    return (
      <span
        className="badge badge-success"
        style={{ fontSize: '0.7rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
      >
        <CheckCircle2 size={10} /> {qty} in stock
      </span>
    );
  };

  const calculateMargin = (cost, selling) => {
    const c = parseFloat(cost) || 0;
    const s = parseFloat(selling) || 0;
    if (s <= 0) return null;
    const marginPct = ((s - c) / s) * 100;
    return marginPct.toFixed(1);
  };

  return (
    <div className="inv-table-root" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      {/* Search & Filter Top Bar */}
      <div
        className="glass-panel inv-toolbar"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        {/* Search Input - Fills available horizontal space */}
        <div className="inv-search-wrap" style={{ position: 'relative', flex: '1 1 auto', minWidth: '200px' }}>
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
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search product name, UID, section... (or scan barcode)"
            className="form-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              paddingLeft: '38px',
              paddingRight: searchQuery ? '36px' : '16px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.84rem',
              height: '36px',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              title="Clear search"
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '50%',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="form-select inv-sort-select"
          style={{
            flex: '0 0 170px',
            width: '170px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.84rem',
            padding: '0 14px',
            height: '36px',
          }}
        >
          <option value="">Sort</option>
          <option value="name_asc">sort by A -&gt; Z</option>
          <option value="name_desc">sort by Z -&gt; A</option>
          <option value="selling_price">sort by selling price (low -&gt; high)</option>
          <option value="selling_price_desc">sort by selling price (high -&gt; low)</option>
          <option value="stock">sort by stock (high -&gt; low)</option>
          <option value="stock_asc">sort by stock (low -&gt; high)</option>
        </select>

        {/* Filter Toggle Button (Exact same size and form-select style as Sort dropdown) */}
        <button
          type="button"
          onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
          className="form-select inv-filter-btn"
          style={{
            flex: '0 0 170px',
            width: '170px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.84rem',
            padding: '0 14px',
            height: '36px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: 'pointer',
            background: isFilterDropdownOpen || activeFilterCount > 0 ? 'rgba(239, 68, 68, 0.08)' : undefined,
            borderColor: isFilterDropdownOpen || activeFilterCount > 0 ? 'var(--brand-primary)' : undefined,
            color: isFilterDropdownOpen || activeFilterCount > 0 ? 'var(--brand-primary)' : 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <Filter size={14} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: 'var(--brand-primary)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0 6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  lineHeight: '16px',
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </div>
          <ChevronDown
            size={13}
            style={{
              transform: isFilterDropdownOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          />
        </button>

        {/* AI Description Studio Launcher Action Button */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-ai-studio', { detail: { jobId: 'active' } }));
            if (onStartAIDescriptionJob) onStartAIDescriptionJob({ id: 'active' });
          }}
          className="btn inv-ai-btn"
          style={{
            flex: '0 0 auto',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.84rem',
            padding: '0 16px',
            height: '36px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 800,
            color: '#ffffff',
            background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
            border: 'none',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            cursor: 'pointer',
          }}
          title="Open AI Description Studio to review, tweak, and overwrite descriptions"
        >
          <Sparkles size={15} />
          <span>✨ AI Studio</span>
        </button>

        {/* Export to CSV Action Button */}
        {onOpenExportCsv && (
          <button
            type="button"
            onClick={onOpenExportCsv}
            className="btn btn-secondary inv-export-btn"
            style={{
              flex: '0 0 auto',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.84rem',
              padding: '0 14px',
              height: '36px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              color: 'var(--color-success)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.08)',
            }}
            title="Export filtered inventory catalog to CSV"
          >
            <FileSpreadsheet size={15} />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* Full-Width Expandable Filter Section (Strictly In One Line Only) */}
      {isFilterDropdownOpen && (
        <div
          className="glass-panel inv-filter-drawer"
          style={{
            position: 'relative',
            zIndex: 120,
            padding: '8px 12px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowX: 'auto',
            overflowY: 'hidden',
            whiteSpace: 'nowrap',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
          }}
        >
          {/* Label / Filter Icon */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
              flexShrink: 0,
              marginRight: '2px',
            }}
          >
            <Filter size={14} style={{ color: 'var(--brand-primary)' }} />
            <span>Filters:</span>
          </div>

          {/* 1. Multi-Select Subcategories Picker */}
          <div style={{ position: 'relative', flex: '0 0 auto', minWidth: '140px', maxWidth: '220px', zIndex: 130 }} ref={subcatFilterDropdownRef}>
            <button
              type="button"
              onClick={() => {
                if (!isSubcatFilterOpen) updateSubcatCoords();
                setIsSubcatFilterOpen(!isSubcatFilterOpen);
              }}
              className="form-select"
              style={{
                width: '100%',
                height: '36px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: activeSubcatIds.length > 0 ? 'rgba(239, 68, 68, 0.08)' : undefined,
                borderColor: activeSubcatIds.length > 0 ? 'var(--brand-primary)' : undefined,
                color: activeSubcatIds.length > 0 ? 'var(--brand-primary)' : 'var(--text-primary)',
                fontWeight: activeSubcatIds.length > 0 ? 600 : 500,
                textAlign: 'left',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeSubcatIds.length === 0
                  ? `All Subcategories (${subcategories.length})`
                  : activeSubcatIds.length === 1
                  ? subcategories.find((s) => String(s.id) === activeSubcatIds[0])?.name || '1 Selected'
                  : `${activeSubcatIds.length} Subcategories`}
              </span>
              <ChevronDown
                size={13}
                style={{
                  transform: isSubcatFilterOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                  marginLeft: '6px',
                }}
              />
            </button>

            {/* Floating Popover for Subcategories Multi-Select (Mounted to document.body to prevent clipping) */}
            {isSubcatFilterOpen &&
              createPortal(
                <div
                  ref={subcatMenuRef}
                  style={{
                    position: 'fixed',
                    top: `${subcatCoords.top}px`,
                    left: `${subcatCoords.left}px`,
                    zIndex: 99999,
                    width: '280px',
                    maxHeight: '340px',
                    background: 'var(--bg-surface-solid, #161B2C)',
                    border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.18))',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255,255,255,0.08)',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {/* Search input in picker */}
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={13}
                      style={{
                        position: 'absolute',
                        left: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      type="text"
                      value={subcatFilterQuery}
                      onChange={(e) => setSubcatFilterQuery(e.target.value)}
                      placeholder="Search subcategory..."
                      className="form-input"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        paddingLeft: '28px',
                        fontSize: '0.78rem',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    />
                  </div>

                  {/* Quick actions: Select All / Clear */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                      padding: '0 2px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleSelectAllSubcats}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--brand-primary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      Select All
                    </button>
                    {activeSubcatIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllSubcats}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Clear ({activeSubcatIds.length})
                      </button>
                    )}
                  </div>

                  {/* Scrollable list */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    {filteredFilterSubcats.length === 0 ? (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                        No subcategory found
                      </div>
                    ) : (
                      filteredFilterSubcats.map((subcat) => {
                        const isChecked = activeSubcatIds.includes(String(subcat.id));
                        return (
                          <label
                            key={subcat.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '5px 8px',
                              borderRadius: 'var(--radius-sm)',
                              background: isChecked ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              color: isChecked ? 'var(--brand-primary)' : 'inherit',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSubcatFilterItem(subcat.id)}
                              style={{ cursor: 'pointer', width: '14px', height: '14px', margin: 0 }}
                            />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {subcat.name}
                            </span>
                            {subcat.category_name && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                                {subcat.category_name}
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>,
                document.body
              )}
          </div>

          {/* 2. Supplier Filter */}
          <select
            value={hasNoSupplierFilter ? '__none__' : (selectedSupplier || '')}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__none__') {
                onSupplierChange && onSupplierChange('');
                onHasNoSupplierFilterChange && onHasNoSupplierFilterChange(true);
              } else {
                onHasNoSupplierFilterChange && onHasNoSupplierFilterChange(false);
                onSupplierChange && onSupplierChange(val);
              }
            }}
            className="form-select"
            style={{
              flex: '0 0 auto',
              width: 'auto',
              minWidth: '120px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              padding: '0 12px',
              height: '36px',
              background: (selectedSupplier || hasNoSupplierFilter) ? 'rgba(239, 68, 68, 0.08)' : undefined,
              borderColor: (selectedSupplier || hasNoSupplierFilter) ? 'var(--brand-primary)' : undefined,
              color: (selectedSupplier || hasNoSupplierFilter) ? 'var(--brand-primary)' : 'var(--text-primary)',
              fontWeight: (selectedSupplier || hasNoSupplierFilter) ? 600 : 500,
              whiteSpace: 'nowrap',
            }}
          >
            <option value="">All Suppliers ({suppliers.length})</option>
            <option value="__none__">No Supplier Assigned</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
              </option>
            ))}
          </select>

          {/* 2.5 Section Filter */}
          {isSectionRestricted ? (
            <div
              style={{
                flex: '0 0 auto',
                width: 'auto',
                minWidth: '120px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                padding: '0 12px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38BDF8',
                fontWeight: 600,
                cursor: 'default',
                whiteSpace: 'nowrap',
              }}
              title="Your inventory access is restricted to your assigned section"
            >
              <Lock size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Section: {currentUser?.section_name || 'Assigned'}
              </span>
            </div>
          ) : (
            <select
              value={hasNoSectionFilter ? '__none__' : (selectedSection || '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__none__') {
                  onSectionChange && onSectionChange('');
                  onHasNoSectionFilterChange && onHasNoSectionFilterChange(true);
                } else {
                  onHasNoSectionFilterChange && onHasNoSectionFilterChange(false);
                  onSectionChange && onSectionChange(val);
                }
              }}
              className="form-select"
              style={{
                flex: '0 0 auto',
                width: 'auto',
                minWidth: '120px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                padding: '0 12px',
                height: '36px',
                background: (selectedSection || hasNoSectionFilter) ? 'rgba(239, 68, 68, 0.08)' : undefined,
                borderColor: (selectedSection || hasNoSectionFilter) ? 'var(--brand-primary)' : undefined,
                color: (selectedSection || hasNoSectionFilter) ? 'var(--brand-primary)' : 'var(--text-primary)',
                fontWeight: (selectedSection || hasNoSectionFilter) ? 600 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              <option value="">All Sections ({sections.length})</option>
              <option value="__none__">No Section Assigned</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} {sec.code ? `(${sec.code})` : ''}
                </option>
              ))}
            </select>
          )}

          {/* 3. Stock Level: Advanced Range & Preset Popover */}
          <div style={{ position: 'relative', flex: '0 0 auto', minWidth: '120px', zIndex: 125 }} ref={stockPopoverRef}>
            <button
              type="button"
              onClick={() => {
                if (!isStockPopoverOpen) updateStockCoords();
                setIsStockPopoverOpen(!isStockPopoverOpen);
              }}
              className="form-select"
              style={{
                width: '100%',
                height: '36px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: (selectedStockStatus || minStockFilter !== '' || maxStockFilter !== '') ? 'rgba(239, 68, 68, 0.08)' : undefined,
                borderColor: (selectedStockStatus || minStockFilter !== '' || maxStockFilter !== '') ? 'var(--brand-primary)' : undefined,
                color: (selectedStockStatus || minStockFilter !== '' || maxStockFilter !== '') ? 'var(--brand-primary)' : 'var(--text-primary)',
                fontWeight: (selectedStockStatus || minStockFilter !== '' || maxStockFilter !== '') ? 600 : 500,
                textAlign: 'left',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {minStockFilter !== '' && maxStockFilter !== ''
                  ? `Stock: ${minStockFilter} – ${maxStockFilter}`
                  : minStockFilter !== ''
                  ? `Stock ≥ ${minStockFilter}`
                  : maxStockFilter !== ''
                  ? `Stock ≤ ${maxStockFilter}`
                  : selectedStockStatus === 'in_stock'
                  ? 'In Stock (>0)'
                  : selectedStockStatus === 'low'
                  ? 'Low Stock (≤5)'
                  : selectedStockStatus === 'out'
                  ? 'Out of Stock (0)'
                  : 'All Stock Levels'}
              </span>
              <ChevronDown
                size={13}
                style={{
                  transform: isStockPopoverOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                  marginLeft: '6px',
                }}
              />
            </button>

            {/* Custom Stock Popover Dropdown (Mounted to document.body to prevent clipping) */}
            {isStockPopoverOpen &&
              createPortal(
                <div
                  ref={stockMenuRef}
                  style={{
                    position: 'fixed',
                    top: `${stockCoords.top}px`,
                    left: `${stockCoords.left}px`,
                    zIndex: 99999,
                    width: '270px',
                    background: 'var(--bg-surface-solid, #161B2C)',
                    border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.18))',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255,255,255,0.08)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Stock Level Filter
                    </span>
                    {(selectedStockStatus || minStockFilter !== '' || maxStockFilter !== '') && (
                      <button
                        type="button"
                        onClick={() => {
                          onStockStatusChange && onStockStatusChange('');
                          onMinStockFilterChange && onMinStockFilterChange('');
                          onMaxStockFilterChange && onMaxStockFilterChange('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--brand-primary)',
                          cursor: 'pointer',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Quick Presets */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {[
                      { label: 'All Levels', status: '', min: '', max: '' },
                      { label: 'In Stock (>0)', status: 'in_stock', min: '', max: '' },
                      { label: 'Low Stock (≤5)', status: 'low', min: '', max: '' },
                      { label: 'Out of Stock (0)', status: 'out', min: '', max: '' },
                      { label: '≤ 10 Units', status: '', min: '', max: '10' },
                      { label: '≥ 50 Units', status: '', min: '50', max: '' },
                    ].map((p, idx) => {
                      const isPresetActive =
                        selectedStockStatus === p.status &&
                        minStockFilter === p.min &&
                        maxStockFilter === p.max;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onStockStatusChange && onStockStatusChange(p.status);
                            onMinStockFilterChange && onMinStockFilterChange(p.min);
                            onMaxStockFilterChange && onMaxStockFilterChange(p.max);
                          }}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.74rem',
                            fontWeight: isPresetActive ? 700 : 500,
                            background: isPresetActive ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-main, rgba(255,255,255,0.04))',
                            border: `1px solid ${isPresetActive ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                            color: isPresetActive ? 'var(--brand-primary)' : 'var(--text-main)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      Custom Numerical Range:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Min (≥)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 10"
                          value={minStockFilter}
                          onChange={(e) => {
                            onStockStatusChange && onStockStatusChange('');
                            onMinStockFilterChange && onMinStockFilterChange(e.target.value);
                          }}
                          className="form-input"
                          style={{ width: '100%', height: '28px', fontSize: '0.78rem', padding: '0 6px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '14px' }}>to</span>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Max (≤)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 100"
                          value={maxStockFilter}
                          onChange={(e) => {
                            onStockStatusChange && onStockStatusChange('');
                            onMaxStockFilterChange && onMaxStockFilterChange(e.target.value);
                          }}
                          className="form-input"
                          style={{ width: '100%', height: '28px', fontSize: '0.78rem', padding: '0 6px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsStockPopoverOpen(false)}
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', fontSize: '0.76rem', height: '28px', borderRadius: 'var(--radius-sm)', marginTop: '2px' }}
                  >
                    Apply Filter
                  </button>
                </div>,
                document.body
              )}
          </div>

          {/* 3. Has no image Toggle Button */}
          <button
            type="button"
            onClick={() => onHasNoImageFilterChange && onHasNoImageFilterChange(!hasNoImageFilter)}
            className="form-select"
            style={{
              flex: '0 0 auto',
              width: 'auto',
              minWidth: '105px',
              height: '36px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              padding: '0 12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              background: hasNoImageFilter ? 'rgba(239, 68, 68, 0.12)' : undefined,
              borderColor: hasNoImageFilter ? 'var(--brand-primary)' : undefined,
              color: hasNoImageFilter ? 'var(--brand-primary)' : 'var(--text-primary)',
              fontWeight: hasNoImageFilter ? 700 : 500,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ImageIcon size={14} />
            <span>Has no image</span>
            {hasNoImageFilter && <Check size={12} />}
          </button>

          {/* 4. Has no sub category Toggle Button */}
          <button
            type="button"
            onClick={() => onHasNoSubcategoryFilterChange && onHasNoSubcategoryFilterChange(!hasNoSubcategoryFilter)}
            className="form-select"
            style={{
              flex: '0 0 auto',
              width: 'auto',
              minWidth: '125px',
              height: '36px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              padding: '0 12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              background: hasNoSubcategoryFilter ? 'rgba(239, 68, 68, 0.12)' : undefined,
              borderColor: hasNoSubcategoryFilter ? 'var(--brand-primary)' : undefined,
              color: hasNoSubcategoryFilter ? 'var(--brand-primary)' : 'var(--text-primary)',
              fontWeight: hasNoSubcategoryFilter ? 700 : 500,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={14} />
            <span>Has no sub category</span>
            {hasNoSubcategoryFilter && <Check size={12} />}
          </button>

          {/* 5. Needs Barcode Printed Toggle Button */}
          <button
            type="button"
            onClick={() => onNeedsBarcodeFilterChange && onNeedsBarcodeFilterChange(!needsBarcodeFilter)}
            className="form-select"
            style={{
              flex: '0 0 auto',
              width: 'auto',
              minWidth: '135px',
              height: '36px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              padding: '0 12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              background: needsBarcodeFilter ? 'rgba(239, 68, 68, 0.12)' : undefined,
              borderColor: needsBarcodeFilter ? 'var(--brand-primary)' : undefined,
              color: needsBarcodeFilter ? 'var(--brand-primary)' : 'var(--text-primary)',
              fontWeight: needsBarcodeFilter ? 700 : 500,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Barcode size={14} />
            <span>Needs Barcode Printed</span>
            {needsBarcodeFilter && <Check size={12} />}
          </button>

          {/* 6. Has no weight Toggle Button */}
          <button
            type="button"
            onClick={() => onHasNoWeightFilterChange && onHasNoWeightFilterChange(!hasNoWeightFilter)}
            className="form-select"
            style={{
              flex: '0 0 auto',
              width: 'auto',
              minWidth: '105px',
              height: '36px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              padding: '0 12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              background: hasNoWeightFilter ? 'rgba(239, 68, 68, 0.12)' : undefined,
              borderColor: hasNoWeightFilter ? 'var(--brand-primary)' : undefined,
              color: hasNoWeightFilter ? 'var(--brand-primary)' : 'var(--text-primary)',
              fontWeight: hasNoWeightFilter ? 700 : 500,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
            title="Filter items with missing or 0 weight"
          >
            <Scale size={14} />
            <span>Has no weight</span>
            {hasNoWeightFilter && <Check size={12} />}
          </button>

          {/* 7. Has no volume Toggle Button */}
          <button
            type="button"
            onClick={() => onHasNoVolumeFilterChange && onHasNoVolumeFilterChange(!hasNoVolumeFilter)}
            className="form-select"
            style={{
              flex: '0 0 auto',
              width: 'auto',
              minWidth: '105px',
              height: '36px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              padding: '0 12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              background: hasNoVolumeFilter ? 'rgba(239, 68, 68, 0.12)' : undefined,
              borderColor: hasNoVolumeFilter ? 'var(--brand-primary)' : undefined,
              color: hasNoVolumeFilter ? 'var(--brand-primary)' : 'var(--text-primary)',
              fontWeight: hasNoVolumeFilter ? 700 : 500,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
            title="Filter items with missing Length, Width, or Height dimensions"
          >
            <Box size={14} />
            <span>Has no volume</span>
            {hasNoVolumeFilter && <Check size={12} />}
          </button>

          {/* Right Actions: Reset & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto', flexShrink: 0, marginLeft: 'auto' }}>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.74rem', height: '30px', padding: '0 10px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(false)}
              className="btn btn-secondary btn-sm btn-icon"
              style={{ width: '30px', height: '30px', padding: 0, borderRadius: '50%', flexShrink: 0 }}
              title="Close Filters"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {feedback && (
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.84rem',
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
            padding: '10px 16px',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Table Panel (Fitted with No Horizontal Scroll) */}
      <div
        className="glass-panel"
        style={{
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          padding: 0,
          borderRadius: 'var(--radius-lg)',
          border: isEditMode ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
        }}
      >
        {/* Subtle Background Sync Bar (Non-blocking) */}
        {loading && items.length > 0 && (
          <div
            style={{
              height: '3px',
              width: '100%',
              background: 'rgba(239, 68, 68, 0.15)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '40%',
                background: 'var(--brand-primary)',
                position: 'absolute',
                animation: 'indeterminateProgress 0.9s infinite ease-in-out',
                borderRadius: '2px',
              }}
            />
          </div>
        )}

        <div className={`inv-table-scroll ${isEditMode ? 'inv-table-scroll-editing' : ''}`} style={{ overflowX: 'auto' }}>
          <table className={`inv-table ${isEditMode ? 'inv-table-editing' : ''}`} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isEditMode ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: isEditMode ? 'var(--brand-primary)' : 'var(--text-muted)',
                }}
              >
                {/* Select Column Header when in Edit Mode (No Select All Checkbox) */}
                {isEditMode && (
                  <th className="inv-th-select" style={{ padding: '10px 8px', width: '32px', minWidth: '32px', textAlign: 'center' }}></th>
                )}
                <th className="inv-th-photo" style={{ padding: '10px 8px', width: '74px', minWidth: '74px', textAlign: 'center' }}>Photo</th>
                <th className="inv-th-details" style={{ padding: '10px 10px', minWidth: '160px' }}>Product Details</th>
                <th className="inv-th-subcats" style={{ padding: '10px 8px', minWidth: '110px' }}>Subcategories</th>
                <th className="inv-th-uid" style={{ padding: '10px 8px', width: '95px', minWidth: '95px' }}>UID / Barcode</th>
                <th className="inv-th-section" style={{ padding: '10px 8px', width: '70px', minWidth: '70px' }}>Section</th>
                <th className="inv-th-stock" style={{ padding: '10px 8px', width: '88px', minWidth: '88px' }}>Stock</th>
                <th className="inv-th-cost" style={{ padding: '10px 8px', width: '68px', minWidth: '68px' }}>Cost</th>
                <th className="inv-th-selling" style={{ padding: '10px 8px', width: '74px', minWidth: '74px' }}>Selling</th>
                <th className="inv-th-mrp" style={{ padding: '10px 8px', width: '68px', minWidth: '68px' }}>MRP</th>
                <th className="inv-th-margin" style={{ padding: '10px 8px', width: '56px', minWidth: '56px' }}>Margin</th>
                <th className="inv-th-weight" style={{ padding: '10px 8px', width: '58px', minWidth: '58px' }}>Weight</th>
                <th className="inv-th-expiry" style={{ padding: '10px 8px', width: '85px', minWidth: '85px' }}>Expiry</th>
                <th className="inv-th-actions" style={{ padding: '10px 14px', width: '110px', minWidth: '110px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody style={{ opacity: loading && items.length > 0 ? 0.75 : 1, transition: 'opacity 0.15s ease' }}>
              {loading && items.length === 0 ? (
                <SkeletonInventoryRows rows={8} isEditMode={isEditMode} />
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={isEditMode ? 14 : 13} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <Package size={38} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.5 }} />
                    <h4 style={{ marginBottom: '4px', fontSize: '0.96rem' }}>No items match your filters</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Try clearing search terms or registering a new product.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const edited = editBuffer[item.id] || {
                    name: item.name,
                    cost_price: item.cost_price,
                    selling_price: item.selling_price,
                    mrp: item.mrp,
                    section_id: isSectionRestricted && currentUser?.section ? String(currentUser.section) : (item.section ? (typeof item.section === 'object' ? item.section.id : item.section) : (item.section_details?.id || '')),
                    expiry_date: item.expiry_date,
                    weight: item.weight,
                    length: item.length,
                    width: item.width,
                    height: item.height,
                    description: item.description,
                    subcategory_ids: (item.subcategories || []).map((sc) => sc.id),
                  };

                  const costForMargin = isEditMode ? edited.cost_price : item.cost_price;
                  const sellingForMargin = isEditMode ? edited.selling_price : item.selling_price;
                  const marginPct = calculateMargin(costForMargin, sellingForMargin);
                  const isSelected = selectedItemIds.includes(item.id);
                  const isHovered = hoveredItemId === item.id;
                  const otherVariants = (item._groupItems || []).filter((sib) => sib.id !== item.id);

                  // Calculate derived volume and volumetric weight metrics
                  const effLength = isEditMode ? edited.length : item.length;
                  const effWidth = isEditMode ? edited.width : item.width;
                  const effHeight = isEditMode ? edited.height : item.height;
                  const volMetrics = calculateVolumeMetrics(effLength, effWidth, effHeight);

                  return (
                    <React.Fragment key={item.id}>
                      {/* LINE 1: Primary Product Information */}
                      <tr
                        className="inv-row-primary"
                        onClick={() => {
                          if (!isEditMode && onViewItem) {
                            onViewItem(item);
                          }
                        }}
                        onMouseEnter={() => setHoveredItemId(item.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                        style={{
                          borderBottom: 'none',
                          background: isSelected
                            ? 'rgba(239, 68, 68, 0.07)'
                            : isHovered
                            ? 'var(--bg-surface-hover)'
                            : 'transparent',
                          transition: 'background 0.15s ease',
                          fontSize: '0.82rem',
                          cursor: !isEditMode ? 'pointer' : 'default',
                        }}
                      >
                        {/* Select Checkbox (Edit Mode Only) */}
                        {isEditMode && (
                          <td
                            className="inv-cell-select"
                            rowSpan={2}
                            style={{
                              padding: '8px 4px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              width: '32px',
                              minWidth: '32px',
                              borderBottom: '6px solid var(--border-subtle)',
                              background: isSelected ? 'rgba(239, 68, 68, 0.07)' : isHovered ? 'var(--bg-surface-hover)' : 'transparent',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                          </td>
                        )}

                        {/* 1. Thumbnail Image (Spans both rows across the card) */}
                        <td
                          className="inv-cell-photo"
                          rowSpan={2}
                          style={{
                            padding: '6px 4px',
                            textAlign: 'center',
                            verticalAlign: 'top',
                            width: '56px',
                            minWidth: '56px',
                            position: 'relative',
                            borderBottom: item._isVariantGroupParent && expandedVariantGroups[item._variantGroupId] && otherVariants.length > 0 ? '1px dashed rgba(59, 130, 246, 0.3)' : '3px solid var(--border-subtle)',
                            background: isSelected ? 'rgba(239, 68, 68, 0.07)' : isHovered ? 'var(--bg-surface-hover)' : 'transparent',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ position: 'relative', width: '48px', height: '100%', minHeight: '68px', margin: '0 auto' }}>
                            <div
                              className="inv-thumb-box"
                              onClick={() => {
                                if (isEditMode) {
                                  if (onOpenImageModal) onOpenImageModal(item);
                                } else if (item.primary_image_url) {
                                  setLightboxImage({
                                    src: item.primary_image_url,
                                    name: item.name,
                                    uid: item.uid,
                                  });
                                }
                              }}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: 'var(--radius-sm)',
                                overflow: 'hidden',
                                background: 'var(--bg-surface-hover)',
                                border: isEditMode ? '1px dashed var(--brand-primary)' : '1px solid var(--border-subtle)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: isEditMode ? 'pointer' : (item.primary_image_url ? 'zoom-in' : 'default'),
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                                position: 'absolute',
                                left: '4px',
                                top: '4px',
                                zIndex: 2,
                              }}
                              onMouseEnter={(e) => {
                                if (isEditMode || item.primary_image_url) {
                                  e.currentTarget.style.transform = 'scale(1.08)';
                                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.45)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = isEditMode ? 'var(--brand-primary)' : 'var(--border-subtle)';
                                e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.25)';
                              }}
                              title={
                                isEditMode
                                  ? `Manage image gallery for "${item.name}"`
                                  : (item.primary_image_url ? `View full image for "${item.name}" (Lightbox)` : item.name)
                              }
                            >
                              {item.primary_image_url ? (
                                <img
                                  src={item.primary_image_url}
                                  alt={item.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <ImageIcon
                                  size={18}
                                  style={{
                                    color: isEditMode ? 'var(--brand-primary)' : 'var(--text-muted)',
                                    opacity: isEditMode ? 0.9 : 0.45,
                                  }}
                                />
                              )}
                            </div>

                            {/* Continuous Tree Trunk Connector Line down to Child Variants */}
                            {item._isVariantGroupParent && expandedVariantGroups[item._variantGroupId] && otherVariants.length > 0 && (
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '14px',
                                  top: '44px',
                                  bottom: 0,
                                  width: '2px',
                                  background: 'rgba(59, 130, 246, 0.65)',
                                  zIndex: 1,
                                }}
                              />
                            )}
                          </div>
                        </td>

                        {/* 2. Product Details */}
                        <td className="inv-cell-details" style={{ padding: '6px 8px 3px', maxWidth: '200px' }}>
                          {isEditMode ? (
                            <input
                              type="text"
                              value={edited.name}
                              onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                              className="form-input inv-edit-name-input"
                              style={{ height: '26px', fontSize: '0.80rem', padding: '2px 6px', width: '100%' }}
                              required
                            />
                          ) : (
                            <div>
                              <div
                                className="inv-product-title"
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.82rem',
                                  color: 'var(--text-primary)',
                                  lineHeight: 1.2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  transition: 'color 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isEditMode) e.currentTarget.style.color = 'var(--brand-primary)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isEditMode) e.currentTarget.style.color = 'var(--text-primary)';
                                }}
                                title={!isEditMode ? `Click to view full detail & analytics for "${item.name}"` : item.name}
                              >
                                {item.name}
                              </div>
                              {item.legacy_uid && item.legacy_uid !== item.uid && (
                                <div className="inv-legacy-uid" style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                  Legacy: <span className="mono">{item.legacy_uid}</span>
                                </div>
                              )}
                              {/* Variant Family Folder/Tree Dropdown Toggle & Primary Switcher */}
                              {item._isVariantGroupParent && (
                                <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedVariantGroups((prev) => ({
                                        ...prev,
                                        [item._variantGroupId]: !prev[item._variantGroupId],
                                      }));
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: expandedVariantGroups[item._variantGroupId] ? 'rgba(59, 130, 246, 0.18)' : 'rgba(59, 130, 246, 0.08)',
                                      border: `1px solid ${expandedVariantGroups[item._variantGroupId] ? 'var(--brand-primary)' : 'rgba(59, 130, 246, 0.3)'}`,
                                      color: 'var(--brand-primary)',
                                      borderRadius: 'var(--radius-pill)',
                                      padding: '1px 7px',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    title="Click to view all variant sub-items in folder tree"
                                  >
                                    {expandedVariantGroups[item._variantGroupId] ? <FolderOpen size={11} /> : <Folder size={11} />}
                                    <span>{otherVariants.length} Variant{otherVariants.length > 1 ? 's' : ''}</span>
                                    <ChevronDown size={11} style={{ transform: expandedVariantGroups[item._variantGroupId] ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                  </button>

                                  <select
                                    value={item.id}
                                    onChange={(e) => {
                                      const newId = Number(e.target.value);
                                      setActiveVariantIdByGroup((prev) => ({
                                        ...prev,
                                        [item._variantGroupId]: newId,
                                      }));
                                    }}
                                    style={{
                                      height: '22px',
                                      fontSize: '0.68rem',
                                      padding: '0 4px',
                                      borderRadius: 'var(--radius-xs)',
                                      background: 'var(--bg-surface-hover)',
                                      border: '1px solid var(--border-subtle)',
                                      color: 'var(--text-secondary)',
                                      colorScheme: 'dark',
                                      cursor: 'pointer',
                                      maxWidth: '140px',
                                    }}
                                    title="Change which variant represents this product in the table"
                                  >
                                    {(item._groupItems || []).map((sib) => (
                                      <option key={sib.id} value={sib.id} style={{ background: '#161B2C', color: '#ffffff', padding: '4px 6px' }}>
                                        {sib.variant_name || (sib.is_master_variant ? 'Original' : `Batch ${sib.uid}`)} ({sib.uid})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 3. Subcategories */}
                        <td className="inv-cell-subcats" style={{ padding: '14px 8px 8px', maxWidth: '170px' }}>
                          {isEditMode ? (
                            (() => {
                              const subcatIds = edited.subcategory_ids || [];
                              const primId = edited.primary_subcategory_id || (subcatIds.length > 0 ? subcatIds[0] : null);
                              const primSub = primId ? subcategories.find((s) => s.id === primId) : null;

                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    if (subcatPickerAnchor?.itemId === item.id) {
                                      setSubcatPickerAnchor(null);
                                      return;
                                    }
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setSubcatPickerAnchor({
                                      itemId: item.id,
                                      anchorEl: e.currentTarget,
                                      anchorRect: rect,
                                    });
                                  }}
                                  className="btn btn-secondary btn-sm inv-edit-subcat-btn"
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.72rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    width: '100%',
                                    justifyContent: 'space-between',
                                    height: '28px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: primSub ? '1px solid rgba(245, 158, 11, 0.4)' : undefined,
                                  }}
                                  title={
                                    primSub
                                      ? `Primary Anchor: ${primSub.name} (${subcatIds.length} assigned)`
                                      : 'Click to assign subcategories and primary financial anchor'
                                  }
                                >
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    {primSub ? (
                                      <>
                                        <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>★</span>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{primSub.name}</span>
                                        {subcatIds.length > 1 && (
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>
                                            (+{subcatIds.length - 1})
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span>{subcatIds.length} subcat(s)</span>
                                    )}
                                  </span>
                                  <span>▾</span>
                                </button>
                              );
                            })()
                          ) : (
                            <SubcategoriesBadgeList
                              subcategories={item.subcategories}
                              primarySubcategory={item.primary_subcategory}
                              primarySubcategoryId={item.primary_subcategory_id}
                              isOpen={activeSubcatViewer?.itemId === item.id}
                              onOpenDropdown={(anchorEl, primSub, allSubs) => {
                                handleToggleSubcatViewer(item.id, item.name, anchorEl, primSub, allSubs);
                              }}
                            />
                          )}
                        </td>

                        {/* 4. UID / Barcode (Always Read-Only) */}
                        <td className="inv-cell-uid" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          <span
                            className="mono inv-uid-badge"
                            style={{
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              padding: '1px 5px',
                              background: 'var(--bg-surface)',
                              borderRadius: 'var(--radius-xs)',
                              border: '1px solid var(--border-subtle)',
                              color: isEditMode ? 'var(--text-muted)' : 'inherit',
                            }}
                            title="UID is permanent and immutable"
                          >
                            {item.uid}
                          </span>
                          {item.needs_new_barcode_printed && (
                            <div style={{ marginTop: '3px' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPrintBarcode?.(item);
                                }}
                                className="badge badge-warning"
                                style={{
                                  fontSize: '0.64rem',
                                  padding: '2px 6px',
                                  lineHeight: 1.2,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontWeight: 700,
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#F59E0B',
                                  borderRadius: 'var(--radius-xs)',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                title="Click to print barcode label now"
                              >
                                <span>⚠️ Print Label</span>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 5. Section Dropdown in Edit Mode / Badge in View Mode */}
                        <td className="inv-cell-section" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          {isEditMode ? (
                            isSectionRestricted ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-pill)',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  color: '#38BDF8',
                                  border: '1px solid rgba(56, 189, 248, 0.35)',
                                  cursor: 'not-allowed',
                                }}
                                title="Section is locked to your assigned department"
                              >
                                <Lock size={10} style={{ flexShrink: 0 }} />
                                <span>{currentUser?.section_name || item.section_name || 'Assigned'}</span>
                              </div>
                            ) : (
                              <select
                                value={edited.section_id !== undefined ? (edited.section_id || '') : (item.section ? (typeof item.section === 'object' ? item.section.id : item.section) : '')}
                                onChange={(e) => handleFieldChange(item.id, 'section_id', e.target.value)}
                                className="form-select inv-edit-section-select"
                                style={{ height: '28px', fontSize: '0.78rem', padding: '2px 6px', minWidth: '95px' }}
                              >
                                <option value="">No Section</option>
                                {sections.map((sec) => (
                                  <option key={sec.id} value={sec.id}>
                                    {sec.name}
                                  </option>
                                ))}
                              </select>
                            )
                          ) : (item.section_name || item.section_details?.name || (typeof item.section === 'object' ? item.section?.name : null) || item.location_section) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {(item.section_name || item.section_details?.name || (typeof item.section === 'object' ? item.section?.name : null)) && (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-pill)',
                                    fontSize: '0.70rem',
                                    fontWeight: 700,
                                    background: `${item.section_color || item.section_details?.color || (typeof item.section === 'object' ? item.section?.color : '#3B82F6') || '#3B82F6'}18`,
                                    color: item.section_color || item.section_details?.color || (typeof item.section === 'object' ? item.section?.color : '#3B82F6') || '#3B82F6',
                                    border: `1px solid ${item.section_color || item.section_details?.color || (typeof item.section === 'object' ? item.section?.color : '#3B82F6') || '#3B82F6'}33`,
                                    width: 'fit-content',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      backgroundColor: item.section_color || item.section_details?.color || (typeof item.section === 'object' ? item.section?.color : '#3B82F6') || '#3B82F6',
                                    }}
                                  />
                                  <span>{item.section_name || item.section_details?.name || (typeof item.section === 'object' ? item.section?.name : '')}</span>
                                </div>
                              )}
                              {!item.section_name && !item.section_details?.name && item.location_section && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                  <MapPin size={10} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                                  <span>{item.location_section}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                          )}
                        </td>

                        {/* 6. Stock Level (Protected Immutable Ledger Adjustment Button in Edit Mode) */}
                        <td className="inv-cell-stock" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          {isEditMode ? (
                            <button
                              type="button"
                              onClick={() => onQuickAdjust && onQuickAdjust(item)}
                              className="btn btn-secondary btn-sm inv-edit-stock-btn"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                                height: '26px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderRadius: 'var(--radius-pill)',
                                border: '1px solid var(--border-focus)',
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: 'var(--brand-primary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                              title="Open Stock Adjustment Menu"
                            >
                              <ArrowUpDown size={11} />
                              <span>Adjust ({item.quantity})</span>
                            </button>
                          ) : (
                            getStockBadge(item.quantity)
                          )}
                        </td>

                        {/* 7. Cost Price */}
                        <td className="inv-cell-cost" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          {isEditMode ? (
                            <div className="inv-edit-price-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <span className="inv-currency-symbol" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={edited.cost_price}
                                onChange={(e) => handleFieldChange(item.id, 'cost_price', e.target.value)}
                                className="form-input mono inv-edit-cost-input"
                                style={{ height: '28px', fontSize: '0.8rem', padding: '2px 4px', width: '70px' }}
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              ₹{parseFloat(item.cost_price || 0).toFixed(2)}
                            </span>
                          )}
                        </td>

                        {/* 8. Selling Price */}
                        <td className="inv-cell-selling" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          {isEditMode ? (
                            <div className="inv-edit-price-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <span className="inv-currency-symbol" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={edited.selling_price}
                                onChange={(e) => handleFieldChange(item.id, 'selling_price', e.target.value)}
                                className="form-input mono inv-edit-selling-input"
                                style={{ height: '28px', fontSize: '0.82rem', padding: '2px 4px', width: '75px', fontWeight: 700 }}
                              />
                            </div>
                          ) : (
                            <span style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                              ₹{parseFloat(item.selling_price || 0).toFixed(2)}
                            </span>
                          )}
                        </td>

                        {/* 9. MRP */}
                        <td className="inv-cell-mrp" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          {isEditMode ? (
                            <div className="inv-edit-price-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <span className="inv-currency-symbol" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={edited.mrp || ''}
                                placeholder="Auto"
                                onChange={(e) => handleFieldChange(item.id, 'mrp', e.target.value)}
                                className="form-input mono inv-edit-mrp-input"
                                style={{ height: '28px', fontSize: '0.78rem', padding: '2px 4px', width: '70px' }}
                              />
                            </div>
                          ) : (
                            <>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                ₹{parseFloat(item.effective_mrp || item.selling_price || 0).toFixed(2)}
                              </span>
                              {item.mrp === null && (
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginLeft: '2px' }}>
                                  (=)
                                </span>
                              )}
                            </>
                          )}
                        </td>

                        {/* 10. Margin % (Always Read-Only, Computed Live) */}
                        <td className="inv-cell-margin" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          {marginPct !== null ? (
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: parseFloat(marginPct) >= 30 ? '#10B981' : parseFloat(marginPct) > 0 ? '#F59E0B' : 'var(--color-danger)',
                              }}
                              title="Margin is calculated strictly from cost and selling price"
                            >
                              {marginPct}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                          )}
                        </td>

                        {/* 11. Weight */}
                        <td className="inv-cell-weight" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          {isEditMode ? (
                            <input
                              type="number"
                              step="0.1"
                              value={edited.weight || ''}
                              placeholder="g"
                              onChange={(e) => handleFieldChange(item.id, 'weight', e.target.value)}
                              className="form-input inv-edit-weight-input"
                              style={{ height: '28px', fontSize: '0.76rem', padding: '2px 4px', width: '58px' }}
                            />
                          ) : item.weight ? (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              {item.weight}g
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                          )}
                        </td>

                        {/* 12. Expiry */}
                        <td className="inv-cell-expiry" style={{ padding: '14px 8px 8px', whiteSpace: 'nowrap' }}>
                          {isEditMode ? (
                            <input
                              type="date"
                              value={edited.expiry_date || ''}
                              onChange={(e) => handleFieldChange(item.id, 'expiry_date', e.target.value)}
                              className="form-input mono inv-edit-expiry-input"
                              style={{ height: '28px', fontSize: '0.72rem', padding: '2px 3px', width: '105px' }}
                            />
                          ) : item.expiry_date ? (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {item.expiry_date}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                          )}
                        </td>

                        {/* 13. Actions (Barcode Button + Edit Icon Button Only) */}
                        <td className="inv-cell-actions" style={{ padding: '14px 14px 8px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => onPrintBarcode(item)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.74rem', height: '26px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Print Barcode Tag"
                            >
                              <Printer size={11} />
                              <span>Barcode</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (onEditItem) {
                                  onEditItem(item);
                                } else if (onViewItem) {
                                  onViewItem(item);
                                }
                              }}
                              className="btn btn-secondary btn-sm btn-icon"
                              style={{ width: '26px', height: '26px', padding: 0 }}
                              title={isEditMode ? "Open Full Edit Modal" : "Edit Product & View Ledger"}
                            >
                              <Edit size={12} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setBrokenItemTarget(item)}
                              disabled={!item?.quantity || Number(item.quantity) <= 0}
                              className="btn btn-secondary btn-sm btn-icon"
                              style={{
                                width: '26px',
                                height: '26px',
                                padding: 0,
                                background: (item?.quantity && Number(item.quantity) > 0) ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                                color: (item?.quantity && Number(item.quantity) > 0) ? '#f43f5e' : 'var(--text-muted)',
                                border: (item?.quantity && Number(item.quantity) > 0) ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid var(--border-subtle)',
                                cursor: (item?.quantity && Number(item.quantity) > 0) ? 'pointer' : 'not-allowed',
                              }}
                              title={(item?.quantity && Number(item.quantity) > 0) ? `Report Damaged Item: ${item.name}` : "Cannot report broken: Item is out of stock"}
                            >
                              <AlertOctagon size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* LINE 2: Dimensions, Volume, Volumetric Weight, and Description Sub-Row */}
                      <tr
                        className="inv-row-sub"
                        onClick={() => {
                          if (!isEditMode && onViewItem) {
                            onViewItem(item);
                          }
                        }}
                        onMouseEnter={() => setHoveredItemId(item.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                        style={{
                          borderBottom: '6px solid var(--border-subtle)',
                          background: isSelected
                            ? 'rgba(239, 68, 68, 0.05)'
                            : isHovered
                            ? 'var(--bg-surface-hover)'
                            : 'var(--bg-surface-subtle, rgba(255, 255, 255, 0.015))',
                          fontSize: '0.8rem',
                          cursor: !isEditMode ? 'pointer' : 'default',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td
                          className="inv-cell-subinfo"
                          colSpan={12}
                          style={{
                            padding: '4px 14px 14px 10px',
                            verticalAlign: 'middle',
                            maxWidth: 0,
                          }}
                          onClick={(e) => isEditMode && e.stopPropagation()}
                        >
                          <div
                            className="inv-metrics-wrap"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              flexWrap: 'wrap',
                              width: '100%',
                              minHeight: '34px',
                            }}
                          >
                            {/* Dimensions Badge / Inline Inputs */}
                            {isEditMode ? (
                              <div
                                className="inv-dim-inputs"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: 'var(--bg-surface)',
                                  padding: '3px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-subtle)',
                                  height: '32px',
                                  flexShrink: 0,
                                }}
                              >
                                <Ruler size={13} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem' }}>L:</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={edited.length ?? ''}
                                  onChange={(e) => handleFieldChange(item.id, 'length', e.target.value)}
                                  placeholder="cm"
                                  className="form-input mono inv-edit-dim-input"
                                  style={{ height: '26px', fontSize: '0.78rem', padding: '1px 6px', width: '54px' }}
                                />
                                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem' }}>× W:</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={edited.width ?? ''}
                                  onChange={(e) => handleFieldChange(item.id, 'width', e.target.value)}
                                  placeholder="cm"
                                  className="form-input mono inv-edit-dim-input"
                                  style={{ height: '26px', fontSize: '0.78rem', padding: '1px 6px', width: '54px' }}
                                />
                                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem' }}>× H:</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={edited.height ?? ''}
                                  onChange={(e) => handleFieldChange(item.id, 'height', e.target.value)}
                                  placeholder="cm"
                                  className="form-input mono inv-edit-dim-input"
                                  style={{ height: '26px', fontSize: '0.78rem', padding: '1px 6px', width: '54px' }}
                                />
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>cm</span>
                              </div>
                            ) : (
                              <div
                                className="badge inv-metric-badge inv-dim-badge"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.78rem',
                                  padding: '5px 12px',
                                  borderRadius: 'var(--radius-pill)',
                                  background: volMetrics.hasDimensions ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-surface-hover)',
                                  border: volMetrics.hasDimensions ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border-subtle)',
                                  color: volMetrics.hasDimensions ? '#60A5FA' : 'var(--text-muted)',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  height: '28px',
                                  flexShrink: 0,
                                }}
                                title="Product dimensions (Length × Width × Height in cm)"
                              >
                                <Ruler size={13} />
                                <span>{volMetrics.dimensionsStr || 'Dimensions: —'}</span>
                              </div>
                            )}

                            {/* Calculated Physical Volume Badge */}
                            <div
                              className="badge inv-metric-badge inv-vol-badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.78rem',
                                padding: '5px 12px',
                                borderRadius: 'var(--radius-pill)',
                                background: volMetrics.hasDimensions ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface-hover)',
                                border: volMetrics.hasDimensions ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
                                color: volMetrics.hasDimensions ? '#34D399' : 'var(--text-muted)',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                height: '28px',
                                flexShrink: 0,
                              }}
                              title="Calculated physical volume (L × W × H in cm³)"
                            >
                              <Box size={13} />
                              <span>
                                {volMetrics.volumeCm3
                                  ? `Volume: ${volMetrics.volumeCm3} cm³ (${volMetrics.volumeLiters} L)`
                                  : 'Volume: —'}
                              </span>
                            </div>

                            {/* Calculated Volumetric Weight Badge */}
                            <div
                              className="badge inv-metric-badge inv-vwt-badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.78rem',
                                padding: '5px 12px',
                                borderRadius: 'var(--radius-pill)',
                                background: volMetrics.hasDimensions ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-surface-hover)',
                                border: volMetrics.hasDimensions ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-subtle)',
                                color: volMetrics.hasDimensions ? '#FBBF24' : 'var(--text-muted)',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                height: '28px',
                                flexShrink: 0,
                              }}
                              title="Volumetric weight for shipping ((L × W × H) / 5000 kg)"
                            >
                              <Scale size={13} />
                              <span>
                                {volMetrics.volumetricWeightKg
                                  ? `Volumetric: ${volMetrics.volumetricWeightKg} kg`
                                  : 'Volumetric: —'}
                              </span>
                            </div>

                            {/* Supplier Badge / Inline Selector */}
                            {isEditMode ? (
                              <div
                                className="inv-supplier-select-wrap"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: 'var(--bg-surface)',
                                  padding: '3px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-subtle)',
                                  height: '32px',
                                  flexShrink: 0,
                                }}
                              >
                                <Truck size={13} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem' }}>Supplier:</span>
                                <select
                                  value={edited.supplier_id || ''}
                                  onChange={(e) => handleFieldChange(item.id, 'supplier_id', e.target.value || null)}
                                  className="form-select inv-edit-supplier-select"
                                  style={{ height: '26px', fontSize: '0.78rem', padding: '0 6px', minWidth: '130px', maxWidth: '180px' }}
                                >
                                  <option value="">No Supplier</option>
                                  {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div
                                className="badge inv-metric-badge inv-sup-badge"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.78rem',
                                  padding: '5px 12px',
                                  borderRadius: 'var(--radius-pill)',
                                  background: item.supplier_name ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-surface-hover)',
                                  border: item.supplier_name ? '1px solid rgba(139, 92, 246, 0.35)' : '1px solid var(--border-subtle)',
                                  color: item.supplier_name ? '#a78bfa' : 'var(--text-muted)',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  height: '28px',
                                  flexShrink: 0,
                                }}
                                title={item.supplier_details ? `Supplier: ${item.supplier_name} (${[item.supplier_details.contact_person, item.supplier_details.phone, item.supplier_details.city].filter(Boolean).join(', ')})` : 'No supplier assigned'}
                              >
                                <Truck size={13} />
                                <span>{item.supplier_name ? `Supplier: ${item.supplier_name}` : 'Supplier: —'}</span>
                              </div>
                            )}

                            {/* Description Line / Field */}
                            {isEditMode ? (
                              <div className="inv-desc-input-wrap" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 240px', minWidth: 0 }}>
                                <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <input
                                  type="text"
                                  maxLength={500}
                                  value={edited.description || ''}
                                  onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                                  placeholder="Product description / notes (max 500 chars)..."
                                  className="form-input inv-edit-desc-input"
                                  style={{ height: '32px', fontSize: '0.82rem', padding: '4px 12px', width: '100%' }}
                                />
                              </div>
                            ) : (
                              <div
                                className="inv-desc-wrap"
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '6px',
                                  fontSize: '0.82rem',
                                  color: item.description ? 'var(--text-secondary)' : 'var(--text-muted)',
                                  flex: '1 1 240px',
                                  minWidth: 0,
                                  lineHeight: 1.45,
                                }}
                              >
                                <FileText
                                  size={13}
                                  style={{
                                    color: 'var(--text-muted)',
                                    flexShrink: 0,
                                    marginTop: '2.5px',
                                    opacity: item.description ? 0.75 : 0.45,
                                  }}
                                />
                                <span
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'anywhere',
                                    whiteSpace: 'normal',
                                    fontStyle: item.description ? 'normal' : 'italic',
                                  }}
                                  title={item.description || 'No description provided'}
                                >
                                  {item.description ? item.description : 'No description provided'}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Variant Sub-Items: Connected by Smooth Vector Folder Tree Lines, Scaled-Down Replicas of the Full Card */}
                      {item._isVariantGroupParent && expandedVariantGroups[item._variantGroupId] && otherVariants.length > 0 && (
                        otherVariants.map((sib, sIdx) => {
                          const isLastSib = sIdx === (otherVariants.length - 1);
                          const sibCost = parseFloat(sib.cost_price || 0);
                          const sibSelling = parseFloat(sib.selling_price || 0);
                          const sibEffectiveMrp = parseFloat(sib.effective_mrp || sib.mrp || sib.selling_price || 0);
                          const sibMargin = calculateMargin(sibCost, sibSelling);
                          const sibSelected = selectedItemIds.includes(sib.id);
                          const isSibHovered = hoveredItemId === sib.id;
                          const sibVolMetrics = calculateVolumeMetrics(sib.length, sib.width, sib.height);

                          return (
                            <React.Fragment key={`variant-sib-${sib.id}`}>
                              {/* SIBLING LINE 1: Scaled-Down Product Row */}
                              <tr
                                className="inv-row-primary inv-row-variant-primary"
                                onClick={() => !isEditMode && onViewItem?.(sib)}
                                onMouseEnter={() => setHoveredItemId(sib.id)}
                                onMouseLeave={() => setHoveredItemId(null)}
                                style={{
                                  borderBottom: 'none',
                                  background: sibSelected
                                    ? 'rgba(239, 68, 68, 0.07)'
                                    : isSibHovered
                                    ? 'rgba(59, 130, 246, 0.06)'
                                    : 'rgba(255, 255, 255, 0.015)',
                                  transition: 'background 0.15s ease',
                                  fontSize: '0.78rem',
                                  cursor: !isEditMode ? 'pointer' : 'default',
                                }}
                              >
                                {/* Select Checkbox in Edit Mode */}
                                {isEditMode && (
                                  <td
                                    className="inv-cell-select"
                                    rowSpan={2}
                                    style={{
                                      padding: '4px 2px',
                                      textAlign: 'center',
                                      verticalAlign: 'middle',
                                      width: '32px',
                                      minWidth: '32px',
                                      borderBottom: isLastSib ? '3px solid var(--border-subtle)' : '1px dashed rgba(255, 255, 255, 0.05)',
                                      background: sibSelected ? 'rgba(239, 68, 68, 0.07)' : isSibHovered ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={sibSelected}
                                      onChange={() => toggleSelectItem(sib.id)}
                                      style={{ width: '13px', height: '13px', cursor: 'pointer' }}
                                    />
                                  </td>
                                )}

                                {/* Sibling Thumbnail & Continuous Tree Connector Branch */}
                                <td
                                  className="inv-cell-photo"
                                  rowSpan={2}
                                  style={{
                                    padding: '6px 4px',
                                    textAlign: 'center',
                                    verticalAlign: 'top',
                                    width: '56px',
                                    minWidth: '56px',
                                    position: 'relative',
                                    borderBottom: isLastSib ? '3px solid var(--border-subtle)' : '1px dashed rgba(255, 255, 255, 0.05)',
                                    background: sibSelected ? 'rgba(239, 68, 68, 0.07)' : isSibHovered ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div style={{ position: 'relative', width: '48px', height: '100%', minHeight: '68px', margin: '0 auto' }}>
                                    {/* Pixel-perfect vector tree lines */}
                                    <svg
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        pointerEvents: 'none',
                                        overflow: 'visible',
                                      }}
                                    >
                                      {/* Smooth curved branch arm to variant thumbnail */}
                                      <path
                                        d="M 14 0 L 14 12 Q 14 20 18 20 L 22 20"
                                        fill="none"
                                        stroke="rgba(59, 130, 246, 0.65)"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                      />
                                      {/* Continuous vertical trunk descending to subsequent siblings */}
                                      {!isLastSib && (
                                        <line
                                          x1="14"
                                          y1="20"
                                          x2="14"
                                          y2="100%"
                                          stroke="rgba(59, 130, 246, 0.65)"
                                          strokeWidth="2"
                                        />
                                      )}
                                    </svg>

                                    {/* Scaled-down Sibling Thumbnail Box */}
                                    <div
                                      className="inv-thumb-box"
                                      style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: 'var(--radius-xs)',
                                        overflow: 'hidden',
                                        background: 'var(--bg-surface-hover)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: sib.primary_image_url ? 'zoom-in' : 'default',
                                        position: 'absolute',
                                        left: '22px',
                                        top: '5px',
                                        zIndex: 2,
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                        transition: 'all 0.15s ease',
                                      }}
                                      onClick={() => {
                                        if (sib.primary_image_url) {
                                          setLightboxImage({
                                            src: sib.primary_image_url,
                                            name: sib.name,
                                            uid: sib.uid,
                                          });
                                        }
                                      }}
                                      title={sib.primary_image_url ? `View full image for "${sib.name}"` : sib.name}
                                    >
                                      {sib.primary_image_url ? (
                                        <img
                                          src={sib.primary_image_url}
                                          alt={sib.name}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                      ) : (
                                        <ImageIcon size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Product Details: Name, Variant/Batch Tag, and "Set as Main" Button */}
                                <td className="inv-cell-details" style={{ padding: '6px 8px 3px', maxWidth: '200px' }}>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          fontSize: '0.80rem',
                                          color: 'var(--text-primary)',
                                          lineHeight: 1.2,
                                        }}
                                      >
                                        {sib.variant_name || (sib.is_master_variant ? 'Original' : `Batch ${sib.uid}`)}
                                      </span>
                                      {sib.is_master_variant && (
                                        <span
                                          style={{
                                            fontSize: '0.58rem',
                                            background: 'rgba(59, 130, 246, 0.2)',
                                            color: 'var(--brand-primary)',
                                            border: '1px solid rgba(59, 130, 246, 0.4)',
                                            borderRadius: '3px',
                                            padding: '1px 5px',
                                            fontWeight: 700,
                                          }}
                                        >
                                          ORIGINAL
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveVariantIdByGroup((prev) => ({
                                            ...prev,
                                            [item._variantGroupId]: sib.id,
                                          }));
                                        }}
                                        className="btn btn-secondary btn-xs"
                                        style={{
                                          fontSize: '0.62rem',
                                          padding: '1px 6px',
                                          height: '19px',
                                          borderRadius: 'var(--radius-pill)',
                                          border: '1px solid var(--border-subtle)',
                                          lineHeight: 1,
                                        }}
                                        title="Display this variant as the top representative product"
                                      >
                                        Set as Main
                                      </button>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '0.68rem',
                                        color: 'var(--text-muted)',
                                        marginTop: '1px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {sib.name}
                                    </div>
                                  </div>
                                </td>

                                {/* Subcategories - Compact display with automated dropdown overflow */}
                                <td className="inv-cell-subcats" style={{ padding: '6px 8px 3px', maxWidth: '170px' }}>
                                  <SubcategoriesBadgeList
                                    subcategories={sib.subcategories}
                                    primarySubcategory={sib.primary_subcategory || item.primary_subcategory}
                                    primarySubcategoryId={sib.primary_subcategory_id}
                                    fontSize="0.64rem"
                                    isOpen={activeSubcatViewer?.itemId === sib.id}
                                    onOpenDropdown={(anchorEl, primSub, allSubs) => {
                                      handleToggleSubcatViewer(sib.id, sib.name, anchorEl, primSub, allSubs);
                                    }}
                                  />
                                </td>

                                {/* UID / Barcode */}
                                <td className="inv-cell-uid" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  <span
                                    className="mono inv-uid-badge"
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '0.74rem',
                                      padding: '1px 5px',
                                      background: 'var(--bg-surface)',
                                      borderRadius: 'var(--radius-xs)',
                                      border: '1px solid var(--border-subtle)',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    {sib.uid}
                                  </span>
                                  {sib.needs_new_barcode_printed && (
                                    <span
                                      className="badge badge-warning"
                                      style={{ fontSize: '0.58rem', padding: '1px 3px', marginLeft: '3px' }}
                                    >
                                      Print
                                    </span>
                                  )}
                                </td>

                                {/* Section */}
                                <td className="inv-cell-section" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  {sib.location_section ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                      <MapPin size={10} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                                      <span>{sib.location_section}</span>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>—</span>
                                  )}
                                </td>

                                {/* Stock */}
                                <td className="inv-cell-stock" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  {getStockBadge(sib.quantity)}
                                </td>

                                {/* Cost Price */}
                                <td className="inv-cell-cost" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                    ₹{sibCost.toFixed(2)}
                                  </span>
                                </td>

                                {/* Selling Price */}
                                <td className="inv-cell-selling" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                    ₹{sibSelling.toFixed(2)}
                                  </span>
                                </td>

                                {/* MRP */}
                                <td className="inv-cell-mrp" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                    ₹{sibEffectiveMrp.toFixed(2)}
                                  </span>
                                </td>

                                {/* Margin */}
                                <td className="inv-cell-margin" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  {sibMargin !== null ? (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        color: parseFloat(sibMargin) >= 30 ? '#10B981' : parseFloat(sibMargin) > 0 ? '#F59E0B' : 'var(--color-danger)',
                                      }}
                                    >
                                      {sibMargin}%
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>—</span>
                                  )}
                                </td>

                                {/* Weight */}
                                <td className="inv-cell-weight" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    {sib.weight ? `${sib.weight}g` : '—'}
                                  </span>
                                </td>

                                {/* Expiry */}
                                <td className="inv-cell-expiry" style={{ padding: '6px 8px 3px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                    {sib.expiry_date || '—'}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="inv-cell-actions" style={{ padding: '6px 14px 3px 6px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      onClick={() => onPrintBarcode?.(sib)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '2px 7px', fontSize: '0.70rem', height: '24px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title="Print Barcode Tag"
                                    >
                                      <Printer size={10} />
                                      <span>Barcode</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onEditItem) onEditItem(sib);
                                        else if (onViewItem) onViewItem(sib);
                                      }}
                                      className="btn btn-secondary btn-sm btn-icon"
                                      style={{ width: '24px', height: '24px', padding: 0 }}
                                      title="Edit Variant"
                                    >
                                      <Edit size={11} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setBrokenItemTarget(sib)}
                                      disabled={!sib?.quantity || Number(sib.quantity) <= 0}
                                      className="btn btn-secondary btn-sm btn-icon"
                                      style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: 0,
                                        background: (sib?.quantity && Number(sib.quantity) > 0) ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                                        color: (sib?.quantity && Number(sib.quantity) > 0) ? '#f43f5e' : 'var(--text-muted)',
                                        border: (sib?.quantity && Number(sib.quantity) > 0) ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid var(--border-subtle)',
                                        cursor: (sib?.quantity && Number(sib.quantity) > 0) ? 'pointer' : 'not-allowed',
                                      }}
                                      title={(sib?.quantity && Number(sib.quantity) > 0) ? `Report Damaged Variant: ${sib.name}` : "Cannot report broken: Out of stock"}
                                    >
                                      <AlertOctagon size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* SIBLING LINE 2: Scaled-Down Dimensions, Volume, Volumetric Weight, Supplier, and Description Sub-Row */}
                              <tr
                                className="inv-row-sub inv-row-variant-sub"
                                onClick={() => !isEditMode && onViewItem?.(sib)}
                                onMouseEnter={() => setHoveredItemId(sib.id)}
                                onMouseLeave={() => setHoveredItemId(null)}
                                style={{
                                  borderBottom: isLastSib ? '3px solid var(--border-subtle)' : '1px dashed rgba(255, 255, 255, 0.05)',
                                  background: sibSelected
                                    ? 'rgba(239, 68, 68, 0.05)'
                                    : isSibHovered
                                    ? 'rgba(59, 130, 246, 0.05)'
                                    : 'rgba(255, 255, 255, 0.01)',
                                  fontSize: '0.76rem',
                                  cursor: !isEditMode ? 'pointer' : 'default',
                                  transition: 'background 0.15s ease',
                                }}
                              >
                                <td
                                  className="inv-cell-subinfo"
                                  colSpan={12}
                                  style={{
                                    padding: '2px 14px 10px 10px',
                                    verticalAlign: 'middle',
                                    maxWidth: 0,
                                  }}
                                  onClick={(e) => isEditMode && e.stopPropagation()}
                                >
                                  <div
                                    className="inv-metrics-wrap"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      flexWrap: 'wrap',
                                      width: '100%',
                                      minHeight: '26px',
                                    }}
                                  >
                                    {/* Dimensions Badge */}
                                    <div
                                      className="badge inv-metric-badge inv-dim-badge"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.72rem',
                                        padding: '3px 9px',
                                        borderRadius: 'var(--radius-pill)',
                                        background: sibVolMetrics.hasDimensions ? 'rgba(59, 130, 246, 0.10)' : 'var(--bg-surface-hover)',
                                        border: sibVolMetrics.hasDimensions ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-subtle)',
                                        color: sibVolMetrics.hasDimensions ? '#60A5FA' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        height: '24px',
                                        flexShrink: 0,
                                      }}
                                      title="Variant dimensions (Length × Width × Height in cm)"
                                    >
                                      <Ruler size={11} />
                                      <span>{sibVolMetrics.dimensionsStr || 'Dimensions: —'}</span>
                                    </div>

                                    {/* Physical Volume Badge */}
                                    <div
                                      className="badge inv-metric-badge inv-vol-badge"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.72rem',
                                        padding: '3px 9px',
                                        borderRadius: 'var(--radius-pill)',
                                        background: sibVolMetrics.hasDimensions ? 'rgba(16, 185, 129, 0.10)' : 'var(--bg-surface-hover)',
                                        border: sibVolMetrics.hasDimensions ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                                        color: sibVolMetrics.hasDimensions ? '#34D399' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        height: '24px',
                                        flexShrink: 0,
                                      }}
                                      title="Calculated physical volume (L × W × H in cm³)"
                                    >
                                      <Box size={11} />
                                      <span>
                                        {sibVolMetrics.volumeCm3
                                          ? `Volume: ${sibVolMetrics.volumeCm3} cm³ (${sibVolMetrics.volumeLiters} L)`
                                          : 'Volume: —'}
                                      </span>
                                    </div>

                                    {/* Volumetric Weight Badge */}
                                    <div
                                      className="badge inv-metric-badge inv-vwt-badge"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.72rem',
                                        padding: '3px 9px',
                                        borderRadius: 'var(--radius-pill)',
                                        background: sibVolMetrics.hasDimensions ? 'rgba(245, 158, 11, 0.10)' : 'var(--bg-surface-hover)',
                                        border: sibVolMetrics.hasDimensions ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
                                        color: sibVolMetrics.hasDimensions ? '#FBBF24' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        height: '24px',
                                        flexShrink: 0,
                                      }}
                                      title="Volumetric weight ((L × W × H) / 5000 kg)"
                                    >
                                      <Scale size={11} />
                                      <span>
                                        {sibVolMetrics.volumetricWeightKg
                                          ? `Volumetric: ${sibVolMetrics.volumetricWeightKg} kg`
                                          : 'Volumetric: —'}
                                      </span>
                                    </div>

                                    {/* Supplier Badge */}
                                    <div
                                      className="badge inv-metric-badge inv-sup-badge"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.72rem',
                                        padding: '3px 9px',
                                        borderRadius: 'var(--radius-pill)',
                                        background: sib.supplier_name ? 'rgba(139, 92, 246, 0.10)' : 'var(--bg-surface-hover)',
                                        border: sib.supplier_name ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-subtle)',
                                        color: sib.supplier_name ? '#a78bfa' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        height: '24px',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <Truck size={11} />
                                      <span>{sib.supplier_name ? `Supplier: ${sib.supplier_name}` : 'Supplier: —'}</span>
                                    </div>

                                    {/* Description Snippet */}
                                    <div
                                      className="inv-desc-wrap"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '5px',
                                        fontSize: '0.74rem',
                                        color: sib.description ? 'var(--text-secondary)' : 'var(--text-muted)',
                                        flex: '1 1 200px',
                                        minWidth: 0,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      <FileText
                                        size={11}
                                        style={{
                                          color: 'var(--text-muted)',
                                          flexShrink: 0,
                                          marginTop: '2px',
                                          opacity: sib.description ? 0.75 : 0.45,
                                        }}
                                      />
                                      <span
                                        style={{
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          wordBreak: 'break-word',
                                          overflowWrap: 'anywhere',
                                          whiteSpace: 'normal',
                                          fontStyle: sib.description ? 'normal' : 'italic',
                                        }}
                                        title={sib.description || 'No description provided'}
                                      >
                                        {sib.description || 'No description provided'}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Pagination Controls */}
        <div
          className="inv-pagination"
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Left: Range Summary & Per Page Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>
              Showing{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0}
              </strong>
              {' – '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {Math.min(safePage * pageSize, totalItems)}
              </strong>{' '}
              of <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> product(s)
              {isEditMode && selectedItemIds.length > 0 && (
                <span style={{ marginLeft: '10px', color: 'var(--brand-primary)', fontWeight: 700 }}>
                  ({selectedItemIds.length} selected)
                </span>
              )}
            </span>

            {/* Items Per Page Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <span style={{ fontSize: '0.76rem' }}>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(e.target.value)}
                className="form-select"
                style={{
                  height: '28px',
                  padding: '0 8px',
                  fontSize: '0.76rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  width: 'auto',
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {/* Right: Page Navigation Buttons */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                disabled={safePage <= 1}
                className="btn btn-secondary btn-sm"
                style={{ height: '28px', width: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="First Page"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="btn btn-secondary btn-sm"
                style={{ height: '28px', width: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              <span style={{ margin: '0 6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Page <strong style={{ color: 'var(--text-primary)' }}>{safePage}</strong> of{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong>
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                className="btn btn-secondary btn-sm"
                style={{ height: '28px', width: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                disabled={safePage >= totalPages}
                className="btn btn-secondary btn-sm"
                style={{ height: '28px', width: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Last Page"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar (Draggable from Right to Left, Snaps Smoothly to Left / Right Edge) */}
      <div
        ref={floatingBarRef}
        className={`inv-floating-bar ${isEditMode ? 'inv-floating-bar-editing' : ''}`}
        onPointerDown={handleStartDrag}
        style={{
          position: 'fixed',
          bottom: '24px',
          left: dockSide === 'left' ? '24px' : 'auto',
          right: dockSide === 'right' ? '24px' : 'auto',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transform: isDraggingEditBar ? `translate3d(${dragDeltaX}px, 0, 0)` : 'translate3d(0, 0, 0)',
          transition: isDraggingEditBar
            ? 'none'
            : 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), left 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), right 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* Bulk Delete Button when items are selected in Edit Mode */}
        {isEditMode && selectedItemIds.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (justDraggedRef.current) return;
              handleBulkDelete();
            }}
            disabled={deletingBulk}
            className="btn btn-primary inv-floating-btn"
            style={{
              background: 'var(--color-danger)',
              borderColor: 'var(--color-danger)',
              borderRadius: 'var(--radius-pill)',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              padding: '10px 18px',
              fontSize: '0.88rem',
              cursor: isDraggingEditBar ? 'grabbing' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Trash2 size={16} className="inv-float-icon" />
            <span className="inv-btn-text-full">{deletingBulk ? 'Deleting...' : `Delete Selected (${selectedItemIds.length})`}</span>
            <span className="inv-btn-text-mobile">{deletingBulk ? 'Del...' : `Del (${selectedItemIds.length})`}</span>
          </button>
        )}

        {/* AI Product Description Generator Button when in Edit Mode */}
        {isEditMode && (
          <button
            type="button"
            onClick={handleGenerateAIDescriptions}
            disabled={generatingAI}
            className="btn inv-floating-btn"
            style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              padding: '10px 18px',
              fontSize: '0.88rem',
              cursor: isDraggingEditBar ? 'grabbing' : 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Generate AI product descriptions using Gemini Vision in the background"
          >
            <Sparkles size={16} className={`inv-float-icon ${generatingAI ? 'animate-spin' : ''}`} />
            <span className="inv-btn-text-full">
              {generatingAI
                ? 'Starting AI...'
                : selectedItemIds.length > 0
                ? `AI Descriptions (${selectedItemIds.length})`
                : 'AI Descriptions'}
            </span>
            <span className="inv-btn-text-mobile">
              {generatingAI
                ? 'AI...'
                : selectedItemIds.length > 0
                ? `AI (${selectedItemIds.length})`
                : 'AI Studio'}
            </span>
          </button>
        )}

        {/* Save Edits Button when in Edit Mode */}
        {isEditMode && (
          <button
            type="button"
            onClick={() => {
              if (justDraggedRef.current) return;
              handleSaveAllEdits();
            }}
            disabled={savingEdits}
            className="btn btn-primary inv-floating-btn"
            style={{
              background: '#10B981',
              borderColor: '#10B981',
              borderRadius: 'var(--radius-pill)',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              padding: '10px 18px',
              fontSize: '0.88rem',
              cursor: isDraggingEditBar ? 'grabbing' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Check size={16} className="inv-float-icon" />
            <span className="inv-btn-text-full">{savingEdits ? 'Saving Changes...' : 'Save Changes'}</span>
            <span className="inv-btn-text-mobile">{savingEdits ? 'Saving...' : 'Save'}</span>
          </button>
        )}

        {/* Floating Edit Mode Toggle Button */}
        <button
          type="button"
          onClick={() => {
            if (justDraggedRef.current) return;
            setIsEditMode(!isEditMode);
          }}
          className={`btn ${isEditMode ? 'btn-secondary' : 'btn-primary'} inv-floating-btn`}
          style={{
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 800,
            padding: '11px 20px',
            fontSize: '0.9rem',
            border: isEditMode ? '2px solid var(--brand-primary)' : 'none',
            cursor: isDraggingEditBar ? 'grabbing' : 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Toggle Inline Table Edit Mode"
        >
          {isEditMode ? (
            <>
              <X size={16} className="inv-float-icon" style={{ color: 'var(--brand-primary)' }} />
              <span className="inv-btn-text-full">Edit Mode: <strong>ON</strong> (Cancel)</span>
              <span className="inv-btn-text-mobile">Cancel</span>
            </>
          ) : (
            <>
              <Edit3 size={16} className="inv-float-icon" />
              <span className="inv-btn-text-full">Edit Mode (Inline)</span>
              <span className="inv-btn-text-mobile">Edit</span>
            </>
          )}
        </button>
      </div>

      {/* Floating Subcategory Picker Popover (Matches Add Item Design & Grouping) */}
      <SubcategoryPickerPopover
        isOpen={Boolean(subcatPickerAnchor)}
        anchorEl={subcatPickerAnchor?.anchorEl}
        anchorRect={subcatPickerAnchor?.anchorRect}
        categories={categories}
        subcategories={subcategories}
        selectedIds={subcatPickerAnchor ? (editBuffer[subcatPickerAnchor.itemId]?.subcategory_ids || []) : []}
        primaryId={subcatPickerAnchor ? (editBuffer[subcatPickerAnchor.itemId]?.primary_subcategory_id || null) : null}
        onChangePrimary={(subcatId) => {
          if (subcatPickerAnchor) {
            setItemPrimarySubcategory(subcatPickerAnchor.itemId, subcatId);
          }
        }}
        onToggle={(subcatId) => {
          if (subcatPickerAnchor) {
            toggleSubcategory(subcatPickerAnchor.itemId, subcatId);
          }
        }}
        onClear={() => {
          if (subcatPickerAnchor) {
            setDirtyItemIds((prev) => {
              const next = new Set(prev);
              next.add(subcatPickerAnchor.itemId);
              return next;
            });
            setEditBuffer((prev) => ({
              ...prev,
              [subcatPickerAnchor.itemId]: {
                ...(prev[subcatPickerAnchor.itemId] || {}),
                subcategory_ids: [],
                primary_subcategory_id: null,
              },
            }));
          }
        }}
        onClose={() => setSubcatPickerAnchor(null)}
      />

      {/* Floating Read-Only Subcategories Viewer Dropdown */}
      <SubcategoryViewerDropdown
        isOpen={Boolean(activeSubcatViewer)}
        anchorEl={activeSubcatViewer?.anchorEl}
        anchorRect={activeSubcatViewer?.anchorRect}
        itemName={activeSubcatViewer?.itemName}
        primarySubcat={activeSubcatViewer?.primarySubcat}
        subcategories={activeSubcatViewer?.allSubcategories || []}
        onClose={() => setActiveSubcatViewer(null)}
      />

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
            zIndex: 3000,
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

      {/* AI Error Dialog Window Modal */}
      {aiErrorDialogMessage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => setAiErrorDialogMessage(null)}
        >
          <div
            style={{
              background: 'var(--bg-surface-solid, #161B2C)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              color: 'var(--text-primary, #ffffff)',
              fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: '#f87171' }}>
                  AI Description Service Notice
                </h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
                  {aiErrorDialogMessage}
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                color: 'var(--text-muted, #94a3b8)',
                lineHeight: 1.4,
              }}
            >
              💡 <strong>Note:</strong> Product descriptions require an active backend connection and Gemini Vision API keys. If your daily quota limit is reached (HTTP 429), the system will retry automatically or you can add extra keys.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setAiErrorDialogMessage(null)}
                className="btn btn-primary"
                style={{
                  borderRadius: 'var(--radius-pill)',
                  padding: '9px 24px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  background: '#EF4444',
                  borderColor: '#EF4444',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broken / Damaged Item Reporting Modal */}
      {brokenItemTarget && (
        <BrokenItemModal
          item={brokenItemTarget}
          currentUser={currentUser}
          sections={sections}
          onClose={() => setBrokenItemTarget(null)}
          onSuccess={() => {
            onItemsChanged?.();
          }}
        />
      )}
    </div>
  );
}
