import React, { useState } from 'react';
import {
  Truck,
  ArrowLeft,
  Building2,
  Layers,
  Search,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Package,
} from 'lucide-react';
import SupplierSection from './SupplierSection';
import SupplierDetailView from './SupplierDetailView';

export default function SuppliersAppView({
  currentUser,
  stores = [],
  selectedStore = '',
  suppliers = [],
  loading = false,
  onSuppliersUpdated,
  onBackToLauncher,
  currencySymbol = '₹',
}) {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'manage_suppliers'
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const currentStore = stores.find((s) => String(s.id) === String(selectedStore)) || null;

  // Selected supplier object
  const selectedSupplier = suppliers.find((s) => String(s.id) === String(selectedSupplierId)) || null;

  // If a supplier is selected for detail view, show detail view directly
  if (selectedSupplierId) {
    return (
      <div
        className="suppliers-app-root"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          gap: '20px',
          padding: '20px',
          maxWidth: '1440px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <SupplierDetailView
          supplierId={selectedSupplierId}
          supplier={selectedSupplier}
          onBack={() => {
            setSelectedSupplierId(null);
            onSuppliersUpdated?.();
          }}
          currentUser={currentUser}
          stores={stores}
          selectedStore={selectedStore}
          currencySymbol={currencySymbol}
        />
      </div>
    );
  }

  // Filtered suppliers for directory
  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.contact_person?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.pincode?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="suppliers-app-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        gap: '20px',
        padding: '20px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header bar matching other module apps */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          padding: '16px 22px',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onBackToLauncher && (
            <button
              type="button"
              onClick={onBackToLauncher}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Return to Main Launcher Menu"
            >
              <ArrowLeft size={15} />
              <span>Menu</span>
            </button>
          )}

          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(20, 184, 166, 0.16)',
              color: '#14B8A6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(20, 184, 166, 0.25)',
              flexShrink: 0,
            }}
          >
            <Truck size={22} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Suppliers & Vendor Central
              </h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(20, 184, 166, 0.14)',
                  color: '#14B8A6',
                }}
              >
                {suppliers.length} Registered
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Manage supplier records, track auto-generated orders, pay outstanding balances, and audit purchase ledgers.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        className="glass-panel"
        style={{
          padding: '0 16px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          style={{
            padding: '14px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'directory' ? '3px solid #14B8A6' : '3px solid transparent',
            color: activeTab === 'directory' ? '#14B8A6' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Building2 size={17} />
          <span>Supplier Directory & Ledgers ({suppliers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manage_suppliers')}
          style={{
            padding: '14px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'manage_suppliers' ? '3px solid #14B8A6' : '3px solid transparent',
            color: activeTab === 'manage_suppliers' ? '#14B8A6' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={17} />
          <span>Manage Suppliers</span>
        </button>
      </div>

      {/* Tab Viewport */}
      <div>
        {activeTab === 'directory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Search and Quick Filters */}
            <div
              className="glass-panel"
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search suppliers by name, city, phone, pincode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.86rem', padding: '6px 10px' }}
                />
              </div>
            </div>

            {/* Supplier Cards Grid */}
            {filteredSuppliers.length === 0 ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No suppliers found matching your search.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                {filteredSuppliers.map((sup) => {
                  const owed = parseFloat(sup.total_owed || 0);

                  return (
                    <div
                      key={sup.id}
                      onClick={() => setSelectedSupplierId(sup.id)}
                      className="glass-panel"
                      style={{
                        padding: '18px 20px',
                        borderRadius: 'var(--radius-xl)',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        border: '1px solid var(--border-color)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = '#14B8A6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                            {sup.name}
                          </h3>
                          {owed > 0 ? (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#EF4444',
                                flexShrink: 0,
                              }}
                            >
                              Owe: {currencySymbol}{owed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10B981',
                                flexShrink: 0,
                              }}
                            >
                              All Clear
                            </span>
                          )}
                        </div>

                        {sup.contact_person && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            👤 {sup.contact_person}
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '10px',
                            marginTop: '10px',
                            fontSize: '0.76rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {sup.city && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <MapPin size={12} /> {sup.city}{sup.pincode ? ` (${sup.pincode})` : ''}
                            </span>
                          )}
                          {sup.phone && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Phone size={12} /> {sup.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '12px',
                          borderTop: '1px solid var(--border-color)',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)' }}>
                          <span>📦 <strong>{sup.items_count || 0}</strong> products</span>
                          <span>🛒 <strong>{sup.orders_count || 0}</strong> orders</span>
                        </div>
                        <span style={{ color: '#14B8A6', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          View Ledger →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'manage_suppliers' && (
          <SupplierSection
            suppliers={suppliers}
            stores={stores}
            currentStore={currentStore}
            loading={loading}
            onSuppliersUpdated={onSuppliersUpdated}
          />
        )}
      </div>
    </div>
  );
}
