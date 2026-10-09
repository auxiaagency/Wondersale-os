import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  AlertCircle,
  CheckCircle2,
  Package,
  TrendingUp,
  Tag,
  ArrowRight,
  RotateCcw,
  Search,
  X,
  ChevronDown,
  Image as ImageIcon,
  Check,
  Upload,
  Camera,
  ListPlus,
  Trash2,
  Edit3,
  Layers,
  Sparkles,
  Loader2,
  ShieldCheck,
  MapPin,
  ArrowUpDown,
  FileSpreadsheet,
  Ruler,
  Scale,
  FileText,
  Box,
  Truck,
  Lock,
} from 'lucide-react';
import { createItem, bulkCreateItems, uploadItemImages, checkItemUidExists } from '../api';
import ItemImageModal from './ItemImageModal';
import SubcategoryPickerPopover from './SubcategoryPickerPopover';
import ImportCsvModal from './ImportCsvModal';
import ScanBillModal from './ScanBillModal';
import { calculateVolumeMetrics } from './ItemTable';

// Validation helper for staged product rows (ensures missing or invalid text fields are treated as RED errors)
export function getItemErrors(item, allStagedItems = [], existingUidMap = {}) {
  const errors = {};

  // 1. Product Name (Mandatory)
  const nameStr = item.name !== undefined && item.name !== null ? String(item.name).trim() : '';
  if (!nameStr) {
    errors.name = 'Product name is required';
  } else if (['n/a', 'unknown', 'null', '-', '--', 'none'].includes(nameStr.toLowerCase())) {
    errors.name = 'Product name is invalid';
  }

  // 2. Cost Price (Mandatory, positive numeric)
  const costStr = item.costPrice !== undefined && item.costPrice !== null ? String(item.costPrice).trim() : '';
  if (!costStr) {
    errors.costPrice = 'Cost price is required';
  } else if (!/^\d+(\.\d+)?$/.test(costStr) || isNaN(Number(costStr)) || Number(costStr) < 0) {
    errors.costPrice = 'Cost price must be a valid number (no letters or text)';
  }

  // 3. Selling Price (Mandatory, positive numeric)
  const sellStr = item.sellingPrice !== undefined && item.sellingPrice !== null ? String(item.sellingPrice).trim() : '';
  if (!sellStr) {
    errors.sellingPrice = 'Selling price is required';
  } else if (!/^\d+(\.\d+)?$/.test(sellStr) || isNaN(Number(sellStr)) || Number(sellStr) < 0) {
    errors.sellingPrice = 'Selling price must be a valid number (no letters or text)';
  }

  // 4. Quantity (Mandatory for all staged items, non-negative whole number)
  const qtyStr = item.initialQuantity !== undefined && item.initialQuantity !== null ? String(item.initialQuantity).trim() : '';
  if (!qtyStr) {
    errors.initialQuantity = 'Stock quantity is required';
  } else if (!/^\d+$/.test(qtyStr) || isNaN(parseInt(qtyStr, 10)) || parseInt(qtyStr, 10) < 0) {
    errors.initialQuantity = 'Stock quantity must be a non-negative whole number (no text or decimals)';
  }

  // 5. MRP (Optional, valid positive number if present)
  const mrpStr = item.mrp !== undefined && item.mrp !== null ? String(item.mrp).trim() : '';
  if (mrpStr !== '' && (!/^\d+(\.\d+)?$/.test(mrpStr) || isNaN(Number(mrpStr)) || Number(mrpStr) < 0)) {
    errors.mrp = 'MRP must be a valid positive number';
  }

  // 6. Weight (Optional, valid positive number if present)
  const weightStr = item.weight !== undefined && item.weight !== null ? String(item.weight).trim() : '';
  if (weightStr !== '' && (!/^\d+(\.\d+)?$/.test(weightStr) || isNaN(Number(weightStr)) || Number(weightStr) < 0)) {
    errors.weight = 'Weight must be a valid positive number';
  }

  // 7. Expiry Date (Optional, valid date if present)
  const expStr = item.expiryDate !== undefined && item.expiryDate !== null ? String(item.expiryDate).trim() : '';
  if (expStr !== '') {
    const d = new Date(expStr);
    if (isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(expStr)) {
      errors.expiryDate = 'Invalid expiry date format (YYYY-MM-DD)';
    }
  }

  // 8. Custom UID Validation (Duplicate in queue or already exists in database)
  const uidVal = item.uid !== undefined && item.uid !== null ? String(item.uid).trim() : '';
  if (uidVal !== '') {
    const uidLower = uidVal.toLowerCase();
    const duplicateInQueue = allStagedItems.filter((i) => i.id !== item.id && String(i.uid || '').trim().toLowerCase() === uidLower);
    if (duplicateInQueue.length > 0) {
      errors.uid = 'Duplicate custom UID in list';
    } else if (existingUidMap[uidLower]?.exists) {
      errors.uid = `UID already exists in database (${existingUidMap[uidLower]?.item_name || 'Existing item'})`;
    }
  }

  return errors;
}

// Low-confidence warning evaluator (returns yellow warnings for human verification)
export function getItemWarnings(item, dismissedWarnings = {}) {
  const warnings = {};
  const conf = item._confidence || {};
  const dismissed = dismissedWarnings || {};
  if (dismissed['*']) return warnings;

  if (!getItemErrors(item).name && conf.name !== undefined && conf.name < 0.75 && !dismissed.name) {
    warnings.name = `Low AI certainty (${Math.round(conf.name * 100)}%): please verify product name from bill`;
  }
  if (!getItemErrors(item).costPrice && conf.cost_price !== undefined && conf.cost_price < 0.75 && !dismissed.costPrice && !dismissed.cost_price) {
    warnings.costPrice = `Low AI certainty (${Math.round(conf.cost_price * 100)}%): check buying price digit`;
  }
  if (!getItemErrors(item).sellingPrice && conf.selling_price !== undefined && conf.selling_price < 0.75 && !dismissed.sellingPrice && !dismissed.selling_price) {
    warnings.sellingPrice = `Low AI certainty (${Math.round(conf.selling_price * 100)}%): check selling price`;
  }
  if (!getItemErrors(item).initialQuantity && conf.quantity !== undefined && conf.quantity < 0.75 && !dismissed.initialQuantity && !dismissed.quantity) {
    warnings.initialQuantity = `Low AI certainty (${Math.round(conf.quantity * 100)}%): verify quantity number from bill`;
  }
  if (!getItemErrors(item).mrp && conf.mrp !== undefined && conf.mrp < 0.75 && !dismissed.mrp) {
    warnings.mrp = `Low AI certainty (${Math.round(conf.mrp * 100)}%): check MRP`;
  }
  if (!getItemErrors(item).weight && conf.weight !== undefined && conf.weight < 0.75 && !dismissed.weight) {
    warnings.weight = `Low AI certainty (${Math.round(conf.weight * 100)}%): check weight`;
  }
  if (!getItemErrors(item).locationSection && conf.location_section !== undefined && conf.location_section < 0.75 && !dismissed.locationSection && !dismissed.location_section) {
    warnings.locationSection = `Low AI certainty (${Math.round(conf.location_section * 100)}%): check location`;
  }
  if (!getItemErrors(item).expiryDate && conf.expiry_date !== undefined && conf.expiry_date < 0.75 && !dismissed.expiryDate && !dismissed.expiry_date) {
    warnings.expiryDate = `Low AI certainty (${Math.round(conf.expiry_date * 100)}%): check expiry date`;
  }

  return warnings;
}

// Helper to convert File to Base64 Data URL for persistent storage
function serializeFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || 'image/jpeg',
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// Helper to convert Base64 Data URL back to a File object
function deserializeDataUrlToFile(dataUrl, name, type) {
  try {
    const arr = dataUrl.split(',');
    const mime = type || (arr[0].match(/:(.*?);/) ? arr[0].match(/:(.*?);/)[1] : 'image/jpeg');
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], name || `photo_${Date.now()}.jpg`, { type: mime });
  } catch (e) {
    console.error('Error deserializing image file', e);
    return null;
  }
}

