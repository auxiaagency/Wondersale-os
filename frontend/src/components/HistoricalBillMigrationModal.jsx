import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Trash2,
  Database,
  Clock,
  ShieldCheck,
  Plus,
  Coins,
  CreditCard,
  QrCode,
  Banknote,
  PenTool,
  Combine,
  CheckSquare,
  Clipboard,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { parseHistoricalSheet, commitHistoricalBatch, fetchItems } from '../api';

export default function HistoricalBillMigrationModal({
  isOpen = false,
  onClose,
  store = null,
  currentUser = null,
  items = [], // Store inventory items for catalog search & remap
  onSuccess,
}) {
  // Modal active tab: 'ready' | 'rejected' | 'manual'
  const [activeTab, setActiveTab] = useState('ready');

  // Batch Configuration
  const [batchDatetime, setBatchDatetime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00`;
  });
  const [deductStock, setDeductStock] = useState(true); // Default to true: backward entries strictly deduct stock and prevent negative inventory
  const [sheetReference, setSheetReference] = useState('10/10/26 Kitchen Utility');

  // Custom AI Guidance / Prompt (Default instructions stay in background, input field is solely for user's additional context)
  const [showPromptBox, setShowPromptBox] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  // File & Camera Upload State - Supports single and multiple files (bulk upload)
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Parsing & Processing State
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [parseError, setParseError] = useState('');
  const [commitMessage, setCommitMessage] = useState(null);

  // Pre-OCR Multi-Page Split Bill Selection State (Uploaded files that form a single continuous bill)
  const [selectedFileIndices, setSelectedFileIndices] = useState([]);

  // Queues
  const [validBills, setValidBills] = useState([]);
  const [rejectedBills, setRejectedBills] = useState([]);
  const [usedModel, setUsedModel] = useState('');

  // Post-OCR Multi-Page Split Bill Merge Selection State
  const [selectedBillIndices, setSelectedBillIndices] = useState([]);

  // Interactive Anomaly Inspector Modal State
  const [inspectingBill, setInspectingBill] = useState(null);
  const [inspectorSearchQuery, setInspectorSearchQuery] = useState('');
  const [selectedLineForRemap, setSelectedLineForRemap] = useState(null);

  // Live Catalog and Real-Time Stock Validation State
  const [liveCatalogItems, setLiveCatalogItems] = useState(items || []);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [revalidationNotification, setRevalidationNotification] = useState(null);

  // Helper: Evaluates a list of bills against liveCatalogItems to check for stock deficits
  const checkBillsForStockDeficits = (billsToCheck, catalogList, shouldDeductStock = true) => {
    if (!Array.isArray(billsToCheck) || billsToCheck.length === 0) {
      return [];
    }

    const catMap = new Map();
    (catalogList || []).forEach((c) => {
      catMap.set(c.id, c);
      if (c.uid) catMap.set(String(c.uid).trim().toLowerCase(), c);
    });

    return billsToCheck.map((b) => {
      const deficits = [];
      const itemsList = Array.isArray(b.items) ? b.items : [];

      itemsList.forEach((it) => {
        if (!it.is_valid && !it.item_id) return;
        const catObj = catMap.get(it.item_id) || (it.item_uid ? catMap.get(String(it.item_uid).trim().toLowerCase()) : null);
        const avail = Math.max(0, parseInt(catObj?.quantity ?? it.available_stock ?? 0, 10));
        const req = parseInt(it.quantity, 10) || 1;

        if (req > avail) {
          deficits.push({
            item_id: it.item_id || catObj?.id,
            item_uid: it.item_uid || catObj?.uid,
            item_name: it.item_name || catObj?.name,
            available_stock: avail,
            requested_stock: req,
            shortfall: req - avail,
          });
        }
      });

      return {
        ...b,
        stock_deficits: deficits,
        has_stock_deficit: deficits.length > 0,
      };
    });
  };

  // Sync liveCatalogItems whenever items prop changes
  useEffect(() => {
    if (items && items.length > 0) {
      setLiveCatalogItems(items);
    }
  }, [items]);

  // When deductStock toggle changes, immediately re-check all queues
  useEffect(() => {
    if (!isOpen) return;
    setValidBills((prev) => checkBillsForStockDeficits(prev, liveCatalogItems, deductStock));
    setRejectedBills((prev) => checkBillsForStockDeficits(prev, liveCatalogItems, deductStock));
  }, [isOpen, deductStock, liveCatalogItems]);

  // Manual Bill Entry State
  const [manualPhone, setManualPhone] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('cash');
  const [manualItems, setManualItems] = useState([]);
  const [manualCatalogQuery, setManualCatalogQuery] = useState('');
  const [manualSelectedProduct, setManualSelectedProduct] = useState(null);
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualCustomRate, setManualCustomRate] = useState('');
  const [manualBillNotes, setManualBillNotes] = useState('');
  const [manualError, setManualError] = useState('');

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Listen for Clipboard Paste (Ctrl+V / Command+V) when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e) => {
      // Don't intercept paste if user is typing into text inputs, textareas, etc.
      const target = e.target;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        // If it's a file input, allow default
        if (target.type !== 'file') {
          // If clipboard actually has image files, we still want to grab them if text field is empty or user is pasting an image
          const clipboardItems = e.clipboardData?.items;
          const hasImage = clipboardItems && Array.from(clipboardItems).some((it) => it.type.startsWith('image/'));
          if (!hasImage) return;
        }
      }

      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const pastedImageFiles = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png';
            const file = new File(
              [blob],
              `clipboard_sheet_${Date.now()}_${i + 1}.${ext}`,
              { type: blob.type }
            );
            pastedImageFiles.push(file);
          }
        }
      }

      if (pastedImageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        handleFilesSelected(pastedImageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Camera helpers
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera error:', err);
      setIsCameraActive(false);
      setParseError('Unable to open camera. Please use file upload.');
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const file = new File([blob], `sheet_snapshot_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleFilesSelected([file]);
      stopCamera();
    }, 'image/jpeg', 0.95);
  };

  const handleFilesSelected = (incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    const filesArray = Array.from(incomingFiles);

    const validNewFiles = [];
    filesArray.forEach((file) => {
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      const isCsv = file.type === 'text/csv' || file.name?.toLowerCase().endsWith('.csv');
      const isImg = file.type?.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name || '');
      if (isPdf || isImg || isCsv) {
        validNewFiles.push(file);
      }
    });

    if (validNewFiles.length === 0) {
      setParseError('Please upload valid sheet image files (JPG, PNG, WebP), PDF documents, or CSV files.');
      return;
    }

    // Read previews for newly added files
    validNewFiles.forEach((file) => {
      const isCsv = file.type === 'text/csv' || file.name?.toLowerCase().endsWith('.csv');
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

      if (isCsv) {
        setFilePreviews((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            dataUrl: null,
            isPdf: false,
            isCsv: true,
          },
        ]);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreviews((prev) => [
            ...prev,
            {
              name: file.name,
              size: file.size,
              dataUrl: e.target.result,
              isPdf: isPdf,
              isCsv: false,
            },
          ]);
        };
        reader.readAsDataURL(file);
      }
    });

    setSelectedFiles((prev) => [...prev, ...validNewFiles]);
    setParseError('');
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
    setFilePreviews((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedFileIndices((prev) =>
      prev
        .filter((idx) => idx !== index)
        .map((idx) => (idx > index ? idx - 1 : idx))
    );
  };

  const handleClearAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setSelectedFileIndices([]);
    setParseError('');
  };

  const handleToggleSelectFile = (index) => {
    setSelectedFileIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSelectAllFiles = () => {
    if (selectedFileIndices.length === selectedFiles.length) {
      setSelectedFileIndices([]);
    } else {
      setSelectedFileIndices(selectedFiles.map((_, i) => i));
    }
  };

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Run AI Sheet Parsing
  const handleParseSheet = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setParseError('Please upload, drop, or snap a photo of the register sheet(s) first.');
      return;
    }

    setIsParsing(true);
    setParseError('');
    setCommitMessage(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => {
        formData.append('files', f);
      });
      // Also append first file as 'file' for backward-compatible fallback
      if (selectedFiles[0]) {
        formData.append('file', selectedFiles[0]);
      }
      if (store?.id) formData.append('store_id', store.id);

      // Construct effective custom prompt including multi-page split bill instructions if selected
      let effectiveCustomPrompt = (customPrompt || '').trim();
      if (selectedFileIndices.length >= 2) {
        const pageNames = selectedFileIndices.map((i) => `Page #${i + 1} (${selectedFiles[i]?.name || `File ${i + 1}`})`).join(' and ');
        const mergeDirectives = `[IMPORTANT MULTI-PAGE SPLIT BILL]: The attached files ${pageNames} are consecutive pages of ONE SINGLE customer bill that was split across multiple sheets/pages. Treat all items on these pages as ONE single continuous bill: concatenate all line items together into one single bill entry, do not split them into multiple bills, and calculate the overall total for the combined bill.`;
        effectiveCustomPrompt = effectiveCustomPrompt
          ? `${mergeDirectives}\n\nAdditional Operator Context: ${effectiveCustomPrompt}`
          : mergeDirectives;
      }

      if (effectiveCustomPrompt) formData.append('custom_prompt', effectiveCustomPrompt);

      const result = await parseHistoricalSheet(formData);

      const parsedValid = checkBillsForStockDeficits(result.valid_bills || [], liveCatalogItems, deductStock);
      const parsedRejected = checkBillsForStockDeficits(result.rejected_bills || [], liveCatalogItems, deductStock);

      setValidBills(parsedValid);
      setRejectedBills(parsedRejected);
      setUsedModel(result.used_model || 'Gemini Vision');

      if (parsedRejected.length > 0) {
        setActiveTab('rejected');
      } else {
        setActiveTab('ready');
      }
    } catch (err) {
      setParseError(err.message || 'Failed to extract bills from sheet.');
    } finally {
      setIsParsing(false);
    }
  };

  // Manual Entry Item Addition
  const handleAddManualItem = () => {
    if (!manualSelectedProduct) {
      setManualError('Please select a product from catalog.');
      return;
    }
    const qty = parseInt(manualQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setManualError('Please enter a valid quantity greater than 0.');
      return;
    }

    const availableStock = Math.max(0, parseInt(manualSelectedProduct.quantity, 10) || 0);
    if (qty > availableStock) {
      setManualError(`Cannot add ${qty} units: Only ${availableStock} units available in stock for "${manualSelectedProduct.name}". Stock cannot be negative. Please replenish inventory first.`);
      return;
    }

    const rate = manualCustomRate !== '' ? parseFloat(manualCustomRate) : parseFloat(manualSelectedProduct.selling_price || 0);
    if (isNaN(rate) || rate < 0) {
      setManualError('Please enter a valid rate/price.');
      return;
    }

    const newItem = {
      item_id: manualSelectedProduct.id,
      item_uid: manualSelectedProduct.uid,
      raw_code: manualSelectedProduct.uid,
      item_name: manualSelectedProduct.name,
      quantity: qty,
      unit_price: rate,
      total_price: Math.round(qty * rate * 100) / 100,
      catalog_selling_price: parseFloat(manualSelectedProduct.selling_price || 0),
      catalog_mrp: parseFloat(manualSelectedProduct.mrp || manualSelectedProduct.selling_price || 0),
      is_valid: true,
      error: null,
    };

    setManualItems((prev) => [...prev, newItem]);
    setManualSelectedProduct(null);
    setManualCatalogQuery('');
    setManualQuantity(1);
    setManualCustomRate('');
    setManualError('');
  };

  const handleRemoveManualItem = (index) => {
    setManualItems((prev) => prev.filter((_, idx) => idx !== index));
  };


  // Revalidate Stock Handler: Re-fetches the latest live inventory catalog from server and updates bills
  const handleRevalidateLiveStock = async () => {
    setIsRevalidating(true);
    setRevalidationNotification(null);
    try {
      const refreshedData = await fetchItems({
        store: store?.id || '',
        page_size: 2500,
      });

      const freshItems = Array.isArray(refreshedData)
        ? refreshedData
        : Array.isArray(refreshedData?.results)
        ? refreshedData.results
        : [];

      setLiveCatalogItems(freshItems);

      // Re-evaluate current valid bills
      setValidBills((prev) => checkBillsForStockDeficits(prev, freshItems, deductStock));

      // Re-evaluate rejected bills
      setRejectedBills((prev) => checkBillsForStockDeficits(prev, freshItems, deductStock));

      // Re-evaluate inspected bill if open
      if (inspectingBill) {
        const reCheckedInspected = checkBillsForStockDeficits([inspectingBill], freshItems, deductStock)[0];
        setInspectingBill(reCheckedInspected);
      }

      setRevalidationNotification({
        type: 'success',
        text: `Stock revalidated successfully against live inventory (${freshItems.length} products refreshed).`,
      });
      setTimeout(() => setRevalidationNotification(null), 4000);
    } catch (err) {
      setRevalidationNotification({
        type: 'error',
        text: `Failed to revalidate live stock: ${err.message || 'Network error'}`,
      });
      setTimeout(() => setRevalidationNotification(null), 5000);
    } finally {
      setIsRevalidating(false);
    }
  };


  const handleStageManualBill = () => {
    if (manualItems.length === 0) {
      setManualError('Add at least one item before staging this manual bill.');
      return;
    }

    const totalAmount = manualItems.reduce((acc, it) => acc + (it.total_price || 0), 0);
    const newBill = {
      bill_index: validBills.length + rejectedBills.length + 1,
      customer_phone: manualPhone.trim() || 'Walk-in',
      payment_method: manualPaymentMethod,
      items: manualItems,
      total_amount: Math.round(totalAmount * 100) / 100,
      is_valid: true,
      status: 'valid',
      rejection_reasons: [],
      notes: manualBillNotes.trim() || undefined,
    };

    const evaluatedBill = checkBillsForStockDeficits([newBill], liveCatalogItems, deductStock)[0];

    setValidBills((prev) => [...prev, evaluatedBill]);
    // Reset manual form
    setManualItems([]);
    setManualPhone('');
    setManualPaymentMethod('cash');
    setManualBillNotes('');
    setManualError('');
    setActiveTab('ready');
  };

  // Commit Verified Bills Batch
  const handleCommitBatch = async () => {
    if (validBills.length === 0) {
      alert('There are no verified bills ready to commit.');
      return;
    }

    // Client-side pre-flight check: backward inwarding strictly blocks committing items with stock deficits
    const billsWithDeficits = validBills.filter((b) => b.has_stock_deficit);
    if (billsWithDeficits.length > 0) {
      const deficitList = billsWithDeficits.flatMap((b) => b.stock_deficits || []);
      const sampleDeficits = deficitList.slice(0, 3).map((d) => `• ${d.item_name} (UID: ${d.item_uid}): ${d.available_stock} available, ${d.requested_stock} needed (Deficit: -${d.shortfall})`).join('\n');
      alert(
        `Cannot commit backward entry: Insufficient stock in inventory.\n\n` +
        `Deficit items found in Ready queue:\n${sampleDeficits}\n\n` +
        `Stock must always be 0 or a positive integer and cannot be sold without available inventory. Please replenish these products in inventory and click "Revalidate Stock".`
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to commit ${validBills.length} historical bill(s) for date ${batchDatetime}? This will record them into sales history.`)) {
      return;
    }

    setIsCommitting(true);
    setParseError('');
    try {
      const payload = {
        store_id: store?.id,
        batch_datetime: batchDatetime,
        deduct_inventory_stock: deductStock,
        sheet_reference: sheetReference,
        entry_source: 'sheet_photo_ocr',
        bills: validBills,
      };

      const res = await commitHistoricalBatch(payload);
      setCommitMessage({
        type: 'success',
        text: `Successfully committed ${res.total_bills_committed} past bill(s) totaling ₹${res.total_revenue_recorded.toLocaleString('en-IN')}.`,
      });
      setValidBills([]);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setParseError(err.message || 'Failed to commit historical batch.');
      // If server returned structured insufficient stock items, update bills and trigger re-check
      if (err.insufficient_stock_items && Array.isArray(err.insufficient_stock_items)) {
        setValidBills((prev) => checkBillsForStockDeficits(prev, liveCatalogItems, true));
      }
    } finally {
      setIsCommitting(false);
    }
  };

  // Anomaly Inspector Helpers
  const handleOpenInspector = (bill) => {
    setInspectingBill(JSON.parse(JSON.stringify(bill)));
    setSelectedLineForRemap(null);
    setInspectorSearchQuery('');
  };

  const handleRemapItem = (lineIndex, catalogItem) => {
    if (!inspectingBill) return;
    const updated = { ...inspectingBill };
    const line = updated.items[lineIndex];
    if (line) {
      line.item_id = catalogItem.id;
      line.item_uid = catalogItem.uid;
      line.item_name = catalogItem.name;
      line.catalog_selling_price = Number(catalogItem.selling_price);
      line.catalog_mrp = Number(catalogItem.mrp || catalogItem.selling_price);
      line.is_valid = true;
      line.error = null;
    }
    setInspectingBill(updated);
    setSelectedLineForRemap(null);
  };

  const handleRemoveLineItem = (lineIndex) => {
    if (!inspectingBill) return;
    const updated = { ...inspectingBill };
    updated.items.splice(lineIndex, 1);
    setInspectingBill(updated);
  };

  const handleRevalidateInspectedBill = () => {
    if (!inspectingBill) return;
    const allValid = inspectingBill.items.length > 0 && inspectingBill.items.every((it) => it.is_valid && it.item_id);
    if (!allValid) {
      alert('There are still unresolved anomalous items in this bill. Please resolve all items before moving to Valid queue.');
      return;
    }

    const newTotal = inspectingBill.items.reduce((sum, it) => sum + (Number(it.unit_price) * Number(it.quantity)), 0);
    const candidateBill = {
      ...inspectingBill,
      total_amount: Math.round(newTotal * 100) / 100,
      is_valid: true,
      status: 'valid',
      rejection_reasons: [],
      anomalous_indices: [],
    };

    const revalidatedBill = checkBillsForStockDeficits([candidateBill], liveCatalogItems, deductStock)[0];

    if (revalidatedBill.has_stock_deficit) {
      const deficitMsgs = revalidatedBill.stock_deficits.map((d) => `• ${d.item_name} (UID: ${d.item_uid}): ${d.available_stock} available, ${d.requested_stock} needed (Deficit: -${d.shortfall})`).join('\n');
      alert(
        `Cannot move bill to Ready queue: Insufficient stock in inventory:\n\n${deficitMsgs}\n\n` +
        `Items cannot be sold without available stock in inventory. Please replenish inventory and click "Revalidate Stock", or adjust the bill quantities.`
      );
      return;
    }

    setRejectedBills((prev) => prev.filter((b) => b.bill_index !== inspectingBill.bill_index));
    setValidBills((prev) => [...prev, revalidatedBill]);
    setInspectingBill(null);
    setActiveTab('ready');
  };

  const handleDiscardRejectedBill = (billIndex) => {
    if (!window.confirm(`Discard Bill #${billIndex}? It will not be imported.`)) return;
    setRejectedBills((prev) => prev.filter((b) => b.bill_index !== billIndex));
    setSelectedBillIndices((prev) => prev.filter((idx) => idx !== billIndex));
    if (inspectingBill && inspectingBill.bill_index === billIndex) {
      setInspectingBill(null);
    }
  };

  // Split-Bill Merge Selection Handlers
  const handleToggleSelectBill = (billIndex) => {
    setSelectedBillIndices((prev) =>
      prev.includes(billIndex) ? prev.filter((idx) => idx !== billIndex) : [...prev, billIndex]
    );
  };

  const handleSelectAllInTab = () => {
    const currentList = activeTab === 'ready' ? validBills : activeTab === 'rejected' ? rejectedBills : [];
    if (selectedBillIndices.length === currentList.length) {
      setSelectedBillIndices([]);
    } else {
      setSelectedBillIndices(currentList.map((b) => b.bill_index));
    }
  };

  const handleMergeSelectedBills = () => {
    if (selectedBillIndices.length < 2) {
      alert('Please select at least 2 pages/bills to merge into a single continuous customer bill.');
      return;
    }

    const currentList = activeTab === 'ready' ? validBills : rejectedBills;
    const targetsToMerge = currentList.filter((b) => selectedBillIndices.includes(b.bill_index));

    if (targetsToMerge.length < 2) {
      alert('Selected bills could not be found in the current queue.');
      return;
    }

    const firstBill = targetsToMerge[0];
    const customerPhone = targetsToMerge.find((b) => b.customer_phone && b.customer_phone !== 'Walk-in')?.customer_phone || firstBill.customer_phone || 'Walk-in';
    const paymentMethod = targetsToMerge.find((b) => b.payment_method && b.payment_method !== 'cash')?.payment_method || firstBill.payment_method || 'cash';

    // Combine all line items
    const combinedItems = [];
    targetsToMerge.forEach((b) => {
      if (Array.isArray(b.items)) {
        combinedItems.push(...b.items);
      }
    });

    const combinedTotal = combinedItems.reduce((acc, it) => acc + (Number(it.total_price) || (Number(it.unit_price || 0) * Number(it.quantity || 1))), 0);
    const combinedRejectionReasons = Array.from(new Set(targetsToMerge.flatMap((b) => b.rejection_reasons || [])));
    const allItemsValid = combinedItems.length > 0 && combinedItems.every((it) => it.is_valid && it.item_id);

    const mergedBill = {
      ...firstBill,
      bill_index: firstBill.bill_index,
      customer_phone: customerPhone,
      payment_method: paymentMethod,
      items: combinedItems,
      total_amount: Math.round(combinedTotal * 100) / 100,
      is_valid: allItemsValid,
      status: allItemsValid ? 'valid' : 'rejected',
      rejection_reasons: allItemsValid ? [] : combinedRejectionReasons,
      anomalous_indices: allItemsValid ? [] : combinedItems.map((it, idx) => (!it.is_valid ? idx : null)).filter((idx) => idx !== null),
      notes: `Merged from ${targetsToMerge.length} split bill pages (Bills #${targetsToMerge.map((b) => b.bill_index).join(', #')})`,
    };

    if (activeTab === 'ready') {
      setValidBills((prev) => [
        ...prev.filter((b) => !selectedBillIndices.includes(b.bill_index)),
        mergedBill,
      ]);
    } else {
      setRejectedBills((prev) => [
        ...prev.filter((b) => !selectedBillIndices.includes(b.bill_index)),
        mergedBill,
      ]);
    }

    setSelectedBillIndices([]);
    alert(`Successfully merged ${targetsToMerge.length} pages into single Bill #${mergedBill.bill_index} with ${combinedItems.length} items (Total: ₹${mergedBill.total_amount.toLocaleString('en-IN')})!`);
  };

  // Filter items for remap autocomplete
  const filteredCatalogItems = (liveCatalogItems || [])
    .filter((it) => {
      if (!inspectorSearchQuery) return true;
      const q = inspectorSearchQuery.toLowerCase();
      return (
        it.name?.toLowerCase().includes(q) ||
        it.uid?.toLowerCase().includes(q) ||
        it.legacy_uid?.toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  // Filter items for manual product search
  const manualFilteredProducts = (liveCatalogItems || [])
    .filter((it) => {
      if (!manualCatalogQuery.trim()) return false;
      const q = manualCatalogQuery.toLowerCase();
      return (
        it.name?.toLowerCase().includes(q) ||
        it.uid?.toLowerCase().includes(q) ||
        it.legacy_uid?.toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isParsing && !isCommitting) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl, 18px)',
          background: 'var(--bg-surface-solid, #141829)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55), 0 0 35px rgba(245, 158, 11, 0.1)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
          animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.12))',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F59E0B',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Historical Past Bills Inward
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#FBBF24',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={11} /> One-Time Inward Utility
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34D399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ShieldCheck size={11} /> Shift Drawer Protected
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Digitize handwritten register tally sheets with strict inventory catalog validation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isParsing || isCommitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={20} />
          </button>
        </div>

        {/* TOP CONFIGURATION STRIP */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
            padding: '14px 22px',
            background: 'rgba(0, 0, 0, 0.12)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          }}
        >
          {/* Batch Date & Time Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              <Calendar size={13} style={{ color: '#F59E0B' }} />
              <span>Batch Bill Date & Time (Applied to all)</span>
            </label>
            <input
              type="datetime-local"
              value={batchDatetime}
              onChange={(e) => setBatchDatetime(e.target.value)}
              className="form-input"
              style={{
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600,
                borderRadius: 'var(--radius-md, 10px)',
                background: 'var(--bg-input, #0F1322)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Sheet / Slip Reference */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              <FileText size={13} style={{ color: '#38BDF8' }} />
              <span>Sheet Note / Physical Ledger Reference</span>
            </label>
            <input
              type="text"
              value={sheetReference}
              onChange={(e) => setSheetReference(e.target.value)}
              placeholder="e.g. 10/10/26 Kitchen Utility Board #1"
              className="form-input"
              style={{
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-md, 10px)',
                background: 'var(--bg-input, #0F1322)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Inventory Stock Deduction Status */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'default',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={true}
                disabled={true}
                readOnly={true}
                style={{ width: '15px', height: '15px', accentColor: '#10B981', cursor: 'default' }}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Deduct Inventory Stock (Mandatory)
              </span>
            </label>
            <div style={{ paddingLeft: '23px' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34D399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'inline-block',
                }}
              >
                ✓ Enforced: Stock deduction strictly verified (stock cannot be negative)
              </span>
            </div>
          </div>
        </div>

        {/* MODAL BODY */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* UPLOAD & AI OCR SECTION */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg, 14px)',
              background: 'var(--bg-surface, rgba(20, 24, 41, 0.6))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: '#F59E0B' }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Step 1: Upload Sheet Photo, PDF, or CSV File
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPromptBox(!showPromptBox)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#F59E0B',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
              >
                <span>{showPromptBox ? 'Hide Custom Prompt' : 'Custom Guidance & Context Prompt'}</span>
                {showPromptBox ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Collapsible Prompt Context Box */}
            {showPromptBox && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 10px)',
                  background: 'var(--bg-input, #0F1322)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#FBBF24' }}>
                    Additional Context (Applies to both photos &amp; CSV files):
                  </span>
                  {customPrompt && (
                    <button
                      type="button"
                      onClick={() => setCustomPrompt('')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={2}
                  className="form-textarea"
                  style={{
                    padding: '8px 10px',
                    fontSize: '0.8rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Optional: Enter any extra hints, notes on messy handwriting, custom columns or notations..."
                />
              </div>
            )}

            {/* Upload Area / Camera View */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '14px',
              }}
            >
              {/* Dropzone / Camera Feed */}
              {!isCameraActive ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: dragActive
                      ? '2px dashed #F59E0B'
                      : selectedFiles.length > 0
                      ? '2px solid rgba(16, 185, 129, 0.45)'
                      : '2px dashed rgba(245, 158, 11, 0.35)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    padding: '24px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: dragActive
                      ? 'rgba(245, 158, 11, 0.12)'
                      : selectedFiles.length > 0
                      ? 'rgba(16, 185, 129, 0.05)'
                      : 'rgba(0, 0, 0, 0.15)',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!dragActive) {
                      e.currentTarget.style.borderColor = '#F59E0B';
                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!dragActive) {
                      e.currentTarget.style.borderColor = selectedFiles.length > 0 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.35)';
                      e.currentTarget.style.background = selectedFiles.length > 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 0, 0, 0.15)';
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFilesSelected(e.target.files);
                      }
                    }}
                  />
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: selectedFiles.length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.12)',
                      border: selectedFiles.length > 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: selectedFiles.length > 0 ? '#10B981' : '#F59E0B',
                      marginBottom: '10px',
                    }}
                  >
                    {selectedFiles.length > 0 ? <CheckCircle2 size={24} /> : <Upload size={22} />}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''} Loaded — Click or drop to add more`
                      : 'Click to browse or drop sheet photo(s), PDF, or CSV file(s)'}
                  </p>
                  <p style={{ margin: '4px 0 10px 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Drop, browse, or press <kbd style={{ padding: '2px 5px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.1)', color: '#FBBF24', fontSize: '0.72rem', border: '1px solid rgba(255, 255, 255, 0.2)' }}>Ctrl + V</kbd> to paste from clipboard
                  </p>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          if (navigator.clipboard && navigator.clipboard.read) {
                            const clipboardItems = await navigator.clipboard.read();
                            const files = [];
                            for (const item of clipboardItems) {
                              const imageType = item.types.find((t) => t.startsWith('image/'));
                              if (imageType) {
                                const blob = await item.getType(imageType);
                                const ext = imageType.split('/')[1] || 'png';
                                files.push(new File([blob], `clipboard_sheet_${Date.now()}.${ext}`, { type: imageType }));
                              }
                            }
                            if (files.length > 0) {
                              handleFilesSelected(files);
                              return;
                            }
                          }
                          setParseError('No image found in clipboard. Copy an image screenshot first, then paste.');
                        } catch (err) {
                          console.warn('Clipboard read error:', err);
                          setParseError('Please press Ctrl+V to paste your clipboard image directly into this window.');
                        }
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-pill)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        borderColor: 'rgba(56, 189, 248, 0.4)',
                        color: '#38BDF8',
                        background: 'rgba(56, 189, 248, 0.08)',
                      }}
                    >
                      <Clipboard size={14} />
                      <span>Paste Image (Ctrl+V)</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startCamera();
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-pill)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        borderColor: 'rgba(245, 158, 11, 0.4)',
                        color: '#FBBF24',
                      }}
                    >
                      <Camera size={14} />
                      <span>Take Live Photo</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 'var(--radius-lg, 12px)',
                    overflow: 'hidden',
                    background: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                  }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={captureCameraPhoto}
                      className="btn btn-primary btn-sm"
                      style={{
                        padding: '6px 16px',
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        color: '#0F172A',
                        fontWeight: 800,
                      }}
                    >
                      Snap Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 16px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Preview & Action Card */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg, 12px)',
                  background: 'var(--bg-input, #0F1322)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {selectedFiles.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Selected Sheets ({selectedFiles.length})
                        </span>
                        {selectedFiles.length > 1 && (
                          <button
                            type="button"
                            onClick={handleSelectAllFiles}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px' }}
                          >
                            {selectedFileIndices.length === selectedFiles.length ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleClearAllFiles}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: 700,
                          padding: 0,
                        }}
                      >
                        Clear All
                      </button>
                    </div>

                    {/* Pre-OCR Split Bill Merge Notice */}
                    {selectedFiles.length > 1 && (
                      <div
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: selectedFileIndices.length >= 2 ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                          border: selectedFileIndices.length >= 2 ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.72rem',
                          color: selectedFileIndices.length >= 2 ? '#38BDF8' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Combine size={13} style={{ color: selectedFileIndices.length >= 2 ? '#38BDF8' : 'var(--text-muted)' }} />
                        <span>
                          {selectedFileIndices.length >= 2 ? (
                            <strong>
                              {selectedFileIndices.length} pages ticked: OCR will identify &amp; inward them as ONE continuous bill.
                            </strong>
                          ) : (
                            'Split Bill? Tick the checkboxes on pages that belong to the same multi-page bill.'
                          )}
                        </span>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                        gap: '8px',
                        maxHeight: '140px',
                        overflowY: 'auto',
                        paddingRight: '4px',
                      }}
                    >
                      {selectedFiles.map((file, idx) => {
                        const preview = filePreviews[idx];
                        const isChecked = selectedFileIndices.includes(idx);
                        return (
                          <div
                            key={idx}
                            onClick={() => handleToggleSelectFile(idx)}
                            style={{
                              position: 'relative',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: isChecked ? '2px solid #38BDF8' : '1px solid var(--border-subtle)',
                              background: isChecked ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                              height: '70px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '4px',
                              cursor: 'pointer',
                              boxShadow: isChecked ? '0 0 10px rgba(56, 189, 248, 0.3)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {/* Checkbox for identifying split bill pages before OCR */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSelectFile(idx);
                              }}
                              style={{
                                position: 'absolute',
                                top: '3px',
                                left: '3px',
                                zIndex: 2,
                                background: 'rgba(15, 23, 42, 0.85)',
                                borderRadius: '4px',
                                padding: '1px 3px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelectFile(idx);
                                }}
                                style={{
                                  width: '13px',
                                  height: '13px',
                                  accentColor: '#38BDF8',
                                  cursor: 'pointer',
                                }}
                              />
                              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: isChecked ? '#38BDF8' : '#CBD5E1' }}>
                                P{idx + 1}
                              </span>
                            </div>

                            {preview?.isCsv ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '10px' }}>
                                <FileSpreadsheet size={18} style={{ color: '#10B981' }} />
                                <span style={{ fontSize: '0.62rem', color: '#10B981', fontWeight: 700, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {file.name}
                                </span>
                              </div>
                            ) : preview?.isPdf ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '10px' }}>
                                <FileText size={18} style={{ color: '#EF4444' }} />
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {file.name}
                                </span>
                              </div>
                            ) : preview?.dataUrl ? (
                              <img
                                src={preview.dataUrl}
                                alt={file.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            ) : (
                              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{file.name}</div>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFile(idx);
                              }}
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: 'rgba(0, 0, 0, 0.75)',
                                color: '#EF4444',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                zIndex: 2,
                              }}
                              title="Remove file"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '110px',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      gap: '4px',
                    }}
                  >
                    <span>No sheet photo or CSV loaded yet.</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                      Drop or select photos, PDF, or CSV file(s)
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={selectedFiles.length === 0 || isParsing}
                  onClick={handleParseSheet}
                  className="btn"
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    padding: '10px 16px',
                    background: selectedFileIndices.length >= 2
                      ? 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)'
                      : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    color: selectedFileIndices.length >= 2 ? '#FFFFFF' : '#0F172A',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-md, 10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: selectedFileIndices.length >= 2
                      ? '0 4px 14px rgba(2, 132, 199, 0.35)'
                      : '0 4px 14px rgba(245, 158, 11, 0.25)',
                    opacity: selectedFiles.length === 0 || isParsing ? 0.6 : 1,
                    cursor: selectedFiles.length === 0 || isParsing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isParsing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Parsing &amp; Verifying Bills...</span>
                    </>
                  ) : (
                    <>
                      {selectedFileIndices.length >= 2 ? <Combine size={16} /> : <Sparkles size={16} />}
                      <span>
                        {selectedFileIndices.length >= 2
                          ? `Merge & Parse Split Bill (${selectedFileIndices.length} Pages)`
                          : `Extract & Verify Bills${selectedFiles.length > 0 ? ` (${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''})` : ''}`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {parseError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  fontSize: '0.78rem',
                  color: '#FCA5A5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0 }} />
                <span>{parseError}</span>
              </div>
            )}

            {/* Commit Message */}
            {commitMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  fontSize: '0.78rem',
                  color: '#6EE7B7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                <span>{commitMessage.text}</span>
              </div>
            )}
          </div>

          {/* QUEUE TABS & STAGING BOARD */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                paddingBottom: '8px',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('ready')}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'ready' ? '2px solid #10B981' : '2px solid transparent',
                    color: activeTab === 'ready' ? '#34D399' : 'var(--text-muted)',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    padding: '6px 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Ready to Push ({validBills.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('rejected')}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'rejected' ? '2px solid #EF4444' : '2px solid transparent',
                    color: activeTab === 'rejected' ? '#F87171' : 'var(--text-muted)',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    padding: '6px 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>Discrepancies & Rejected ({rejectedBills.length})</span>
                </button>

                {/* MANUAL BILL ENTRY TAB */}
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'manual' ? '2px solid #38BDF8' : '2px solid transparent',
                    color: activeTab === 'manual' ? '#38BDF8' : 'var(--text-muted)',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    padding: '6px 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <PenTool size={15} />
                  <span>Manual Past Bill Entry</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* REVALIDATE STOCK BUTTON */}
                <button
                  type="button"
                  disabled={isRevalidating || isCommitting}
                  onClick={handleRevalidateLiveStock}
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-pill)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#38BDF8',
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    background: 'rgba(56, 189, 248, 0.08)',
                  }}
                  title="Re-fetch live stock from inventory to check if restocked items now have sufficient balance"
                >
                  <RefreshCw size={13} className={isRevalidating ? 'animate-spin' : ''} />
                  <span>{isRevalidating ? 'Revalidating...' : 'Revalidate Stock'}</span>
                </button>

                {validBills.length > 0 && (
                  <button
                    type="button"
                    disabled={isCommitting || isRevalidating}
                    onClick={handleCommitBatch}
                    className="btn btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      padding: '7px 16px',
                      borderRadius: 'var(--radius-pill)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    {isCommitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>Commit Verified Bills ({validBills.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Revalidation Toast / Notification Banner */}
            {revalidationNotification && (
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: revalidationNotification.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${revalidationNotification.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  fontSize: '0.78rem',
                  color: revalidationNotification.type === 'success' ? '#6EE7B7' : '#FCA5A5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {revalidationNotification.type === 'success' ? (
                  <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={15} style={{ color: '#EF4444', flexShrink: 0 }} />
                )}
                <span>{revalidationNotification.text}</span>
              </div>
            )}

            {/* TAB 1: READY TO PUSH BILLS */}
            {activeTab === 'ready' && (
              <div>
                {/* Multi-Page Split Bill Merge Action Bar */}
                {validBills.length > 1 && (
                  <div
                    style={{
                      marginBottom: '12px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md, 10px)',
                      background: selectedBillIndices.length > 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: selectedBillIndices.length > 0 ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleSelectAllInTab}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px' }}
                      >
                        {selectedBillIndices.length === validBills.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {selectedBillIndices.length > 0 ? (
                          <strong style={{ color: '#38BDF8' }}>
                            {selectedBillIndices.length} page(s)/bill(s) selected
                          </strong>
                        ) : (
                          'Tip: Tick 2 or more pages of a split customer bill to merge them into one.'
                        )}
                      </span>
                    </div>

                    {selectedBillIndices.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleMergeSelectedBills}
                        className="btn btn-sm"
                        style={{
                          background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
                          color: '#0F172A',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-pill)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)',
                        }}
                      >
                        <Combine size={14} />
                        <span>Merge Selected ({selectedBillIndices.length} Pages) into 1 Bill</span>
                      </button>
                    )}
                  </div>
                )}

                {validBills.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      borderRadius: 'var(--radius-lg, 12px)',
                      background: 'rgba(0, 0, 0, 0.12)',
                      border: '1px dashed var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                    }}
                  >
                    No verified bills yet. Upload a tally sheet above or use "Manual Past Bill Entry" to stage bills.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: '14px',
                    }}
                  >
                    {validBills.map((b, i) => {
                      const isSelected = selectedBillIndices.includes(b.bill_index);
                      return (
                        <div
                          key={i}
                          onClick={() => handleToggleSelectBill(b.bill_index)}
                          style={{
                            padding: '14px 16px',
                            borderRadius: 'var(--radius-lg, 12px)',
                            background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-surface, #141829)',
                            border: isSelected ? '2px solid #38BDF8' : '1px solid rgba(16, 185, 129, 0.35)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxShadow: isSelected ? '0 0 16px rgba(56, 189, 248, 0.2)' : '0 4px 14px rgba(0, 0, 0, 0.25)',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelectBill(b.bill_index);
                                }}
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  accentColor: '#38BDF8',
                                  cursor: 'pointer',
                                }}
                              />
                              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                Bill #{b.bill_index}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#34D399',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              {b.payment_method}
                            </span>
                          </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <p style={{ margin: 0 }}>
                            Customer Phone:{' '}
                            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
                              {b.customer_phone || 'Walk-in'}
                            </span>
                          </p>
                          <p style={{ margin: 0 }}>
                            Items Count:{' '}
                            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{b.items.length}</span>
                          </p>
                          <p style={{ margin: 0 }}>
                            Total Amount:{' '}
                            <span style={{ color: '#34D399', fontWeight: 800, fontSize: '0.92rem' }}>
                              ₹{b.total_amount?.toLocaleString('en-IN')}
                            </span>
                          </p>
                        </div>

                        {/* Stock Deficit Warning in Ready Queue */}
                        {b.has_stock_deficit && deductStock && (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              fontSize: '0.72rem',
                              color: '#FCA5A5',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 800, color: '#F87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={12} /> Stock Deficit Detected
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRevalidateLiveStock();
                                }}
                                disabled={isRevalidating}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  fontSize: '0.66rem',
                                  padding: '2px 6px',
                                  height: '20px',
                                  borderRadius: '4px',
                                  color: '#38BDF8',
                                  borderColor: 'rgba(56, 189, 248, 0.3)',
                                  background: 'rgba(56, 189, 248, 0.1)',
                                }}
                              >
                                Revalidate
                              </button>
                            </div>
                            {b.stock_deficits.map((d, dIdx) => (
                              <span key={dIdx} style={{ fontSize: '0.7rem' }}>
                                • <strong>{d.item_name}</strong> (UID: {d.item_uid}): {d.available_stock} in stock, {d.requested_stock} needed (Deficit: -{d.shortfall})
                              </span>
                            ))}
                          </div>
                        )}

                        <div
                          style={{
                            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                            paddingTop: '8px',
                            maxHeight: '100px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            fontSize: '0.74rem',
                          }}
                        >
                          {b.items.map((it, itIdx) => (
                            <div key={itIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {it.item_name} x{it.quantity}
                              </span>
                              <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
                                ₹{it.total_price}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* TAB 2: REJECTED / DISCREPANCY QUEUE */}
            {activeTab === 'rejected' && (
              <div>
                {/* Multi-Page Split Bill Merge Action Bar */}
                {rejectedBills.length > 1 && (
                  <div
                    style={{
                      marginBottom: '12px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md, 10px)',
                      background: selectedBillIndices.length > 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: selectedBillIndices.length > 0 ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleSelectAllInTab}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px' }}
                      >
                        {selectedBillIndices.length === rejectedBills.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {selectedBillIndices.length > 0 ? (
                          <strong style={{ color: '#38BDF8' }}>
                            {selectedBillIndices.length} page(s)/bill(s) selected
                          </strong>
                        ) : (
                          'Tip: Tick 2 or more split pages to combine them into one continuous bill.'
                        )}
                      </span>
                    </div>

                    {selectedBillIndices.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleMergeSelectedBills}
                        className="btn btn-sm"
                        style={{
                          background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
                          color: '#0F172A',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-pill)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)',
                        }}
                      >
                        <Combine size={14} />
                        <span>Merge Selected ({selectedBillIndices.length} Pages) into 1 Bill</span>
                      </button>
                    )}
                  </div>
                )}

                {rejectedBills.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      borderRadius: 'var(--radius-lg, 12px)',
                      background: 'rgba(0, 0, 0, 0.12)',
                      border: '1px dashed rgba(16, 185, 129, 0.3)',
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={24} style={{ color: '#10B981' }} />
                    <span style={{ color: '#34D399', fontWeight: 700 }}>
                      All bills passed catalog validation! Zero discrepancies found.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md, 10px)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        fontSize: '0.78rem',
                        color: '#FCA5A5',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 800 }}>⚠️ Attention: {rejectedBills.length} Bill(s) were rejected.</p>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        These bills contain items that do not exist in the store inventory catalog. Click "Inspect & Fix Anomalies" to map them or remove invalid lines.
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '14px',
                      }}
                    >
                      {rejectedBills.map((b, i) => {
                        const isSelected = selectedBillIndices.includes(b.bill_index);
                        return (
                          <div
                            key={i}
                            onClick={() => handleToggleSelectBill(b.bill_index)}
                            style={{
                              padding: '14px 16px',
                              borderRadius: 'var(--radius-lg, 12px)',
                              background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-surface, #141829)',
                              border: isSelected ? '2px solid #38BDF8' : '1px solid rgba(239, 68, 68, 0.45)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              boxShadow: isSelected ? '0 0 16px rgba(56, 189, 248, 0.2)' : '0 4px 14px rgba(239, 68, 68, 0.12)',
                              position: 'relative',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleSelectBill(b.bill_index);
                                  }}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    accentColor: '#38BDF8',
                                    cursor: 'pointer',
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: '0.86rem',
                                    fontWeight: 800,
                                    color: '#EF4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <AlertTriangle size={15} />
                                  <span>Bill #{b.bill_index} (REJECTED)</span>
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-pill)',
                                  background: 'rgba(239, 68, 68, 0.18)',
                                  color: '#F87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                }}
                              >
                                {b.anomalous_indices?.length || 1} Anomalies
                              </span>
                            </div>

                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <p style={{ margin: 0 }}>
                              Customer Phone:{' '}
                              <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                {b.customer_phone || 'Walk-in'}
                              </span>
                            </p>
                            <p style={{ margin: 0 }}>
                              Calculated Total: ₹{b.total_amount}{' '}
                              {b.subtotal_written && (
                                <span style={{ color: 'var(--text-muted)' }}>(Written: ₹{b.subtotal_written})</span>
                              )}
                            </p>
                            <div style={{ color: '#FCA5A5', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {b.rejection_reasons?.map((r, rIdx) => (
                                <span key={rIdx}>• {r}</span>
                              ))}
                            </div>

                            {/* Stock Deficit Warning in Rejected Queue */}
                            {b.has_stock_deficit && deductStock && (
                              <div
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  fontSize: '0.72rem',
                                  color: '#FCA5A5',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '3px',
                                  marginTop: '4px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontWeight: 800, color: '#F87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} /> Stock Deficit Detected
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRevalidateLiveStock();
                                    }}
                                    disabled={isRevalidating}
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      fontSize: '0.66rem',
                                      padding: '2px 6px',
                                      height: '20px',
                                      borderRadius: '4px',
                                      color: '#38BDF8',
                                      borderColor: 'rgba(56, 189, 248, 0.3)',
                                      background: 'rgba(56, 189, 248, 0.1)',
                                    }}
                                  >
                                    Revalidate
                                  </button>
                                </div>
                                {b.stock_deficits.map((d, dIdx) => (
                                  <span key={dIdx} style={{ fontSize: '0.7rem' }}>
                                    • <strong>{d.item_name}</strong> (UID: {d.item_uid}): {d.available_stock} in stock, {d.requested_stock} needed (Deficit: -{d.shortfall})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: '8px',
                              paddingTop: '8px',
                              borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenInspector(b)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                color: '#FBBF24',
                                borderColor: 'rgba(245, 158, 11, 0.4)',
                                background: 'rgba(245, 158, 11, 0.12)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                              }}
                            >
                              <Search size={13} />
                              <span>Inspect & Fix Anomalies</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDiscardRejectedBill(b.bill_index)}
                              className="btn btn-danger btn-sm"
                              style={{
                                padding: '6px 10px',
                                fontSize: '0.76rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Discard Bill"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MANUAL BILL ENTRY WORKBENCH */}
            {activeTab === 'manual' && (
              <div
                style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-lg, 14px)',
                  background: 'var(--bg-surface, rgba(20, 24, 41, 0.6))',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PenTool size={16} style={{ color: '#38BDF8' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Quick Manual Bill Entry (Catalog-Enforced)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Add items manually and push directly to "Ready to Push" batch queue
                  </span>
                </div>

                {/* Bill Customer & Payment Metadata */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Customer Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="e.g. 9876543210 (or leave empty)"
                      className="form-input"
                      style={{ padding: '8px 12px', fontSize: '0.82rem', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Payment Method
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['cash', 'upi', 'card'].map((pm) => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setManualPaymentMethod(pm)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: manualPaymentMethod === pm ? '1px solid #38BDF8' : '1px solid var(--border-subtle)',
                            background: manualPaymentMethod === pm ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-input, #0F1322)',
                            color: manualPaymentMethod === pm ? '#38BDF8' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                          }}
                        >
                          {pm}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Bill Reference / Notes
                    </label>
                    <input
                      type="text"
                      value={manualBillNotes}
                      onChange={(e) => setManualBillNotes(e.target.value)}
                      placeholder="e.g. Memo #14 or Handwritten slip"
                      className="form-input"
                      style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                {/* Catalog Search & Add Item Strip */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md, 10px)',
                    background: 'var(--bg-input, #0F1322)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#38BDF8' }}>
                    Add Catalog Products to This Bill:
                  </span>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 2fr) minmax(80px, 1fr) minmax(100px, 1fr) auto',
                      gap: '10px',
                      alignItems: 'flex-end',
                    }}
                  >
                    {/* Catalog Search */}
                    <div style={{ position: 'relative' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Search Product (Name / UID / Barcode)
                      </label>
                      <input
                        type="text"
                        value={manualCatalogQuery}
                        onChange={(e) => {
                          setManualCatalogQuery(e.target.value);
                          setManualSelectedProduct(null);
                        }}
                        placeholder="Type to search catalog..."
                        className="form-input"
                        style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                      />

                      {/* Autocomplete Dropdown */}
                      {manualCatalogQuery.trim() && !manualSelectedProduct && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 20,
                            marginTop: '4px',
                            background: '#0B0E17',
                            border: '1px solid var(--border-strong)',
                            borderRadius: '8px',
                            maxHeight: '180px',
                            overflowY: 'auto',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                          }}
                        >
                          {manualFilteredProducts.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              No matching catalog items found
                            </div>
                          ) : (
                            manualFilteredProducts.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setManualSelectedProduct(p);
                                  setManualCatalogQuery(p.name);
                                  setManualCustomRate(String(p.selling_price));
                                }}
                                style={{
                                  padding: '8px 12px',
                                  borderBottom: '1px solid var(--border-subtle)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.78rem',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    <span style={{ fontFamily: 'monospace' }}>UID: {p.uid}</span>
                                    <span>•</span>
                                    <span style={{ fontWeight: 700, color: (p.quantity || 0) > 0 ? '#34D399' : '#EF4444' }}>
                                      {Math.max(0, p.quantity || 0)} in stock
                                    </span>
                                  </div>
                                </div>
                                <span style={{ fontWeight: 800, color: '#34D399', fontFamily: 'monospace' }}>
                                  ₹{p.selling_price}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={manualQuantity}
                        onChange={(e) => setManualQuantity(e.target.value)}
                        className="form-input"
                        style={{ padding: '8px 10px', fontSize: '0.82rem', fontFamily: 'monospace' }}
                      />
                    </div>

                    {/* Rate / Price */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Rate (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={manualCustomRate}
                        onChange={(e) => setManualCustomRate(e.target.value)}
                        placeholder="Catalog price"
                        className="form-input"
                        style={{ padding: '8px 10px', fontSize: '0.82rem', fontFamily: 'monospace' }}
                      />
                    </div>

                    {/* Add Item Button */}
                    <button
                      type="button"
                      onClick={handleAddManualItem}
                      className="btn"
                      style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
                        color: '#0F172A',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={15} />
                      <span>Add Item</span>
                    </button>
                  </div>

                  {manualError && (
                    <div style={{ fontSize: '0.74rem', color: '#EF4444', fontWeight: 700 }}>
                      ⚠️ {manualError}
                    </div>
                  )}
                </div>

                {/* Staged Items Table for Current Manual Bill */}
                <div
                  style={{
                    borderRadius: 'var(--radius-md, 10px)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.78rem',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: 'rgba(0, 0, 0, 0.35)', color: 'var(--text-muted)', fontWeight: 700 }}>
                      <tr>
                        <th style={{ padding: '8px 12px' }}>#</th>
                        <th style={{ padding: '8px 12px' }}>UID</th>
                        <th style={{ padding: '8px 12px' }}>Product</th>
                        <th style={{ padding: '8px 12px' }}>Qty</th>
                        <th style={{ padding: '8px 12px' }}>Rate</th>
                        <th style={{ padding: '8px 12px' }}>Total</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No items added yet. Search a product above and click "Add Item".
                          </td>
                        </tr>
                      ) : (
                        manualItems.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                              {it.item_uid}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{it.item_name}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{it.quantity}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>₹{it.unit_price}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#34D399' }}>
                              ₹{it.total_price}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveManualItem(idx)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Staging Action Row */}
                {manualItems.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '6px',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      Bill Total ({manualItems.length} items):{' '}
                      <span style={{ color: '#34D399', fontSize: '1rem', fontWeight: 800 }}>
                        ₹{manualItems.reduce((acc, it) => acc + (it.total_price || 0), 0).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleStageManualBill}
                      className="btn"
                      style={{
                        padding: '8px 18px',
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        borderRadius: 'var(--radius-pill)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      <Check size={14} />
                      <span>Stage Bill to "Ready to Push" Queue</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.18)',
            fontSize: '0.78rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            {usedModel ? `Powered by ${usedModel}` : 'Wondersale Production Inward Safe Gate'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 18px', fontWeight: 700, borderRadius: 'var(--radius-md, 8px)' }}
          >
            Close
          </button>
        </div>

        {/* SUBMODAL: INTERACTIVE ANOMALY INSPECTOR OVERLAY */}
        {inspectingBill && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100000,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            <div
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '920px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 'var(--radius-xl, 18px)',
                background: 'var(--bg-surface-solid, #141829)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
              }}
            >
              {/* INSPECTOR HEADER */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0, 0, 0, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Discrepancy Inspector: Bill #{inspectingBill.bill_index}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#F87171',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                    }}
                  >
                    Needs Resolution
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingBill(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* INSPECTOR BODY */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Review anomalous items highlighted in red. Search the inventory catalog to remap misread barcodes, or remove invalid line items.
                </p>

                {/* LINE ITEMS TABLE */}
                <div
                  style={{
                    borderRadius: 'var(--radius-md, 10px)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                    fontSize: '0.78rem',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead
                      style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <tr>
                        <th style={{ padding: '10px 12px' }}>#</th>
                        <th style={{ padding: '10px 12px' }}>Sheet Code</th>
                        <th style={{ padding: '10px 12px' }}>Catalog Item Name</th>
                        <th style={{ padding: '10px 12px' }}>Qty</th>
                        <th style={{ padding: '10px 12px' }}>Rate (₹)</th>
                        <th style={{ padding: '10px 12px' }}>Total (₹)</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectingBill.items.map((line, lIdx) => (
                        <React.Fragment key={lIdx}>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                              background: !line.is_valid ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                              borderLeft: !line.is_valid ? '4px solid #EF4444' : '4px solid transparent',
                            }}
                          >
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                              {lIdx + 1}
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                              {line.raw_code || line.item_uid}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{line.item_name}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{line.quantity}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>₹{line.unit_price}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                              ₹{line.total_price}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {line.is_valid ? (
                                <span style={{ color: '#34D399', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                                  <Check size={13} />
                                  <span>Verified</span>
                                </span>
                              ) : (
                                <span style={{ color: '#EF4444', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                                  <AlertCircle size={13} />
                                  <span>Missing in Catalog</span>
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {!line.is_valid && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedLineForRemap(selectedLineForRemap === lIdx ? null : lIdx);
                                      setInspectorSearchQuery(line.raw_code || '');
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      fontSize: '0.72rem',
                                      padding: '3px 8px',
                                      color: '#FBBF24',
                                      borderColor: 'rgba(245, 158, 11, 0.4)',
                                    }}
                                  >
                                    Remap Item
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLineItem(lIdx)}
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '4px 6px', fontSize: '0.72rem' }}
                                  title="Remove line"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* INLINE CATALOG SEARCH & REMAP ROW */}
                          {selectedLineForRemap === lIdx && (
                            <tr style={{ background: 'rgba(0, 0, 0, 0.35)', borderBottom: '1px solid rgba(245, 158, 11, 0.3)' }}>
                              <td colSpan={8} style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Search size={15} style={{ color: '#F59E0B' }} />
                                    <input
                                      type="text"
                                      value={inspectorSearchQuery}
                                      onChange={(e) => setInspectorSearchQuery(e.target.value)}
                                      placeholder="Search catalog by UID (e.g. 24439, 25461) or product name..."
                                      className="form-input"
                                      style={{
                                        flex: 1,
                                        padding: '6px 10px',
                                        fontSize: '0.8rem',
                                        background: 'var(--bg-input, #0F1322)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)',
                                      }}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setSelectedLineForRemap(null)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '0.74rem', padding: '5px 10px' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>

                                  {/* Suggestions List */}
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                                      gap: '8px',
                                      maxHeight: '160px',
                                      overflowY: 'auto',
                                    }}
                                  >
                                    {filteredCatalogItems.map((catIt) => (
                                      <div
                                        key={catIt.id}
                                        onClick={() => handleRemapItem(lIdx, catIt)}
                                        style={{
                                          padding: '8px 10px',
                                          borderRadius: '8px',
                                          background: 'var(--bg-surface, #141829)',
                                          border: '1px solid var(--border-subtle)',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '8px',
                                          transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.borderColor = '#F59E0B';
                                          e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                          e.currentTarget.style.background = 'var(--bg-surface, #141829)';
                                        }}
                                      >
                                        <div style={{ overflow: 'hidden' }}>
                                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {catIt.name}
                                          </p>
                                          <p style={{ margin: 0, fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                            UID: {catIt.uid}
                                          </p>
                                        </div>
                                        <span style={{ fontFamily: 'monospace', color: '#34D399', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                                          ₹{catIt.selling_price}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* INSPECTOR FOOTER */}
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0, 0, 0, 0.25)',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleDiscardRejectedBill(inspectingBill.bill_index)}
                  className="btn btn-danger btn-sm"
                  style={{ fontSize: '0.76rem', padding: '6px 14px' }}
                >
                  Discard this Bill
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setInspectingBill(null)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.76rem', padding: '6px 14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRevalidateInspectedBill}
                    className="btn btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '0.76rem',
                      padding: '6px 16px',
                      borderRadius: 'var(--radius-pill)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Check size={14} />
                    <span>Re-validate & Move to Ready Queue</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
