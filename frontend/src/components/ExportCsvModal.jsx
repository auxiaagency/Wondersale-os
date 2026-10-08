import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Package,
  Layers,
  Image as ImageIcon,
  Barcode,
  Check,
  RotateCcw,
  ChevronDown,
  Scale,
  Box,
} from 'lucide-react';

export default function ExportCsvModal({
  isOpen = false,
  onClose,
  items = [],
  categories = [],
  subcategories = [],
  suppliers = [],
  currentFilters = {},
  currentStoreName = '',
}) {
  // 1. File Name State
  const defaultFileName = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return `wondersale_inventory_${today}`;
  }, []);

  const [fileName, setFileName] = useState(defaultFileName);

  // 2. Filter States (Pre-populated from active Inventory Management table filters)
  const [selectedSubcatIds, setSelectedSubcatIds] = useState([]);
  const [stockStatus, setStockStatus] = useState('');
  const [hasNoImage, setHasNoImage] = useState(false);
  const [hasNoSubcategory, setHasNoSubcategory] = useState(false);
  const [needsBarcode, setNeedsBarcode] = useState(false);
  const [hasNoWeight, setHasNoWeight] = useState(false);
  const [hasNoVolume, setHasNoVolume] = useState(false);

  // Popover state for Subcategory Multi-Select Picker
  const [isSubcatPickerOpen, setIsSubcatPickerOpen] = useState(false);
  const [subcatQuery, setSubcatQuery] = useState('');
  const subcatPickerRef = useRef(null);

  // Synchronize initial filters when modal opens
  useEffect(() => {
    if (isOpen) {
      setFileName(defaultFileName);
      
      const initialSubcats = Array.isArray(currentFilters.selectedSubcategories)
        ? currentFilters.selectedSubcategories.map(String)
        : currentFilters.selectedSubcategory
        ? String(currentFilters.selectedSubcategory).split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      setSelectedSubcatIds(initialSubcats);

      setStockStatus(currentFilters.selectedStockStatus || '');
      setHasNoImage(Boolean(currentFilters.hasNoImageFilter));
      setHasNoSubcategory(Boolean(currentFilters.hasNoSubcategoryFilter));
      setNeedsBarcode(Boolean(currentFilters.needsBarcodeFilter));
      setHasNoWeight(Boolean(currentFilters.hasNoWeightFilter));
      setHasNoVolume(Boolean(currentFilters.hasNoVolumeFilter));
      setSubcatQuery('');
      setIsSubcatPickerOpen(false);
    }
  }, [isOpen, currentFilters, defaultFileName]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside to close subcategory popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (subcatPickerRef.current && !subcatPickerRef.current.contains(e.target)) {
        setIsSubcatPickerOpen(false);
      }
    };
    if (isSubcatPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSubcatPickerOpen]);

  // Filter subcategories by search query inside popover
  const filteredSubcats = useMemo(() => {
    if (!subcatQuery.trim()) return subcategories;
    const q = subcatQuery.toLowerCase().trim();
    return subcategories.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.category_name && s.category_name.toLowerCase().includes(q))
    );
  }, [subcategories, subcatQuery]);

  const toggleSubcatItem = (id) => {
    const idStr = String(id);
    setSelectedSubcatIds((prev) =>
      prev.includes(idStr) ? prev.filter((s) => s !== idStr) : [...prev, idStr]
    );
  };

  const handleSelectAllSubcats = () => {
    setSelectedSubcatIds(subcategories.map((s) => String(s.id)));
  };

  const handleClearAllSubcats = () => {
    setSelectedSubcatIds([]);
  };

  const handleResetFilters = () => {
    setSelectedSubcatIds([]);
    setStockStatus('');
    setHasNoImage(false);
    setHasNoSubcategory(false);
    setNeedsBarcode(false);
    setSubcatQuery('');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSubcatIds.length > 0) count++;
    if (stockStatus) count++;
    if (hasNoImage) count++;
    if (hasNoSubcategory) count++;
    if (needsBarcode) count++;
    return count;
  }, [selectedSubcatIds, stockStatus, hasNoImage, hasNoSubcategory, needsBarcode]);

  // 3. Compute Filtered Items for Export
  const filteredItems = useMemo(() => {
    let list = [...items];

    // Subcategories Filter
    if (selectedSubcatIds.length > 0) {
      list = list.filter((item) =>
        (item.subcategories || []).some((sc) => selectedSubcatIds.includes(String(sc.id || sc)))
      );
    }

    // Stock Status
    if (stockStatus === 'out') {
      list = list.filter((item) => (parseInt(item.quantity, 10) || 0) <= 0);
    } else if (stockStatus === 'low') {
      list = list.filter((item) => {
        const q = parseInt(item.quantity, 10) || 0;
        return q > 0 && q <= 5;
      });
    } else if (stockStatus === 'in_stock') {
      list = list.filter((item) => (parseInt(item.quantity, 10) || 0) > 0);
    }

    // Has No Image
    if (hasNoImage) {
      list = list.filter(
        (item) => !item.primary_image_url && (!item.images || item.images.length === 0)
      );
    }

    // Has No Subcategories
    if (hasNoSubcategory) {
      list = list.filter((item) => !item.subcategories || item.subcategories.length === 0);
    }

    // Needs Barcode Printed
    if (needsBarcode) {
      list = list.filter((item) => Boolean(item.needs_new_barcode_printed));
    }

    // Has No Weight
    if (hasNoWeight) {
      list = list.filter(
        (item) => item.weight === null || item.weight === undefined || item.weight === '' || parseFloat(item.weight) <= 0 || isNaN(parseFloat(item.weight))
      );
    }

    // Has No Volume
    if (hasNoVolume) {
      list = list.filter(
        (item) => !item.length || !item.width || !item.height || parseFloat(item.length) <= 0 || parseFloat(item.width) <= 0 || parseFloat(item.height) <= 0
      );
    }

    return list;
  }, [items, selectedSubcatIds, stockStatus, hasNoImage, hasNoSubcategory, needsBarcode, hasNoWeight, hasNoVolume]);

  // Aggregate Metrics for preview
  const totalStockUnits = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 0), 0);
  }, [filteredItems]);

  const totalCostValuation = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) =>
        acc + (parseFloat(item.cost_price) || 0) * (parseInt(item.quantity, 10) || 0),
      0
    );
  }, [filteredItems]);

  // 4. Generate Standard RFC 4180 CSV with UTF-8 BOM
  const handleExport = () => {
    let cleanName = (fileName || '').trim();
    if (!cleanName) {
      cleanName = `wondersale_inventory_${new Date().toISOString().slice(0, 10)}`;
    }
    if (!cleanName.toLowerCase().endsWith('.csv')) {
      cleanName += '.csv';
    }

    const headers = [
      'UID / Barcode',
      'Product Name',
      'Parent Category',
      'Subcategories',
      'Supplier / Vendor',
      'Store Location',
      'Section',
      'Stock Quantity',
      'Cost Price (INR)',
      'Selling Price (INR)',
      'MRP (INR)',
      'Unit Margin (INR)',
      'Margin (%)',
      'Weight (g)',
      'Length (cm)',
      'Width (cm)',
      'Height (cm)',
      'Volume (cm3)',
      'Volumetric Weight (kg)',
      'Description',
      'Expiry Date',
      'Has Image',
      'Image Count',
      'Primary Image URL',
      'Needs Barcode Printed',
      'Created At',
      'Updated At',
    ];

    const rows = filteredItems.map((item) => {
      const cost = parseFloat(item.cost_price) || 0;
      const selling = parseFloat(item.selling_price) || 0;
      const mrp = item.mrp !== null && item.mrp !== undefined ? parseFloat(item.mrp) : '';
      const marginAmt = selling > 0 ? (selling - cost).toFixed(2) : '0.00';
      const marginPct = selling > 0 ? (((selling - cost) / selling) * 100).toFixed(1) : '0.0';

      const subcatNames = (item.subcategories || []).map((sc) => sc.name || sc).join('; ');
      const categoryNames = Array.from(
        new Set(
          (item.subcategories || [])
            .map((sc) => sc.category_name || sc.category?.name)
            .filter(Boolean)
        )
      ).join('; ');

      const supplierName = item.supplier_name || item.supplier?.name || item.supplier_details?.name || '';

      const hasImg = Boolean(
        item.primary_image_url || (item.images && item.images.length > 0)
      );
      const imgCount =
        (item.images && item.images.length) || (item.primary_image_url ? 1 : 0);

      const storeName = item.store_name || item.store?.name || currentStoreName || '';
      const sectionName = item.section_name || item.section_details?.name || item.section?.name || item.location_section || '';

      const l = item.length !== null && item.length !== undefined && item.length !== '' && !isNaN(item.length) ? parseFloat(item.length) : null;
      const w = item.width !== null && item.width !== undefined && item.width !== '' && !isNaN(item.width) ? parseFloat(item.width) : null;
      const h = item.height !== null && item.height !== undefined && item.height !== '' && !isNaN(item.height) ? parseFloat(item.height) : null;
      const volCm3 = (l !== null && w !== null && h !== null && l > 0 && w > 0 && h > 0)
        ? (l * w * h).toFixed(2)
        : (item.volume_cm3 !== null && item.volume_cm3 !== undefined ? Number(item.volume_cm3).toFixed(2) : '');
      const volWtKg = (l !== null && w !== null && h !== null && l > 0 && w > 0 && h > 0)
        ? ((l * w * h) / 5000).toFixed(3)
        : (item.volumetric_weight_kg !== null && item.volumetric_weight_kg !== undefined ? Number(item.volumetric_weight_kg).toFixed(3) : '');

      return [
        item.uid || '',
        item.name || '',
        categoryNames || '',
        subcatNames || '',
        supplierName,
        storeName,
        sectionName,
        item.quantity ?? 0,
        cost.toFixed(2),
        selling.toFixed(2),
        mrp !== '' && !isNaN(mrp) ? mrp.toFixed(2) : '',
        marginAmt,
        marginPct,
        item.weight || '',
        l !== null ? l : (item.length ?? ''),
        w !== null ? w : (item.width ?? ''),
        h !== null ? h : (item.height ?? ''),
        volCm3,
        volWtKg,
        item.description || '',
        item.expiry_date || '',
        hasImg ? 'Yes' : 'No',
        imgCount,
        item.primary_image_url || '',
        item.needs_new_barcode_printed ? 'Yes' : 'No',
        item.created_at ? new Date(item.created_at).toLocaleString() : '',
        item.updated_at ? new Date(item.updated_at).toLocaleString() : '',
      ];
    });

    const escapeCell = (cell) => {
      if (cell === null || cell === undefined) return '""';
      const str = String(cell);
      if (
        str.includes('"') ||
        str.includes(',') ||
        str.includes('\n') ||
        str.includes('\r')
      ) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const csvRows = [
      headers.map(escapeCell).join(','),
      ...rows.map((r) => r.map(escapeCell).join(',')),
    ];

    // Prepend UTF-8 BOM so Excel and spreadsheet applications open Hindi/special characters flawlessly
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', cleanName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="export-csv-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel export-csv-modal-dialog"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="export-csv-modal-header"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-solid, #161B2C)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="export-csv-header-icon"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="export-csv-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Export Inventory to CSV
              </h2>
              <p className="export-csv-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Download inventory spreadsheet filtered by your specifications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-icon export-csv-close-btn"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          className="export-csv-modal-body"
          style={{
            padding: '22px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* 1. File Name Input */}
          <div className="export-csv-filename-group">
            <label className="form-label export-csv-filename-label" style={{ fontWeight: 700 }}>
              Export File Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g. wondersale_inventory_2026-09-05"
                className="form-input export-csv-filename-input"
                style={{
                  paddingRight: '60px',
                  fontFamily: 'monospace',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  width: '100%',
                }}
                autoFocus
              />
              <span
                className="export-csv-filename-badge"
                style={{
                  position: 'absolute',
                  right: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-surface)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                  pointerEvents: 'none',
                }}
              >
                .csv
              </span>
            </div>
          </div>

          {/* 2. Filter Configuration Container (EXACT same style as main inventory filter page) */}
          <div
            className="export-csv-filter-box"
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div className="export-csv-filter-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.88rem' }}>
                <Filter size={15} style={{ color: 'var(--brand-primary)' }} />
                <span>Export Filters ({activeFilterCount} active)</span>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-secondary btn-sm export-csv-reset-btn"
                  style={{ fontSize: '0.74rem', height: '28px', padding: '0 8px', borderRadius: 'var(--radius-pill)' }}
                >
                  <RotateCcw size={11} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Row 1: Subcategory Picker & Stock Status Level (Same style as Main Filter Page) */}
            <div className="export-csv-primary-filters" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* 1. Multi-Select Subcategories Picker */}
              <div className="export-csv-subcat-picker-wrap" style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px', zIndex: 130 }} ref={subcatPickerRef}>
                <button
                  type="button"
                  onClick={() => setIsSubcatPickerOpen(!isSubcatPickerOpen)}
                  className="form-select export-csv-subcat-btn"
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
                    background: selectedSubcatIds.length > 0 ? 'rgba(239, 68, 68, 0.08)' : undefined,
                    borderColor: selectedSubcatIds.length > 0 ? 'var(--brand-primary)' : undefined,
                    color: selectedSubcatIds.length > 0 ? 'var(--brand-primary)' : 'var(--text-primary)',
                    fontWeight: selectedSubcatIds.length > 0 ? 600 : 500,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSubcatIds.length === 0
                      ? `All Subcategories (${subcategories.length})`
                      : selectedSubcatIds.length === 1
                      ? subcategories.find((s) => String(s.id) === selectedSubcatIds[0])?.name || '1 Selected'
                      : `${selectedSubcatIds.length} Subcategories`}
                  </span>
                  <ChevronDown
                    size={13}
                    style={{
                      transform: isSubcatPickerOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                      marginLeft: '6px',
                    }}
                  />
                </button>

                {/* Floating Popover for Subcategories Multi-Select */}
                {isSubcatPickerOpen && (
                  <div
                    className="export-csv-subcat-popover"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      zIndex: 9999,
                      width: '280px',
                      maxHeight: '300px',
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
                        value={subcatQuery}
                        onChange={(e) => setSubcatQuery(e.target.value)}
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
                      {selectedSubcatIds.length > 0 && (
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
                          Clear ({selectedSubcatIds.length})
                        </button>
                      )}
                    </div>

                    {/* Scrollable list */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}
                    >
                      {filteredSubcats.length === 0 ? (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                          No subcategory found
                        </div>
                      ) : (
                        filteredSubcats.map((subcat) => {
                          const isChecked = selectedSubcatIds.includes(String(subcat.id));
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
                                onChange={() => toggleSubcatItem(subcat.id)}
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
                  </div>
                )}
              </div>

              {/* 2. Stock Level (Same form-select pill style as Main Filter Page) */}
              <select
                value={stockStatus || ''}
                onChange={(e) => setStockStatus(e.target.value)}
                className="form-select export-csv-stock-select"
                style={{
                  flex: '1 1 150px',
                  minWidth: '140px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  padding: '0 12px',
                  height: '36px',
                }}
              >
                <option value="">All Stock Levels</option>
                <option value="in_stock">In Stock (&gt;0)</option>
                <option value="low">Low Stock (≤5)</option>
                <option value="out">Out of Stock (0)</option>
              </select>
            </div>

            {/* Row 2: Filter Toggle Buttons (Exact same style as Main Filter Page) */}
            <div className="export-csv-toggles-grid" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* 3. Has no image Toggle Button */}
              <button
                type="button"
                onClick={() => setHasNoImage(!hasNoImage)}
                className="form-select export-csv-toggle-btn"
                style={{
                  flex: '1 1 130px',
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
                  background: hasNoImage ? 'rgba(239, 68, 68, 0.12)' : undefined,
                  borderColor: hasNoImage ? 'var(--brand-primary)' : undefined,
                  color: hasNoImage ? 'var(--brand-primary)' : 'var(--text-primary)',
                  fontWeight: hasNoImage ? 700 : 500,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <ImageIcon size={14} />
                <span>Has no image</span>
                {hasNoImage && <Check size={12} />}
              </button>

              {/* 4. Has no sub category Toggle Button */}
              <button
                type="button"
                onClick={() => setHasNoSubcategory(!hasNoSubcategory)}
                className="form-select export-csv-toggle-btn"
                style={{
                  flex: '1 1 155px',
                  minWidth: '145px',
                  height: '36px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  background: hasNoSubcategory ? 'rgba(239, 68, 68, 0.12)' : undefined,
                  borderColor: hasNoSubcategory ? 'var(--brand-primary)' : undefined,
                  color: hasNoSubcategory ? 'var(--brand-primary)' : 'var(--text-primary)',
                  fontWeight: hasNoSubcategory ? 700 : 500,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Layers size={14} />
                <span>Has no sub category</span>
                {hasNoSubcategory && <Check size={12} />}
              </button>

              {/* 5. Needs Barcode Printed Toggle Button */}
              <button
                type="button"
                onClick={() => setNeedsBarcode(!needsBarcode)}
                className="form-select export-csv-toggle-btn"
                style={{
                  flex: '1 1 165px',
                  minWidth: '155px',
                  height: '36px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  background: needsBarcode ? 'rgba(239, 68, 68, 0.12)' : undefined,
                  borderColor: needsBarcode ? 'var(--brand-primary)' : undefined,
                  color: needsBarcode ? 'var(--brand-primary)' : 'var(--text-primary)',
                  fontWeight: needsBarcode ? 700 : 500,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Barcode size={14} />
                <span>Needs Barcode Printed</span>
                {needsBarcode && <Check size={12} />}
              </button>

              {/* 6. Has no weight Toggle Button */}
              <button
                type="button"
                onClick={() => setHasNoWeight(!hasNoWeight)}
                className="form-select export-csv-toggle-btn"
                style={{
                  flex: '1 1 135px',
                  minWidth: '130px',
                  height: '36px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  background: hasNoWeight ? 'rgba(239, 68, 68, 0.12)' : undefined,
                  borderColor: hasNoWeight ? 'var(--brand-primary)' : undefined,
                  color: hasNoWeight ? 'var(--brand-primary)' : 'var(--text-primary)',
                  fontWeight: hasNoWeight ? 700 : 500,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Filter items with missing or 0 weight"
              >
                <Scale size={14} />
                <span>Has no weight</span>
                {hasNoWeight && <Check size={12} />}
              </button>

              {/* 7. Has no volume Toggle Button */}
              <button
                type="button"
                onClick={() => setHasNoVolume(!hasNoVolume)}
                className="form-select export-csv-toggle-btn export-csv-toggle-btn-last"
                style={{
                  flex: '1 1 135px',
                  minWidth: '130px',
                  height: '36px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  background: hasNoVolume ? 'rgba(239, 68, 68, 0.12)' : undefined,
                  borderColor: hasNoVolume ? 'var(--brand-primary)' : undefined,
                  color: hasNoVolume ? 'var(--brand-primary)' : 'var(--text-primary)',
                  fontWeight: hasNoVolume ? 700 : 500,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Filter items with missing Length, Width, or Height dimensions"
              >
                <Box size={14} />
                <span>Has no volume</span>
                {hasNoVolume && <Check size={12} />}
              </button>
            </div>
          </div>

          {/* 3. Export Summary & Preview Box */}
          <div
            className="export-csv-summary-box"
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div className="export-csv-summary-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-success)' }}>
                <CheckCircle2 size={16} />
                <span>{filteredItems.length} Products Ready for Export</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Matches {filteredItems.length} out of {items.length} total catalog products in active store.
              </div>
            </div>

            <div className="export-csv-summary-metrics" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Units</span>
                <div className="mono" style={{ fontSize: '0.92rem', fontWeight: 800 }}>{totalStockUnits}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cost Value</span>
                <div className="mono font-bold" style={{ fontSize: '0.92rem', color: 'var(--brand-primary)' }}>
                  ₹{totalCostValuation.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="export-csv-modal-footer"
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-solid, #161B2C)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary export-csv-cancel-btn">
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={filteredItems.length === 0}
            className="btn btn-primary export-csv-download-btn"
            style={{
              fontWeight: 800,
              padding: '10px 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Download size={16} />
            <span>Download CSV ({filteredItems.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
