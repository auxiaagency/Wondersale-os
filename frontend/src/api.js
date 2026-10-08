const API_BASE = '/api/inventory';
const STAFF_API = '/api/staff';
const STAKEHOLDERS_API = '/api/stakeholders';

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function getAuthHeaders(extraHeaders = {}) {
  const staffId = localStorage.getItem('wondersale_staff_id');
  const sessionToken = localStorage.getItem('wondersale_session_token');
  const headers = { ...extraHeaders };
  if (staffId) {
    headers['X-Staff-Id'] = staffId;
  }
  if (sessionToken) {
    headers['X-Session-Token'] = sessionToken;
  }
  const csrfToken = getCookie('csrftoken');
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }
  return headers;
}

/**
 * Dispatches global session termination event to kick user to login screen.
 */
export function triggerSessionTermination(message) {
  const wasLoggedIn = Boolean(localStorage.getItem('wondersale_staff_id'));
  localStorage.removeItem('wondersale_staff_id');
  localStorage.removeItem('wondersale_staff_user');
  localStorage.removeItem('wondersale_session_token');
  if (wasLoggedIn && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('wondersale_session_expired', {
        detail: {
          message:
            message ||
            'Your session has ended because your password was changed or your session was revoked from another device. Please log in again.',
        },
      })
    );
  }
}

/**
 * Robust error extractor parsing detail, error, message, or nested DRF field validation dicts.
 */
export async function parseApiError(res, defaultMsg = 'Request failed') {
  try {
    const data = await res.json();
    if (data.detail) return data.detail;
    if (data.error) return data.error;
    if (data.message) return data.message;
    if (typeof data === 'object' && !Array.isArray(data)) {
      const keys = Object.keys(data);
      if (keys.length > 0) {
        const firstVal = data[keys[0]];
        if (Array.isArray(firstVal) && firstVal.length > 0) {
          return `${keys[0]}: ${firstVal[0]}`;
        }
        if (typeof firstVal === 'string') {
          return `${keys[0]}: ${firstVal}`;
        }
      }
    }
    return defaultMsg;
  } catch {
    return `${defaultMsg} (${res.status} ${res.statusText})`;
  }
}

