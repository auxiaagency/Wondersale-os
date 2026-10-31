import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Package,
  ShoppingBag,
  TrendingUp,
  Search,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  Phone,
  MapPin,
  IndianRupee,
  Calendar,
} from 'lucide-react';
import {
  fetchWebsiteStats,
  fetchWebsiteOrders,
  updateWebsiteOrderStatus,
  toggleItemWebsiteListing,
  fetchItems,
} from '../api';

export default function WebsiteManagementView() {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'orders' | 'config'
  const [stats, setStats] = useState({
    total_listed_items: 0,
    total_orders: 0,
    pending_orders: 0,
    confirmed_orders: 0,
    shipped_orders: 0,
    delivered_orders: 0,
    total_revenue: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Catalog Tab State
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all' | 'listed' | 'unlisted'
  const [togglingItemId, setTogglingItemId] = useState(null);

  // Orders Tab State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const data = await fetchWebsiteStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load website stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoadingItems(true);
      const res = await fetchItems({
        search: searchQuery,
        page_size: 50,
      });
      const itemList = Array.isArray(res) ? res : res.results || [];
      setItems(itemList);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [searchQuery]);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await fetchWebsiteOrders({
        status: orderStatusFilter,
        search: orderSearchQuery,
      });
      const orderList = Array.isArray(res) ? res : res.results || [];
      setOrders(orderList);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [orderStatusFilter, orderSearchQuery]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'catalog') {
      loadItems();
    } else if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab, loadItems, loadOrders]);

  const handleToggleListing = async (item) => {
    const nextState = !item.is_listed_on_website;
    setTogglingItemId(item.id);
    try {
      await toggleItemWebsiteListing(item.id, nextState);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_listed_on_website: nextState } : i))
      );
      setStats((prev) => ({
        ...prev,
        total_listed_items: prev.total_listed_items + (nextState ? 1 : -1),
      }));
    } catch (err) {
      console.error('Failed to toggle item listing:', err);
      alert('Failed to update website listing: ' + (err.message || 'Server error'));
    } finally {
      setTogglingItemId(null);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updated = await updateWebsiteOrderStatus(orderId, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: updated.status }));
      }
      loadStats();
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Failed to update status: ' + (err.message || 'Server error'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (catalogFilter === 'listed') return item.is_listed_on_website;
    if (catalogFilter === 'unlisted') return !item.is_listed_on_website;
    return true;
  });

  const getStatusBadge = (status) => {
    const map = {
      PENDING: { label: 'Pending', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
      CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
      PROCESSING: { label: 'Processing', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
      SHIPPED: { label: 'Shipped', bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
      DELIVERED: { label: 'Delivered', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
      CANCELLED: { label: 'Cancelled', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
    };
    const s = map[status] || { label: status, bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F19] text-slate-100 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/20 border border-blue-500/20 shadow-xl backdrop-blur-md">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Website & Online Store</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Connected
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Control which products are published to <span className="text-blue-300 font-medium">wonder.sale</span> and manage incoming online orders.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadStats();
              if (activeTab === 'catalog') loadItems();
              if (activeTab === 'orders') loadOrders();
            }}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-sm font-medium transition"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5"
          >
            <span>Visit Storefront</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Listed Products</p>
            <p className="text-2xl font-bold text-white mt-1">
              {loadingStats ? '...' : stats.total_listed_items}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Orders</p>
            <p className="text-2xl font-bold text-white mt-1">
              {loadingStats ? '...' : stats.total_orders}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending Orders</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {loadingStats ? '...' : stats.pending_orders}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Online Revenue</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              ₹{loadingStats ? '...' : Number(stats.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-6">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center space-x-2 pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'catalog'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product Catalog ({stats.total_listed_items} Listed)</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center space-x-2 pb-3 text-sm font-semibold transition border-b-2 relative ${
            activeTab === 'orders'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Online Orders</span>
          {stats.pending_orders > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
              {stats.pending_orders}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Product Catalog Management */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items by name or UID..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <span className="text-xs text-slate-400">Filter:</span>
              <button
                onClick={() => setCatalogFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  catalogFilter === 'all'
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCatalogFilter('listed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  catalogFilter === 'listed'
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Listed Only
              </button>
              <button
                onClick={() => setCatalogFilter('unlisted')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  catalogFilter === 'unlisted'
                    ? 'bg-rose-600/20 text-rose-400 border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Unlisted
              </button>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">UID</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">MRP</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3 text-right">Website Listing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loadingItems ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Loading items...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        No items found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isListed = Boolean(item.is_listed_on_website);
                      const isToggling = togglingItemId === item.id;
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-800/40 transition group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-3">
                              {item.primary_image_url ? (
                                <img
                                  src={item.primary_image_url}
                                  alt={item.name}
                                  className="w-10 h-10 object-cover rounded-lg border border-slate-700"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-white group-hover:text-blue-300 transition">
                                  {item.name}
                                </p>
                                <p className="text-xs text-slate-500 line-clamp-1">
                                  {item.description || 'No description'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">
                            {item.uid}
                          </td>
                          <td className="px-4 py-3 font-semibold text-emerald-400">
                            ₹{Number(item.selling_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-slate-500 line-through text-xs">
                            ₹{Number(item.mrp || item.selling_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.quantity > 5
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : item.quantity > 0
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-rose-500/15 text-rose-400'
                              }`}
                            >
                              {item.quantity} in stock
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleToggleListing(item)}
                              disabled={isToggling}
                              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                                isListed
                                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 hover:bg-rose-600/20 hover:border-rose-500/40 hover:text-rose-400'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-emerald-600/20 hover:border-emerald-500/40 hover:text-emerald-400'
                              }`}
                            >
                              {isToggling ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : isListed ? (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Published</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>Unlisted</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Online Orders Management */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search by Order #, tracking or phone..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <span className="text-xs text-slate-400">Status:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">All Orders</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders List */}
            <div className="lg:col-span-2 space-y-3">
              {loadingOrders ? (
                <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading online orders...
                </div>
              ) : orders.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                  <p className="font-medium text-slate-300">No online orders found</p>
                  <p className="text-xs text-slate-500 mt-1">Orders placed on wonder.sale will appear right here.</p>
                </div>
              ) : (
                orders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`p-4 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-900/20 border-blue-500/50 shadow-lg'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-white text-sm">#{order.order_number}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{order.customer_name || 'Customer'}</span>
                            <span>•</span>
                            <Phone className="w-3 h-3 ml-1" />
                            <span>{order.customer_mobile}</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-white text-base">₹{Number(order.total_amount).toFixed(2)}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Line items summary */}
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? '' : 's'}
                        </span>
                        <span className="font-mono text-slate-500">{order.tracking_id}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Order Details & Action Panel */}
            <div className="lg:col-span-1">
              {selectedOrder ? (
                <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5 sticky top-6 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Order Detail</p>
                      <p className="font-mono font-bold text-lg text-white">#{selectedOrder.order_number}</p>
                    </div>
                    {getStatusBadge(selectedOrder.status)}
                  </div>

                  {/* Customer Information */}
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-slate-300 uppercase tracking-wider">Customer</p>
                    <div className="p-3 rounded-lg bg-slate-800/50 space-y-1">
                      <p className="text-white font-medium flex items-center space-x-2">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>{selectedOrder.customer_name || 'Customer'}</span>
                      </p>
                      <p className="text-slate-400 flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{selectedOrder.customer_mobile}</span>
                      </p>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  {selectedOrder.delivery_address && (
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-slate-300 uppercase tracking-wider">Delivery Address</p>
                      <div className="p-3 rounded-lg bg-slate-800/50 text-slate-300 space-y-1">
                        <p>{selectedOrder.delivery_address.address_line || selectedOrder.delivery_address.address_line1 || selectedOrder.delivery_address.street || 'Address on file'}</p>
                        <p>
                          {[selectedOrder.delivery_address.city, selectedOrder.delivery_address.pincode].filter(Boolean).join(' - ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Order Items */}
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-slate-300 uppercase tracking-wider">Purchased Items</p>
                    <div className="divide-y divide-slate-800 bg-slate-800/30 rounded-lg max-h-48 overflow-y-auto">
                      {(selectedOrder.items || []).map((oi) => (
                        <div key={oi.id} className="p-2.5 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-medium text-slate-200">{oi.item_name}</p>
                            <p className="text-slate-500 font-mono text-[10px]">{oi.item_uid}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-medium">₹{Number(oi.total_price).toFixed(2)}</p>
                            <p className="text-slate-400 text-[11px]">{oi.quantity}x @ ₹{Number(oi.unit_price).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Update Status Actions */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Update Order Status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(selectedOrder.id, st)}
                          disabled={updatingOrderId === selectedOrder.id || selectedOrder.status === st}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                            selectedOrder.status === st
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                              : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Select an order on the left to view items, address, and update tracking status.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
