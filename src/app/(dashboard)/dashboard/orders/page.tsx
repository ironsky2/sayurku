'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, OrderStatus } from '@/lib/types'
import { formatRupiah, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CheckCircle, XCircle, Eye, Search, Filter, Edit, Save, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { Modal } from '@/components/ui/Modal'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  pending_payment: 'yellow', payment_uploaded: 'blue', confirmed: 'green',
  shopping: 'orange', ready: 'teal', delivering: 'purple', delivered: 'green', cancelled: 'red',
}

export default function DashboardOrdersPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedItems, setEditedItems] = useState<any[]>([])
  const [savingAdjustments, setSavingAdjustments] = useState(false)
  const [editOrderMode, setEditOrderMode] = useState(false)
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [dailyPrices, setDailyPrices] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!selectedOrder) return
    
    const items = selectedOrder.order_items || []
    
    // Fetch suggested prices: try daily_prices today first, fallback to products.price_per_unit
    const fetchSuggestedPrices = async () => {
      const productIds = items.map((i: any) => i.product_id || i.product?.id).filter(Boolean)
      if (productIds.length === 0) return

      const today = new Date().toISOString().slice(0, 10)

      // Try daily_prices first
      const { data: dpData } = await supabase
        .from('daily_prices')
        .select('product_id, price')
        .in('product_id', productIds)
        .eq('date', today)

      const priceMap: Record<string, number> = {}
      if (dpData && dpData.length > 0) {
        dpData.forEach((r: any) => { priceMap[r.product_id] = r.price })
      }

      // Fallback to products.price_per_unit for any missing
      const missing = productIds.filter(id => !priceMap[id])
      if (missing.length > 0) {
        const { data: pData } = await supabase
          .from('products').select('id, price_per_unit').in('id', missing)
        pData?.forEach((p: any) => { priceMap[p.id] = p.price_per_unit })
      }

      setDailyPrices(priceMap)

      setEditedItems(items.map((item: any) => {
        const pid = item.product_id || item.product?.id
        const suggested = pid ? priceMap[pid] : undefined
        return {
          ...item,
          price_at_order: (item.price_at_order && Number(item.price_at_order) > 0)
            ? item.price_at_order
            : (suggested || 0),
        }
      }))
    }
    
    setEditedItems(items)
    setEditOrderMode(false)
    // Fetch all products for edit mode
    const fetchProducts = async () => {
      const { data: prods } = await supabase.from('products').select('id, name, unit, price_per_unit').eq('is_active', true).order('name')
      if (prods) setAllProducts(prods)
    }
    fetchProducts()
    setIsEditing(false)
    fetchSuggestedPrices()
  }, [selectedOrder])


  const handleSaveAdjustments = async () => {
    if (!selectedOrder) return
    setSavingAdjustments(true)

    try {
      // 1. Simpan perubahan ke order_items satu per satu
      for (const item of editedItems) {
        // Hitung subtotal baru berdasarkan qty dan price
        const subtotal = item.quantity * item.price_at_order
        const { error: itemErr } = await supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            price_at_order: item.price_at_order,
          })
          .eq('id', item.id)

        if (itemErr) throw itemErr
      }

      // 2. Hitung total price order yang baru
      const newTotal = editedItems.reduce((sum, item) => sum + (item.quantity * item.price_at_order), 0)

      // 3. Update total_price di tabel orders
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ total_price: newTotal })
        .eq('id', selectedOrder.id)

      if (orderErr) throw orderErr

      toast.success('Harga tagihan pesanan berhasil disesuaikan!')
      setIsEditing(false)
      
      // Refresh modal data
      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('*, customer:profiles!orders_customer_id_fkey(full_name, phone), order_items(*, product:products(name, unit))')
        .eq('id', selectedOrder.id)
        .single()
      
      if (updatedOrder) setSelectedOrder(updatedOrder)
      loadOrders()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyesuaikan harga tagihan')
    } finally {
      setSavingAdjustments(false)
    }
  }

  const loadOrders = async () => {
    let query = supabase
      .from('orders')
      .select('*, customer:profiles!orders_customer_id_fkey(full_name, phone), order_items(*, product:products(name, unit))')
      .order('created_at', { ascending: false })

    if (filterStatus !== 'all') query = query.eq('status', filterStatus)

    const { data } = await query
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
    // Real-time subscribe
    const channel = supabase
      .channel('orders-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [filterStatus])

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : undefined })
      .eq('id', orderId)

    if (error) { toast.error('Gagal update status'); return }
    toast.success(`Status diupdate: ${ORDER_STATUS_LABELS[status]}`)
    loadOrders()
    setSelectedOrder(null)
  }

  const filtered = orders.filter(o =>
    search === '' ||
    (o as any).customer?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.id.includes(search)
  )

  const statusFilters = [
    { value: 'all', label: 'Semua' },
    { value: 'payment_uploaded', label: '🔵 Verifikasi' },
    { value: 'confirmed', label: '🟢 Dikonfirmasi' },
    { value: 'pending_payment', label: '🟡 Belum Bayar' },
    { value: 'delivering', label: '🟣 Dikirim' },
    { value: 'delivered', label: '✅ Selesai' },
  ]

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Pesanan</h1>
          <p className="text-slate-500 text-sm">{orders.length} total pesanan</p>
        </div>
        <Link
          href="/dashboard/orders/timbang"
          className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-bold text-sm px-4 py-2.5 rounded-xl transition-all whitespace-nowrap flex-shrink-0"
        >
          <Scale className="w-4 h-4" />
          ⚖️ Mode Timbang Massal
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            placeholder="Cari nama customer / ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                filterStatus === f.value ? 'bg-green-600 text-white border-green-600' : 'border-slate-700 text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table / List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">Tidak ada pesanan</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="glass rounded-2xl p-4 border border-slate-700/50 flex gap-4 items-start"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-500">#{order.id.split('-')[0].toUpperCase()}</span>
                  <Badge variant={statusColors[order.status] as any} dot>
                    {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                  </Badge>
                  {order.payment_method === 'COD' ? (
                    <Badge variant="orange">🤝 COD</Badge>
                  ) : (
                    <Badge variant="teal">💳 QRIS</Badge>
                  )}
                  {order.order_type === 'PRE_ORDER' && (
                    <Badge variant="blue">📅 PO</Badge>
                  )}
                </div>
                <p className="text-sm font-semibold text-white mt-1">
                  {(order as any).customer?.full_name}
                </p>
                <p className="text-xs text-slate-500">
                  {(order as any).customer?.phone} · {formatDateTime(order.created_at)}
                </p>
                {Number(order.total_price) === 0 ? (
                  <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-600 border border-amber-550/30">
                    ⚖️ Perlu Timbang
                  </span>
                ) : (
                  <p className="text-green-600 font-bold text-sm mt-1">{formatRupiah(order.total_price)}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="p-2 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition-all"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {order.status === 'payment_uploaded' && (
                  <>
                    <button
                      onClick={() => updateStatus(order.id, 'confirmed')}
                      className="p-2 rounded-xl bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, 'cancelled')}
                      className="p-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      <Modal
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Pesanan #${selectedOrder?.id.split('-')[0].toUpperCase()}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-4">
            {/* Customer Info */}
            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">Customer</p>
              <p className="font-semibold text-white">{(selectedOrder as any).customer?.full_name}</p>
              <p className="text-sm text-slate-400">{(selectedOrder as any).customer?.phone}</p>
              <p className="text-sm text-slate-400 mt-1">📍 {selectedOrder.delivery_address}</p>
              {selectedOrder.delivery_notes && (
                <p className="text-xs text-slate-500 mt-1">Catatan: {selectedOrder.delivery_notes}</p>
              )}
            </div>

            {/* Step guide banner - shown when weighing needed */}
            {Number(selectedOrder.total_price) === 0 && (selectedOrder.status === 'confirmed' || selectedOrder.status === 'shopping') && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3">
                <span className="text-2xl flex-shrink-0">⚖️</span>
                <div>
                  <p className="text-sm font-bold text-amber-400">Masukkan Harga Hasil Timbangan</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Harga dari <strong className="text-green-400">Update Harga Harian</strong> sudah otomatis terisi. Sesuaikan jika ada perubahan, lalu klik <strong className="text-green-400">"Selesai Timbang → Siap Kirim"</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Items — always inline editable when confirmed/shopping */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500">Item Pesanan</p>
                {/* Show "Apply All Suggestions" button if any item has a suggested price */}
                {Object.keys(dailyPrices).length > 0 && (
                  <button
                    onClick={() => {
                      setEditedItems(prev => prev.map(item => {
                        const pid = item.product_id || item.product?.id
                        const suggested = pid ? dailyPrices[pid] : undefined
                        return suggested && suggested > 0
                          ? { ...item, price_at_order: suggested }
                          : item
                      }))
                      toast.success('Semua harga diisi dari harga harian! ✅')
                    }}
                    className="text-[11px] font-bold text-green-400 hover:text-green-300 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                  >
                    ✨ Pakai Semua Sugesti
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {editedItems.map((item, idx) => {
                  const needsPrice = Number(item.price_at_order) === 0
                  const canEdit = selectedOrder.status === 'confirmed' || selectedOrder.status === 'shopping' || selectedOrder.status === 'pending_payment' || selectedOrder.status === 'payment_uploaded'
                  const subtotal = Number(item.quantity) * Number(item.price_at_order)
                  const pid = item.product_id || item.product?.id
                  const suggestedPrice = pid ? dailyPrices[pid] : undefined
                  const isSuggested = suggestedPrice && suggestedPrice > 0

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 transition-all ${
                        needsPrice && canEdit
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-slate-700/30 bg-slate-800/20'
                      }`}
                    >
                      {/* Item header */}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white">🥦 {item.product?.name}</p>
                            {isSuggested && (
                              <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                                💰 Sugesti: {formatRupiah(suggestedPrice!)}/ {item.unit}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Pesanan: <span className="font-bold text-slate-200">{item.quantity} {item.unit}</span>
                          </p>
                          {item.notes && (
                            <p className="text-[10px] text-amber-400 font-semibold mt-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 w-fit">
                              📝 {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-xs text-slate-500 mb-0.5">Subtotal</p>
                          {subtotal > 0
                            ? <p className="text-sm font-bold text-green-400">{formatRupiah(subtotal)}</p>
                            : <p className="text-xs font-bold text-amber-500">Belum diisi</p>
                          }
                        </div>
                      </div>

                      {/* Inline price + qty input (always visible if editable) */}
                      {canEdit && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-[10px] text-slate-500 font-semibold block mb-1 uppercase tracking-wide">
                              Berat Timbangan ({item.unit})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                setEditedItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it))
                              }}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                              placeholder="Cth: 1.25"
                            />
                          </div>
                          <div>
                            <label className={`text-[10px] font-semibold block mb-1 uppercase tracking-wide ${
                              isSuggested ? 'text-green-400' : 'text-amber-400'
                            }`}>
                              {isSuggested ? '✅' : '⚖️'} Harga / {item.unit} (Rp)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.price_at_order || ''}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                setEditedItems(prev => prev.map((it, i) => i === idx ? { ...it, price_at_order: val } : it))
                              }}
                              className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 ${
                                needsPrice ? 'border-amber-500/50' : isSuggested ? 'border-green-500/40' : 'border-slate-700'
                              }`}
                              placeholder={isSuggested ? `Sugesti: ${suggestedPrice}` : 'Cth: 7000'}
                            />
                            {isSuggested && (
                              <button
                                onClick={() => setEditedItems(prev => prev.map((it, i) => i === idx ? { ...it, price_at_order: suggestedPrice } : it))}
                                className="mt-1 text-[10px] text-green-400 hover:text-green-300 font-semibold underline underline-offset-2"
                              >
                                Pakai harga sugesti ({formatRupiah(suggestedPrice!)})
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Cancel / Substitute controls - only in edit mode */}
                      {editOrderMode && canEdit && (
                        <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-2">
                          {item.item_status !== 'cancelled' && item.item_status !== 'substituted' ? (
                            <>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  id={`cancel-reason-${item.id}`}
                                  placeholder="Alasan batalkan item ini, tekan Enter untuk konfirmasi"
                                  className="flex-1 bg-slate-900 border border-red-500/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500/40"
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      const reason = (e.target as HTMLInputElement).value.trim()
                                      if (!reason) return
                                      await supabase.from('order_items').update({ item_status: 'cancelled', cancel_reason: reason }).eq('id', item.id)
                                      const { data: upd } = await supabase.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name, phone), order_items(*, product:products(name, unit))').eq('id', selectedOrder.id).single()
                                      if (upd) { setSelectedOrder(upd); setEditOrderMode(true) }
                                      toast.success('Item dibatalkan')
                                    }
                                  }}
                                />
                                <span className="text-[10px] text-slate-600 whitespace-nowrap">Enter → batalkan</span>
                              </div>
                              <div className="flex gap-2 items-center">
                                <span className="text-[10px] text-slate-500 whitespace-nowrap">🔄 Ganti dengan:</span>
                                <select
                                  className="flex-1 bg-slate-900 border border-amber-500/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/40"
                                  defaultValue=""
                                  onChange={async (e) => {
                                    if (!e.target.value) return
                                    const newProd = allProducts.find((p: any) => p.id === e.target.value)
                                    if (!newProd) return
                                    await supabase.from('order_items').update({ item_status: 'substituted' }).eq('id', item.id)
                                    await supabase.from('order_items').insert({ order_id: selectedOrder.id, product_id: newProd.id, quantity: item.quantity, unit: newProd.unit, price_at_order: 0, substitute_for: item.id })
                                    const { data: upd } = await supabase.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name, phone), order_items(*, product:products(name, unit))').eq('id', selectedOrder.id).single()
                                    if (upd) { setSelectedOrder(upd); setEditOrderMode(true) }
                                    toast.success(`🔄 Diganti ke ${newProd.name}`)
                                  }}
                                >
                                  <option value="">Pilih produk pengganti...</option>
                                  {allProducts.filter((p: any) => p.id !== (item.product_id || item.product?.id)).map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                                  ))}
                                </select>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold">
                                {item.item_status === 'cancelled' ? <>❌ Dibatalkan: {item.cancel_reason}</> : <>🔄 Digantikan produk lain</>}
                              </span>
                              <button
                                onClick={async () => {
                                  await supabase.from('order_items').update({ item_status: 'active', cancel_reason: null }).eq('id', item.id)
                                  const { data: upd } = await supabase.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name, phone), order_items(*, product:products(name, unit))').eq('id', selectedOrder.id).single()
                                  if (upd) { setSelectedOrder(upd); setEditOrderMode(true) }
                                  toast.success('Item dipulihkan')
                                }}
                                className="text-[10px] text-green-400 hover:text-green-300 underline"
                              >Pulihkan</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Total row */}
                <div className="border-t border-slate-700/50 pt-3 flex justify-between font-bold">
                  <span className="text-slate-400 text-sm">Total Tagihan</span>
                  <span className="text-green-400">
                    {editedItems.reduce((s, it) => s + Number(it.quantity) * Number(it.price_at_order), 0) > 0
                      ? formatRupiah(editedItems.reduce((s, it) => s + Number(it.quantity) * Number(it.price_at_order), 0))
                      : '⚖️ Perlu Timbang'
                    }
                  </span>
                </div>
                {/* Add new item to order */}
                {editOrderMode && (selectedOrder.status === 'confirmed' || selectedOrder.status === 'shopping') && (
                  <div className="border border-dashed border-green-500/30 rounded-xl p-3 bg-green-500/5 mt-1">
                    <p className="text-xs font-bold text-green-400 mb-2">➕ Tambah Produk ke Pesanan Ini</p>
                    <div className="flex gap-2">
                      <select
                        id={`add-prod-${selectedOrder.id}`}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                        defaultValue=""
                      >
                        <option value="">Pilih produk...</option>
                        {allProducts.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                      <input
                        id={`add-qty-${selectedOrder.id}`}
                        type="number"
                        min="0.1"
                        step="0.25"
                        placeholder="Qty"
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-green-500"
                      />
                      <button
                        onClick={async () => {
                          const sel = document.getElementById(`add-prod-${selectedOrder.id}`) as HTMLSelectElement
                          const qtyEl = document.getElementById(`add-qty-${selectedOrder.id}`) as HTMLInputElement
                          const prodId = sel?.value
                          const qty = Number(qtyEl?.value)
                          if (!prodId || !qty || qty <= 0) { toast.error('Pilih produk dan isi qty terlebih dahulu'); return }
                          const prod = allProducts.find((p: any) => p.id === prodId)
                          if (!prod) return
                          await supabase.from('order_items').insert({ order_id: selectedOrder.id, product_id: prodId, quantity: qty, unit: prod.unit, price_at_order: 0 })
                          const { data: upd } = await supabase.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name, phone), order_items(*, product:products(name, unit))').eq('id', selectedOrder.id).single()
                          if (upd) { setSelectedOrder(upd); setEditOrderMode(true) }
                          if (sel) sel.value = ''
                          if (qtyEl) qtyEl.value = ''
                          toast.success(`${prod.name} ditambahkan ke pesanan!`)
                        }}
                        className="flex-shrink-0 bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Proof */}
            {selectedOrder.payment_proof_url && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Bukti Transfer</p>
                <div className="rounded-xl overflow-hidden">
                  <img
                    src={selectedOrder.payment_proof_url}
                    alt="Bukti Bayar"
                    className="object-cover w-full max-h-60"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            {/* WhatsApp chat + Edit order buttons */}
            {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'shopping' || selectedOrder.status === 'ready') && (
              <div className="flex gap-2 flex-wrap">
                {(selectedOrder as any).customer?.phone && (
                  <a
                    href={`https://wa.me/62${((selectedOrder as any).customer.phone as string).replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                      selectedOrder.status === 'ready'
                        ? `Halo ${(selectedOrder as any).customer?.full_name}! 🥦\n\nPesanan #${selectedOrder.id.split('-')[0].toUpperCase()} Anda telah selesai ditimbang.\n*Total Tagihan Final:* ${formatRupiah(selectedOrder.total_price)}\n\nSilakan cek aplikasi untuk detailnya. Terima kasih!`
                        : `Halo ${(selectedOrder as any).customer?.full_name}, saya ingin konfirmasi mengenai pesanan #${selectedOrder.id.split('-')[0].toUpperCase()}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-2 bg-green-600/10 border border-green-600/30 hover:bg-green-600/20 text-green-400 font-bold text-sm px-3 py-2 rounded-xl transition-all"
                  >
                    💬 {selectedOrder.status === 'ready' ? 'Kirim Tagihan via WA' : 'Chat WA'}
                  </a>
                )}
                {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'shopping') && (
                  <button
                    onClick={() => setEditOrderMode(prev => !prev)}
                    className={`flex-1 flex items-center justify-center gap-2 border font-bold text-sm px-3 py-2 rounded-xl transition-all ${
                      editOrderMode
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : 'bg-slate-700/40 border-slate-600/40 text-slate-300 hover:bg-slate-700/60'
                    }`}
                  >
                    ✏️ {editOrderMode ? 'Tutup Mode Edit' : 'Edit Pesanan'}
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              {/* Confirmed: show save + mark ready in one button */}
              {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'shopping') && (
                <>
                  <Button
                    fullWidth
                    loading={savingAdjustments}
                    onClick={async () => {
                      // Check all items have prices
                      const missing = editedItems.filter(it => Number(it.price_at_order) === 0)
                      if (missing.length > 0) {
                        toast.error(`Masukkan harga untuk: ${missing.map((m: any) => m.product?.name).join(', ')}`)
                        return
                      }
                      setSavingAdjustments(true)
                      try {
                        for (const item of editedItems) {
                          await supabase.from('order_items').update({
                            quantity: item.quantity,
                            price_at_order: item.price_at_order,
                          }).eq('id', item.id)
                        }
                        const newTotal = editedItems.reduce((s, it) => s + Number(it.quantity) * Number(it.price_at_order), 0)
                        await supabase.from('orders').update({ total_price: newTotal, status: 'ready' }).eq('id', selectedOrder.id)
                        toast.success('✅ Harga disimpan! Pesanan siap dikirim!')
                        setSelectedOrder(null)
                        loadOrders()
                      } catch (err: any) {
                        toast.error(err.message)
                      } finally {
                        setSavingAdjustments(false)
                      }
                    }}
                    icon={<CheckCircle className="w-4 h-4" />}
                  >
                    ✅ Selesai Timbang → Siap Kirim
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={savingAdjustments}
                    onClick={async () => {
                      setSavingAdjustments(true)
                      try {
                        for (const item of editedItems) {
                          await supabase.from('order_items').update({
                            quantity: item.quantity,
                            price_at_order: item.price_at_order,
                          }).eq('id', item.id)
                        }
                        const newTotal = editedItems.reduce((s, it) => s + Number(it.quantity) * Number(it.price_at_order), 0)
                        await supabase.from('orders').update({ total_price: newTotal }).eq('id', selectedOrder.id)
                        toast.success('Harga disimpan (draft)!')
                        const { data } = await supabase.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name, phone), order_items(*, product:products(name, unit))').eq('id', selectedOrder.id).single()
                        if (data) setSelectedOrder(data)
                        loadOrders()
                      } catch (err: any) {
                        toast.error(err.message)
                      } finally {
                        setSavingAdjustments(false)
                      }
                    }}
                    icon={<Save className="w-3.5 h-3.5" />}
                  >
                    Simpan Draft
                  </Button>
                </>
              )}
              {selectedOrder.status === 'payment_uploaded' && (
                <>
                  <Button
                    fullWidth
                    onClick={async () => {
                      setSavingAdjustments(true)
                      try {
                        for (const item of editedItems) {
                          await supabase.from('order_items').update({ quantity: item.quantity, price_at_order: item.price_at_order }).eq('id', item.id)
                        }
                        const newTotal = editedItems.reduce((s, it) => s + Number(it.quantity) * Number(it.price_at_order), 0)
                        await supabase.from('orders').update({ total_price: newTotal, status: 'confirmed' }).eq('id', selectedOrder.id)
                        toast.success('Pesanan dikonfirmasi!')
                        setSelectedOrder(null)
                        loadOrders()
                      } catch (err: any) {
                        toast.error(err.message)
                      } finally {
                        setSavingAdjustments(false)
                      }
                    }}
                    icon={<CheckCircle className="w-4 h-4" />}
                  >
                    Konfirmasi
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    onClick={() => updateStatus(selectedOrder.id, 'cancelled')}
                    icon={<XCircle className="w-4 h-4" />}
                  >
                    Tolak
                  </Button>
                </>
              )}
              {selectedOrder.status === 'ready' && (
                <Button fullWidth onClick={() => updateStatus(selectedOrder.id, 'delivering')}>
                  🚀 Mulai Pengiriman
                </Button>
              )}
              {selectedOrder.status === 'delivering' && (
                <Button fullWidth onClick={() => updateStatus(selectedOrder.id, 'delivered')}>
                  Tandai Terkirim ✅
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