// Helper to convert Image URL or Data URL to a File object
async function urlToFile(url, name, type) {
  try {
    if (!url) return null;
    if (url.startsWith('data:')) {
      return deserializeDataUrlToFile(url, name, type);
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || type || 'image/jpeg';
    return new File([blob], name || `photo_${Date.now()}.jpg`, { type: mime });
  } catch (e) {
    console.warn(`Error converting image url "${url}" to File:`, e);
    return null;
  }
}

export default function AddItemSection({
  stores = [],
  categories = [],
  subcategories = [],
  suppliers = [],
  sections = [],
  currentUser,
  isSectionRestricted: propIsSectionRestricted,
  selectedStore,
  onProductCreated,
  onGoToManagement,
  onMetaUpdated,
  onOpenSettings,
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

  const isAssignedNonOwner = Boolean(currentUser && !currentUser.is_owner && currentUser.store);
  const effectiveStoreId = selectedStore || (isAssignedNonOwner ? String(currentUser.store) : (stores[0]?.id || ''));
  const currentStoreObj = stores.find((s) => String(s.id) === String(effectiveStoreId)) || stores[0];
  const isManualUidEnabled = Boolean(currentStoreObj?.allow_manual_uid);

  // User-scoped storage key: ensures staged products are saved strictly per profile
  const userKey = currentUser?.username || (currentUser?.id ? `id_${currentUser.id}` : 'guest_profile');
  const STAGED_STORAGE_KEY = `wondersale_staged_products_${userKey}`;

  // Form states - Line 1
  const [name, setName] = useState('');
  const [customUid, setCustomUid] = useState('');
  const [selectedSubcatIds, setSelectedSubcatIds] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [sectionId, setSectionId] = useState(() => (isSectionRestricted && currentUser?.section ? String(currentUser.section) : ''));

  useEffect(() => {
    if (isSectionRestricted && currentUser?.section) {
      setSectionId(String(currentUser.section));
    }
  }, [isSectionRestricted, currentUser?.section]);

  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');

  // UID uniqueness lookup maps
  const [existingUidMap, setExistingUidMap] = useState({}); // { [uid_lower]: { exists: bool, item_name, store_name } }
  const [checkingUids, setCheckingUids] = useState({}); // { [uid_lower]: bool }

  // Form states - Line 2
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [locationSection, setLocationSection] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [weight, setWeight] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  // Form states - Line 3 (Dimensions & Description)
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [description, setDescription] = useState('');

  // Form Photo Modal state
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Table Row Photo Modal state (for editing photos of a staged row)
  const [activePhotoModalStagedItem, setActivePhotoModalStagedItem] = useState(null);

  // Subcategory Dropdown states (Top Form)
  const [isSubcatDropdownOpen, setIsSubcatDropdownOpen] = useState(false);
  const [subcatSearch, setSubcatSearch] = useState('');
  const dropdownRef = useRef(null);

  // Staged Table Subcategory Picker Popover Anchor
  const [tableSubcatPickerAnchor, setTableSubcatPickerAnchor] = useState(null); // { itemId, anchorRect }

  // Staged Table selection states
  const [selectedStagedIds, setSelectedStagedIds] = useState([]);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formFeedback, setFormFeedback] = useState('');
  const [successItem, setSuccessItem] = useState(null);

  // Batch Staging List state
  const [stagedItems, setStagedItems] = useState([]);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null); // { current: 1, total: 5, name: '...' }
  const [batchSuccessCount, setBatchSuccessCount] = useState(null);

  // CSV Import Modal state
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);

  // Gemini AI Bill Scanner Modal state
  const [isScanBillOpen, setIsScanBillOpen] = useState(false);

  const handleImportCsvSuccess = (importedProducts) => {
    if (!importedProducts || importedProducts.length === 0) return;
    setStagedItems((prev) => [...prev, ...importedProducts]);
    setFormFeedback(
      `Successfully imported ${importedProducts.length} product(s) from CSV into your staged list!`
    );
    setTimeout(() => setFormFeedback(''), 5000);
  };

  const handleScanBillSuccess = (extractedItems, billMetadata, aiStats) => {
    if (!extractedItems || extractedItems.length === 0) return;

    const targetStoreId = currentStoreObj?.id || effectiveStoreId;
    const parsedSupplierId = billMetadata?.matched_supplier_id || null;
    const parsedSupplierName = billMetadata?.matched_supplier_name || null;

    const parsedItems = extractedItems.map((item, rowIdx) => {
      const matchedIds = item.matched_subcategories || [];
      const matchedObjs = item.matched_subcategory_objects || subcategories.filter((s) => matchedIds.includes(s.id));

      return {
        id: `staged_ai_${Date.now()}_${rowIdx}_${Math.random().toString(36).substr(2, 5)}`,
        name: item.name || '',
        store: targetStoreId,
        supplierId: item.supplier_id || parsedSupplierId || '',
        supplierName: item.supplier_name || parsedSupplierName || '',
        subcategories: matchedIds,
        subcategoryObjects: matchedObjs,
        costPrice: item.cost_price || '',
        cost_price: parseFloat(item.cost_price) || 0,
        sellingPrice: item.selling_price || '',
        selling_price: parseFloat(item.selling_price) || 0,
        mrp: item.mrp || '',
        mrp_val: item.mrp ? parseFloat(item.mrp) || null : null,
        initialQuantity: item.quantity || '',
        initial_quantity: parseInt(item.quantity, 10) || 0,
        locationSection: item.location_section || '',
        expiryDate: item.expiry_date || '',
        weight: item.weight || '',
        imageFiles: [],
        imagePreviews: [],
        storedImages: [],
        isFromCsv: true,
        isAiExtracted: true,
        _confidence: item.confidence || {},
        _warnings: item.warnings || [],
      };
    });

    setStagedItems((prev) => [...prev, ...parsedItems]);

    const lowConfidenceCount = parsedItems.filter((p) => {
      const conf = p._confidence || {};
      return (
        (conf.name !== undefined && conf.name < 0.75) ||
        (conf.cost_price !== undefined && conf.cost_price < 0.75) ||
        (conf.selling_price !== undefined && conf.selling_price < 0.75) ||
        (conf.quantity !== undefined && conf.quantity < 0.75)
      );
    }).length;

    setFormFeedback(
      `✨ Gemini AI extracted ${parsedItems.length} product(s) from your bill! ${
        lowConfidenceCount > 0
          ? `${lowConfidenceCount} item(s) have low visual certainty (highlighted in yellow) — please verify before saving.`
          : 'All items extracted with high visual confidence.'
      }`
    );
    setTimeout(() => setFormFeedback(''), 6000);
  };

  // Load staged products from localStorage for this specific logged-in user profile
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STAGED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const restored = parsed.map((item) => {
            const files = (item.storedImages || [])
              .map((img) => deserializeDataUrlToFile(img.dataUrl, img.name, img.type))
              .filter(Boolean);
            const previews = (item.storedImages || []).map((img) => img.dataUrl);
            return {
              ...item,
              imageFiles: files,
              imagePreviews: previews.length > 0 ? previews : (item.imagePreviews || []),
            };
          });
          setStagedItems(restored);
        }
      } else {
        setStagedItems([]);
      }
    } catch (err) {
      console.warn('Failed to load staged items from storage:', err);
    } finally {
      setIsInitialLoadDone(true);
    }
  }, [STAGED_STORAGE_KEY]);

  // Persist staged products to localStorage whenever stagedItems changes
  useEffect(() => {
    if (!isInitialLoadDone) return;
    try {
      if (stagedItems.length === 0) {
        localStorage.removeItem(STAGED_STORAGE_KEY);
      } else {
        const toStore = stagedItems.map((item) => {
          // Omit non-serializable File objects
          const { imageFiles, ...rest } = item;
          return rest;
        });
        localStorage.setItem(STAGED_STORAGE_KEY, JSON.stringify(toStore));
      }
    } catch (err) {
      console.warn('Failed to persist staged items to storage:', err);
    }
  }, [stagedItems, isInitialLoadDone, STAGED_STORAGE_KEY]);

  // Live asynchronous uniqueness verification for non-empty UIDs in form or staged list
  useEffect(() => {
    const uidsToCheck = new Set();
    if (customUid && customUid.trim()) {
      uidsToCheck.add(customUid.trim());
    }
    stagedItems.forEach((item) => {
      if (item.uid && String(item.uid).trim()) {
        uidsToCheck.add(String(item.uid).trim());
      }
    });

    const pendingUids = Array.from(uidsToCheck).filter(
      (u) => existingUidMap[u.toLowerCase()] === undefined && !checkingUids[u.toLowerCase()]
    );

    if (pendingUids.length === 0) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      for (const u of pendingUids) {
        const uLower = u.toLowerCase();
        setCheckingUids((prev) => ({ ...prev, [uLower]: true }));
        try {
          const res = await checkItemUidExists(u);
          if (isMounted) {
            setExistingUidMap((prev) => ({
              ...prev,
              [uLower]: res,
            }));
          }
        } catch (err) {
          console.warn(`Failed to check UID uniqueness for "${u}":`, err);
        } finally {
          if (isMounted) {
            setCheckingUids((prev) => ({ ...prev, [uLower]: false }));
          }
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [customUid, stagedItems, existingUidMap, checkingUids]);

  // Close top dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsSubcatDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Profit Margin Calculation helper
  const calculateMargin = (cVal, sVal) => {
    const c = parseFloat(cVal);
    const s = parseFloat(sVal);
    if (!c || isNaN(c) || c <= 0 || isNaN(s)) return null;
    return (((s - c) / c) * 100).toFixed(1);
  };

  const cost = parseFloat(costPrice) || 0;
  const sell = parseFloat(sellingPrice) || 0;
  const marginAmt = sell - cost;
  const marginPct = cost > 0 ? ((marginAmt / cost) * 100).toFixed(1) : 0;

  // Filtered subcategories grouped by category for top form dropdown
  const filteredCategoryGroups = useMemo(() => {
    const q = subcatSearch.toLowerCase().trim();
    return categories
      .map((cat) => {
        const subs = subcategories.filter((s) => String(s.category) === String(cat.id));
        const matchingSubs = q
          ? subs.filter((s) => s.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q))
          : subs;

        if (matchingSubs.length > 0) {
          return {
            ...cat,
            subcategories: matchingSubs,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [categories, subcategories, subcatSearch]);

  const selectedSubcategoryObjects = useMemo(() => {
    return subcategories.filter((s) => selectedSubcatIds.includes(s.id));
  }, [subcategories, selectedSubcatIds]);

  const toggleSubcategory = (id) => {
    setSelectedSubcatIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleResetForm = () => {
    setName('');
    setCustomUid('');
    setSelectedSubcatIds([]);
    setSupplierId('');
    setSectionId(isSectionRestricted && currentUser?.section ? String(currentUser.section) : '');
    setCostPrice('');
    setSellingPrice('');
    setMrp('');
    setInitialQuantity('0');
    setLocationSection('');
    setExpiryDate('');
    setWeight('');
    setLength('');
    setWidth('');
    setHeight('');
    setDescription('');
    setImageFiles([]);
    setImagePreviews([]);
    setError('');
    setFormFeedback('');
    setSuccessItem(null);
    setSubcatSearch('');
  };

  // Form Validation helper
  const validateForm = () => {
    const targetStoreId = currentStoreObj?.id || effectiveStoreId;
    if (!name.trim()) {
      return 'Product Name is required.';
    }
    if (!targetStoreId) {
      return 'Active store location could not be determined.';
    }
    if (isManualUidEnabled && customUid.trim()) {
      const uidClean = customUid.trim();
      const existingInfo = existingUidMap[uidClean.toLowerCase()];
      if (existingInfo?.exists) {
        return `Product with UID / Barcode "${uidClean}" already exists in inventory (${existingInfo.item_name || 'Existing product'}). Please choose a unique UID.`;
      }
    }
    if (costPrice === '' || isNaN(costPrice) || parseFloat(costPrice) < 0) {
      return 'Cost Price is required and must be a valid positive number.';
    }
    if (sellingPrice === '' || isNaN(sellingPrice) || parseFloat(sellingPrice) < 0) {
      return 'Selling Price is required and must be a valid positive number.';
    }
    if (initialQuantity === '' || isNaN(initialQuantity) || parseInt(initialQuantity, 10) < 0) {
      return 'Stock Quantity is required and must be 0 or greater.';
    }
    return null;
  };

  // 1. ADD SINGLE PRODUCT IMMEDIATELY
  const handleAddSingleProduct = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setFormFeedback('');
    setBatchSuccessCount(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const targetStoreId = currentStoreObj?.id || effectiveStoreId;
    setLoading(true);

    try {
      if (isManualUidEnabled && customUid.trim()) {
        const uidClean = customUid.trim();
        let existsInfo = existingUidMap[uidClean.toLowerCase()];
        if (!existsInfo) {
          try {
            existsInfo = await checkItemUidExists(uidClean);
            setExistingUidMap((prev) => ({ ...prev, [uidClean.toLowerCase()]: existsInfo }));
          } catch (e) {}
        }
        if (existsInfo?.exists) {
          setError(`Item with UID / Barcode "${uidClean}" already exists in inventory (${existsInfo.item_name || 'Existing product'}).`);
          setLoading(false);
          return;
        }
      }

      const payload = {
        name: name.trim(),
        store: targetStoreId,
        subcategories: selectedSubcatIds,
        supplier: supplierId || null,
        section: isSectionRestricted && currentUser?.section ? currentUser.section : (sectionId || null),
        cost_price: parseFloat(costPrice),
        selling_price: parseFloat(sellingPrice),
        mrp: mrp ? parseFloat(mrp) : null,
        initial_quantity: parseInt(initialQuantity, 10) || 0,
        location_section: locationSection.trim(),
        expiry_date: expiryDate || null,
        weight: weight ? parseFloat(weight) : null,
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        description: description.trim(),
        needs_new_barcode_printed: true,
        ...(isManualUidEnabled && customUid.trim() ? { uid: customUid.trim() } : {}),
      };

      const created = await createItem(payload);

      // Upload staged images if any
      if (imageFiles.length > 0) {
        try {
          await uploadItemImages(created.id, imageFiles);
        } catch (imgErr) {
          console.warn('Image upload warning after single product creation:', imgErr);
        }
      }

      setSuccessItem(created);
      onProductCreated?.(created);
      onMetaUpdated?.();
      handleResetForm();
    } catch (err) {
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  // 2. ADD TO STAGED LIST
  const handleAddToList = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setFormFeedback('');
    setBatchSuccessCount(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const targetStoreId = currentStoreObj?.id || effectiveStoreId;

    // Serialize images into Base64 so they persist across tabs, navigation, and reloads
    const serializedImages = await Promise.all(
      (imageFiles || []).map(async (file) => {
        return await serializeFile(file);
      })
    );
    const validStoredImages = serializedImages.filter(Boolean);

    const matchedSupplier = suppliers.find((s) => String(s.id) === String(supplierId));
    const effectiveSecId = isSectionRestricted && currentUser?.section ? String(currentUser.section) : sectionId;
    const matchedSection = sections.find((sec) => String(sec.id) === String(effectiveSecId));

    const newStagedItem = {
      id: `staged_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      uid: isManualUidEnabled && customUid.trim() ? customUid.trim() : '',
      name: name.trim(),
      store: targetStoreId,
      subcategories: [...selectedSubcatIds],
      subcategoryObjects: [...selectedSubcategoryObjects],
      supplierId: supplierId || '',
      supplierName: matchedSupplier ? matchedSupplier.name : '',
      sectionId: effectiveSecId || '',
      sectionName: matchedSection ? matchedSection.name : (isSectionRestricted ? (currentUser?.section_name || '') : ''),
      costPrice: costPrice,
      cost_price: parseFloat(costPrice) || 0,
      sellingPrice: sellingPrice,
      selling_price: parseFloat(sellingPrice) || 0,
      mrp: mrp || '',
      mrp_val: mrp ? parseFloat(mrp) : null,
      initialQuantity: initialQuantity,
      initial_quantity: parseInt(initialQuantity, 10) || 0,
      locationSection: locationSection.trim(),
      expiryDate: expiryDate,
      weight: weight,
      length: length,
      width: width,
      height: height,
      description: description,
      imageFiles: [...imageFiles],
      imagePreviews: validStoredImages.length > 0
        ? validStoredImages.map((img) => img.dataUrl)
        : [...imagePreviews],
      storedImages: validStoredImages,
    };

    setStagedItems((prev) => [...prev, newStagedItem]);
    setFormFeedback(`"${name.trim()}" added to staged queue! (${stagedItems.length + 1} item${stagedItems.length === 0 ? '' : 's'} in list)`);
    setTimeout(() => setFormFeedback(''), 4000);

    // Reset inputs for rapid next product entry
    setName('');
    setCustomUid('');
    setSelectedSubcatIds([]);
    setSupplierId('');
    setSectionId(isSectionRestricted && currentUser?.section ? String(currentUser.section) : '');
    setCostPrice('');
    setSellingPrice('');
    setMrp('');
    setInitialQuantity('0');
    setLocationSection('');
    setExpiryDate('');
    setWeight('');
    setLength('');
    setWidth('');
    setHeight('');
    setDescription('');
    setImageFiles([]);
    setImagePreviews([]);
    setSubcatSearch('');
  };

  // Batch assign supplier to selected staged items (or all if none selected)
  const handleBatchAssignSupplier = (targetSupplierId) => {
    if (stagedItems.length === 0) return;
    const targetSupplier = suppliers.find((s) => String(s.id) === String(targetSupplierId));
    const sName = targetSupplier ? targetSupplier.name : '';
    const hasSelection = selectedStagedIds.length > 0;

    setStagedItems((prev) =>
      prev.map((item) => {
        if (hasSelection && !selectedStagedIds.includes(item.id)) return item;
        return {
          ...item,
          supplierId: targetSupplierId || '',
          supplierName: sName,
        };
      })
    );
    const count = hasSelection ? selectedStagedIds.length : stagedItems.length;
    setFormFeedback(
      targetSupplierId
        ? `Assigned supplier "${sName}" to ${count} staged item(s)!`
        : `Cleared supplier on ${count} staged item(s).`
    );
    setTimeout(() => setFormFeedback(''), 4000);
  };

  // Batch assign a subcategory to selected staged items (or all if none selected)
  const handleBatchAssignSubcategory = (subcatId) => {
    if (stagedItems.length === 0 || !subcatId) return;
    const subcatObj = subcategories.find((s) => String(s.id) === String(subcatId));
    if (!subcatObj) return;
    const hasSelection = selectedStagedIds.length > 0;

    setStagedItems((prev) =>
      prev.map((item) => {
        if (hasSelection && !selectedStagedIds.includes(item.id)) return item;
        const currentSubcats = item.subcategories || [];
        const nextSubcats = currentSubcats.includes(subcatId) ? currentSubcats : [...currentSubcats, subcatId];
        const nextObjs = subcategories.filter((s) => nextSubcats.includes(s.id));
        return {
          ...item,
          subcategories: nextSubcats,
          subcategoryObjects: nextObjs,
        };
      })
    );
    const count = hasSelection ? selectedStagedIds.length : stagedItems.length;
    setFormFeedback(`Added subcategory "${subcatObj.name}" to ${count} staged item(s)!`);
    setTimeout(() => setFormFeedback(''), 4000);
  };

  // Inline update a field directly in the Staged Table
  const handleUpdateStagedField = (itemId, field, value) => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const updatedDismissed = {
          ...(item._dismissedWarnings || {}),
          [field]: true,
        };

        const updated = {
          ...item,
          [field]: value,
          _dismissedWarnings: updatedDismissed,
        };

        if (field === 'uid') {
          updated.uid = value;
          updatedDismissed.uid = true;
        } else if (field === 'supplierId') {
          updated.supplierId = value;
          const sObj = suppliers.find((s) => String(s.id) === String(value));
          updated.supplierName = sObj ? sObj.name : '';
        } else if (field === 'costPrice') {
          updated.cost_price = parseFloat(value) || 0;
          updatedDismissed.cost_price = true;
        } else if (field === 'sellingPrice') {
          updated.selling_price = parseFloat(value) || 0;
          updatedDismissed.selling_price = true;
        } else if (field === 'mrp') {
          updated.mrp_val = value ? parseFloat(value) : null;
          updatedDismissed.mrp = true;
        } else if (field === 'initialQuantity') {
          updated.initialQuantity = value;
          updated.initial_quantity = parseInt(value, 10) || 0;
          updatedDismissed.quantity = true;
        } else if (field === 'locationSection') {
          updatedDismissed.location_section = true;
        } else if (field === 'expiryDate') {
          updatedDismissed.expiry_date = true;
        } else if (field === 'weight') {
          updatedDismissed.weight = true;
        } else if (field === 'name') {
          updatedDismissed.name = true;
        }
        return updated;
      })
    );
  };

  // Confirm / Verify AI extracted row - clears low confidence warnings and marks clean
  const handleConfirmRowAi = (itemId) => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          _dismissedWarnings: { ...(item._dismissedWarnings || {}), '*': true },
        };
      })
    );
  };

  // Confirm all AI extracted rows across the entire staged list
  const handleConfirmAllAiWarnings = () => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (!item._confidence) return item;
        return {
          ...item,
          _dismissedWarnings: { ...(item._dismissedWarnings || {}), '*': true },
        };
      })
    );
  };

  // Toggle subcategory selection in staged table row popup
  const toggleStagedSubcategory = (itemId, subcatId) => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const currentIds = item.subcategories || [];
        const nextIds = currentIds.includes(subcatId)
          ? currentIds.filter((id) => id !== subcatId)
          : [...currentIds, subcatId];

        const nextSubcatObjs = subcategories.filter((s) => nextIds.includes(s.id));
        return {
          ...item,
          subcategories: nextIds,
          subcategoryObjects: nextSubcatObjs,
        };
      })
    );
  };

  // Toggle selection for bulk actions
  const toggleSelectStagedItem = (id) => {
    setSelectedStagedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllStaged = () => {
    if (selectedStagedIds.length === stagedItems.length) {
      setSelectedStagedIds([]);
    } else {
      setSelectedStagedIds(stagedItems.map((i) => i.id));
    }
  };

  // Remove single item from staged list
  const handleRemoveStagedItem = (id) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedStagedIds((prev) => prev.filter((i) => i !== id));
  };

  // Delete selected staged items
  const handleDeleteSelectedStaged = () => {
    if (selectedStagedIds.length === 0) return;
    if (window.confirm(`Remove ${selectedStagedIds.length} selected item(s) from staged list?`)) {
      setStagedItems((prev) => prev.filter((item) => !selectedStagedIds.includes(item.id)));
      setSelectedStagedIds([]);
    }
  };

  // Clear entire staged list
  const handleClearStagedList = () => {
    if (window.confirm('Are you sure you want to clear all staged products?')) {
      setStagedItems([]);
      setSelectedStagedIds([]);
    }
  };

  // Handle Photo Modal save for an individual staged row in the table
  const handleSaveRowPhotos = async (files, previews) => {
    if (!activePhotoModalStagedItem) return;
    const targetId = activePhotoModalStagedItem.id;

    const serializedImages = await Promise.all(
      (files || []).map(async (file) => {
        return await serializeFile(file);
      })
    );
    const validStored = serializedImages.filter(Boolean);

    setStagedItems((prev) =>
      prev.map((item) => {
        if (item.id !== targetId) return item;
        return {
          ...item,
          imageFiles: files,
          imagePreviews: previews,
          storedImages: validStored,
        };
      })
    );
    setActivePhotoModalStagedItem(null);
  };

  // 3. ADD ALL STAGED PRODUCTS BATCH ACTION
  const handleAddAllProducts = async () => {
    if (stagedItems.length === 0) return;

    if (totalErrorRows > 0) {
      setError(`Cannot save products from the list. Please resolve all ${totalErrorRows} problematic row(s) first.`);
      return;
    }

    // Validate all items in staged queue before submitting
    for (let i = 0; i < stagedItems.length; i++) {
      const item = stagedItems[i];
      const errors = getItemErrors(item, stagedItems, existingUidMap);
      if (Object.keys(errors).length > 0) {
        setError(`"${item.name || `Row #${i + 1}`}": ${Object.values(errors)[0]}`);
        return;
      }
    }

    setBatchSubmitting(true);
    setBatchSuccessCount(null);
    setError('');

    // Check if any staged items have images attached
    const hasAnyImages = stagedItems.some(
      (item) =>
        (item.imageFiles && item.imageFiles.length > 0) ||
        (item.storedImages && item.storedImages.length > 0) ||
        (item.imagePreviews && item.imagePreviews.length > 0)
    );

    // OPTIMIZED FAST PATH: If items don't have local image files to upload (e.g. from CSV import or quick lists)
    // Send all of them to the high-performance atomic bulk-create endpoint in ONE single fast request!
    if (!hasAnyImages) {
      try {
        setBatchProgress({
          current: stagedItems.length,
          total: stagedItems.length,
          name: `Saving all ${stagedItems.length} products...`,
        });

        const storeTargetId = currentStoreObj?.id || effectiveStoreId;
        const bulkPayload = stagedItems.map((item) => ({
          name: item.name.trim(),
          store: item.store || storeTargetId,
          subcategories: item.subcategories || [],
          supplier: item.supplierId || item.supplier || null,
          section: isSectionRestricted && currentUser?.section ? currentUser.section : (item.sectionId || item.section || null),
          cost_price: parseFloat(item.cost_price) || 0,
          selling_price: parseFloat(item.selling_price) || 0,
          mrp: item.mrp_val ? parseFloat(item.mrp_val) : (item.mrp ? parseFloat(item.mrp) : null),
          initial_quantity: parseInt(
            item.initialQuantity !== undefined && item.initialQuantity !== ''
              ? item.initialQuantity
              : (item.initial_quantity !== undefined && item.initial_quantity !== '' ? item.initial_quantity : item.quantity),
            10
          ) || 0,
          location_section: item.locationSection ? item.locationSection.trim() : '',
          expiry_date: item.expiryDate || null,
          weight: item.weight ? parseFloat(item.weight) : null,
          length: item.length ? parseFloat(item.length) : null,
          width: item.width ? parseFloat(item.width) : null,
          height: item.height ? parseFloat(item.height) : null,
          description: item.description ? String(item.description).trim() : '',
          ...(item.uid && String(item.uid).trim() ? { uid: String(item.uid).trim() } : {}),
        }));

        const bulkRes = await bulkCreateItems(bulkPayload, storeTargetId);

        setBatchSuccessCount(bulkRes.created_count || stagedItems.length);
        setStagedItems([]);
        setSelectedStagedIds([]);
        try {
          localStorage.removeItem(STAGED_STORAGE_KEY);
        } catch (e) {}
        onProductCreated?.(null);
        onMetaUpdated?.();
        setBatchSubmitting(false);
        setBatchProgress(null);
        return;
      } catch (err) {
        console.error('Bulk create items failed:', err);
        setError(`Failed to bulk register products: ${err.message}`);
        setBatchSubmitting(false);
        setBatchProgress(null);
        return;
      }
    }

    // REGULAR PATH (with photos): Loops through items with retry backoff for rate limits
    let successCount = 0;
    let lastCreated = null;

    for (let i = 0; i < stagedItems.length; i++) {
      const item = stagedItems[i];
      setBatchProgress({
        current: i + 1,
        total: stagedItems.length,
        name: item.name,
      });

      try {
        const payload = {
          name: item.name.trim(),
          store: item.store || (currentStoreObj?.id || effectiveStoreId),
          subcategories: item.subcategories || [],
          supplier: item.supplierId || item.supplier || null,
          section: isSectionRestricted && currentUser?.section ? currentUser.section : (item.sectionId || item.section || null),
          cost_price: parseFloat(item.cost_price) || 0,
          selling_price: parseFloat(item.selling_price) || 0,
          mrp: item.mrp_val ? parseFloat(item.mrp_val) : (item.mrp ? parseFloat(item.mrp) : null),
          initial_quantity: parseInt(
            item.initialQuantity !== undefined && item.initialQuantity !== ''
              ? item.initialQuantity
              : (item.initial_quantity !== undefined && item.initial_quantity !== '' ? item.initial_quantity : item.quantity),
            10
          ) || 0,
          location_section: item.locationSection ? item.locationSection.trim() : '',
          expiry_date: item.expiryDate || null,
          weight: item.weight ? parseFloat(item.weight) : null,
          length: item.length ? parseFloat(item.length) : null,
          width: item.width ? parseFloat(item.width) : null,
          height: item.height ? parseFloat(item.height) : null,
          description: item.description ? String(item.description).trim() : '',
          needs_new_barcode_printed: true,
          ...(item.uid && String(item.uid).trim() ? { uid: String(item.uid).trim() } : {}),
        };

        // Create item with automatic backoff retry if throttled
        let created = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            created = await createItem(payload);
            break;
          } catch (createErr) {
            if (createErr.message && createErr.message.toLowerCase().includes('throttled') && attempt < 2) {
              await new Promise((r) => setTimeout(r, 2500));
            } else {
              throw createErr;
            }
          }
        }

        lastCreated = created;

        // Restore or convert image files for upload
        let filesToUpload = [];
        if (item.imageFiles && item.imageFiles.length > 0) {
          filesToUpload = item.imageFiles;
        } else if (item.storedImages && item.storedImages.length > 0) {
          const converted = await Promise.all(
            item.storedImages.map(async (img, idx) => {
              const u = img.dataUrl || img.url;
              if (!u) return null;
              return await urlToFile(u, img.name || `photo_${idx}.jpg`, img.type);
            })
          );
          filesToUpload = converted.filter(Boolean);
        } else if (item.imagePreviews && item.imagePreviews.length > 0) {
          const converted = await Promise.all(
            item.imagePreviews.map(async (url, idx) => {
              return await urlToFile(url, `photo_${idx}.jpg`);
            })
          );
          filesToUpload = converted.filter(Boolean);
        }

        if (filesToUpload && filesToUpload.length > 0) {
          try {
            await uploadItemImages(created.id, filesToUpload);
          } catch (imgErr) {
            console.warn(`Image upload warning for "${item.name}":`, imgErr);
          }
        }

        successCount++;
      } catch (err) {
        console.error(`Error registering "${item.name}":`, err);
        setError(`Failed to register "${item.name}": ${err.message}`);
        break;
      }
    }

    setBatchSubmitting(false);
    setBatchProgress(null);

    if (successCount > 0) {
      setBatchSuccessCount(successCount);
      setStagedItems((prev) => prev.slice(successCount));
      setSelectedStagedIds([]);
      try {
        localStorage.removeItem(STAGED_STORAGE_KEY);
      } catch (e) {}
      onProductCreated?.(lastCreated);
      onMetaUpdated?.();
    }
  };

  // Compute validation errors and AI warnings on every staged row
  const stagedItemsWithErrors = useMemo(() => {
    return stagedItems.map((item) => {
      const errors = getItemErrors(item, stagedItems, existingUidMap);
      const warnings = getItemWarnings(item, stagedItems, existingUidMap);
      const errorCount = Object.keys(errors).length;
      const warningCount = Object.keys(warnings).length;
      return {
        ...item,
        _errors: errors,
        _warningsMap: warnings,
        _errorCount: errorCount,
        _warningCount: warningCount,
        _hasErrors: errorCount > 0,
        _hasWarnings: errorCount === 0 && warningCount > 0,
      };
    });
  }, [stagedItems, existingUidMap]);

  const totalErrorRows = useMemo(() => {
    return stagedItemsWithErrors.filter((i) => i._hasErrors).length;
  }, [stagedItemsWithErrors]);

  const totalWarningRows = useMemo(() => {
    return stagedItemsWithErrors.filter((i) => !i._hasErrors && i._hasWarnings).length;
  }, [stagedItemsWithErrors]);

  const totalErrorCount = useMemo(() => {
    return stagedItemsWithErrors.reduce((acc, i) => acc + i._errorCount, 0);
  }, [stagedItemsWithErrors]);

  // Tri-tier Sorting: 1. Errors on top (red) -> 2. Low confidence warnings next (yellow) -> 3. Clean rows below
  const sortedStagedItems = useMemo(() => {
    return [...stagedItemsWithErrors].sort((a, b) => {
      if (a._hasErrors && !b._hasErrors) return -1;
      if (!a._hasErrors && b._hasErrors) return 1;
      if (a._hasWarnings && !b._hasWarnings) return -1;
      if (!a._hasWarnings && b._hasWarnings) return 1;
      return 0;
    });
  }, [stagedItemsWithErrors]);

  // Compute batch statistics
  const totalStagedUnits = useMemo(() => {
    return stagedItems.reduce((acc, item) => {
      const q = parseInt(item.initialQuantity !== undefined ? item.initialQuantity : item.initial_quantity, 10);
      return acc + (isNaN(q) || q < 0 ? 0 : q);
    }, 0);
  }, [stagedItems]);

  const totalStagedCost = useMemo(() => {
    return stagedItems.reduce((acc, item) => {
      const c = parseFloat(item.costPrice !== undefined ? item.costPrice : item.cost_price);
      const q = parseInt(item.initialQuantity !== undefined ? item.initialQuantity : item.initial_quantity, 10);
      const validC = isNaN(c) || c < 0 ? 0 : c;
      const validQ = isNaN(q) || q < 0 ? 0 : q;
      return acc + validC * validQ;
    }, 0);
  }, [stagedItems]);

  return (
    <div style={{ width: '100%' }}>
      {/* Batch Success Notification Banner */}
      {batchSuccessCount !== null && (
        <div
          className="glass-panel"
          style={{
            padding: '18px 24px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--color-success-bg)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle2 size={24} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-success)' }}>
                Batch Added Successfully!
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                All <strong>{batchSuccessCount}</strong> products and their photos have been registered into inventory.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoToManagement}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>View in Inventory Management</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Single Success Notification Banner */}
      {successItem && (
        <div
          className="glass-panel"
          style={{
            padding: '18px 24px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--color-success-bg)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle2 size={24} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--color-success)' }}>
                Product Added Successfully!
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <strong>{successItem.name}</strong> registered with UID <span className="mono font-bold">{successItem.uid}</span> ({successItem.quantity} initial units).
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleResetForm}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} />
              <span>Add Another Item</span>
            </button>
            <button
              type="button"
              onClick={onGoToManagement}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Go to Inventory Management</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Creation Form */}
      <div className="glass-panel add-item-form-panel" style={{ padding: '28px', borderRadius: 'var(--radius-xl)', marginBottom: '24px' }}>
        {error && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '18px',
              background: 'var(--color-danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.86rem',
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {formFeedback && (
          <div
            style={{
              padding: '10px 16px',
              marginBottom: '18px',
              background: 'var(--brand-ruby-glow)',
              border: '1px solid rgba(218, 41, 28, 0.3)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.84rem',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{formFeedback}</span>
          </div>
        )}

        {/* LINE 1: Product Name, Custom UID (if enabled), Subcategory Dropdown, Cost Price, Selling Price, MRP */}
        <div
          className="add-item-grid-line1"
          style={{
            display: 'grid',
            gridTemplateColumns: isManualUidEnabled
              ? 'minmax(200px, 2fr) minmax(130px, 1.2fr) minmax(180px, 1.8fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr)'
              : 'minmax(220px, 2.2fr) minmax(200px, 2fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(110px, 1fr)',
            gap: '14px',
            marginBottom: '18px',
          }}
        >
          {/* 1. Product Name */}
          <div className="add-item-field-name">
            <label className="form-label">
              Product Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Classic Oxford Shirt"
              className="form-input"
              required
              autoFocus
            />
          </div>

          {/* 1b. Custom UID (Only shown if manual UID is enabled for this store) */}
          {isManualUidEnabled && (
            <div className="add-item-field-uid">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Custom UID</span>
                <span style={{ fontSize: '0.66rem', color: 'var(--color-success)', fontWeight: 700 }}>Manual ON</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={customUid}
                  onChange={(e) => setCustomUid(e.target.value)}
                  placeholder="e.g. 10245 (auto if blank)"
                  className="form-input mono"
                  style={{
                    borderColor: existingUidMap[customUid.trim().toLowerCase()]?.exists
                      ? 'var(--color-danger)'
                      : (customUid.trim() && !checkingUids[customUid.trim().toLowerCase()] && existingUidMap[customUid.trim().toLowerCase()]?.exists === false)
                      ? 'var(--color-success)'
                      : undefined,
                    background: existingUidMap[customUid.trim().toLowerCase()]?.exists
                      ? 'var(--color-danger-bg)'
                      : undefined,
                    color: existingUidMap[customUid.trim().toLowerCase()]?.exists
                      ? 'var(--color-danger)'
                      : undefined,
                  }}
                  title={existingUidMap[customUid.trim().toLowerCase()]?.exists ? `UID already in use by: ${existingUidMap[customUid.trim().toLowerCase()]?.item_name}` : 'Custom product barcode/UID'}
                />
                {customUid && checkingUids[customUid.trim().toLowerCase()] && (
                  <Loader2
                    size={13}
                    className="animate-spin"
                    style={{ position: 'absolute', right: '8px', top: '14px', color: 'var(--text-muted)' }}
                  />
                )}
              </div>
            </div>
          )}

          {/* 2. Subcategory Search & Select Dropdown */}
          <div className="add-item-field-subcat" style={{ position: 'relative' }} ref={dropdownRef}>
            <label className="form-label">
              Subcategories <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Search &amp; Pick)</span>
            </label>
            <div
              onClick={() => setIsSubcatDropdownOpen((prev) => !prev)}
              className="form-input"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                height: '42px',
                userSelect: 'none',
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.84rem' }}>
                {selectedSubcategoryObjects.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>Select Subcategories...</span>
                ) : (
                  <span>
                    <strong>{selectedSubcategoryObjects.length}</strong> selected:{' '}
                    {selectedSubcategoryObjects.map((s) => s.name).join(', ')}
                  </span>
                )}
              </div>
              <ChevronDown
                size={16}
                style={{
                  color: 'var(--text-muted)',
                  transform: isSubcatDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                  marginLeft: '6px',
                }}
              />
            </div>

            {/* Floating Dropdown Menu */}
            {isSubcatDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 200,
                  maxHeight: '320px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Search Header inside dropdown */}
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={subcatSearch}
                    onChange={(e) => setSubcatSearch(e.target.value)}
                    placeholder="Filter subcategories..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)',
                      width: '100%',
                    }}
                    autoFocus
                  />
                  {selectedSubcatIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSubcatIds([])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--brand-primary)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Clear ({selectedSubcatIds.length})
                    </button>
                  )}
                </div>

                {/* Subcategories List grouped by parent category */}
                <div style={{ overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredCategoryGroups.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No subcategories match your search.
                    </div>
                  ) : (
                    filteredCategoryGroups.map((cat) => (
                      <div key={cat.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--brand-primary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '4px 6px',
                          }}
                        >
                          {cat.name}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {cat.subcategories.map((sub) => {
                            const isSelected = selectedSubcatIds.includes(sub.id);
                            return (
                              <div
                                key={sub.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSubcategory(sub.id);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: isSelected ? 'rgba(218, 41, 28, 0.08)' : 'transparent',
                                  cursor: 'pointer',
                                  fontSize: '0.82rem',
                                  color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                                  fontWeight: isSelected ? 700 : 500,
                                }}
                              >
                                <span>{sub.name}</span>
                                {isSelected ? (
                                  <Check size={14} style={{ color: 'var(--brand-primary)' }} />
                                ) : (
                                  <div
                                    style={{
                                      width: '14px',
                                      height: '14px',
                                      borderRadius: '3px',
                                      border: '1px solid var(--border-strong)',
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Cost Price */}
          <div className="add-item-field-cost">
            <label className="form-label">
              Cost Price (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0.00"
              className="form-input mono"
              required
            />
          </div>

          {/* 4. Selling Price */}
          <div className="add-item-field-selling">
            <label className="form-label">
              Selling Price (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="0.00"
              className="form-input mono"
              required
            />
          </div>

          {/* 5. MRP */}
          <div className="add-item-field-mrp">
            <label className="form-label">
              MRP (₹) <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              placeholder="Defaults to Selling"
              className="form-input mono"
            />
          </div>
        </div>

        {/* Selected subcategories chip preview */}
        {selectedSubcategoryObjects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Selected:</span>
            {selectedSubcategoryObjects.map((sc) => (
              <span
                key={sc.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--brand-primary)',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                }}
              >
                {sc.name}
                <button
                  type="button"
                  onClick={() => toggleSubcategory(sc.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* LINE 2: Supplier, Section, Stock Quantity, Expiry Date, Weight, Add Images Button */}
        <div
          className="add-item-grid-line2"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(140px, 1.4fr) minmax(90px, 0.9fr) minmax(120px, 1.1fr) minmax(90px, 0.9fr) minmax(140px, 1.3fr)',
            gap: '14px',
            marginBottom: '20px',
            alignItems: 'flex-start',
          }}
        >
          {/* 1. Supplier */}
          <div className="add-item-field-supplier">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Truck size={12} style={{ color: 'var(--brand-primary)' }} />
              <span>Supplier</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="form-input"
              style={{ height: '42px', fontSize: '0.84rem' }}
            >
              <option value="">No Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.contact_person ? `(${s.contact_person})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 1b. Store Section */}
          <div className="add-item-field-section-select">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={12} style={{ color: isSectionRestricted ? '#38BDF8' : 'var(--brand-primary)' }} />
              <span>Section</span>
              {isSectionRestricted ? (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#38BDF8',
                    background: 'rgba(56, 189, 248, 0.12)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <Lock size={10} /> Locked
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
              )}
            </label>
            <select
              value={isSectionRestricted && currentUser?.section ? String(currentUser.section) : sectionId}
              onChange={(e) => !isSectionRestricted && setSectionId(e.target.value)}
              disabled={isSectionRestricted}
              className="form-input"
              style={{
                height: '42px',
                fontSize: '0.84rem',
                opacity: isSectionRestricted ? 0.85 : 1,
                cursor: isSectionRestricted ? 'not-allowed' : 'default',
                borderColor: isSectionRestricted ? 'rgba(56, 189, 248, 0.4)' : undefined,
              }}
            >
              <option value="">No Section</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} {sec.code ? `(${sec.code})` : ''}
                </option>
              ))}
            </select>
            {isSectionRestricted && (
              <span style={{ fontSize: '0.72rem', color: '#38BDF8', marginTop: '3px', display: 'block' }}>
                All added items are locked to your assigned department ({currentUser?.section_name || 'Section'}).
              </span>
            )}
          </div>

          {/* 2. Stock Quantity */}
          <div className="add-item-field-qty">
            <label className="form-label">
              Quantity <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(e.target.value)}
              placeholder="0"
              className="form-input mono"
              required
            />
          </div>

          {/* 3. Expiry Date */}
          <div className="add-item-field-expiry">
            <label className="form-label">
              Expiry Date <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="form-input"
            />
          </div>

          {/* 5. Weight (Grams) */}
          <div className="add-item-field-weight">
            <label className="form-label">
              Weight (g) <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 250"
              className="form-input mono"
            />
          </div>

          {/* 6. Product Image(s) Modal Opener */}
          <div className="add-item-field-photos">
            <label className="form-label">
              Product Photos <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{
                  height: '42px',
                  padding: '0 14px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                }}
              >
                <ImageIcon size={15} />
                <span>{imageFiles.length === 0 ? 'Choose Photos' : `Photos (${imageFiles.length})`}</span>
              </button>

              {/* Thumbnails preview strip */}
              {imagePreviews.map((previewUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setIsPhotoModalOpen(true)}
                  style={{
                    position: 'relative',
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  title="Click to view & manage photos"
                >
                  <img
                    src={previewUrl}
                    alt={`Preview ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LINE 3: Physical Dimensions (cm), Live Volume, Volumetric Weight, and Product Description */}
        {(() => {
          const formVol = calculateVolumeMetrics(length, width, height);
          return (
            <div
              className="add-item-grid-line3"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(320px, 1.8fr)',
                gap: '16px',
                marginBottom: '20px',
                alignItems: 'flex-start',
                padding: '14px 16px',
                background: 'var(--bg-surface-subtle, rgba(255, 255, 255, 0.02))',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* Left Column: Dimensions (L, W, H) in cm + Real-time volume badges */}
              <div className="add-item-col-dimensions">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Ruler size={13} style={{ color: 'var(--brand-primary)' }} />
                  <span>Dimensions (cm)</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      placeholder="Length"
                      className="form-input mono"
                      style={{ fontSize: '0.82rem' }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px' }}>L (cm)</div>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      placeholder="Width"
                      className="form-input mono"
                      style={{ fontSize: '0.82rem' }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px' }}>W (cm)</div>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="Height"
                      className="form-input mono"
                      style={{ fontSize: '0.82rem' }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px' }}>H (cm)</div>
                  </div>
                </div>

                {/* Live Volume & Volumetric Wt Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      background: formVol.hasDimensions ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface)',
                      border: formVol.hasDimensions ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                      color: formVol.hasDimensions ? '#10B981' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Box size={11} />
                    <span>{formVol.volumeCm3 ? `${formVol.volumeCm3} cm³ (${formVol.volumeLiters} L)` : 'Volume: —'}</span>
                  </span>

                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      background: formVol.hasDimensions ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-surface)',
                      border: formVol.hasDimensions ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
                      color: formVol.hasDimensions ? '#F59E0B' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Scale size={11} />
                    <span>{formVol.volumetricWeightKg ? `Volumetric: ${formVol.volumetricWeightKg} kg` : 'Volumetric: —'}</span>
                  </span>
                </div>
              </div>

              {/* Right Column: Description */}
              <div className="add-item-col-description">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                    <FileText size={13} style={{ color: 'var(--brand-primary)' }} />
                    <span>Product Description / Notes</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {description.length}/500
                  </span>
                </div>
                <textarea
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter product specifications, material, notes, or features (max 500 chars)..."
                  className="form-input"
                  rows={2}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '0.82rem',
                    lineHeight: '1.4',
                    resize: 'vertical',
                    minHeight: '68px',
                  }}
                />
              </div>
            </div>
          );
        })()}

        {/* Profit Margin Helper */}
        {cost > 0 && sell > 0 && (
          <div
            style={{
              padding: '8px 14px',
              background: marginAmt >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${marginAmt >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={15} style={{ color: marginAmt >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }} />
              <span>
                Unit Margin: <strong>₹{marginAmt.toFixed(2)}</strong> ({marginPct}%)
              </span>
            </div>
            {mrp && parseFloat(mrp) > sell && (
              <span style={{ color: 'var(--text-muted)' }}>
                Discount off MRP: {(((parseFloat(mrp) - sell) / parseFloat(mrp)) * 100).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {/* Action Buttons: Reset Form | Scan Bill (AI) | Import from CSV | Add to List | Add Product */}
        <div
          className="add-item-actions-bar"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '16px',
            flexWrap: 'wrap',
          }}
        >
          <button type="button" onClick={handleResetForm} className="btn btn-secondary">
            Reset Form
          </button>

          <button
            type="button"
            onClick={() => setIsScanBillOpen(true)}
            className="btn btn-secondary"
            style={{
              fontWeight: 700,
              padding: '10px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#EC4899',
              color: '#F472B6',
              background: 'rgba(236, 72, 153, 0.08)',
            }}
          >
            <Sparkles size={16} />
            <span>Scan Bill (AI)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportCsvOpen(true)}
            className="btn btn-secondary"
            style={{
              fontWeight: 700,
              padding: '10px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'var(--color-success)',
              color: 'var(--color-success)',
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Import from CSV</span>
          </button>

          <button
            type="button"
            onClick={handleAddToList}
            className="btn btn-secondary"
            style={{
              fontWeight: 700,
              padding: '10px 20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'var(--brand-primary)',
              color: 'var(--brand-primary)',
            }}
          >
            <ListPlus size={16} />
            <span>Add to List</span>
          </button>

          <button
            type="button"
            onClick={handleAddSingleProduct}
            disabled={loading || batchSubmitting}
            className="btn btn-primary"
            style={{
              fontWeight: 700,
              padding: '10px 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Registering...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Add Product</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* STAGED PRODUCTS QUEUE (LOOKS AND FUNCTIONS EXACTLY LIKE MANAGE INVENTORY EDIT STATE) */}
      {stagedItems.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          {/* Header Card */}
          <div
            className="staged-header-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '0 4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--brand-ruby-glow)',
                  color: 'var(--brand-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.12rem', fontWeight: 800, margin: 0 }}>
                    Staged Products Queue ({stagedItems.length})
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
                    <span>Saved to Profile (@{currentUser?.username || 'Owner'})</span>
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Inline editable like Inventory Management. Problematic rows are sorted to top and highlighted.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsScanBillOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '0.76rem',
                  color: '#F472B6',
                  borderColor: 'rgba(236, 72, 153, 0.4)',
                  background: 'rgba(236, 72, 153, 0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={13} />
                <span>Scan Bill (AI)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsImportCsvOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--color-success)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FileSpreadsheet size={13} />
                <span>Import CSV</span>
              </button>

              <button
                type="button"
                onClick={handleAddAllProducts}
                disabled={totalErrorRows > 0 || batchSubmitting}
                className="btn btn-primary btn-sm"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  padding: '6px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: totalErrorRows > 0 ? 0.65 : 1,
                  cursor: totalErrorRows > 0 ? 'not-allowed' : 'pointer',
                  boxShadow: totalErrorRows === 0 ? '0 2px 10px var(--brand-ruby-glow)' : 'none',
                }}
                title={totalErrorRows > 0 ? `Fix ${totalErrorRows} error row(s) before saving` : `Save all ${stagedItems.length} products into inventory`}
              >
                {batchSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Save All ({stagedItems.length})</span>
                  </>
                )}
              </button>

              {selectedStagedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedStaged}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.76rem',
                    color: 'var(--color-danger)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    background: 'var(--color-danger-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Trash2 size={13} />
                  <span>Delete Selected ({selectedStagedIds.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClearStagedList}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.76rem', color: 'var(--color-danger)' }}
              >
                Clear List
              </button>
            </div>
          </div>

          {/* Batch Quick-Assign Bar for Supplier and Subcategories */}
          <div
            className="staged-quick-assign-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              padding: '8px 14px',
              background: 'var(--bg-surface-hover)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Batch Set {selectedStagedIds.length > 0 ? `(${selectedStagedIds.length} Selected)` : `(All ${stagedItems.length})`}:
            </span>

            {/* Batch Supplier Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={13} style={{ color: 'var(--brand-primary)' }} />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value !== undefined) {
                    handleBatchAssignSupplier(e.target.value);
                  }
                }}
                className="form-input"
                style={{ height: '30px', fontSize: '0.76rem', padding: '0 8px', minWidth: '170px' }}
              >
                <option value="">Set Supplier for {selectedStagedIds.length > 0 ? 'Selected' : 'All'}...</option>
                <option value="">-- Remove Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Subcategory Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={13} style={{ color: '#06B6D4' }} />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBatchAssignSubcategory(e.target.value);
                  }
                }}
                className="form-input"
                style={{ height: '30px', fontSize: '0.76rem', padding: '0 8px', minWidth: '170px' }}
              >
                <option value="">Add Subcategory to {selectedStagedIds.length > 0 ? 'Selected' : 'All'}...</option>
                {subcategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name} ({sc.category_name || 'Category'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Validation Error Alert Banner if any row has invalid fields */}
          {totalErrorRows > 0 && (
            <div
              style={{
                padding: '14px 18px',
                marginBottom: '14px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                    {totalErrorRows} Problematic Product Row{totalErrorRows > 1 ? 's' : ''} Detected ({totalErrorCount} Total Error{totalErrorCount > 1 ? 's' : ''})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Rows with issues have been sorted to the top with red highlighted inputs. Please fix all errors directly in the table to unlock saving.
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                Saving Locked
              </div>
            </div>
          )}

          {/* Low Confidence AI Warning Banner */}
          {totalWarningRows > 0 && totalErrorRows === 0 && (
            <div
              style={{
                padding: '12px 18px',
                marginBottom: '14px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#FCD34D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#FBBF24' }}>
                    {totalWarningRows} Item(s) with Low AI Visual Certainty
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Fields with smudged or ambiguous handwriting are highlighted in yellow. Click the tick mark (<strong style={{ color: 'var(--color-success)' }}>✓</strong>) or edit any field to confirm it and dismiss the review.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmAllAiWarnings}
                className="btn btn-sm"
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#FBBF24',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Confirm all low certainty AI values as correct"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Confirm All AI Items</span>
              </button>
            </div>
          )}

          {/* Batch In-Progress Banner */}
          {batchProgress && (
            <div
              style={{
                padding: '12px 18px',
                marginBottom: '14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-ruby-glow)',
                border: '1px solid rgba(218, 41, 28, 0.3)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.86rem',
                fontWeight: 700,
              }}
            >
              <Loader2 size={18} className="animate-spin" />
              <span>
                Registering product {batchProgress.current} of {batchProgress.total}: &quot;{batchProgress.name}&quot;...
              </span>
            </div>
          )}

          {/* Table Container in Edit Mode Styling */}
          <div
            className="glass-panel"
            style={{
              position: 'relative',
              zIndex: 1,
              overflow: 'hidden',
              padding: 0,
              borderRadius: 'var(--radius-lg)',
              border: totalErrorRows > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-subtle)',
              marginBottom: '16px',
            }}
          >
            <div className="staged-table-scroll" style={{ overflowX: 'auto', borderRadius: 'inherit' }}>
              <table className="staged-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <th style={{ padding: '10px 8px', width: '32px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedStagedIds.length === stagedItems.length && stagedItems.length > 0}
                        onChange={toggleSelectAllStaged}
                        style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                        title="Select All"
                      />
                    </th>
                    <th style={{ padding: '10px 8px', width: '74px', minWidth: '74px', textAlign: 'center' }}>Photo</th>
                    <th style={{ padding: '10px 10px', minWidth: '160px' }}>Product Details</th>
                    <th style={{ padding: '10px 8px', minWidth: '110px' }}>Subcategories</th>
                    <th style={{ padding: '10px 8px', width: isManualUidEnabled ? '135px' : '95px', minWidth: '95px' }}>
                      {isManualUidEnabled ? 'UID (Editable)' : 'UID / Status'}
                    </th>
                    <th style={{ padding: '10px 8px', width: '70px', minWidth: '70px' }}>Section</th>
                    <th style={{ padding: '10px 8px', width: '88px', minWidth: '88px' }}>Stock</th>
                    <th style={{ padding: '10px 8px', width: '68px', minWidth: '68px' }}>Cost</th>
                    <th style={{ padding: '10px 8px', width: '74px', minWidth: '74px' }}>Selling</th>
                    <th style={{ padding: '10px 8px', width: '68px', minWidth: '68px' }}>MRP</th>
                    <th style={{ padding: '10px 8px', width: '56px', minWidth: '56px' }}>Margin</th>
                    <th style={{ padding: '10px 8px', width: '58px', minWidth: '58px' }}>Weight</th>
                    <th style={{ padding: '10px 8px', width: '85px', minWidth: '85px' }}>Expiry</th>
                    <th style={{ padding: '10px 14px', width: '110px', minWidth: '110px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStagedItems.map((item, idx) => {
                    const marginPctVal = calculateMargin(item.costPrice, item.sellingPrice);
                    const isSelected = selectedStagedIds.includes(item.id);
                    const primaryThumb = item.imagePreviews?.[0] || null;
                    const volMetrics = calculateVolumeMetrics(item.length, item.width, item.height);

                    return (
                      <React.Fragment key={item.id}>
                      <tr
                        style={{
                          borderBottom: 'none',
                          background: item._hasErrors
                            ? 'rgba(239, 68, 68, 0.08)'
                            : item._hasWarnings
                            ? 'rgba(245, 158, 11, 0.06)'
                            : isSelected
                            ? 'rgba(218, 41, 28, 0.07)'
                            : 'transparent',
                          borderLeft: item._hasErrors
                            ? '3px solid var(--color-danger)'
                            : item._hasWarnings
                            ? '3px solid #F59E0B'
                            : '3px solid transparent',
                          transition: 'background 0.15s ease',
                          fontSize: '0.82rem',
                          cursor: 'default',
                        }}
                      >
                        {/* 1. Select Checkbox (spans both rows) */}
                        <td
                          rowSpan={2}
                          style={{
                            padding: '8px 4px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            width: '32px',
                            minWidth: '32px',
                            borderBottom: '6px solid var(--border-subtle)',
                            background: item._hasErrors
                              ? 'rgba(239, 68, 68, 0.08)'
                              : item._hasWarnings
                              ? 'rgba(245, 158, 11, 0.06)'
                              : isSelected
                              ? 'rgba(218, 41, 28, 0.07)'
                              : 'transparent',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectStagedItem(item.id)}
                            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                          />
                        </td>

                        {/* 2. Photo Thumbnail (spans both rows, opens photo modal) */}
                        <td
                          rowSpan={2}
                          style={{
                            padding: '8px 8px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            width: '74px',
                            minWidth: '74px',
                            borderBottom: '6px solid var(--border-subtle)',
                            background: item._hasErrors
                              ? 'rgba(239, 68, 68, 0.08)'
                              : item._hasWarnings
                              ? 'rgba(245, 158, 11, 0.06)'
                              : isSelected
                              ? 'rgba(218, 41, 28, 0.07)'
                              : 'transparent',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            onClick={() => setActivePhotoModalStagedItem(item)}
                            style={{
                              width: '58px',
                              height: '58px',
                              borderRadius: 'var(--radius-sm)',
                              overflow: 'hidden',
                              background: 'var(--bg-surface-hover)',
                              border: '1px dashed var(--brand-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'all 0.15s ease',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                              margin: '0 auto',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.08)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
                            }}
                            title="Click to manage photos (Drag & Drop / Camera)"
                          >
                            {primaryThumb ? (
                              <>
                                <img
                                  src={primaryThumb}
                                  alt={item.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                {item.imagePreviews && item.imagePreviews.length > 1 && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      bottom: '1px',
                                      right: '1px',
                                      background: 'rgba(0,0,0,0.75)',
                                      color: '#fff',
                                      fontSize: '0.58rem',
                                      padding: '0 2px',
                                      borderRadius: '2px',
                                      fontWeight: 700,
                                    }}
                                  >
                                    +{item.imagePreviews.length - 1}
                                  </span>
                                )}
                              </>
                            ) : (
                              <ImageIcon
                                size={22}
                                style={{
                                  color: 'var(--brand-primary)',
                                  opacity: 0.9,
                                }}
                              />
                            )}
                          </div>
                        </td>

                        {/* 3. Product Details (Editable Name) */}
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateStagedField(item.id, 'name', e.target.value)}
                            placeholder="Product Name *"
                            className="form-input"
                            style={{
                              height: '28px',
                              fontSize: '0.82rem',
                              padding: '2px 8px',
                              width: '100%',
                              borderColor: item._errors?.name
                                ? 'var(--color-danger)'
                                : item._warningsMap?.name
                                ? '#F59E0B'
                                : undefined,
                              background: item._errors?.name
                                ? 'rgba(239, 68, 68, 0.12)'
                                : item._warningsMap?.name
                                ? 'rgba(245, 158, 11, 0.14)'
                                : undefined,
                              color: item._errors?.name
                                ? 'var(--color-danger)'
                                : item._warningsMap?.name
                                ? '#FCD34D'
                                : undefined,
                            }}
                            title={item._errors?.name || item._warningsMap?.name || ''}
                            required
                          />
                        </td>

                        {/* 4. Subcategories */}
                        <td style={{ padding: '8px 8px', maxWidth: '150px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTableSubcatPickerAnchor({
                                itemId: item.id,
                                anchorRect: rect,
                              });
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              width: '100%',
                              justifyContent: 'space-between',
                              height: '28px',
                            }}
                          >
                            <span>{item.subcategories?.length || 0} subcat(s)</span>
                            <span>▾</span>
                          </button>
                        </td>



                        {/* 5. UID / Status */}
                        <td style={{ padding: '8px 8px', minWidth: isManualUidEnabled ? '135px' : '90px', whiteSpace: 'nowrap' }}>
                          {isManualUidEnabled ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={item.uid || ''}
                                  onChange={(e) => handleUpdateStagedField(item.id, 'uid', e.target.value)}
                                  placeholder={`Auto (#${idx + 1})`}
                                  className="form-input mono"
                                  style={{
                                    height: '28px',
                                    fontSize: '0.78rem',
                                    padding: '2px 6px',
                                    width: '100%',
                                    fontWeight: 600,
                                    borderColor: item._errors?.uid
                                      ? 'var(--color-danger)'
                                      : (item.uid && !checkingUids[String(item.uid).trim().toLowerCase()] && existingUidMap[String(item.uid).trim().toLowerCase()]?.exists === false)
                                      ? 'rgba(16, 185, 129, 0.5)'
                                      : undefined,
                                    background: item._errors?.uid
                                      ? 'rgba(239, 68, 68, 0.12)'
                                      : (item.uid && !checkingUids[String(item.uid).trim().toLowerCase()] && existingUidMap[String(item.uid).trim().toLowerCase()]?.exists === false)
                                      ? 'rgba(16, 185, 129, 0.06)'
                                      : undefined,
                                    color: item._errors?.uid
                                      ? 'var(--color-danger)'
                                      : (item.uid && !checkingUids[String(item.uid).trim().toLowerCase()] && existingUidMap[String(item.uid).trim().toLowerCase()]?.exists === false)
                                      ? 'var(--color-success)'
                                      : undefined,
                                  }}
                                  title={item._errors?.uid || (item.uid ? `Custom UID: ${item.uid}` : 'Leave blank for auto-generated sequential UID')}
                                />
                                {item.uid && checkingUids[String(item.uid).trim().toLowerCase()] && (
                                  <Loader2
                                    size={11}
                                    className="animate-spin"
                                    style={{ position: 'absolute', right: '6px', color: 'var(--text-muted)' }}
                                  />
                                )}
                              </div>

                              {item._errors?.uid ? (
                                <span
                                  style={{
                                    fontSize: '0.64rem',
                                    fontWeight: 700,
                                    color: 'var(--color-danger)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '135px',
                                  }}
                                  title={item._errors.uid}
                                >
                                  {item._errors.uid.includes('already exists') ? 'Exists in DB' : 'Duplicate in queue'}
                                </span>
                              ) : item._hasWarnings ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <span
                                    style={{
                                      fontSize: '0.64rem',
                                      fontWeight: 700,
                                      color: '#FCD34D',
                                    }}
                                  >
                                    AI Verify ({item._warningCount})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConfirmRowAi(item.id);
                                    }}
                                    style={{
                                      background: 'rgba(16, 185, 129, 0.2)',
                                      border: '1px solid rgba(16, 185, 129, 0.45)',
                                      color: 'var(--color-success)',
                                      borderRadius: '2px',
                                      padding: '0 2px',
                                      cursor: 'pointer',
                                      fontSize: '0.62rem',
                                      fontWeight: 800,
                                    }}
                                    title="Confirm AI values"
                                  >
                                    ✓
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            item._hasErrors ? (
                              <span
                                className="mono"
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  padding: '2px 6px',
                                  background: 'var(--color-danger-bg)',
                                  borderRadius: 'var(--radius-xs)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  color: 'var(--color-danger)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                                title={Object.values(item._errors).join('; ')}
                              >
                                <AlertCircle size={11} />
                                <span>{item._errorCount} Error{item._errorCount > 1 ? 's' : ''}</span>
                              </span>
                            ) : item._hasWarnings ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span
                                  className="mono"
                                  style={{
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    padding: '2px 6px',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    borderRadius: 'var(--radius-xs)',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    color: '#FCD34D',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                  title={Object.values(item._warningsMap).join('; ')}
                                >
                                  <Sparkles size={11} style={{ color: '#F59E0B' }} />
                                  <span>AI Verify ({item._warningCount})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmRowAi(item.id);
                                  }}
                                  className="btn btn-icon btn-sm"
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    minWidth: '22px',
                                    padding: 0,
                                    background: 'rgba(16, 185, 129, 0.18)',
                                    border: '1px solid rgba(16, 185, 129, 0.45)',
                                    color: 'var(--color-success)',
                                    borderRadius: 'var(--radius-xs)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title="Click tick mark to confirm AI values are correct (removes AI review)"
                                >
                                  <Check size={12} strokeWidth={3} />
                                </button>
                              </div>
                            ) : item.isAiExtracted ? (
                              <span
                                className="mono"
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  padding: '2px 6px',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  borderRadius: 'var(--radius-xs)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  color: 'var(--color-success)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <CheckCircle2 size={11} />
                                <span>AI Clean</span>
                              </span>
                            ) : (
                              <span
                                className="mono"
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.74rem',
                                  padding: '2px 6px',
                                  background: 'var(--bg-surface)',
                                  borderRadius: 'var(--radius-xs)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--brand-primary)',
                                }}
                              >
                                DRAFT #{idx + 1}
                              </span>
                            )
                          )}
                        </td>

                        {/* 6. Section */}
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <select
                            value={isSectionRestricted && currentUser?.section ? String(currentUser.section) : (item.sectionId || '')}
                            onChange={(e) => !isSectionRestricted && handleUpdateStagedField(item.id, 'sectionId', e.target.value)}
                            disabled={isSectionRestricted}
                            className="form-select"
                            style={{
                              height: '28px',
                              fontSize: '0.78rem',
                              padding: '2px 6px',
                              minWidth: '95px',
                              opacity: isSectionRestricted ? 0.85 : 1,
                              cursor: isSectionRestricted ? 'not-allowed' : 'default',
                            }}
                          >
                            <option value="">No Section</option>
                            {sections.map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                {sec.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 7. Stock Quantity */}
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <input
                            type="text"
                            value={item.initialQuantity !== undefined ? item.initialQuantity : '0'}
                            onChange={(e) => handleUpdateStagedField(item.id, 'initialQuantity', e.target.value)}
                            className="form-input mono font-bold"
                            style={{
                              height: '28px',
                              fontSize: '0.8rem',
                              padding: '2px 4px',
                              width: '65px',
                              borderColor: item._errors?.initialQuantity
                                ? 'var(--color-danger)'
                                : item._warningsMap?.initialQuantity
                                ? '#F59E0B'
                                : undefined,
                              background: item._errors?.initialQuantity
                                ? 'rgba(239, 68, 68, 0.12)'
                                : item._warningsMap?.initialQuantity
                                ? 'rgba(245, 158, 11, 0.14)'
                                : undefined,
                              color: item._errors?.initialQuantity
                                ? 'var(--color-danger)'
                                : item._warningsMap?.initialQuantity
                                ? '#FCD34D'
                                : undefined,
                            }}
                            title={item._errors?.initialQuantity || item._warningsMap?.initialQuantity || ''}
                            required
                          />
                        </td>

                        {/* 8. Cost Price */}
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', color: item._errors?.costPrice ? 'var(--color-danger)' : 'var(--text-muted)' }}>₹</span>
                            <input
                              type="text"
                              value={item.costPrice !== undefined ? item.costPrice : ''}
                              onChange={(e) => handleUpdateStagedField(item.id, 'costPrice', e.target.value)}
                              className="form-input mono"
                              style={{
                                height: '28px',
                                fontSize: '0.8rem',
                                padding: '2px 4px',
                                width: '70px',
                                borderColor: item._errors?.costPrice
                                  ? 'var(--color-danger)'
                                  : item._warningsMap?.costPrice
                                  ? '#F59E0B'
                                  : undefined,
                                background: item._errors?.costPrice
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : item._warningsMap?.costPrice
                                  ? 'rgba(245, 158, 11, 0.14)'
                                  : undefined,
                                color: item._errors?.costPrice
                                  ? 'var(--color-danger)'
                                  : item._warningsMap?.costPrice
                                  ? '#FCD34D'
                                  : undefined,
                              }}
                              title={item._errors?.costPrice || item._warningsMap?.costPrice || ''}
                              required
                            />
                          </div>
                        </td>

                        {/* 9. Selling Price */}
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', color: item._errors?.sellingPrice ? 'var(--color-danger)' : 'var(--text-muted)' }}>₹</span>
                            <input
                              type="text"
                              value={item.sellingPrice !== undefined ? item.sellingPrice : ''}
                              onChange={(e) => handleUpdateStagedField(item.id, 'sellingPrice', e.target.value)}
                              className="form-input mono font-bold"
                              style={{
                                height: '28px',
                                fontSize: '0.82rem',
                                padding: '2px 4px',
                                width: '75px',
                                borderColor: item._errors?.sellingPrice
                                  ? 'var(--color-danger)'
                                  : item._warningsMap?.sellingPrice
                                  ? '#F59E0B'
                                  : undefined,
                                background: item._errors?.sellingPrice
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : item._warningsMap?.sellingPrice
                                  ? 'rgba(245, 158, 11, 0.14)'
                                  : undefined,
                                color: item._errors?.sellingPrice
                                  ? 'var(--color-danger)'
                                  : item._warningsMap?.sellingPrice
                                  ? '#FCD34D'
                                  : undefined,
                              }}
                              title={item._errors?.sellingPrice || item._warningsMap?.sellingPrice || ''}
                              required
                            />
                          </div>
                        </td>

                        {/* 10. MRP */}
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', color: item._errors?.mrp ? 'var(--color-danger)' : 'var(--text-muted)' }}>₹</span>
                            <input
                              type="text"
                              value={item.mrp || ''}
                              placeholder="Auto"
                              onChange={(e) => handleUpdateStagedField(item.id, 'mrp', e.target.value)}
                              className="form-input mono"
                              style={{
                                height: '28px',
                                fontSize: '0.78rem',
                                padding: '2px 4px',
                                width: '70px',
                                borderColor: item._errors?.mrp
                                  ? 'var(--color-danger)'
                                  : item._warningsMap?.mrp
                                  ? '#F59E0B'
                                  : undefined,
                                background: item._errors?.mrp
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : item._warningsMap?.mrp
                                  ? 'rgba(245, 158, 11, 0.14)'
                                  : undefined,
                                color: item._errors?.mrp
                                  ? 'var(--color-danger)'
                                  : item._warningsMap?.mrp
                                  ? '#FCD34D'
                                  : undefined,
                              }}
                              title={item._errors?.mrp || item._warningsMap?.mrp || ''}
                            />
                          </div>
                        </td>

                        {/* 11. Margin % (Computed Live) */}
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          {marginPctVal !== null ? (
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: parseFloat(marginPctVal) >= 30 ? '#10B981' : parseFloat(marginPctVal) > 0 ? '#F59E0B' : 'var(--color-danger)',
                              }}
                            >
                              {marginPctVal}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                          )}
                        </td>

                        {/* 12. Weight */}
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <input
                            type="text"
                            value={item.weight || ''}
                            placeholder="g"
                            onChange={(e) => handleUpdateStagedField(item.id, 'weight', e.target.value)}
                            className="form-input"
                            style={{
                              height: '28px',
                              fontSize: '0.76rem',
                              padding: '2px 4px',
                              width: '58px',
                              borderColor: item._errors?.weight ? 'var(--color-danger)' : undefined,
                              background: item._errors?.weight ? 'rgba(239, 68, 68, 0.12)' : undefined,
                              color: item._errors?.weight ? 'var(--color-danger)' : undefined,
                            }}
                            title={item._errors?.weight || ''}
                          />
                        </td>

                        {/* 13. Expiry */}
                        <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <input
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={(e) => handleUpdateStagedField(item.id, 'expiryDate', e.target.value)}
                            className="form-input mono"
                            style={{
                              height: '28px',
                              fontSize: '0.72rem',
                              padding: '2px 3px',
                              width: '105px',
                              borderColor: item._errors?.expiryDate ? 'var(--color-danger)' : undefined,
                              background: item._errors?.expiryDate ? 'rgba(239, 68, 68, 0.12)' : undefined,
                            }}
                            title={item._errors?.expiryDate || ''}
                          />
                        </td>

                        {/* 14. Actions */}
                        <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                            {item._hasWarnings && (
                              <button
                                type="button"
                                onClick={() => handleConfirmRowAi(item.id)}
                                className="btn btn-secondary btn-icon"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  color: 'var(--color-success)',
                                  borderColor: 'rgba(16, 185, 129, 0.4)',
                                  background: 'rgba(16, 185, 129, 0.14)',
                                }}
                                title="Confirm AI values are correct (removes AI review)"
                              >
                                <Check size={13} strokeWidth={2.5} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveStagedItem(item.id)}
                              className="btn btn-secondary btn-icon"
                              style={{ width: '28px', height: '28px', color: 'var(--color-danger)' }}
                              title="Remove from list"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* LINE 2: Dimensions, Volume, Volumetric Weight, Supplier & Description Sub-Row */}
                      <tr
                        style={{
                          borderBottom: '6px solid var(--border-subtle)',
                          borderLeft: item._hasErrors
                            ? '3px solid var(--color-danger)'
                            : item._hasWarnings
                            ? '3px solid #F59E0B'
                            : '3px solid transparent',
                          background: item._hasErrors
                            ? 'rgba(239, 68, 68, 0.05)'
                            : item._hasWarnings
                            ? 'rgba(245, 158, 11, 0.04)'
                            : isSelected
                            ? 'rgba(218, 41, 28, 0.05)'
                            : 'var(--bg-surface-subtle, rgba(255, 255, 255, 0.015))',
                          fontSize: '0.8rem',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td
                          colSpan={12}
                          style={{
                            padding: '4px 14px 14px 10px',
                            verticalAlign: 'middle',
                            maxWidth: 0,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              flexWrap: 'wrap',
                              width: '100%',
                              minHeight: '34px',
                            }}
                          >
                            {/* Dimensions Inline Inputs */}
                            <div
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
                                value={item.length ?? ''}
                                onChange={(e) => handleUpdateStagedField(item.id, 'length', e.target.value)}
                                placeholder="cm"
                                className="form-input mono"
                                style={{ height: '26px', fontSize: '0.78rem', padding: '1px 6px', width: '54px' }}
                              />
                              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem' }}>× W:</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={item.width ?? ''}
                                onChange={(e) => handleUpdateStagedField(item.id, 'width', e.target.value)}
                                placeholder="cm"
                                className="form-input mono"
                                style={{ height: '26px', fontSize: '0.78rem', padding: '1px 6px', width: '54px' }}
                              />
                              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem' }}>× H:</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={item.height ?? ''}
                                onChange={(e) => handleUpdateStagedField(item.id, 'height', e.target.value)}
                                placeholder="cm"
                                className="form-input mono"
                                style={{ height: '26px', fontSize: '0.78rem', padding: '1px 6px', width: '54px' }}
                              />
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>cm</span>
                            </div>

                            {/* Calculated Physical Volume Badge */}
                            <div
                              className="badge"
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
                              className="badge"
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

                            {/* Supplier Inline Selector */}
                            <div
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
                                value={item.supplierId || ''}
                                onChange={(e) => handleUpdateStagedField(item.id, 'supplierId', e.target.value)}
                                className="form-select"
                                style={{ height: '26px', fontSize: '0.78rem', padding: '0 6px', minWidth: '130px', maxWidth: '180px' }}
                                title={item.supplierName ? `Supplier: ${item.supplierName}` : 'Assign supplier'}
                              >
                                <option value="">No Supplier</option>
                                {suppliers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Description Inline Field */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 240px', minWidth: 0 }}>
                              <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <input
                                type="text"
                                maxLength={500}
                                value={item.description || ''}
                                onChange={(e) => handleUpdateStagedField(item.id, 'description', e.target.value)}
                                placeholder="Product description / notes (max 500 chars)..."
                                className="form-input"
                                style={{ height: '32px', fontSize: '0.82rem', padding: '4px 12px', width: '100%' }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staged Summary & ADD ALL Button (Sticky Floating Bar) */}
          <div
            style={{
              position: 'sticky',
              bottom: '16px',
              zIndex: 30,
              padding: '14px 22px',
              background: 'var(--bg-card)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.28)',
            }}
          >
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Products
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{stagedItems.length}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Stock Units
                </span>
                <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                  {totalStagedUnits}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Cost Value
                </span>
                <div className="mono font-bold" style={{ fontSize: '1.05rem', color: 'var(--brand-primary)' }}>
                  ₹{totalStagedCost.toFixed(2)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddAllProducts}
              disabled={totalErrorRows > 0 || batchSubmitting}
              className="btn btn-primary"
              style={{
                fontWeight: 800,
                fontSize: '0.92rem',
                padding: '12px 28px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                opacity: totalErrorRows > 0 ? 0.65 : 1,
                cursor: totalErrorRows > 0 ? 'not-allowed' : 'pointer',
                boxShadow: totalErrorRows === 0 ? '0 4px 14px var(--brand-ruby-glow)' : 'none',
              }}
            >
              {batchSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Registering All Products...</span>
                </>
              ) : totalErrorRows > 0 ? (
                <>
                  <AlertCircle size={18} />
                  <span>Fix {totalErrorRows} Row Error{totalErrorRows > 1 ? 's' : ''} to Save All</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Add All ({stagedItems.length}) Products</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TOP FORM PHOTO MODAL */}
      {isPhotoModalOpen && (
        <ItemImageModal
          item={{ name: name.trim() || 'New Product Photos', uid: 'DRAFT' }}
          isDraftMode={true}
          draftImages={imageFiles.map((file, idx) => ({
            id: `draft_${idx}`,
            file,
            image_url: imagePreviews[idx],
            is_primary: idx === 0,
          }))}
          onClose={() => setIsPhotoModalOpen(false)}
          onSaveDraft={(files, previews) => {
            setImageFiles(files);
            setImagePreviews(previews);
          }}
        />
      )}

      {/* TABLE ROW PHOTO MODAL (for clicked row in Staged Table) */}
      {activePhotoModalStagedItem && (
        <ItemImageModal
          item={{ name: activePhotoModalStagedItem.name || 'Staged Product Photos', uid: 'STAGED' }}
          isDraftMode={true}
          draftImages={
            (activePhotoModalStagedItem.storedImages && activePhotoModalStagedItem.storedImages.length > 0)
              ? activePhotoModalStagedItem.storedImages.map((img, idx) => ({
                  id: `staged_img_${idx}`,
                  image_url: img.dataUrl,
                  is_primary: idx === 0,
                }))
              : (activePhotoModalStagedItem.imagePreviews || []).map((url, idx) => ({
                  id: `staged_img_${idx}`,
                  image_url: url,
                  is_primary: idx === 0,
                }))
          }
          onClose={() => setActivePhotoModalStagedItem(null)}
          onSaveDraft={(files, previews) => {
            handleSaveRowPhotos(files, previews);
          }}
        />
      )}

      {/* STAGED TABLE SUBCATEGORY PICKER POPOVER */}
      <SubcategoryPickerPopover
        isOpen={Boolean(tableSubcatPickerAnchor)}
        anchorRect={tableSubcatPickerAnchor?.anchorRect}
        categories={categories}
        subcategories={subcategories}
        selectedIds={
          tableSubcatPickerAnchor
            ? (stagedItems.find((i) => i.id === tableSubcatPickerAnchor.itemId)?.subcategories || [])
            : []
        }
        onToggle={(subcatId) => {
          if (tableSubcatPickerAnchor) {
            toggleStagedSubcategory(tableSubcatPickerAnchor.itemId, subcatId);
          }
        }}
        onClear={() => {
          if (tableSubcatPickerAnchor) {
            setStagedItems((prev) =>
              prev.map((i) =>
                i.id === tableSubcatPickerAnchor.itemId
                  ? { ...i, subcategories: [], subcategoryObjects: [] }
                  : i
              )
            );
          }
        }}
        onClose={() => setTableSubcatPickerAnchor(null)}
      />

      {/* CSV IMPORT MODAL */}
      <ImportCsvModal
        isOpen={isImportCsvOpen}
        onClose={() => setIsImportCsvOpen(false)}
        onImportSuccess={handleImportCsvSuccess}
        categories={categories}
        subcategories={subcategories}
        suppliers={suppliers}
        sections={sections}
        effectiveStoreId={currentStoreObj?.id || effectiveStoreId}
        isManualUidEnabled={isManualUidEnabled}
        isSectionRestricted={isSectionRestricted}
        currentUser={currentUser}
      />

      {/* GEMINI AI BILL SCANNER MODAL */}
      <ScanBillModal
        isOpen={isScanBillOpen}
        onClose={() => setIsScanBillOpen(false)}
        onExtractSuccess={handleScanBillSuccess}
        subcategories={subcategories}
        suppliers={suppliers}
        effectiveStoreId={currentStoreObj?.id || effectiveStoreId}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
