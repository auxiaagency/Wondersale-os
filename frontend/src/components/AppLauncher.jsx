import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Users,
  Receipt,
  BarChart3,
  Briefcase,
  UserCheck,
  UserCog,
  IdCard,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { isStakeholdersEnabled, onStakeholdersSettingChange } from '../utils/stakeholdersSettings';

export const SYSTEM_MODULES = [
  // Primary (Row 1: 4 buttons)
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    color: '#10B981',
    bgGlow: 'rgba(16, 185, 129, 0.16)',
    description: 'Overview, analytics & performance',
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: Package,
    color: '#C52224',
    bgGlow: 'rgba(197, 34, 36, 0.16)',
    description: 'Catalog, stock levels & barcodes',
  },
  {
    id: 'employee_management',
    title: 'Employee Management',
    icon: UserCog,
    color: '#6366F1',
    bgGlow: 'rgba(99, 102, 241, 0.14)',
    description: 'Workforce records, shifts & ops',
  },
  {
    id: 'billing',
    title: 'Billing & POS',
    icon: Receipt,
    color: '#3B82F6',
    bgGlow: 'rgba(59, 130, 246, 0.14)',
    description: 'Cashier checkout & receipts',
  },

  // Primary (Row 2: first 3 buttons; 4th slot is "Show More")
  {
    id: 'accounting',
    title: 'Accounts and Finance',
    icon: BarChart3,
    color: '#8B5CF6',
    bgGlow: 'rgba(139, 92, 246, 0.14)',
    description: 'Ledgers, balances & cashflow',
  },
  {
    id: 'stakeholders',
    title: 'Stakeholders',
    icon: Briefcase,
    color: '#EC4899',
    bgGlow: 'rgba(236, 72, 153, 0.14)',
    description: 'Profit-sharing partners & analytics',
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: UserCheck,
    color: '#06B6D4',
    bgGlow: 'rgba(6, 182, 212, 0.14)',
    description: 'Customer profiles & contact info',
  },

  // Extended (Visible after clicking "Show More")
  {
    id: 'employee_portal',
    title: 'Employee Portal',
    icon: IdCard,
    color: '#D946EF',
    bgGlow: 'rgba(217, 70, 239, 0.16)',
    description: 'Personal profile, credentials & directory',
  },
  {
    id: 'staff',
    title: 'Staff & Roles',
    icon: Users,
    color: '#FEC501',
    bgGlow: 'rgba(254, 197, 1, 0.16)',
    description: 'Employee access & permissions',
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    color: '#F97316',
    bgGlow: 'rgba(249, 115, 22, 0.14)',
    description: 'System configuration & preferences',
  },
];

export const PRIMARY_MODULES = SYSTEM_MODULES.slice(0, 7);
export const EXTENDED_MODULES = SYSTEM_MODULES.slice(7);

const STORAGE_KEY_PREFIX = 'wondersale_launcher_order';

export function getLauncherOrderStorageKey(currentUser) {
  return currentUser?.id ? `${STORAGE_KEY_PREFIX}_${currentUser.id}` : STORAGE_KEY_PREFIX;
}

/**
 * Strict permission check:
 * If stakeholders module is disabled, return false even for owner.
 * Owner has access to all active modules.
 * Any other staff has access ONLY if the module ID is explicitly in their role's allowed_modules array.
 */
export function isModuleAccessible(currentUser, moduleId) {
  if (moduleId === 'stakeholders' && !isStakeholdersEnabled()) {
    return false;
  }
  if (!currentUser) return false;
  if (currentUser.is_owner) return true;
  if (moduleId === 'employee_portal') return true;

  const allowed = currentUser.role_details?.allowed_modules;
  if (Array.isArray(allowed)) {
    return allowed.includes(moduleId);
  }

  return false;
}

export function getAccessibleModulesForUser(currentUser, customOrderIds = null) {
  const isShEnabled = isStakeholdersEnabled();
  const base = SYSTEM_MODULES.filter((m) => {
    if (m.id === 'stakeholders' && !isShEnabled) return false;
    return isModuleAccessible(currentUser, m.id);
  });

  if (!customOrderIds || !Array.isArray(customOrderIds) || customOrderIds.length === 0) {
    return base;
  }

  const map = new Map(base.map((m) => [m.id, m]));
  const ordered = customOrderIds.map((id) => map.get(id)).filter(Boolean);
  // Append any newly accessible modules not in the saved order
  base.forEach((m) => {
    if (!ordered.some((o) => o.id === m.id)) {
      ordered.push(m);
    }
  });

  return ordered;
}

