import React from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  Receipt,
  BarChart3,
  Building2,
  Briefcase,
  UserCheck,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

const MODULE_CONFIG = {
  dashboard: {
    title: 'Dashboard & Store Overview',
    subtitle: 'Real-time retail performance analytics, sales speedometers, and executive summary',
    icon: LayoutDashboard,
    color: '#10B981',
    bgGlow: 'rgba(16, 185, 129, 0.14)',
    features: ['Real-time Sales Trends', 'Top Moving Inventory', 'Daily Revenue & Net Profit', 'Store Branch Performance'],
  },
  billing: {
    title: 'Billing & POS Station',
    subtitle: 'Point of sale cashier counter & customer transaction processing',
    icon: Receipt,
    color: '#3B82F6',
    bgGlow: 'rgba(59, 130, 246, 0.14)',
    features: ['Barcode Scanner Hookup', 'Quick Item Lookup', 'Digital Receipts', 'Cash & Card Payments'],
  },
  accounting: {
    title: 'Accounts and Finance',
    subtitle: 'Financial entries, daily cash drawer reconciliations, profit margins, and expense tracking',
    icon: BarChart3,
    color: '#8B5CF6',
    bgGlow: 'rgba(139, 92, 246, 0.14)',
    features: ['Daily Cash Drawer Closeout', 'Operational Net Profit', 'Sales & COGS Ledgers', 'Expense & Counter Payout Audits'],
  },
  stakeholders: {
    title: 'Stakeholders & Profit Sharing',
    subtitle: 'Contractual profit-sharing partners and return on investment analytics',
    icon: Briefcase,
    color: '#EC4899',
    bgGlow: 'rgba(236, 72, 153, 0.14)',
    features: ['Profit Distribution', 'Contract Ledger', 'Disbursement History', 'Performance Analytics'],
  },
  customers: {
    title: 'Customer Directory & Profiles',
    subtitle: 'Customer contact information, purchase history, loyalty rewards, and store accounts',
    icon: UserCheck,
    color: '#06B6D4',
    bgGlow: 'rgba(6, 182, 212, 0.14)',
    features: ['Customer Contact Info', 'Purchase & Order History', 'Loyalty Points & Tiers', 'Store Accounts & Balances'],
  },
  settings: {
    title: 'Store & System Settings',
    subtitle: 'Store branches, receipt printer configuration, tax rates, and global defaults',
    icon: Settings,
    color: '#F97316',
    bgGlow: 'rgba(249, 115, 22, 0.14)',
    features: ['Branch Metadata', 'Tax Rates & VAT', 'Receipt Customization', 'Cloud Backup Sync'],
  },
};

export default function WorkstationView({ viewId, currentUser, onBackToLauncher }) {
  const config = MODULE_CONFIG[viewId] || {
    title: 'Workstation',
    subtitle: 'Store Module Workstation',
    icon: Settings,
    color: 'var(--brand-primary)',
    bgGlow: 'rgba(197, 34, 36, 0.14)',
    features: [],
  };

  const IconComponent = config.icon;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>
      {/* Header with Back to Menu button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '32px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={onBackToLauncher}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
            }}
            id="workstation-back-to-menu"
          >
            <ArrowLeft size={18} />
            <span>Back to Menu</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
                {config.title}
              </h1>
              <span
                className="badge"
                style={{
                  background: config.bgGlow,
                  color: config.color,
                  border: `1px solid ${config.color}40`,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              >
                ONLINE
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
              {config.subtitle}
            </p>
          </div>
        </div>

        {/* User Role Tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 14px',
            fontSize: '0.84rem',
          }}
        >
          <ShieldCheck size={16} style={{ color: config.color }} />
          <span style={{ fontWeight: 600 }}>{currentUser?.name}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            ({currentUser?.role_details?.name || 'Staff'})
          </span>
        </div>
      </div>

      {/* Main Workstation Card */}
      <div
        className="glass-panel"
        style={{
          padding: '40px',
          borderRadius: 'var(--radius-xl)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '24px',
        }}
      >
        {/* Glow backdrop */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            background: config.bgGlow,
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-xl)',
              background: config.bgGlow,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: config.color,
              border: `2px solid ${config.color}30`,
              boxShadow: 'var(--shadow-md)',
              flexShrink: 0,
            }}
          >
            <IconComponent size={40} />
          </div>

          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={18} style={{ color: config.color }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Verified Role Access
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
              {config.title} is ready for {currentUser?.role_details?.name || 'Authorized Staff'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', lineHeight: 1.6, maxWidth: '640px' }}>
              Your account has explicit permission to access and operate this workstation.
              This module operates in harmony with the Wondersale unified store database.
            </p>
          </div>
        </div>

        {/* Feature Capabilities Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginTop: '32px',
          }}
        >
          {config.features.map((feature, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <CheckCircle2 size={18} style={{ color: config.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Return to Menu Footer banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
          <Clock size={16} />
          <span>Active workstation session logged under Staff ID: <strong>{currentUser?.staff_id}</strong></span>
        </div>
        <button
          type="button"
          onClick={onBackToLauncher}
          className="btn btn-primary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} />
          <span>Return to Menu</span>
        </button>
      </div>
    </div>
  );
}
