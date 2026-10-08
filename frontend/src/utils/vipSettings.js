// VIP Card & RFID Hardware Configuration Helper

export const VIP_SETTINGS_STORAGE_KEY = 'wondersale_vip_settings';

export const DEFAULT_VIP_SETTINGS = {
  cardPrice: '500',
  initialCredit: '500',
  discountPercent: '5',
  rechargePresets: ['500', '1000', '2000'],
  usbModuleConnected: false,
};

export function getVipSettings() {
  try {
    const raw = localStorage.getItem(VIP_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_VIP_SETTINGS,
        ...parsed,
        rechargePresets: Array.isArray(parsed.rechargePresets) && parsed.rechargePresets.length > 0
          ? parsed.rechargePresets
          : DEFAULT_VIP_SETTINGS.rechargePresets,
      };
    }
  } catch (e) {
    console.warn('Failed to parse VIP settings from localStorage, using defaults:', e);
  }
  return { ...DEFAULT_VIP_SETTINGS };
}

export function saveVipSettings(newSettings) {
  try {
    const current = getVipSettings();
    const updated = {
      ...current,
      ...newSettings,
    };
    localStorage.setItem(VIP_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom event so all active views can synchronize live without page reload
    window.dispatchEvent(new CustomEvent('wondersale_vip_settings_updated', { detail: updated }));
    return updated;
  } catch (e) {
    console.error('Failed to save VIP settings to localStorage:', e);
    return newSettings;
  }
}