export function getInitialModulesOrder(currentUser) {
  const storageKey = getLauncherOrderStorageKey(currentUser);
  let savedIds = null;
  try {
    const saved = localStorage.getItem(storageKey) || localStorage.getItem(STORAGE_KEY_PREFIX);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        savedIds = parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved launcher order', e);
  }

  return getAccessibleModulesForUser(currentUser, savedIds);
}

function ModuleCardContent({ module: m }) {
  const IconComponent = m.icon;

  return (
    <>
      {/* Background Ambient Glow */}
      <div
        className="app-launcher-glow"
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '105px',
          height: '105px',
          borderRadius: '50%',
          background: m.bgGlow,
          filter: 'blur(28px)',
          pointerEvents: 'none',
        }}
      />

      {/* Icon Container */}
      <div
        className="app-launcher-icon-box"
        style={{
          width: '66px',
          height: '66px',
          borderRadius: '18px',
          background: m.bgGlow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: m.color,
          border: `1px solid ${m.bgGlow}`,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <IconComponent size={32} className="app-launcher-icon" />
      </div>

      {/* Button Title */}
      <div className="app-launcher-text-wrap" style={{ maxWidth: '94%', textAlign: 'center' }}>
        <span
          className="app-launcher-card-title"
          style={{
            fontSize: '1.28rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.22,
            display: 'block',
          }}
        >
          {m.title}
        </span>
      </div>
    </>
  );
}

function SortableLauncherCard({
  module: m,
  onCardClick,
  activeId,
  moveModeActive = true,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: m.id,
    disabled: !moveModeActive,
  });

  const isCurrentCardActive = isDragging || activeId === m.id;

  return (
    <motion.div
      layoutId={`launcher-card-${m.id}`}
      layout
      transition={{
        type: 'spring',
        damping: 26,
        stiffness: 320,
      }}
      ref={setNodeRef}
      style={{
        '--card-color': m.color,
        '--card-glow': m.bgGlow,
        opacity: isCurrentCardActive ? 0.2 : 1,
        zIndex: isCurrentCardActive ? 0 : 1,
        touchAction: moveModeActive ? 'none' : 'auto',
        aspectRatio: '1 / 1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px 16px',
        borderRadius: 'var(--radius-xl)',
        cursor: isCurrentCardActive ? 'grabbing' : 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
        border: isCurrentCardActive ? '2px dashed rgba(254, 197, 1, 0.5)' : '1px solid var(--border-subtle)',
        background: isCurrentCardActive ? 'rgba(254, 197, 1, 0.04)' : 'var(--bg-surface)',
        textAlign: 'center',
        width: '100%',
        userSelect: 'none',
      }}
      {...attributes}
      {...(moveModeActive ? listeners : {})}
      onClick={() => {
        if (!isCurrentCardActive && onCardClick) {
          onCardClick(m.id);
        }
      }}
      className={`glass-panel app-launcher-card ${isCurrentCardActive ? 'app-launcher-card-ghost' : ''}`}
    >
      <ModuleCardContent module={m} />
    </motion.div>
  );
}

const customCollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCenter(args);
};

