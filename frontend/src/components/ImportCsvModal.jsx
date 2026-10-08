import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  FileText,
  AlertTriangle,
  ArrowRight,
  Check,
} from 'lucide-react';

// Robust CSV Line Parser supporting quotes, escaped quotes, and commas
function parseCsvRows(text) {
  const cleanText = text.replace(/^\uFEFF/, '').trim(); // Remove UTF-8 BOM if present
  if (!cleanText) return [];

  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip CRLF
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Normalizes header names for clean column matching
function normalizeHeader(header) {
  return (header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Function to find exact and prioritized column indices without false-positive collisions
function resolveColumnIndices(rawHeaders) {
  const normHeaders = rawHeaders.map(normalizeHeader);

  const columnRules = {
    uid: [
      'uid', 'productcode', 'itemcode', 'barcode', 'sku', 'code', 'customuid', 'customcode',
      'barcodenumber', 'productuid', 'itemuid',
    ],
    costPrice: [
      'costprice', 'costpriceinr', 'cost', 'costinr', 'cp', 'buyingprice', 'buyingpriceinr',
      'purchaseprice', 'purchasepriceinr', 'unitcost', 'unitcostprice',
    ],
    sellingPrice: [
      'sellingprice', 'sellingpriceinr', 'selling', 'saleprice', 'salepriceinr', 'retailprice',
      'retailpriceinr', 'sp', 'sellingrate', 'salerate', 'price', 'priceinr',
    ],
    mrp: [
      'mrp', 'mrpinr', 'maximumretailprice', 'maxretailprice', 'maximumretailpriceinr', 'maxretailpriceinr',
    ],
    category: [
      'parentcategory', 'category', 'categoryname', 'parentcategoryname', 'maincategory', 'cat',
    ],
    subcategories: [
      'subcategories', 'subcategory', 'subcat', 'subcats', 'subcategoriesname', 'subcategoryname',
      'assignedsubcategories', 'productsubcategory', 'productsubcategories',
    ],
    supplier: [
      'supplier', 'suppliername', 'vendor', 'vendorname', 'provider', 'dealer', 'distributor',
    ],
    section: [
      'section', 'department', 'storesection', 'storedept', 'sectionname', 'dept',
      'sectioncode', 'departmentname', 'sectionshelf', 'shelf', 'rack', 'aisle',
      'locationsection', 'shelflocation', 'shelfsection', 'storeshelf', 'itemlocation',
    ],
    name: [
      'productname', 'name', 'product', 'itemname', 'item', 'title', 'producttitle', 'itemtitle',
      'productnameinr',
    ],
    quantity: [
      'stockquantity', 'quantity', 'stock', 'initialquantity', 'units', 'qty', 'count',
      'stockqty', 'initialstock', 'availablequantity', 'availablestock', 'totalstock',
    ],
    expiryDate: [
      'expirydate', 'expiry', 'expdate', 'expiration', 'expirationdate', 'bestbefore', 'bestbeforedate', 'exp',
    ],
    weight: [
      'weight', 'weightg', 'weightgrams', 'grams', 'netweight', 'netweightg', 'weightingrams', 'itemweight',
    ],
    length: [
      'length', 'lengthcm', 'lcm', 'l', 'productlength', 'itemlength',
    ],
    width: [
      'width', 'widthcm', 'wcm', 'w', 'breadth', 'breadthcm', 'productwidth', 'itemwidth',
    ],
    height: [
      'height', 'heightcm', 'hcm', 'h', 'productheight', 'itemheight',
    ],
    description: [
      'description', 'productdescription', 'itemdescription', 'desc', 'details', 'specifications', 'notes', 'productdetails',
    ],
    variantName: [
      'variantname', 'variant', 'batch', 'batchname', 'tag', 'size', 'color', 'varianttag',
    ],
    image: [
      'primaryimageurl', 'imageurl', 'imageurls', 'primaryimage', 'image', 'images',
      'photo', 'photos', 'productimage', 'productphotos', 'imagelink', 'picture', 'photourl',
      'primaryphotourl', 'productimageurl', 'photoimageurl', 'imagefile', 'imagefiles',
    ],
  };

  const matchedIndices = {};
  const usedIndices = new Set();
  const priorityOrder = [
    'uid',
    'costPrice',
    'sellingPrice',
    'mrp',
    'category',
    'subcategories',
    'supplier',
    'section',
    'name',
    'quantity',
    'expiryDate',
    'weight',
    'length',
    'width',
    'height',
    'description',
    'variantName',
    'image',
  ];

  // Pass 1: Exact matches
  for (const field of priorityOrder) {
    const aliases = columnRules[field];
    for (const alias of aliases) {
      const idx = normHeaders.findIndex((h, i) => !usedIndices.has(i) && h === alias);
      if (idx !== -1) {
        matchedIndices[field] = idx;
        usedIndices.add(idx);
        break;
      }
    }
  }

  // Pass 2: Controlled suffix/prefix matches for remaining fields (with strict collision safety guards)
  for (const field of priorityOrder) {
    if (matchedIndices[field] !== undefined) continue;

    const aliases = columnRules[field];
    for (const alias of aliases) {
      const idx = normHeaders.findIndex((h, i) => {
        if (usedIndices.has(i)) return false;

        // Skip any collisions with unwanted extra columns or other fields
        if (field === 'sellingPrice' && (h.includes('cost') || h.includes('mrp') || h.includes('margin') || h.includes('unit'))) return false;
        if (field === 'costPrice' && (h.includes('selling') || h.includes('sale') || h.includes('mrp') || h.includes('margin') || h.includes('unit'))) return false;
        if (field === 'section' && (h.includes('city') || h.includes('branch'))) return false;
        if (field === 'category' && (h.includes('subcat') || h.includes('subcategories'))) return false;
        if (field === 'subcategories' && (h.includes('parent') || h === 'category' || h === 'categories')) return false;
        if (field === 'uid' && (h.includes('name') || h.includes('title') || h.includes('desc'))) return false;

        return h === alias || (alias.length >= 5 && (h.startsWith(alias) || h.endsWith(alias)));
      });

      if (idx !== -1) {
        matchedIndices[field] = idx;
        usedIndices.add(idx);
        break;
      }
    }
  }

  return {
    uidIdx: matchedIndices.uid !== undefined ? matchedIndices.uid : -1,
    nameIdx: matchedIndices.name !== undefined ? matchedIndices.name : -1,
    costIdx: matchedIndices.costPrice !== undefined ? matchedIndices.costPrice : -1,
    sellingIdx: matchedIndices.sellingPrice !== undefined ? matchedIndices.sellingPrice : -1,
    qtyIdx: matchedIndices.quantity !== undefined ? matchedIndices.quantity : -1,
    mrpIdx: matchedIndices.mrp !== undefined ? matchedIndices.mrp : -1,
    catIdx: matchedIndices.category !== undefined ? matchedIndices.category : -1,
    subcatIdx: matchedIndices.subcategories !== undefined ? matchedIndices.subcategories : -1,
    supplierIdx: matchedIndices.supplier !== undefined ? matchedIndices.supplier : -1,
    sectionIdx: matchedIndices.section !== undefined ? matchedIndices.section : -1,
    expiryIdx: matchedIndices.expiryDate !== undefined ? matchedIndices.expiryDate : -1,
    weightIdx: matchedIndices.weight !== undefined ? matchedIndices.weight : -1,
    lengthIdx: matchedIndices.length !== undefined ? matchedIndices.length : -1,
    widthIdx: matchedIndices.width !== undefined ? matchedIndices.width : -1,
    heightIdx: matchedIndices.height !== undefined ? matchedIndices.height : -1,
    descIdx: matchedIndices.description !== undefined ? matchedIndices.description : -1,
    variantIdx: matchedIndices.variantName !== undefined ? matchedIndices.variantName : -1,
    imageIdx: matchedIndices.image !== undefined ? matchedIndices.image : -1,
  };
}

// Convert various date formats (DD-MM-YYYY, YYYY-MM-DD, D/M/YYYY) to standard YYYY-MM-DD for HTML input
function parseDateToYyyyMmDd(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  // 1. Check YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Check DD-MM-YYYY or DD/MM/YYYY or D/M/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Fallback standard Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

export default function ImportCsvModal({
  isOpen = false,
  onClose,
  onImportSuccess,
  categories = [],
  subcategories = [],
  suppliers = [],
  sections = [],
  effectiveStoreId = '',
  isManualUidEnabled = false,
  isSectionRestricted = false,
  currentUser = null,
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseError, setParseError] = useState('');
  const [previewItems, setPreviewItems] = useState([]);
  const [missingMandatoryHeaders, setMissingMandatoryHeaders] = useState([]);
  const fileInputRef = useRef(null);

  // Generate Sample CSV Template for user download
  const handleDownloadTemplate = () => {
    const templateHeaders = [
      'Product Name',
      ...(isManualUidEnabled ? ['UID / Barcode'] : []),
      'Cost Price',
      'Selling Price',
      'Stock Quantity',
      'MRP',
      'Category',
      'Subcategories',
      'Supplier',
      'Section',
      'Expiry Date',
      'Weight (g)',
      'Length (cm)',
      'Width (cm)',
      'Height (cm)',
      'Description',
      'Primary Image URL',
    ];

    const sampleSubcat = subcategories[0]?.name || 'Casual Shirts';
    const sampleCategory = categories[0]?.name || subcategories[0]?.category_name || 'Apparel';
    const sampleSupplier = suppliers[0]?.name || 'Apex Textiles Ltd';
    const sampleSection = sections[0]?.name || 'Menswear';

    const sampleRows = [
      [
        'Classic Oxford Cotton Shirt (Blue - L)',
        ...(isManualUidEnabled ? ['1000001'] : []),
        '450.00',
        '899.00',
        '25',
        '999.00',
        sampleCategory,
        sampleSubcat,
        sampleSupplier,
        sampleSection,
        '2028-12-31',
        '320',
        '35',
        '25',
        '3',
        'Premium 100% breathable cotton button-down shirt',
        'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400',
      ],
      [
        'Wireless Bluetooth Noise-Cancelling Earbuds',
        ...(isManualUidEnabled ? ['1000002'] : []),
        '1200.00',
        '2499.00',
        '15',
        '2999.00',
        categories[1]?.name || 'Electronics',
        subcategories[1]?.name || 'Audio & Accessories',
        suppliers[1]?.name || 'Sonic Distributors',
        sections[1]?.name || 'Electronics Hub',
        '',
        '160',
        '6.5',
        '5.0',
        '2.8',
        'Active noise cancelling earbuds with USB-C wireless charging case',
        '',
      ],
      [
        'Organic Mountain Honey 500g Glass Jar',
        ...(isManualUidEnabled ? ['1000003'] : []),
        '180.00',
        '320.00',
        '50',
        '350.00',
        categories[2]?.name || 'Groceries & Foods',
        subcategories[2]?.name || 'Spreads & Honey',
        suppliers[2]?.name || 'Pure Nature Foods',
        sections[2]?.name || 'Pantry & Grocery',
        '2027-06-30',
        '500',
        '10',
        '10',
        '15',
        '100% pure raw unfiltered multi-floral forest honey',
        '',
      ],
    ];

    const escapeCell = (c) => `"${String(c ?? '').replace(/"/g, '""')}"`;
    const csvContent =
      '\uFEFF' +
      [
        templateHeaders.map(escapeCell).join(','),
        ...sampleRows.map((r) => r.map(escapeCell).join(',')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'wondersale_product_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleProcessFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a valid .csv spreadsheet file.');
      setSelectedFile(null);
      setPreviewItems([]);
      return;
    }

    setParseError('');
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = parseCsvRows(text);

        if (rows.length < 2) {
          setParseError('The CSV file is empty or missing data rows.');
          setPreviewItems([]);
          return;
        }

        const rawHeaders = rows[0];
        const {
          uidIdx,
          nameIdx,
          costIdx,
          sellingIdx,
          qtyIdx,
          mrpIdx,
          catIdx,
          subcatIdx,
          supplierIdx,
          sectionIdx,
          locSecIdx,
          expiryIdx,
          weightIdx,
          lengthIdx,
          widthIdx,
          heightIdx,
          descIdx,
          variantIdx,
          imageIdx,
        } = resolveColumnIndices(rawHeaders);

        // Check Mandatory Header Requirements: Name, Cost Price, Selling Price, Stock Quantity
        const missing = [];
        if (nameIdx === -1) missing.push('Product Name');
        if (costIdx === -1) missing.push('Cost Price');
        if (sellingIdx === -1) missing.push('Selling Price');
        if (qtyIdx === -1) missing.push('Stock Quantity');

        if (missing.length > 0) {
          setMissingMandatoryHeaders(missing);
          setParseError(
            `Missing mandatory column(s): ${missing.join(', ')}. Please verify that your CSV contains headers for Product Name, Cost Price, Selling Price, and Stock Quantity.`
          );
          setPreviewItems([]);
          return;
        }

        setMissingMandatoryHeaders([]);

        // Parse data rows with Ditto Mark (", ,, -do-, ditto) convention support
        const dataRows = rows.slice(1);
        const parsedProducts = [];

        const isDitto = (v) => {
          if (!v) return false;
          const s = String(v).trim();
          return /^["'”’“„〃,]+$/i.test(s) || /^(-?do-?|ditto|d\/o|d\.o\.)$/i.test(s);
        };

        let prevRowValues = null;

        dataRows.forEach((row, rowIdx) => {
          // If the whole row is blank, skip
          if (!row.some((cell) => cell.trim() !== '')) return;

          let rawUid = uidIdx !== -1 ? (row[uidIdx] || '').trim() : '';
          let rawName = nameIdx !== -1 ? (row[nameIdx] || '').trim() : '';
          let rawCost = costIdx !== -1 ? (row[costIdx] || '').trim() : '';
          let rawSelling = sellingIdx !== -1 ? (row[sellingIdx] || '').trim() : '';
          let rawQty = qtyIdx !== -1 ? (row[qtyIdx] || '').trim() : '';
          let rawMrp = mrpIdx !== -1 ? (row[mrpIdx] || '').trim() : '';
          let rawCat = catIdx !== -1 ? (row[catIdx] || '').trim() : '';
          let rawSubcat = subcatIdx !== -1 ? (row[subcatIdx] || '').trim() : '';
          let rawSupplier = supplierIdx !== -1 ? (row[supplierIdx] || '').trim() : '';
          let rawSection = sectionIdx !== -1 ? (row[sectionIdx] || '').trim() : '';
          let rawExpiry = expiryIdx !== -1 ? (row[expiryIdx] || '').trim() : '';
          let rawWeight = weightIdx !== -1 ? (row[weightIdx] || '').trim() : '';
          let rawLength = lengthIdx !== -1 ? (row[lengthIdx] || '').trim() : '';
          let rawWidth = widthIdx !== -1 ? (row[widthIdx] || '').trim() : '';
          let rawHeight = heightIdx !== -1 ? (row[heightIdx] || '').trim() : '';
          let rawDesc = descIdx !== -1 ? (row[descIdx] || '').trim() : '';
          let rawVariant = variantIdx !== -1 ? (row[variantIdx] || '').trim() : '';
          let rawImage = imageIdx !== -1 ? (row[imageIdx] || '').trim() : '';

          // Ditto mark inheritance from previous row
          if (prevRowValues) {
            if (isDitto(rawName)) {
              rawName = prevRowValues.name;
            } else if (/^["'”’“„〃,]+/.test(rawName)) {
              const suffix = rawName.replace(/^["'”’“„〃,\s]+/, '').trim();
              const prevWords = prevRowValues.name.split(/\s+/);
              const unitPattern = /^\d+(\.\d+)?\s*(g|kg|ml|l|ltr|gm|oz|pk|pack|pcs|pc|m|cm|s|m|l|xl|xxl)?$/i;
              if (prevWords.length > 1 && unitPattern.test(suffix) && unitPattern.test(prevWords[prevWords.length - 1])) {
                rawName = `${prevWords.slice(0, -1).join(' ')} ${suffix}`.trim();
              } else if (prevRowValues.name) {
                rawName = `${prevRowValues.name} ${suffix}`.trim();
              } else {
                rawName = suffix;
              }
            }

            if (isDitto(rawCost) || (!rawCost && prevRowValues.cost)) rawCost = prevRowValues.cost;
            if (isDitto(rawSelling) || (!rawSelling && prevRowValues.selling)) rawSelling = prevRowValues.selling;
            if (isDitto(rawQty) || (!rawQty && prevRowValues.qty)) rawQty = prevRowValues.qty;
            if (isDitto(rawMrp)) rawMrp = prevRowValues.mrp;
            if (isDitto(rawCat) || (!rawCat && prevRowValues.cat)) rawCat = prevRowValues.cat;
            if (isDitto(rawSubcat) || (!rawSubcat && prevRowValues.subcat)) rawSubcat = prevRowValues.subcat;
            if (isDitto(rawSupplier) || (!rawSupplier && prevRowValues.supplier)) rawSupplier = prevRowValues.supplier;
            if (isDitto(rawSection) || (!rawSection && prevRowValues.section)) rawSection = prevRowValues.section;
            if (isDitto(rawExpiry)) rawExpiry = prevRowValues.expiry;
            if (isDitto(rawWeight)) rawWeight = prevRowValues.weight;
            if (isDitto(rawLength)) rawLength = prevRowValues.length;
            if (isDitto(rawWidth)) rawWidth = prevRowValues.width;
            if (isDitto(rawHeight)) rawHeight = prevRowValues.height;
            if (isDitto(rawDesc)) rawDesc = prevRowValues.description;
          }

          // Remember values for subsequent rows
          prevRowValues = {
            name: rawName,
            cost: rawCost,
            selling: rawSelling,
            qty: rawQty,
            mrp: rawMrp,
            cat: rawCat,
            subcat: rawSubcat,
            supplier: rawSupplier,
            section: rawSection,
            expiry: rawExpiry,
            weight: rawWeight,
            length: rawLength,
            width: rawWidth,
            height: rawHeight,
            description: rawDesc,
          };

          // 1. Match supplier against available suppliers
          let matchedSupplierId = '';
          let matchedSupplierName = '';
          if (rawSupplier) {
            const normRaw = rawSupplier.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const found = suppliers.find((s) => {
              const sNorm = (s.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              return sNorm === normRaw || (s.name || '').toLowerCase().trim() === rawSupplier.toLowerCase().trim();
            });
            if (found) {
              matchedSupplierId = String(found.id);
              matchedSupplierName = found.name;
            } else {
              matchedSupplierName = rawSupplier;
            }
          }

          // 2. Match Section against available Sections
          let matchedSectionId = '';
          let matchedSectionName = '';

          // If staff is section restricted, enforce their assigned section strictly
          if (isSectionRestricted && currentUser?.section) {
            matchedSectionId = String(currentUser.section);
            const foundSec = sections.find((s) => String(s.id) === String(currentUser.section));
            matchedSectionName = foundSec ? foundSec.name : (currentUser?.section_name || '');
          } else if (rawSection) {
            const normSec = rawSection.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const foundSec = sections.find((s) => {
              const sNorm = (s.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              const codeNorm = (s.code || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              return (sNorm && sNorm === normSec) || (codeNorm && codeNorm === normSec) || (s.name || '').toLowerCase().trim() === rawSection.toLowerCase().trim();
            });
            if (foundSec) {
              matchedSectionId = String(foundSec.id);
              matchedSectionName = foundSec.name;
            } else {
              matchedSectionName = rawSection;
            }
          }

          // 3. Match subcategories (and parent category if given)
          const matchedSubcatIds = [];
          const matchedSubcatObjs = [];

          const candidateTokens = [];
          if (rawSubcat) {
            candidateTokens.push(
              ...rawSubcat
                .split(/[,;|]/)
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean)
            );
          }
          if (rawCat) {
            // Also search subcategories that belong to the specified category
            const normCat = rawCat.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const matchedCategoryObj = categories.find((c) => {
              const cNorm = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              return cNorm === normCat || (c.name || '').toLowerCase().trim() === rawCat.toLowerCase().trim();
            });
            if (matchedCategoryObj && matchedCategoryObj.subcategories) {
              // If subcategory was empty, assign first subcat of this category
              if (candidateTokens.length === 0 && matchedCategoryObj.subcategories.length > 0) {
                const firstSub = matchedCategoryObj.subcategories[0];
                const scObj = subcategories.find((s) => String(s.id) === String(firstSub.id)) || firstSub;
                if (!matchedSubcatIds.includes(scObj.id)) {
                  matchedSubcatIds.push(scObj.id);
                  matchedSubcatObjs.push(scObj);
                }
              }
            }
          }

          if (candidateTokens.length > 0) {
            subcategories.forEach((sc) => {
              if (!sc || !sc.name) return;
              const scNameLower = sc.name.toLowerCase().trim();
              const scNorm = scNameLower.replace(/[^a-z0-9]/g, '');

              const isMatch =
                candidateTokens.some((token) => {
                  const tokenNorm = token.replace(/[^a-z0-9]/g, '');
                  return token === scNameLower || (tokenNorm.length > 0 && tokenNorm === scNorm);
                }) ||
                (rawSubcat && (rawSubcat.toLowerCase().trim() === scNameLower || rawSubcat.toLowerCase().replace(/[^a-z0-9]/g, '') === scNorm));

              if (isMatch) {
                if (!matchedSubcatIds.includes(sc.id)) {
                  matchedSubcatIds.push(sc.id);
                  matchedSubcatObjs.push(sc);
                }
              }
            });
          }

          // 4. Parse image URLs if present
          const parsedImages = [];
          if (rawImage) {
            const splitImages = rawImage
              .split(/[,;\n\r|]/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0 && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/') || s.startsWith('data:') || s.startsWith('blob:') || s.includes('.')));
            parsedImages.push(...splitImages);
          }

          // 5. Format expiry date to YYYY-MM-DD
          const formattedExpiry = parseDateToYyyyMmDd(rawExpiry);

          // Append variant tag to description if provided
          let finalDescription = rawDesc || '';
          if (rawVariant && !finalDescription.toLowerCase().includes(rawVariant.toLowerCase())) {
            finalDescription = finalDescription ? `${finalDescription} [Variant: ${rawVariant}]` : `Variant: ${rawVariant}`;
          }

          const parsedItem = {
            id: `staged_csv_${Date.now()}_${rowIdx}_${Math.random().toString(36).substr(2, 5)}`,
            uid: isManualUidEnabled && rawUid ? rawUid : '',
            name: rawName,
            store: effectiveStoreId,
            subcategories: matchedSubcatIds,
            subcategoryObjects: matchedSubcatObjs,
            supplierId: matchedSupplierId,
            supplierName: matchedSupplierName,
            sectionId: matchedSectionId,
            sectionName: matchedSectionName,
            costPrice: rawCost,
            cost_price: parseFloat(rawCost) || 0,
            sellingPrice: rawSelling,
            selling_price: parseFloat(rawSelling) || 0,
            mrp: rawMrp,
            mrp_val: rawMrp ? parseFloat(rawMrp) || null : null,
            initialQuantity: rawQty || '0',
            initial_quantity: parseInt(rawQty, 10) || 0,
            locationSection: matchedSectionName || '',
            expiryDate: formattedExpiry,
            weight: rawWeight,
            length: rawLength ? parseFloat(rawLength) || null : null,
            width: rawWidth ? parseFloat(rawWidth) || null : null,
            height: rawHeight ? parseFloat(rawHeight) || null : null,
            description: finalDescription,
            imageFiles: [],
            imagePreviews: parsedImages,
            storedImages: parsedImages.map((u, i) => ({
              name: `imported_photo_${rowIdx}_${i}.jpg`,
              dataUrl: u,
              type: 'image/jpeg',
              url: u,
            })),
            isFromCsv: true,
          };

          parsedProducts.push(parsedItem);
        });

        if (parsedProducts.length === 0) {
          setParseError('No valid product rows could be read from this CSV.');
          setPreviewItems([]);
          return;
        }

        setPreviewItems(parsedProducts);
      } catch (err) {
        console.error('CSV Parsing error:', err);
        setParseError(`Failed to parse CSV file: ${err.message}`);
        setPreviewItems([]);
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file.');
      setPreviewItems([]);
    };
    reader.readAsText(file);
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (previewItems.length === 0) return;
    onImportSuccess?.(previewItems);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="import-csv-modal-overlay"
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
      onClick={onClose}
    >
      <div
        className="glass-panel import-csv-modal-dialog"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
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
          className="import-csv-modal-header"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-solid, #161B2C)',
          }}
        >
          <div className="import-csv-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="import-csv-header-icon"
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
              <h2 className="import-csv-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Import Products from CSV
              </h2>
              <p className="import-csv-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Batch import products directly into your staged queue for rapid registration.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-icon import-csv-close-btn"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="import-csv-modal-body"
          style={{
            padding: '22px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* 1. CSV Structure & Mandatory Fields Guide */}
          <div
            className="import-csv-guide-card"
            style={{
              background: 'var(--bg-surface-hover)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '16px 18px',
            }}
          >
            <div
              className="import-csv-guide-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.88rem' }}>
                <HelpCircle size={16} style={{ color: 'var(--brand-primary)' }} />
                <span>CSV Column Structure &amp; Requirements</span>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="btn btn-secondary btn-sm import-csv-download-btn"
                style={{
                  fontSize: '0.76rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--color-success)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                }}
              >
                <Download size={13} />
                <span>Download Sample Template (.csv)</span>
              </button>
            </div>

            <div className="import-csv-columns-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {/* Mandatory Columns Box */}
              <div
                className="import-csv-mandatory-box"
                style={{
                  padding: '12px 14px',
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--brand-primary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Mandatory (Required)
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  <li><strong>Product Name</strong> <span style={{ color: 'var(--color-danger)' }}>*</span></li>
                  <li><strong>Cost Price</strong> <span style={{ color: 'var(--color-danger)' }}>*</span> (Numeric ₹)</li>
                  <li><strong>Selling Price</strong> <span style={{ color: 'var(--color-danger)' }}>*</span> (Numeric ₹)</li>
                  <li><strong>Stock Quantity</strong> <span style={{ color: 'var(--color-danger)' }}>*</span> (Units)</li>
                </ul>
              </div>

              {/* Recommended Columns Box */}
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#60A5FA', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Classification &amp; Section
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  <li><strong>MRP</strong> (Max retail price ₹)</li>
                  <li><strong>Category</strong> &amp; <strong>Subcategories</strong></li>
                  <li><strong>Section</strong> (Store Department / Section)</li>
                  <li><strong>Supplier</strong> (Vendor name)</li>
                </ul>
              </div>

              {/* Physical Specifications & Details Box */}
              <div
                className="import-csv-optional-box"
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Physical &amp; Additional
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {isManualUidEnabled && <li><strong>UID / Barcode</strong> (Custom Code)</li>}
                  <li><strong>Expiry Date</strong> (YYYY-MM-DD)</li>
                  <li><strong>Weight (g)</strong> &amp; <strong>Dimensions (L, W, H cm)</strong></li>
                  <li><strong>Description</strong> / Notes</li>
                  <li><strong>Primary Image URL</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* 2. Drag & Drop File Upload Area */}
          <div
            className="import-csv-dropzone"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '24px 20px',
              border: dragActive
                ? '2px dashed var(--brand-primary)'
                : selectedFile && !parseError
                ? '2px solid rgba(16, 185, 129, 0.5)'
                : '2px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              background: dragActive
                ? 'rgba(218, 41, 28, 0.08)'
                : selectedFile && !parseError
                ? 'rgba(16, 185, 129, 0.04)'
                : 'var(--bg-surface-hover)',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
            />

            <div
              className="import-csv-dropzone-icon"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: selectedFile && !parseError ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                color: selectedFile && !parseError ? 'var(--color-success)' : 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedFile && !parseError ? <Check size={24} /> : <Upload size={24} />}
            </div>

            <div className="import-csv-dropzone-text">
              <div className="import-csv-dropzone-title" style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                {selectedFile ? selectedFile.name : 'Click to select or drag and drop your CSV file'}
              </div>
              <div className="import-csv-dropzone-sub" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Standard CSV format (.csv) with comma separators • UTF-8 encoded
              </div>
            </div>
          </div>

          {/* Error Banner if missing mandatory headers or corrupt file */}
          {parseError && (
            <div
              className="import-csv-error-alert"
              style={{
                padding: '12px 16px',
                background: 'var(--color-danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-danger)',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700 }}>Import Validation Failed</div>
                <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{parseError}</div>
              </div>
            </div>
          )}

          {/* 3. Parsed Summary Box & Quick Preview Table */}
          {previewItems.length > 0 && !parseError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                className="import-csv-summary-box"
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div className="import-csv-summary-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--color-success)' }}>
                      {previewItems.length} Products Parsed Successfully!
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Ready to add into your staged queue for final review and one-click bulk registration.
                    </div>
                  </div>
                </div>

                <div
                  className="import-csv-summary-badge"
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {previewItems.reduce((acc, p) => acc + (parseInt(p.initialQuantity, 10) || 0), 0)} Total Units
                </div>
              </div>

              {/* Compact Preview Table */}
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface-hover)', zIndex: 1 }}>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 10px' }}>#</th>
                      {isManualUidEnabled && <th style={{ padding: '6px 10px' }}>UID</th>}
                      <th style={{ padding: '6px 10px' }}>Product Name</th>
                      <th style={{ padding: '6px 10px' }}>Qty</th>
                      <th style={{ padding: '6px 10px' }}>Cost</th>
                      <th style={{ padding: '6px 10px' }}>Selling</th>
                      <th style={{ padding: '6px 10px' }}>Section</th>
                      <th style={{ padding: '6px 10px' }}>Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((p, idx) => (
                      <tr
                        key={p.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                        }}
                      >
                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        {isManualUidEnabled && (
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: p.uid ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                            {p.uid || 'Auto'}
                          </td>
                        )}
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.name}
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 700 }}>{p.initialQuantity}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>₹{p.costPrice}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--color-success)', fontWeight: 600 }}>₹{p.sellingPrice}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>
                          {p.sectionName || '—'}
                        </td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{p.supplierName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="import-csv-modal-footer"
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
          <button type="button" onClick={onClose} className="btn btn-secondary import-csv-cancel-btn">
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={previewItems.length === 0 || Boolean(parseError)}
            className="btn btn-primary import-csv-submit-btn"
            style={{
              fontWeight: 800,
              padding: '10px 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>Add to Staged List ({previewItems.length})</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