/**
 * Resilient fetch wrapper with automatic single-retry on transient network dropouts for GET requests.
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 401 && !url.includes('/auth/login/')) {
        triggerSessionTermination();
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && (!options.method || options.method.toUpperCase() === 'GET')) {
        await new Promise((r) => setTimeout(r, 400));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

// ----------------- Authentication & Current Staff -----------------

export async function loginStaff(staff_id, password, store_id) {
  const payload = { staff_id, password };
  if (store_id) {
    payload.store_id = store_id;
  }
  const res = await fetch(`${STAFF_API}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Invalid Staff ID or Password.');
  }
  const data = await res.json();
  if (data.staff?.staff_id) {
    localStorage.setItem('wondersale_staff_id', data.staff.staff_id);
    localStorage.setItem('wondersale_staff_user', JSON.stringify(data.staff));
    const token = data.session_token || data.staff.session_token;
    if (token) {
      localStorage.setItem('wondersale_session_token', token);
    }
  }
  return data;
}

export async function logoutStaff() {
  try {
    await fetch(`${STAFF_API}/auth/logout/`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (e) {
    console.error('Logout error', e);
  } finally {
    localStorage.removeItem('wondersale_staff_id');
    localStorage.removeItem('wondersale_staff_user');
    localStorage.removeItem('wondersale_session_token');
  }
  return true;
}

export async function getStaffMe() {
  const res = await fetch(`${STAFF_API}/auth/me/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) {
      triggerSessionTermination();
    } else {
      localStorage.removeItem('wondersale_staff_id');
      localStorage.removeItem('wondersale_staff_user');
      localStorage.removeItem('wondersale_session_token');
    }
    return null;
  }
  const data = await res.json();
  localStorage.setItem('wondersale_staff_user', JSON.stringify(data));
  if (data.session_token) {
    localStorage.setItem('wondersale_session_token', data.session_token);
  }
  return data;
}

export async function revokeStaffSessions(id) {
  const res = await fetch(`${STAFF_API}/members/${id}/revoke-sessions/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });
  if (!res.ok) {
    const err = await parseApiError(res, 'Failed to revoke staff sessions.');
    throw new Error(err);
  }
  return res.json();
}

// ----------------- Staff Directory (Owner Only) -----------------

export async function fetchStaffMembers() {
  const res = await fetch(`${STAFF_API}/members/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch staff directory.');
  return res.json();
}

export async function createStaffMember(data) {
  const isFormData = data instanceof FormData;
  const headers = isFormData ? getAuthHeaders() : getAuthHeaders({ 'Content-Type': 'application/json' });
  const body = isFormData ? data : JSON.stringify(data);
  const res = await fetch(`${STAFF_API}/members/`, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create staff member.';
    throw new Error(message);
  }
  return res.json();
}

export async function updateStaffMember(id, data) {
  const isFormData = data instanceof FormData;
  const headers = isFormData ? getAuthHeaders() : getAuthHeaders({ 'Content-Type': 'application/json' });
  const body = isFormData ? data : JSON.stringify(data);
  const res = await fetch(`${STAFF_API}/members/${id}/`, {
    method: 'PATCH',
    headers,
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update staff member.';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteStaffMember(id) {
  const res = await fetch(`${STAFF_API}/members/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete staff member.');
  return true;
}

// ----------------- Staff Roles & Categories (Owner Only) -----------------

export async function fetchStaffRoles() {
  const res = await fetch(`${STAFF_API}/roles/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch staff roles.');
  return res.json();
}

export async function createStaffRole(data) {
  const res = await fetch(`${STAFF_API}/roles/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create role.';
    throw new Error(message);
  }
  return res.json();
}

export async function updateStaffRole(id, data) {
  const res = await fetch(`${STAFF_API}/roles/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update role.';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteStaffRole(id) {
  const res = await fetch(`${STAFF_API}/roles/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete role.');
  return true;
}

// ----------------- Inventory APIs -----------------

export async function fetchStores() {
  const res = await fetch(`${API_BASE}/stores/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch stores');
  return res.json();
}

export async function createStore(data) {
  const res = await fetch(`${API_BASE}/stores/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create store branch';
    throw new Error(message);
  }
  return res.json();
}

export async function updateStore(id, data) {
  const res = await fetch(`${API_BASE}/stores/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update store branch';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteStore(id) {
  const res = await fetch(`${API_BASE}/stores/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete store branch');
  return true;
}

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function createCategory(data) {
  const payload = typeof data === 'string' ? { name: data } : data;
  const res = await fetch(`${API_BASE}/categories/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create category';
    throw new Error(message);
  }
  return res.json();
}

export async function updateCategory(id, data) {
  const payload = typeof data === 'string' ? { name: data } : data;
  const res = await fetch(`${API_BASE}/categories/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update category';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteCategory(id) {
  const res = await fetch(`${API_BASE}/categories/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete category');
  return true;
}

// ----------------- SubCategories APIs -----------------

export async function fetchSubcategories(params = {}) {
  const url = new URL(`${window.location.origin}${API_BASE}/subcategories/`);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.append(key, val);
    }
  });
  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch subcategories');
  return res.json();
}

export async function createSubcategory(data) {
  const res = await fetch(`${API_BASE}/subcategories/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create subcategory';
    throw new Error(message);
  }
  return res.json();
}

export async function updateSubcategory(id, data) {
  const res = await fetch(`${API_BASE}/subcategories/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update subcategory');
  return res.json();
}

export async function deleteSubcategory(id) {
  const res = await fetch(`${API_BASE}/subcategories/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete subcategory');
  return true;
}

// ----------------- Suppliers APIs -----------------

export async function fetchSuppliers(params = {}) {
  const url = new URL(`${window.location.origin}${API_BASE}/suppliers/`);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.append(key, val);
    }
  });
  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch suppliers');
  return res.json();
}

export async function fetchSupplier(id) {
  const res = await fetch(`${API_BASE}/suppliers/${id}/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch supplier details');
  return res.json();
}

export async function createSupplier(data) {
  const res = await fetch(`${API_BASE}/suppliers/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create supplier';
    throw new Error(message);
  }
  return res.json();
}

export async function updateSupplier(id, data) {
  const res = await fetch(`${API_BASE}/suppliers/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update supplier';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteSupplier(id) {
  const res = await fetch(`${API_BASE}/suppliers/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete supplier');
  return true;
}

// ----------------- Sections (Departments / Aisles) APIs -----------------

export async function fetchSections(params = {}) {
  const url = new URL(`${window.location.origin}${API_BASE}/sections/`);
  const effectiveParams = typeof params === 'object' && params !== null ? params : { store: params };
  Object.entries(effectiveParams).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.append(key, val);
    }
  });
  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch sections');
  return res.json();
}

export async function fetchSection(id) {
  const res = await fetch(`${API_BASE}/sections/${id}/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch section details');
  return res.json();
}

export async function createSection(data) {
  const res = await fetch(`${API_BASE}/sections/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create section';
    throw new Error(message);
  }
  return res.json();
}

export async function updateSection(id, data) {
  const res = await fetch(`${API_BASE}/sections/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update section';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteSection(id) {
  const res = await fetch(`${API_BASE}/sections/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete section');
  return true;
}

export async function fetchItems(params = {}) {
  const url = new URL(`${window.location.origin}${API_BASE}/items/`);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.append(key, val);
    }
  });

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch items');
  return res.json();
}

export const getItems = fetchItems;

export async function fetchItemByUid(uid) {
  const res = await fetch(`${API_BASE}/items/by-uid/${encodeURIComponent(uid)}/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to lookup item with UID ${uid}`);
  }
  return res.json();
}

export async function checkItemUidExists(uid, excludeId = null) {
  if (!uid || !String(uid).trim()) return { exists: false, uid: '' };
  const url = new URL(`${window.location.origin}${API_BASE}/items/check-uid/`);
  url.searchParams.append('uid', String(uid).trim());
  if (excludeId) url.searchParams.append('exclude_id', excludeId);
  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to check UID availability');
  return res.json();
}

export async function fetchItem(id) {
  const res = await fetch(`${API_BASE}/items/${id}/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch item ${id}`);
  return res.json();
}

export async function fetchProductAnalytics(id) {
  const res = await fetch(`${API_BASE}/items/${id}/product-analytics/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch product analytics for item ${id}`);
  return res.json();
}

export async function createItem(data) {
  const res = await fetch(`${API_BASE}/items/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create item';
    throw new Error(message);
  }
  return res.json();
}

export async function updateItem(id, data) {
  const res = await fetch(`${API_BASE}/items/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update item';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteItem(id) {
  const res = await fetch(`${API_BASE}/items/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete item ${id}`);
  return true;
}

export async function adjustStock(id, { change, reason, note }) {
  const res = await fetch(`${API_BASE}/items/${id}/adjust-stock/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ change, reason, note }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to adjust stock');
  }
  return res.json();
}

export async function uploadItemImages(id, fileList) {
  const formData = new FormData();
  Array.from(fileList).forEach((file) => {
    formData.append('images', file);
  });

  const res = await fetch(`${API_BASE}/items/${id}/upload-images/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload images');
  return res.json();
}

export async function setImagePrimary(imageId) {
  const res = await fetch(`${API_BASE}/images/${imageId}/set-primary/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to set primary image');
  return res.json();
}

export async function deleteItemImage(imageId) {
  const res = await fetch(`${API_BASE}/images/${imageId}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete image');
  return true;
}

export async function fetchStockMovements(id, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/items/${id}/stock-movements/${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch stock movements');
  return res.json();
}

export async function fetchAllStockMovements(params = {}) {
  const url = new URL(`${window.location.origin}${API_BASE}/stock-movements/`);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.append(key, val);
    }
  });
  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch stock ledger movements');
  return res.json();
}

export function getBarcodeUrl(id, download = false) {
  return `${API_BASE}/items/${id}/barcode/${download ? '?download=1' : ''}`;
}

// ----------------- Gemini AI Multimodal OCR & Bill Extraction -----------------

export async function extractProductsFromBill(formData) {
  // Ensure saved Gemini API keys from settings/localStorage are included
  if (formData instanceof FormData && !formData.has('api_keys')) {
    const keys = getStoredGeminiApiKeys();
    if (keys && keys.length > 0) {
      formData.append('api_keys', JSON.stringify(keys));
    }
  }

  const res = await fetch(`${API_BASE}/items/extract-from-bill/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.error || data.detail || 'Failed to extract bill items with Gemini AI.';
    const error = new Error(errorMsg);
    error.status = res.status;
    error.quotaExhausted = data.quota_exhausted || res.status === 429;
    error.keyErrors = data.key_errors || [];
    error.keysTried = data.keys_tried || 0;
    error.data = data;
    throw error;
  }
  return data;
}

export async function testGeminiApiKey(apiKey) {
  const res = await fetch(`${API_BASE}/items/test-gemini-key/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ api_key: apiKey }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Gemini API connection test failed.');
  }
  return data;
}

// ----------------- Customer Directory & Management -----------------

export async function getCustomers(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.sort) query.append('sort', params.sort);
  if (params.store) query.append('store', params.store);
  if (params.store_id) query.append('store_id', params.store_id);

  const url = `${API_BASE}/customers/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch customers');
  return res.json();
}

export async function createCustomer(data) {
  const res = await fetch(`${API_BASE}/customers/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      err.detail ||
      err.phone?.[0] ||
      err.vip_card_uid?.[0] ||
      (typeof err === 'object' ? Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : 'Failed to create customer');
    throw new Error(msg);
  }
  return res.json();
}

export async function updateCustomer(id, data) {
  const res = await fetch(`${API_BASE}/customers/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      err.detail ||
      err.phone?.[0] ||
      err.vip_card_uid?.[0] ||
      (typeof err === 'object' ? Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : 'Failed to update customer');
    throw new Error(msg);
  }
  return res.json();
}

export async function detachVipCard(customerId) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/detach_card/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || (typeof data === 'object' ? Object.values(data).flat().join(', ') : 'Failed to detach VIP card');
    throw new Error(msg);
  }
  return data;
}

export async function deleteCustomer(id) {
  const res = await fetch(`${API_BASE}/customers/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete customer');
  return true;
}

export async function lookupCustomer(query, storeId = null) {
  if (!query || !query.trim()) return [];
  const params = new URLSearchParams({ q: query.trim() });
  if (storeId) params.append('store', storeId);
  const res = await fetch(`${API_BASE}/customers/lookup/?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getCustomerHistory(customerId, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/customers/${customerId}/history/${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch customer purchase history');
  return res.json();
}

export async function assignVipCard(customerId, payload) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/assign_card/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.card_uid?.[0] || data.error || (typeof data === 'object' ? Object.values(data).flat().join(', ') : 'Failed to assign VIP card');
    throw new Error(msg);
  }
  return data;
}

export async function rechargeVipCard(customerId, payload) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/recharge_card/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.amount?.[0] || data.error || (typeof data === 'object' ? Object.values(data).flat().join(', ') : 'Failed to recharge VIP card');
    throw new Error(msg);
  }
  return data;
}

export async function lookupCustomerByCardUid(cardUid) {
  if (!cardUid || !cardUid.trim()) return null;
  const res = await fetch(`${API_BASE}/customers/lookup_card/?card_uid=${encodeURIComponent(cardUid.trim())}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getVipTransactions(customerId, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/customers/${customerId}/vip_transactions/${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch VIP card transactions');
  return res.json();
}

// ----------------- Counter Cash / Expense Payouts -----------------

export async function getCounterPayouts(params = {}) {
  const query = new URLSearchParams();
  if (params.store) query.append('store', params.store);
  if (params.store_id) query.append('store_id', params.store_id);
  if (params.search) query.append('search', params.search);
  if (params.category) query.append('category', params.category);
  if (params.payment_method) query.append('payment_method', params.payment_method);

  const url = `${API_BASE}/counter-payouts/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch counter payouts');
  return res.json();
}

export async function createCounterPayout(data) {
  const res = await fetch(`${API_BASE}/counter-payouts/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      resData.detail ||
      resData.amount?.[0] ||
      resData.paid_to?.[0] ||
      (typeof resData === 'object' ? Object.entries(resData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : 'Failed to record counter payout');
    throw new Error(msg);
  }
  return resData;
}

export async function deleteCounterPayout(id) {
  const res = await fetch(`${API_BASE}/counter-payouts/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete payout record');
  return true;
}

// ----------------- Billing, POS & Sales Invoices -----------------

export async function processCheckout(payload) {
  const res = await fetch(`${API_BASE}/sales/checkout/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      typeof data === 'string'
        ? data
        : data.detail ||
          (Array.isArray(data.items) ? data.items.join(', ') : null) ||
          data.customer_phone?.[0] ||
          (data.non_field_errors ? data.non_field_errors.join(', ') : null) ||
          (typeof data === 'object' ? Object.values(data).flat().join(', ') : null) ||
          'Checkout transaction failed.';
    throw new Error(errMsg);
  }
  return data;
}

export async function sendSaleOrderWhatsApp(orderId, phone = null, pdfBlob = null, forceResend = false) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    if (pdfBlob) {
      const formData = new FormData();
      if (phone) formData.append('phone', phone);
      if (forceResend) formData.append('force', 'true');
      formData.append('pdf_file', pdfBlob, `Wondersale_Bill_${orderId}.pdf`);
      res = await fetch(`${API_BASE}/sales/${orderId}/send-whatsapp/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
        signal: controller.signal,
      });
    } else {
      const payload = phone ? { phone } : {};
      if (forceResend) payload.force = true;
      res = await fetch(`${API_BASE}/sales/${orderId}/send-whatsapp/`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Sending bill via WhatsApp timed out. Please check customer phone number and network connectivity.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Failed to send WhatsApp message via Meta Cloud API.');
  }
  return data;
}



export async function getSaleOrders(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });

  const url = `${API_BASE}/sales/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch sales records');
  return res.json();
}

export async function getSaleOrderDetail(id) {
  const res = await fetch(`${API_BASE}/sales/${id}/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch sales invoice details');
  return res.json();
}

export async function recordOrderDuePayment(orderId, paymentData) {
  const res = await fetch(`${API_BASE}/sales/${orderId}/record-payment/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(paymentData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Failed to record due payment');
  }
  return data;
}

export async function getDuesSummary(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const res = await fetch(`${API_BASE}/sales/dues-summary/${query.toString() ? `?${query.toString()}` : ''}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch customer dues summary');
  return res.json();
}

export async function updateSaleOrder(id, patchData) {
  const res = await fetch(`${API_BASE}/sales/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patchData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      typeof data === 'string'
        ? data
        : data.detail ||
          data.error ||
          (data.payment_method ? data.payment_method.join(', ') : null) ||
          (data.non_field_errors ? data.non_field_errors.join(', ') : null) ||
          'Failed to update sale order.';
    throw new Error(errMsg);
  }
  return data;
}

export async function lookupSaleOrderForReturn(invoiceNumber) {
  const res = await fetch(`${API_BASE}/sales/lookup-for-return/?invoice_number=${encodeURIComponent(invoiceNumber)}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || `Bill #${invoiceNumber} not found.`);
  }
  return data;
}

export async function processSaleOrderReturn(payload) {
  const res = await fetch(`${API_BASE}/sales/process-return/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      typeof data === 'string'
        ? data
        : data.error ||
          data.detail ||
          (data.items ? (typeof data.items === 'string' ? data.items : JSON.stringify(data.items)) : null) ||
          (data.non_field_errors ? data.non_field_errors.join(', ') : null) ||
          'Failed to process product return.';
    throw new Error(errMsg);
  }
  return data;
}

// ----------------- Stakeholders & Profit-Sharing API -----------------

export async function fetchStakeholdersStatus(store_id = null) {
  const qs = store_id ? `?store_id=${store_id}` : '';
  const res = await fetch(`${API_BASE}/stores/toggle-stakeholders/${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch stakeholders status');
  return res.json();
}

export async function toggleStakeholdersSystem({ enable_stakeholders, store_id = null } = {}) {
  const res = await fetch(`${API_BASE}/stores/toggle-stakeholders/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ enable_stakeholders, store_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Failed to toggle stakeholders setting');
  }
  return res.json();
}

export async function getStakeholders(params = {}) {
  const query = new URLSearchParams();
  if (params.store) query.append('store', params.store);
  if (params.search) query.append('search', params.search);
  if (params.status) query.append('status', params.status);

  const url = `${STAKEHOLDERS_API}/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch stakeholders');
  return res.json();
}

export async function getStakeholder(id) {
  const res = await fetch(`${STAKEHOLDERS_API}/${id}/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch stakeholder ${id}`);
  return res.json();
}

export async function createStakeholder(data) {
  const res = await fetch(`${STAKEHOLDERS_API}/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to create stakeholder';
    throw new Error(message);
  }
  return res.json();
}

export async function updateStakeholder(id, data) {
  const res = await fetch(`${STAKEHOLDERS_API}/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update stakeholder';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteStakeholder(id) {
  const res = await fetch(`${STAKEHOLDERS_API}/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete stakeholder ${id}`);
  return true;
}

export async function getStakeholderAnalytics(params = {}) {
  const query = new URLSearchParams();
  if (params.timeframe) query.append('timeframe', params.timeframe);
  if (params.store) query.append('store', params.store);
  if (params.year) query.append('year', params.year);
  if (params.month) query.append('month', params.month);
  if (params.year_month) query.append('year_month', params.year_month);

  const url = `${STAKEHOLDERS_API}/analytics/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch stakeholder analytics');
  return res.json();
}

export async function recordStakeholderPayout(id, data) {
  const res = await fetch(`${STAKEHOLDERS_API}/${id}/record_payout/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = Object.entries(errData)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to record payout';
    throw new Error(message);
  }
  return res.json();
}

export async function getStakeholderPayouts(id, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${STAKEHOLDERS_API}/${id}/payouts/${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch payout records');
  return res.json();
}

// ----------------- Accounts & Finance: Financial Intelligence -----------------

const ACCOUNTING_API = '/api/accounting';

export async function fetchMonthlyFinancialAnalysis(params = {}) {
  const query = new URLSearchParams();
  if (params.store) query.append('store', params.store);
  if (params.year) query.append('year', params.year);
  if (params.month) query.append('month', params.month);
  if (params.start_date) query.append('start_date', params.start_date);
  if (params.end_date) query.append('end_date', params.end_date);

  const url = `${ACCOUNTING_API}/financial-analysis/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch monthly financial analysis');
  return res.json();
}

// ----------------- Accounts & Finance: Operating Expenses -----------------

export async function fetchOperatingExpenses(params = {}) {
  const query = new URLSearchParams();
  if (params.store) query.append('store', params.store);
  if (params.year) query.append('year', params.year);
  if (params.month) query.append('month', params.month);
  if (params.start_date) query.append('start_date', params.start_date);
  if (params.end_date) query.append('end_date', params.end_date);
  if (params.category && params.category !== 'all') query.append('category', params.category);
  if (params.payment_method && params.payment_method !== 'all') query.append('payment_method', params.payment_method);
  if (params.search) query.append('search', params.search);

  const url = `${ACCOUNTING_API}/operating-expenses/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch operating expenses');
  return res.json();
}

export async function fetchOperatingExpenseSummary(params = {}) {
  const query = new URLSearchParams();
  if (params.store) query.append('store', params.store);
  if (params.year) query.append('year', params.year);
  if (params.month) query.append('month', params.month);
  if (params.start_date) query.append('start_date', params.start_date);
  if (params.end_date) query.append('end_date', params.end_date);

  const url = `${ACCOUNTING_API}/operating-expenses/summary/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch operating expense summary');
  return res.json();
}

export async function createOperatingExpense(data) {
  const res = await fetch(`${ACCOUNTING_API}/operating-expenses/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to record operating expense';
    throw new Error(message);
  }
  return res.json();
}

export async function updateOperatingExpense(id, data) {
  const res = await fetch(`${ACCOUNTING_API}/operating-expenses/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ') || 'Failed to update operating expense';
    throw new Error(message);
  }
  return res.json();
}

export async function deleteOperatingExpense(id) {
  const res = await fetch(`${ACCOUNTING_API}/operating-expenses/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete operating expense ${id}`);
  return true;
}

// ----------------- Daily Cash Register Shifts (Day-Start & Day-End) -----------------

export async function getCurrentRegisterShift(params = {}) {
  const query = new URLSearchParams();
  const storeId = typeof params === 'object' ? params.store : params;
  if (storeId) query.append('store', storeId);

  const url = `${API_BASE}/register-shifts/current-shift/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch active register shift');
  return res.json();
}

export async function openRegisterShift(data) {
  const res = await fetch(`${API_BASE}/register-shifts/open-shift/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Failed to open register shift');
  }
  return res.json();
}

export async function closeRegisterShift(id, data) {
  const res = await fetch(`${API_BASE}/register-shifts/${id}/close-shift/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Failed to close register shift');
  }
  return res.json();
}

export async function getRegisterShifts(params = {}) {
  const query = new URLSearchParams();
  if (params.store && params.store !== 'all') query.append('store', params.store);
  if (params.status) query.append('status', params.status);
  if (params.date) query.append('date', params.date);
  if (params.start_date) query.append('start_date', params.start_date);
  if (params.end_date) query.append('end_date', params.end_date);
  if (params.has_discrepancy !== undefined) query.append('has_discrepancy', params.has_discrepancy);
  if (params.is_discrepancy_settled !== undefined) query.append('is_discrepancy_settled', params.is_discrepancy_settled);
  if (params.start_time) query.append('start_time', params.start_time);
  if (params.end_time) query.append('end_time', params.end_time);

  const url = `${API_BASE}/register-shifts/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch register shifts history');
  return res.json();
}

export async function settleRegisterDiscrepancy(id, data) {
  const res = await fetch(`${API_BASE}/register-shifts/${id}/settle-discrepancy/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Failed to settle register discrepancy');
  }
  return res.json();
}

export async function fetchDashboardAnalytics(storeId, startDate, endDate) {
  let url = `${API_BASE}/dashboard-analytics/`;
  const params = [];
  if (storeId && storeId !== 'all') params.push(`store_id=${encodeURIComponent(storeId)}`);
  if (startDate) params.push(`start_date=${encodeURIComponent(startDate)}`);
  if (endDate) params.push(`end_date=${encodeURIComponent(endDate)}`);
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Failed to load dashboard analytics');
  }
  return await res.json();
}

export async function fetchExpiryAnalytics(storeId) {
  let url = `${API_BASE}/expiry-analytics/`;
  if (storeId && storeId !== 'all') {
    url += `?store_id=${encodeURIComponent(storeId)}`;
  }
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Failed to load expiry analytics');
  }
  return await res.json();
}

// ----------------- Stage 1: Employee Management & Attendance API -----------------

export async function fetchEmployees(params = {}) {
  const query = new URLSearchParams();
  if (params.store_id) query.append('store_id', params.store_id);
  if (params.search) query.append('search', params.search);
  if (params.status) query.append('status', params.status);

  const url = `${STAFF_API}/employees/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch employees');
  return res.json();
}

export async function createEmployee(data) {
  const isFormData = data instanceof FormData;
  const headers = isFormData ? getAuthHeaders() : getAuthHeaders({ 'Content-Type': 'application/json' });
  const body = isFormData ? data : JSON.stringify(data);
  const res = await fetch(`${STAFF_API}/employees/`, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || JSON.stringify(err) || 'Failed to create employee');
  }
  return res.json();
}

export async function updateEmployee(id, data) {
  const isFormData = data instanceof FormData;
  const headers = isFormData ? getAuthHeaders() : getAuthHeaders({ 'Content-Type': 'application/json' });
  const body = isFormData ? data : JSON.stringify(data);
  const res = await fetch(`${STAFF_API}/employees/${id}/`, {
    method: 'PATCH',
    headers,
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || JSON.stringify(err) || 'Failed to update employee');
  }
  return res.json();
}

export async function assignEmployeeCard(employeeId, card_uid, reason) {
  const res = await fetch(`${STAFF_API}/employees/${employeeId}/assign-card/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ card_uid, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to assign RFID card');
  }
  return res.json();
}

export async function deactivateEmployeeCard(employeeId, card_id, reason, status = 'deactivated') {
  const res = await fetch(`${STAFF_API}/employees/${employeeId}/deactivate-card/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ card_id, reason, status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to deactivate card');
  }
  return res.json();
}

export async function inspectCard(card_uid) {
  const clean = (card_uid || '').trim().toUpperCase();
  if (!clean) return { success: false, message: 'Card UID is required', is_assigned: false, assigned_type: 'none' };
  const res = await fetch(`${API_BASE}/customers/inspect-card/?card_uid=${encodeURIComponent(clean)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || err.message || 'Failed to inspect card');
  }
  return res.json();
}

export async function transferEmployeeStore(employeeId, store_id, effective_date, notes) {
  const res = await fetch(`${STAFF_API}/employees/${employeeId}/transfer-store/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id, effective_date, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to transfer store');
  }
  return res.json();
}

export async function assignEmployeeShift(employeeId, data) {
  const res = await fetch(`${STAFF_API}/employees/${employeeId}/assign-shift/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to assign shift');
  }
  return res.json();
}

export async function fetchEmployeeMonthSummary(employeeId, year, month) {
  const res = await fetch(`${STAFF_API}/employees/${employeeId}/month-summary/?year=${year}&month=${month}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch month summary');
  return res.json();
}

export async function fetchShifts(store_id) {
  const url = `${STAFF_API}/shifts/${store_id ? `?store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch shifts');
  return res.json();
}

export async function createShift(data) {
  const res = await fetch(`${STAFF_API}/shifts/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || JSON.stringify(err) || 'Failed to create shift');
  }
  return res.json();
}

export async function updateShift(id, data) {
  const res = await fetch(`${STAFF_API}/shifts/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update shift');
  return res.json();
}

export async function deleteShift(id) {
  const res = await fetch(`${STAFF_API}/shifts/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete shift');
  return true;
}

export async function fetchKioskDevices(store_id) {
  const url = `${STAFF_API}/kiosk-devices/${store_id ? `?store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch kiosk devices');
  return res.json();
}

export async function createKioskDevice(data) {
  const res = await fetch(`${STAFF_API}/kiosk-devices/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to register kiosk device');
  }
  return res.json();
}

export async function deleteKioskDevice(id) {
  const res = await fetch(`${STAFF_API}/kiosk-devices/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete kiosk device');
  return true;
}

export async function fetchDailyAttendance(params = {}) {
  const query = new URLSearchParams();
  if (params.store_id) query.append('store_id', params.store_id);
  if (params.date) query.append('date', params.date);
  if (params.status) query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.needs_review) query.append('needs_review', params.needs_review);

  const res = await fetch(`${STAFF_API}/attendance/daily/?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch daily attendance');
  return res.json();
}

export async function overrideAttendanceDay(attendance_day_id, status, reason) {
  const res = await fetch(`${STAFF_API}/attendance/daily/override/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ attendance_day_id, status, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to override attendance day status');
  }
  return res.json();
}

export async function clearAttendanceOverride(attendance_day_id, reason) {
  const res = await fetch(`${STAFF_API}/attendance/daily/clear-override/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ attendance_day_id, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to clear override');
  }
  return res.json();
}

export async function addManualPunch(employee_id, punched_at, note) {
  const res = await fetch(`${STAFF_API}/attendance/daily/manual-punch/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ employee_id, punched_at, note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to add manual punch');
  }
  return res.json();
}

export async function recordManualAttendanceDay(payload) {
  const res = await fetch(`${STAFF_API}/attendance/daily/manual-entry/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.detail || err.error || err.message || (typeof err === 'object' && Object.keys(err).length > 0 ? JSON.stringify(err) : null);
    throw new Error(msg || `Failed to record manual attendance (${res.status})`);
  }
  return res.json();
}

export async function voidPunch(punch_id, reason) {
  const res = await fetch(`${STAFF_API}/attendance/daily/void-punch/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ punch_id, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to void punch');
  }
  return res.json();
}

export async function recalculateAttendance(store_id, from_date, to_date, preview_only = false) {
  const res = await fetch(`${STAFF_API}/attendance/daily/recalculate/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id, from_date, to_date, preview_only }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to recalculate attendance');
  }
  return res.json();
}

export async function fetchWhoIsIn(store_id) {
  const query = new URLSearchParams();
  if (store_id && store_id !== 'null' && store_id !== 'undefined') {
    query.append('store_id', store_id);
  }
  const qStr = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${STAFF_API}/attendance/reports/who-is-in/${qStr}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch active present staff');
  return res.json();
}

export async function fetchMonthlyGrid(store_id, year, month) {
  const query = new URLSearchParams();
  if (store_id && store_id !== 'null' && store_id !== 'undefined') {
    query.append('store_id', store_id);
  }
  if (year) query.append('year', year);
  if (month) query.append('month', month);

  const res = await fetch(`${STAFF_API}/attendance/reports/monthly-grid/?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.error || 'Failed to fetch monthly grid');
  }
  return res.json();
}

export async function fetchPunchLog(store_id) {
  const query = new URLSearchParams();
  if (store_id && store_id !== 'null' && store_id !== 'undefined') {
    query.append('store_id', store_id);
  }
  const qStr = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${STAFF_API}/attendance/reports/punch-log/${qStr}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.error || 'Failed to fetch punch log');
  }
  return res.json();
}

export async function fetchMonthlySummaryReport(store_id, year, month) {
  const query = new URLSearchParams();
  if (store_id && store_id !== 'null' && store_id !== 'undefined') {
    query.append('store_id', store_id);
  }
  if (year) query.append('year', year);
  if (month) query.append('month', month);

  const res = await fetch(`${STAFF_API}/attendance/reports/monthly-summary/?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.error || 'Failed to fetch monthly summary report');
  }
  return res.json();
}

export async function fetchLateEarlyReport(store_id, from_date, to_date) {
  let url = `${STAFF_API}/attendance/reports/late-early/?store_id=${store_id}`;
  if (from_date) url += `&from_date=${from_date}`;
  if (to_date) url += `&to_date=${to_date}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch late/early report');
  return res.json();
}

export async function lockAttendanceMonth(store_id, year, month) {
  const res = await fetch(`${STAFF_API}/attendance/reports/lock-month/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id, year, month }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to lock month');
  }
  return res.json();
}

export async function unlockAttendanceMonth(store_id, year, month) {
  const res = await fetch(`${STAFF_API}/attendance/reports/unlock-month/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id, year, month }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to unlock month');
  }
  return res.json();
}

export async function fetchLeaveTypes() {
  const res = await fetch(`${STAFF_API}/leave/types/`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch leave types');
  return res.json();
}

export async function createLeaveType(data) {
  const res = await fetch(`${STAFF_API}/leave/types/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create leave type');
  }
  return res.json();
}

export async function fetchLeaveRequests(store_id) {
  const url = `${STAFF_API}/leave/requests/${store_id ? `?store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch leave requests');
  return res.json();
}

export async function submitLeaveRequest(data) {
  const res = await fetch(`${STAFF_API}/leave/requests/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit leave request');
  }
  return res.json();
}

export async function approveLeaveRequest(id, notes = '') {
  const res = await fetch(`${STAFF_API}/leave/requests/${id}/approve/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error('Failed to approve leave request');
  return res.json();
}

export async function rejectLeaveRequest(id, notes = '') {
  const res = await fetch(`${STAFF_API}/leave/requests/${id}/reject/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error('Failed to reject leave request');
  return res.json();
}

export async function cancelLeaveRequest(id, notes = '') {
  const res = await fetch(`${STAFF_API}/leave/requests/${id}/cancel/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error('Failed to cancel leave request');
  return res.json();
}

export async function fetchLeaveBalances(employee_id, year) {
  const res = await fetch(`${STAFF_API}/leave/balances/?employee_id=${employee_id}&year=${year}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch leave balances');
  return res.json();
}

export async function fetchHolidays(store_id) {
  const url = `${STAFF_API}/holidays/${store_id ? `?store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch holidays');
  return res.json();
}

export async function createHoliday(data) {
  const res = await fetch(`${STAFF_API}/holidays/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create holiday');
  }
  return res.json();
}

export async function deleteHoliday(id) {
  const res = await fetch(`${STAFF_API}/holidays/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete holiday');
  return true;
}

export async function fetchHRSettings(store_id) {
  const url = `${STAFF_API}/hr-settings/${store_id ? `?store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load HR settings');
  return res.json();
}

export async function saveHRSettings(store_id, settings) {
  const res = await fetch(`${STAFF_API}/hr-settings/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id, ...settings }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors ? err.errors.join('; ') : 'Failed to save HR settings');
  }
  return res.json();
}

export async function sendKioskTap(card_uid, store_id = null, device_token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (device_token) {
    headers['X-Device-Token'] = device_token;
  }
  const authHeaders = getAuthHeaders(headers);
  const payload = { card_uid };
  if (store_id) payload.store_id = store_id;

  const res = await fetch(`${STAFF_API}/tap/`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, ...data };
  }
  return data;
}

export async function previewKioskTap(card_uid, store_id = null, device_token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (device_token) {
    headers['X-Device-Token'] = device_token;
  }
  const authHeaders = getAuthHeaders(headers);
  const payload = { card_uid, preview: true };
  if (store_id) payload.store_id = store_id;

  const res = await fetch(`${STAFF_API}/tap/`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, ...data };
  }
  return data;
}

// ----------------- Stage 2: Salary, Payroll, Ledger & Staff Sync API -----------------

export function extractErrorMessage(err, fallback = 'Operation failed') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message && typeof err.message === 'string') return err.message;
  if (err.detail) return err.detail;
  if (err.non_field_errors) {
    return Array.isArray(err.non_field_errors) ? err.non_field_errors.join('; ') : String(err.non_field_errors);
  }
  if (typeof err === 'object') {
    const parts = [];
    for (const [key, val] of Object.entries(err)) {
      const valStr = Array.isArray(val) ? val.join(', ') : (typeof val === 'object' ? JSON.stringify(val) : String(val));
      parts.push(`${key}: ${valStr}`);
    }
    if (parts.length > 0) return parts.join(' | ');
  }
  return fallback;
}

export async function fetchSalaryStructures(params = {}) {
  const query = new URLSearchParams();
  if (params.employee_id) query.append('employee_id', params.employee_id);
  if (params.store_id) query.append('store_id', params.store_id);

  const url = `${STAFF_API}/salary-structures/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch salary structures');
  return res.json();
}

export async function createSalaryStructure(data) {
  const res = await fetch(`${STAFF_API}/salary-structures/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Failed to save salary structure'));
  }
  return res.json();
}

export async function updateSalaryStructure(id, data) {
  const res = await fetch(`${STAFF_API}/salary-structures/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Failed to update salary structure'));
  }
  return res.json();
}

export async function deleteSalaryStructure(id) {
  const res = await fetch(`${STAFF_API}/salary-structures/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete salary structure');
  return true;
}

export async function fetchPayrollRuns(store_id) {
  const url = `${STAFF_API}/payroll/${store_id ? `?store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch payroll runs');
  return res.json();
}

export async function fetchPayrollRunDetail(id, store_id) {
  const url = `${STAFF_API}/payroll/${id}/${store_id ? `?store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch payroll run detail');
  return res.json();
}

export async function generateDraftPayroll(data) {
  const res = await fetch(`${STAFF_API}/payroll/generate/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate draft payroll');
  }
  return res.json();
}

export async function finalizePayrollRun(id, store_id) {
  const res = await fetch(`${STAFF_API}/payroll/${id}/finalize/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to finalize payroll run');
  }
  return res.json();
}

export async function reopenPayrollRun(id, store_id, reason) {
  const res = await fetch(`${STAFF_API}/payroll/${id}/reopen/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reopen payroll run');
  }
  return res.json();
}

export async function fetchSalaryStatement(runId, stmtId, store_id) {
  const url = `${STAFF_API}/payroll/${runId}/statements/${stmtId}/${store_id ? `?store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch salary statement detail');
  return res.json();
}

export async function toggleStatementInclusion(runId, stmtId, store_id, is_included, exclusion_reason = '') {
  const res = await fetch(`${STAFF_API}/payroll/${runId}/statements/${stmtId}/toggle-inclusion/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id, is_included, exclusion_reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update statement inclusion');
  }
  return res.json();
}

export async function fetchPayrollAdjustments(params = {}) {
  const query = new URLSearchParams();
  if (params.store_id) query.append('store_id', params.store_id);
  if (params.year) query.append('year', params.year);
  if (params.month) query.append('month', params.month);
  if (params.employee_id) query.append('employee_id', params.employee_id);

  const url = `${STAFF_API}/payroll/adjustments/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch payroll adjustments');
  return res.json();
}

export async function createPayrollAdjustment(data) {
  const res = await fetch(`${STAFF_API}/payroll/adjustments/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create adjustment');
  }
  return res.json();
}

export async function deletePayrollAdjustment(id, store_id) {
  const res = await fetch(`${STAFF_API}/payroll/adjustments/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete adjustment');
  }
  return true;
}

// ─── Interim Settlement API ───────────────────────────────────────────────────

export async function fetchPayrollPreview(store_id, year, month, employee_ids = null) {
  const query = new URLSearchParams({ store_id, year, month });
  if (employee_ids?.length) query.append('employee_ids', employee_ids.join(','));
  const res = await fetch(`${STAFF_API}/payroll/preview/?${query}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch payroll preview');
  }
  return res.json();
}

export async function fetchOvertimePendingVerification(store_id, year, month) {
  const query = new URLSearchParams({ store_id, year, month });
  const res = await fetch(`${STAFF_API}/payroll/overtime-verify/?${query}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch overtime verification list');
  }
  return res.json();
}

export async function bulkVerifyOvertime(verifications) {
  const res = await fetch(`${STAFF_API}/payroll/overtime-verify-bulk/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ verifications }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to verify overtime entries');
  }
  return res.json();
}

export async function settleInterimPayroll(store_id, settlements, proceed_with_unreviewed = false) {
  const res = await fetch(`${STAFF_API}/payroll/settle/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id, settlements, proceed_with_unreviewed }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to process interim settlement');
  }
  return res.json();
}

export async function fetchRegisterShifts(store_id, include_closed = false) {
  const query = new URLSearchParams({ store_id });
  if (include_closed) query.append('include_closed', 'true');
  const res = await fetch(`${STAFF_API}/payroll/register-shifts/?${query}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch register shifts');
  }
  return res.json();
}

export async function fetchLedgerEntries(params = {}) {
  const query = new URLSearchParams();
  if (params.store_id) query.append('store_id', params.store_id);
  if (params.employee_id) query.append('employee_id', params.employee_id);
  if (params.from_date) query.append('from_date', params.from_date);
  if (params.to_date) query.append('to_date', params.to_date);

  const url = `${STAFF_API}/ledger/${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch employee ledger entries');
  return res.json();
}

export async function fetchStoreLedgerSummary(store_id, employee_id) {
  const params = new URLSearchParams();
  if (store_id) params.set('store_id', store_id);
  if (employee_id) params.set('employee_id', employee_id);
  const qs = params.toString();
  const url = `${STAFF_API}/ledger/summary/${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load store ledger summary');
  return res.json();
}

export async function fetchEmployeeBalance(employee_id, store_id) {
  const url = `${STAFF_API}/ledger/balance/?employee_id=${employee_id}${store_id ? `&store_id=${store_id}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load employee balance');
  return res.json();
}

export async function addLedgerEntry(data) {
  const res = await fetch(`${STAFF_API}/ledger/add-entry/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to post ledger entry');
  }
  return res.json();
}

export async function reverseLedgerEntry(data) {
  const res = await fetch(`${STAFF_API}/ledger/reverse-entry/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reverse ledger entry');
  }
  return res.json();
}

export async function correctLedgerEntry(data) {
  const res = await fetch(`${STAFF_API}/ledger/correct-entry/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to correct ledger entry');
  }
  return res.json();
}

export async function syncStaffMembers(store_id) {
  const res = await fetch(`${STAFF_API}/sync/sync-staff/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to synchronize staff directory');
  }
  return res.json();
}

export async function seedDemoPayrollData(store_id) {
  const res = await fetch(`${STAFF_API}/sync/seed-demo/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ store_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to seed demo payroll data');
  }
  return res.json();
}

// ----------------- AI Product Description Generation Engine -----------------

export function getStoredGeminiApiKeys() {
  try {
    const raw = localStorage.getItem('wondersale_gemini_api_keys');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((k) => (typeof k === 'object' ? k.isActive !== false : true))
          .map((k) => (typeof k === 'string' ? k.trim() : (k.key || '').trim()))
          .filter(Boolean);
      }
    }
  } catch (e) {}
  return [];
}

export async function bulkAIGenerateDescriptions({ item_ids, store_id, api_keys = null }) {
  let keys = api_keys;
  if (!keys || (Array.isArray(keys) && keys.length === 0)) {
    keys = getStoredGeminiApiKeys();
  }
  const payload = { item_ids, store_id };
  if (keys && keys.length > 0) {
    payload.api_keys = keys;
  }
  const res = await fetch(`${API_BASE}/items/bulk-ai-generate-descriptions/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Failed to start AI description batch generation.');
  }
  return data;
}

export async function fetchActiveAIDescriptionJob(storeId = null) {
  const url = new URL(`${window.location.origin}${API_BASE}/items/active-ai-description-job/`);
  if (storeId) {
    url.searchParams.append('store', storeId);
  }
  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.detail || `Server returned error status ${res.status}`);
  }
  return res.json();
}

export async function fetchAIDescriptionJobDetail(jobId) {
  const res = await fetch(`${API_BASE}/items/ai-description-jobs/${jobId}/`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Failed to fetch batch job details.');
  }
  return data;
}

export async function singleAIGenerateDescription(itemId, apiKeys = null) {
  let keys = apiKeys;
  if (!keys || (Array.isArray(keys) && keys.length === 0)) {
    keys = getStoredGeminiApiKeys();
  }
  const payload = {};
  if (keys && keys.length > 0) payload.api_keys = keys;
  const res = await fetch(`${API_BASE}/items/${itemId}/ai-generate-description/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.detail || 'Failed to generate AI description.');
    err.status = data.status || 'failed';
    throw err;
  }
  return data;
}

export async function applyAIDescription(itemId, customDescription = null) {
  const payload = {};
  if (customDescription !== null) payload.description = customDescription;
  const res = await fetch(`${API_BASE}/items/${itemId}/apply-ai-description/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Failed to apply description.');
  }
  return data;
}

export async function discardAIDescription(itemId) {
  const res = await fetch(`${API_BASE}/items/${itemId}/discard-ai-description/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Failed to discard description.');
  }
  return data;
}

export async function bulkApplyAIDescriptions(itemIds = null) {
  const payload = {};
  if (itemIds && Array.isArray(itemIds)) payload.item_ids = itemIds;
  const res = await fetch(`${API_BASE}/items/bulk-apply-ai-descriptions/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Failed to bulk apply descriptions.');
  }
  return data;
}

export async function retryAIDescription(itemId) {
  const res = await fetch(`${API_BASE}/items/${itemId}/retry-ai-description/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || 'Failed to retry AI description generation.');
  }
  return data;
}


// -----------------------------------------------------------------------------
// Variant / Batch Management
// -----------------------------------------------------------------------------

export async function fetchItemVariants(itemId) {
  const res = await fetch(`${API_BASE}/items/${itemId}/variants/`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || 'Failed to fetch variants.');
  return data;
}

export async function fetchNextUid() {
  const res = await fetch(`${API_BASE}/items/next-uid/`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch next UID.');
  return data.next_uid;
}

export async function createItemVariant(itemId, variantData) {
  const res = await fetch(`${API_BASE}/items/${itemId}/create-variant/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(variantData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || 'Failed to create variant.');
  return data;
}

// -----------------------------------------------------------------------------
// Expired Stock Write-Off
// -----------------------------------------------------------------------------

export async function previewExpiredStock(storeId = null) {
  const params = new URLSearchParams();
  if (storeId) params.set('store', storeId);
  const res = await fetch(`${API_BASE}/items/expired-preview/?${params}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || 'Failed to fetch expired stock preview.');
  return data;
}

export async function writeOffExpiredStock({ storeId = null, itemId = null } = {}) {
  const body = {};
  if (storeId) body.store = storeId;
  if (itemId) body.item_id = itemId;
  const res = await fetch(`${API_BASE}/items/write-off-expired/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || 'Failed to write off expired stock.');
  return data;
}

// ============================================================================
// PHASE 1: EMPLOYEE PORTAL API
// ============================================================================

/** Get own profile (any authenticated staff member) */
export async function getPortalMe() {
  const res = await fetch(`${STAFF_API}/portal/me/`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch profile.');
  return data;
}

/** Update own profile name, phone, photo */
export async function updatePortalMe(formData) {
  const isForm = formData instanceof FormData;
  const res = await fetch(`${STAFF_API}/portal/me/`, {
    method: 'PATCH',
    headers: getAuthHeaders(isForm ? {} : { 'Content-Type': 'application/json' }),
    body: isForm ? formData : JSON.stringify(formData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to update profile.');
  return data;
}

/** Owner: get full staff directory */
export async function getOwnerStaffDirectory(storeId = null) {
  const params = storeId ? `?store=${encodeURIComponent(storeId)}` : '';
  const res = await fetch(`${STAFF_API}/portal/directory/${params}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch directory.');
  return data;
}

// ============================================================================
// PHASE 2: EMPLOYEE TASK ASSIGNMENT & PHOTO PROOF VERIFICATION ENGINE API
// ============================================================================

/**
 * Fetch tasks. For regular staff, returns their assigned tasks.
 * For owners/managers, returns store tasks with optional filters.
 */
export async function fetchEmployeeTasks(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${STAFF_API}/tasks/${queryString}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch tasks.');
  return Array.isArray(data) ? data : (data.results || []);
}

/** Owner/Manager: create a task */
export async function createEmployeeTask(taskData) {
  const isForm = taskData instanceof FormData;
  const res = await fetch(`${STAFF_API}/tasks/`, {
    method: 'POST',
    headers: getAuthHeaders(isForm ? {} : { 'Content-Type': 'application/json' }),
    body: isForm ? taskData : JSON.stringify(taskData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || (data.title?.[0]) || 'Failed to create task.');
  return data;
}

/** Start a task (marks as in_progress) */
export async function startEmployeeTask(taskId) {
  const res = await fetch(`${STAFF_API}/tasks/${taskId}/start/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to start task.');
  return data;
}

/**
 * Employee submits task with mandatory photo proof and write-off notes.
 * Expects FormData with 'proof_image' (File) and 'write_off_notes' (string).
 */
export async function submitEmployeeTask(taskId, formData) {
  const res = await fetch(`${STAFF_API}/tasks/${taskId}/submit/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to submit task proof.');
  return data;
}

/**
 * Owner/Manager verifies task.
 * payload: { action: 'approve' | 'revision_needed', revision_notes?: string }
 */
export async function verifyEmployeeTask(taskId, payload) {
  const res = await fetch(`${STAFF_API}/tasks/${taskId}/verify/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to verify task.');
  return data;
}

/** Delete a task (owner only) */
export async function deleteEmployeeTask(taskId) {
  const res = await fetch(`${STAFF_API}/tasks/${taskId}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to delete task.');
  }
  return true;
}

/** Fetch task statistics */
export async function fetchEmployeeTaskStats(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${STAFF_API}/tasks/stats/${queryString}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch task stats.');
  return data;
}

// Deprecated stubs to satisfy cached browser bundles and avoid HMR SyntaxError
export async function submitPasswordResetRequest() { return {}; }
export async function getMyPasswordResetRequests() { return []; }
export async function getAllPasswordResetRequests() { return []; }
export async function resolvePasswordResetRequest() { return {}; }

// ============================================================================
// PHASE 4: SECTION MONTHLY SALES & PROFIT TARGET GOALS API
// ============================================================================

/**
 * Fetch section monthly targets (with auto-lock evaluation).
 * Parameters: { year, month, section, store }
 */
export async function fetchSectionGoals(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${ACCOUNTING_API}/section-goals/${queryString}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch section monthly goals.');
  return Array.isArray(data) ? data : (data.results || []);
}

/**
 * Owner/Manager: Create or update target goals for a section.
 * Prohibited if the goal period is locked.
 */
export async function saveSectionGoal(goalData) {
  const res = await fetch(`${ACCOUNTING_API}/section-goals/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(goalData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to save section goal.');
  return data;
}

/**
 * Owner/Manager: Edit an existing section goal
 */
export async function updateSectionGoal(goalId, goalData) {
  const res = await fetch(`${ACCOUNTING_API}/section-goals/${goalId}/`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(goalData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to update section goal.');
  return data;
}

/**
 * Report a broken item with mandatory proof photo and reason.
 * Enforces atomic stock deduction and ledger sync.
 */
export async function reportBrokenItem(itemId, formData) {
  const headers = getAuthHeaders();
  delete headers['Content-Type'];

  // Ensure item_id is in formData
  if (formData instanceof FormData) {
    if (!formData.has('item') && !formData.has('item_id')) {
      formData.append('item_id', itemId);
    }
  }

  let res = await fetch(`${API_BASE}/items/${itemId}/report-broken/`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    // If ItemViewSet returned 403 or 404, fallback to broken-items/ ViewSet endpoint
    try {
      const fallbackRes = await fetch(`${API_BASE}/broken-items/`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (fallbackRes.ok) {
        return await fallbackRes.json();
      }
    } catch {
      // ignore fallback error and parse original
    }

    const errorMsg = await parseApiError(res, 'Failed to report broken item.');
    throw new Error(errorMsg);
  }
  return await res.json();
}

/**
 * Fetch broken item reports with store/section/date filters.
 */
export async function fetchBrokenItemReports(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/broken-items/${queryString}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to fetch broken item reports.');
    throw new Error(errorMsg);
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : (data.results || []);
}

/**
 * Fetch staff employees for store assignment and fines.
 */
export async function fetchStaffEmployees(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${STAFF_API}/employees/${queryString}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to fetch employees.');
    throw new Error(errorMsg);
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : (data.results || []);
}

/**
 * Fetch employee ledger balance.
 */
export async function fetchEmployeeLedgerBalance(employeeId) {
  if (!employeeId) return { balance: '0.00' };
  const res = await fetch(`${STAFF_API}/ledger/balance/?employee_id=${employeeId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to fetch employee balance.');
    throw new Error(errorMsg);
  }
  return await res.json();
}

/**
 * Fine an employee for a broken/damaged item report and post directly to their ledger.
 */
export async function fineEmployeeForBrokenItem(reportId, data = {}) {
  const res = await fetch(`${API_BASE}/broken-items/${reportId}/fine-employee/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to fine employee.');
    throw new Error(errorMsg);
  }
  return await res.json();
}

/**
 * Mark a broken item report as 'No Fine' (100% absorbed as store operational loss).
 */
export async function markBrokenItemNoFine(reportId) {
  const res = await fetch(`${API_BASE}/broken-items/${reportId}/no-fine/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to mark as No Fine.');
    throw new Error(errorMsg);
  }
  return await res.json();
}