export default function AppLauncher({ currentUser, onNavigate }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [modules, setModules] = useState(() => getInitialModulesOrder(currentUser));
  const [activeId, setActiveId] = useState(null);

  // On desktop (>640px) dragging is always enabled.
  // On mobile (<=640px) it requires the move-mode button toggle.
  const isMobile = () => window.innerWidth <= 640;
  const [isMoveModeActive, setIsMoveModeActive] = useState(() => !isMobile());

  const [stakeholdersActive, setStakeholdersActive] = useState(() => isStakeholdersEnabled());

  // Listen for mobile move mode toggle events from Navbar
  useEffect(() => {
    const handleMoveToggle = (e) => {
      // Only apply toggle from the button on mobile; desktop is always enabled
      if (isMobile() && typeof e.detail?.active === 'boolean') {
        setIsMoveModeActive(e.detail.active);
      }
    };
    window.addEventListener('wondersale_launcher_toggle_move_mode', handleMoveToggle);
    return () => window.removeEventListener('wondersale_launcher_toggle_move_mode', handleMoveToggle);
  }, []);

  // When the viewport resizes, sync move mode to correct default
  useEffect(() => {
    const handleResize = () => {
      if (!isMobile()) {
        // Desktop: always keep drag enabled
        setIsMoveModeActive(true);
      }
      // Mobile: leave it as-is (controlled by the button)
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Broadcast state changes if needed
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('wondersale_launcher_move_mode_changed', {
        detail: { active: isMoveModeActive },
      })
    );
  }, [isMoveModeActive]);

  // Keep modules in sync whenever currentUser changes (login, switch user, role permissions change)
  useEffect(() => {
    setModules(getInitialModulesOrder(currentUser));
  }, [currentUser]);

  useEffect(() => {
    return onStakeholdersSettingChange((enabled) => {
      setStakeholdersActive(enabled);
      setModules((prev) => {
        if (!enabled) {
          return prev.filter((m) => m.id !== 'stakeholders');
        } else {
          if (isModuleAccessible(currentUser, 'stakeholders')) {
            const hasIt = prev.some((m) => m.id === 'stakeholders');
            if (!hasIt) {
              const shMod = SYSTEM_MODULES.find((m) => m.id === 'stakeholders');
              return shMod ? [...prev, shMod] : prev;
            }
          }
          return prev;
        }
      });
    });
  }, [currentUser]);

  const modulesRef = useRef(modules);
  modulesRef.current = modules;

  const saveOrder = useCallback((orderedModules) => {
    try {
      const storageKey = getLauncherOrderStorageKey(currentUser);
      const ids = orderedModules.map((m) => m.id);
      localStorage.setItem(storageKey, JSON.stringify(ids));
      window.dispatchEvent(new CustomEvent('wondersale_launcher_order_changed', { detail: { userId: currentUser?.id, ids } }));
    } catch (e) {
      console.warn('Failed to save launcher order', e);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleResetEvent = () => {
      const storageKey = getLauncherOrderStorageKey(currentUser);
      localStorage.removeItem(storageKey);
      localStorage.removeItem(STORAGE_KEY_PREFIX);
      setModules(getAccessibleModulesForUser(currentUser, null));
      setActiveId(null);
    };
    window.addEventListener('wondersale_reset_launcher_order', handleResetEvent);
    return () => window.removeEventListener('wondersale_reset_launcher_order', handleResetEvent);
  }, [currentUser]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setModules((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        return arrayMove(items, oldIndex, newIndex);
      }
      return items;
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setModules((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const updated = arrayMove(items, oldIndex, newIndex);
          saveOrder(updated);
          return updated;
        }
        saveOrder(items);
        return items;
      });
    } else {
      saveOrder(modulesRef.current);
    }
    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleCardClick = useCallback(
    (id) => {
      if (isModuleAccessible(currentUser, id)) {
        onNavigate(id);
      }
    },
    [currentUser, onNavigate]
  );

  // Strictly filter only accessible modules so inaccessible ones completely disappear
  const accessibleModules = modules.filter((m) => {
    if (m.id === 'stakeholders' && !stakeholdersActive) return false;
    return isModuleAccessible(currentUser, m.id);
  });

  const hasExtended = accessibleModules.length > 7;
  const primaryVisibleModules = hasExtended ? accessibleModules.slice(0, 7) : accessibleModules;
  const extendedModules = hasExtended ? accessibleModules.slice(7) : [];

  // Reset expanded state if accessible modules fit within the primary grid
  useEffect(() => {
    if (!hasExtended && isExpanded) {
      setIsExpanded(false);
    }
  }, [hasExtended, isExpanded]);

  const activeModule = activeId ? accessibleModules.find((m) => m.id === activeId) : null;

  // When expanded, all accessible modules can be dragged between primary and extended areas;
  // otherwise, only the visible primary modules participate in sort.
  const sortableItems = isExpanded && hasExtended
    ? accessibleModules.map((m) => m.id)
    : primaryVisibleModules.map((m) => m.id);

  return (
    <div
      className={`app-launcher-container ${activeId ? 'is-dragging' : ''} ${isMoveModeActive ? 'is-reorder-mode' : ''}`}
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        minHeight: 'calc(100vh - 72px)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isExpanded ? 'flex-start' : 'center',
        padding: isExpanded ? '36px 24px 56px' : '20px 24px',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'padding 0.35s ease',
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <LayoutGroup id="wondersale-app-launcher-group">
          <SortableContext items={sortableItems} strategy={rectSortingStrategy}>
            {/* Primary Grid (4x2 on Desktop / 2x4 on Mobile: up to 7 apps + 1 toggle when extended apps exist) */}
            <div
              className="app-launcher-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: primaryVisibleModules.length < 4
                  ? `repeat(${primaryVisibleModules.length}, minmax(0, 240px))`
                  : 'repeat(4, 1fr)',
                justifyContent: primaryVisibleModules.length < 4 ? 'center' : 'stretch',
                gap: '22px',
                width: '100%',
              }}
            >
              {primaryVisibleModules.map((m) => (
                <SortableLauncherCard
                  key={m.id}
                  module={m}
                  onCardClick={handleCardClick}
                  activeId={activeId}
                  moveModeActive={isMoveModeActive}
                />
              ))}

              {/* 8th Slot: Show More / Show Less Toggle Button (ONLY rendered when extended modules exist) */}
              {hasExtended && (
                <button
                  type="button"
                  className="glass-panel app-launcher-card app-launcher-toggle-btn"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  style={{
                    '--card-color': 'var(--brand-accent, #FEC501)',
                    '--card-glow': 'rgba(254, 197, 1, 0.16)',
                    aspectRatio: '1 / 1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    padding: '24px 16px',
                    borderRadius: 'var(--radius-xl)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-md)',
                    border: isExpanded ? '1px solid var(--brand-accent)' : '1px dashed var(--border-color)',
                    background: isExpanded ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
                    color: 'inherit',
                    textAlign: 'center',
                    width: '100%',
                    userSelect: 'none',
                  }}
                >
                  {/* Background Ambient Glow */}
                  <div
                    className="app-launcher-glow"
                    style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '105px',
                      height: '105px',
                      borderRadius: '50%',
                      background: 'rgba(254, 197, 1, 0.12)',
                      filter: 'blur(28px)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Icon Container with smooth animated rotation */}
                  <motion.div
                    className="app-launcher-icon-box app-launcher-toggle-icon-box"
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      width: '66px',
                      height: '66px',
                      borderRadius: '18px',
                      background: 'rgba(254, 197, 1, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--brand-accent)',
                      border: '1px solid rgba(254, 197, 1, 0.25)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <ChevronDown size={32} className="app-launcher-icon" />
                  </motion.div>

                  {/* Button Title & Subtitle */}
                  <div className="app-launcher-text-wrap" style={{ maxWidth: '94%', textAlign: 'center' }}>
                    <span
                      className="app-launcher-card-title"
                      style={{
                        fontSize: '1.28rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.22,
                        display: 'block',
                      }}
                    >
                      {isExpanded ? 'Show Less' : 'Show More'}
                    </span>
                    <span
                      className="app-launcher-card-subtitle"
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginTop: '3px',
                        fontWeight: 600,
                      }}
                    >
                      {isExpanded ? 'Collapse menu' : `${extendedModules.length} more app${extendedModules.length === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* Smoothly Animated Extended Modules (Staff & Roles, Settings, etc.) */}
            <AnimatePresence initial={false}>
              {hasExtended && isExpanded && (
                <motion.div
                  key="launcher-extended-section"
                  className="app-launcher-extended-section"
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{
                    opacity: 1,
                    height: 'auto',
                    marginTop: '24px',
                    transition: {
                      height: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                      marginTop: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.3, delay: 0.05, ease: 'easeOut' },
                    },
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    marginTop: 0,
                    transition: {
                      opacity: { duration: 0.18, ease: 'easeIn' },
                      height: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                      marginTop: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                    },
                  }}
                  style={{ overflow: 'visible', width: '100%' }}
                >
                  <div
                    className="app-launcher-extended-inner"
                    style={{
                      width: '100%',
                    }}
                  >
                    <motion.div
                      className="app-launcher-grid app-launcher-extended-grid"
                      initial={{ y: -16 }}
                      animate={{ y: 0 }}
                      exit={{ y: -8 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '24px',
                        width: '100%',
                      }}
                    >
                      {extendedModules.map((m) => (
                        <SortableLauncherCard
                          key={m.id}
                          module={m}
                          onCardClick={handleCardClick}
                          activeId={activeId}
                          moveModeActive={isMoveModeActive}
                        />
                      ))}
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SortableContext>
        </LayoutGroup>

        {/* Drag Overlay: Renders floating card at exact cursor position */}
        <DragOverlay dropAnimation={null} zIndex={10000}>
          {activeModule ? (
            <div
              className="glass-panel app-launcher-card app-launcher-drag-overlay"
              style={{
                aspectRatio: '1 / 1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '24px',
                borderRadius: 'var(--radius-xl)',
                cursor: 'grabbing',
                boxShadow: '0 28px 56px rgba(0, 0, 0, 0.7), 0 0 24px ' + (activeModule.bgGlow || 'rgba(255,255,255,0.15)'),
                border: `1.5px solid ${activeModule.color}`,
                background: 'var(--bg-surface)',
                textAlign: 'center',
                transform: 'scale(1.06)',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              <ModuleCardContent module={activeModule} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
