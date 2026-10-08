const STORAGE_KEY = 'wondersale_stakeholders_enabled';

/**
 * Returns whether the stakeholders profit-sharing module is enabled.
 * Checks localStorage first, and optionally store object if passed.
 */
export function isStakeholdersEnabled(selectedStore = null, stores = []) {
  // If specific store is provided
  if (selectedStore && typeof selectedStore === 'object') {
    if (selectedStore.enable_stakeholders !== undefined) {
      return Boolean(selectedStore.enable_stakeholders);
    }
  } else if (selectedStore && stores && stores.length > 0) {
    const found = stores.find((s) => String(s.id) === String(selectedStore));
    if (found && found.enable_stakeholders !== undefined) {
      return Boolean(found.enable_stakeholders);
    }
  }

  // Fallback to localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    return saved === 'true';
  }

  // If stores array has info
  if (stores && stores.length > 0) {
    return stores.some((s) => s.enable_stakeholders !== false);
  }

  return true;
}

/**
 * Persists the stakeholders enabled state in localStorage and dispatches a window event.
 */
export function setStakeholdersEnabled(enabled) {
  const boolVal = Boolean(enabled);
  localStorage.setItem(STORAGE_KEY, boolVal ? 'true' : 'false');
  window.dispatchEvent(
    new CustomEvent('wondersale_stakeholders_setting_changed', {
      detail: { enabled: boolVal },
    })
  );
}

/**
 * Subscribes to changes in the stakeholders enabled state.
 */
export function onStakeholdersSettingChange(callback) {
  const handler = (e) => {
    callback(Boolean(e.detail?.enabled));
  };
  window.addEventListener('wondersale_stakeholders_setting_changed', handler);
  return () => {
    window.removeEventListener('wondersale_stakeholders_setting_changed', handler);
  };
}
