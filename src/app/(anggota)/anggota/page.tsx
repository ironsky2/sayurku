'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingListItem, Order } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  CheckCircle, ShoppingBag, Leaf, LogOut, Truck, 
  MapPin, Phone, MessageSquare, AlertTriangle, ArrowRight,
  Clock, CheckSquare
} from 'lucide-react'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { formatRupiah } from '@/lib/utils'

export default function AnggotaPage() {
  const supabase = createClient()
  const { profile, signOut } = useAuth()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'delivery' | 'shopping'>('delivery')
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [{ data: shoppingData }, { data: deliveryData }] = await Promise.all([
        // 1. Fetch shopping list items
        supabase
          .from('shopping_list_items')
          .select('*, product:products(name, description), category:categories(name, icon), session:shopping_sessions(target_date, status)')
          .eq('anggota_id', profile.id)
          .in('session.status', ['assigned', 'shopping'])
          .order('is_purchased'),

        // 2. Fetch delivery batches (include orders, customer details, and order items)
        supabase
          .from('delivery_batches')
          .select('*, delivery_items(*, order:orders(*, customer:profiles!orders_customer_id_fkey(full_name, phone, address), order_items(*, product:products(name))))')
          .eq('assigned_to', profile.id)
          .order('created_at', { ascending: false })
      ])

      setItems((shoppingData || []).filter((i: any) => i.session))
      setBatches(deliveryData || [])
    } catch (err) {
      console.error('Gagal memuat data anggota:', err)
      toast.error('Gagal mengambil data tugas terbaru')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Realtime subscriptions
    const channelItems = supabase
      .channel('anggota-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list_items' }, loadData)
      .subscribe()

    const channelBatches = supabase
      .channel('anggota-batches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, loadData)
      .subscribe()

    return () => { 
      supabase.removeChannel(channelItems)
      supabase.removeChannel(channelBatches)
    }
  }, [profile])

  // --- SHOPPING HANDLERS ---
  const toggleItem = async (item: ShoppingListItem) => {
    const newPurchased = !item.is_purchased
    await supabase
      .from('shopping_list_items')
      .update({ is_purchased: newPurchased, purchased_at: newPurchased ? new Date().toISOString() : null })
      .eq('id', item.id)
    toast.success(newPurchased ? '✅ Ditandai selesai!' : 'Dibatalkan', { duration: 1000 })
    loadData()
  }

  // --- DELIVERY HANDLERS ---
  const startBatch = async (batchId: string, orderIds: string[]) => {
    try {
      const { error: batchErr } = await supabase
        .from('delivery_batches')
        .update({ status: 'delivering', started_at: new Date().toISOString() })
        .eq('id', batchId)

      if (batchErr) throw batchErr

      if (orderIds.length > 0) {
        const { error: orderErr } = await supabase
          .from('orders')
          .update({ status: 'delivering' })
          .in('id', orderIds)
        if (orderErr) throw orderErr
      }

      toast.success('Pengantaran dimulai! Hati-hati di jalan. 🛵')
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai pengantaran')
    }
  }

  const finishBatch = async (batchId: string) => {
    try {
      const { error } = await supabase
        .from('delivery_batches')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', batchId)

      if (error) throw error

      toast.success('Batch pengiriman telah selesai! Terima kasih. 🎉')
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyelesaikan batch')
    }
  }

  const completeDelivery = async (deliveryItemId: string, orderId: string) => {
    try {
      const { error: itemErr } = await supabase
        .from('delivery_items')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', deliveryItemId)

      if (itemErr) throw itemErr

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', orderId)

      if (orderErr) throw orderErr

      toast.success('Pesanan ditandai terkirim & pembayaran selesai! 👍')
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui status pengiriman')
    }
  }

  const failDelivery = async (deliveryItemId: string, orderId: string) => {
    if (!confirm('Apakah Anda yakin menandai pesanan ini gagal kirim?')) return

    try {
      const { error: itemErr } = await supabase
        .from('delivery_items')
        .update({ status: 'failed' })
        .eq('id', deliveryItemId)

      if (itemErr) throw itemErr

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'ready' }) // kembalikan ke ready agar bisa dikelompokkan lagi
        .eq('id', orderId)

      if (orderErr) throw orderErr

      toast.error('Pesanan ditandai gagal kirim.')
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui status pengiriman')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  // --- DATA GROUPING ---
  // Group shopping items by session date
  const bySessionDate: Record<string, { date: string; items: ShoppingListItem[] }> = {}
  items.forEach((item: any) => {
    const date = item.session?.target_date || 'unknown'
    if (!bySessionDate[date]) bySessionDate[date] = { date, items: [] }
    bySessionDate[date].items.push(item)
  })

  // Format WhatsApp Link
  const getWhatsAppLink = (order: any) => {
    const name = order.customer?.full_name || 'Kak'
    let phoneStr = order.customer?.phone || ''
    if (phoneStr.startsWith('0')) {
      phoneStr = '62' + phoneStr.slice(1)
    }
    const message = `Halo kak ${name}, saya ${profile?.full_name || 'Kurir'} dari SayurKu. Sedang mengantarkan pesanan belanjaan kakak sebesar ${formatRupiah(order.total_price)} (${order.payment_method === 'COD' ? 'Bayar Tunai / Belakangan' : 'Sudah Lunas via QRIS'}). Mohon ditunggu di rumah ya kak. 🥦🛵`
    return `https://wa.me/${phoneStr}?text=${encodeURIComponent(message)}`
  }

  const totalShoppingItems = items.length
  const purchasedShoppingItems = items.filter((i) => i.is_purchased).length

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-700/50 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-md">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-white text-base">Tugas Anggota</p>
              <p className="text-xs text-slate-500 font-semibold">{profile?.full_name} · Kurir/Helper</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6 mb-20">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setActiveTab('delivery')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'delivery'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            Tugas Antar
            {batches.filter(b => b.status !== 'done').length > 0 && (
              <span className="w-5 h-5 text-xs bg-red-500 text-white rounded-full flex items-center justify-center animate-pulse">
                {batches.filter(b => b.status !== 'done').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('shopping')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'shopping'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            List Belanja
            {totalShoppingItems > 0 && (
              <span className="w-5 h-5 text-xs bg-amber-500 text-white rounded-full flex items-center justify-center">
                {totalShoppingItems - purchasedShoppingItems}
              </span>
            )}
          </button>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl shimmer" />
            ))}
          </div>
        ) : activeTab === 'delivery' ? (
          // --- TAB 1: DELIVERY TASKS ---
          <div className="space-y-6">
            {batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center mb-4">
                  <Truck className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Belum Ada Tugas Antar</h3>
                <p className="text-slate-500 text-xs max-w-xs">
                  Sesi pengantaran belum dibuat oleh Admin atau Anda belum ditugaskan untuk mengantar paket.
                </p>
              </div>
            ) : (
              batches.map((batch) => {
                const items = batch.delivery_items || []
                const orderIds = items.map((i: any) => i.order_id)
                const pendingDeliveries = items.filter((i: any) => i.status === 'pending').length
                
                const badgeVariants: Record<string, string> = {
                  pending: 'yellow',
                  delivering: 'purple',
                  done: 'green'
                }
                const badgeLabels: Record<string, string> = {
                  pending: 'Menunggu',
                  delivering: 'Sedang Diantar',
                  done: 'Selesai'
                }

                return (
                  <div key={batch.id} className="glass rounded-2xl border border-slate-700/50 overflow-hidden shadow-lg">
                    {/* Batch Card Header */}
                    <div className="p-4 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-white text-base">{batch.label || 'Tugas Antar'}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(batch.created_at))}
                        </p>
                      </div>
                      <Badge variant={badgeVariants[batch.status] as any} dot>
                        {badgeLabels[batch.status]}
                      </Badge>
                    </div>

                    {/* Batch Actions */}
                    {batch.status === 'pending' && (
                      <div className="p-4 bg-yellow-500/5 border-b border-yellow-500/10 flex flex-col gap-2">
                        <p className="text-xs text-amber-500 font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Siap untuk berangkat? Klik tombol di bawah ini:
                        </p>
                        <Button
                          onClick={() => startBatch(batch.id, orderIds)}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          🚀 Mulai Jalan Mengantarkan
                        </Button>
                      </div>
                    )}

                    {batch.status === 'delivering' && pendingDeliveries === 0 && (
                      <div className="p-4 bg-green-500/5 border-b border-green-500/10 flex flex-col gap-2">
                        <p className="text-xs text-green-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Semua pesanan di batch ini sudah selesai dikirim!
                        </p>
                        <Button
                          variant="primary"
                          onClick={() => finishBatch(batch.id)}
                          className="w-full"
                        >
                          🏁 Tandai Batch Selesai & Pulang
                        </Button>
                      </div>
                    )}

                    {/* Customer Orders in Batch */}
                    <div className="divide-y divide-slate-700/30">
                      {items.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-6">Tidak ada alamat pesanan di batch ini</p>
                      ) : (
                        items.map((item: any, idx: number) => {
                          const order = item.order || {}
                          const customer = order.customer || {}
                          
                          return (
                            <div key={item.id} className="p-4 space-y-3.5">
                              {/* Order Title & Sequence */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                  Antrean Ke-{idx + 1}
                                </span>
                                <div className="flex items-center gap-2">
                                  {order.payment_method === 'COD' ? (
                                    <Badge variant="orange">🤝 COD</Badge>
                                  ) : (
                                    <Badge variant="teal">💳 QRIS</Badge>
                                  )}
                                  
                                  {item.status === 'delivered' && <Badge variant="green">Selesai</Badge>}
                                  {item.status === 'failed' && <Badge variant="red">Gagal</Badge>}
                                  {item.status === 'pending' && <Badge variant="yellow">Proses</Badge>}
                                </div>
                              </div>

                              {/* Customer Profile & Address */}
                              <div className="space-y-1.5">
                                <h5 className="font-extrabold text-white text-base">{customer.full_name || 'Customer'}</h5>
                                <div className="flex items-start gap-2 text-xs text-slate-400">
                                  <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                                  <span className="leading-relaxed font-semibold">{order.delivery_address || 'Tidak ada alamat'}</span>
                                </div>
                                {order.delivery_notes && (
                                  <div className="p-2 rounded bg-slate-900/50 border border-slate-800 text-xs text-slate-400 leading-relaxed italic">
                                    Catatan: {order.delivery_notes}
                                  </div>
                                )}
                              </div>

                              {/* Order Items list */}
                              {order.order_items && order.order_items.length > 0 && (
                                <div className="space-y-1.5 pt-1.5 border-t border-slate-700/20">
                                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    Detail Belanjaan ({order.order_items.length} item):
                                  </p>
                                  <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800 space-y-1.5">
                                    {order.order_items.map((oi: any) => (
                                      <div key={oi.id} className="flex justify-between items-start text-xs leading-relaxed text-slate-300">
                                        <div className="flex-1 font-semibold">
                                          🥦 {oi.product?.name || 'Produk'}
                                          {oi.notes && (
                                            <span className="block text-[10px] text-amber-600 font-semibold italic mt-0.5 pl-4">
                                              Catatan: "{oi.notes}"
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-right font-extrabold text-white ml-2 flex-shrink-0">
                                          {Number(oi.quantity)} {oi.unit}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Billing Info */}
                              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                                <div>
                                  <p className="text-xs text-slate-500 font-semibold">Total yang Harus Dibayar</p>
                                  <p className="text-base font-extrabold text-green-400 mt-0.5">
                                    {formatRupiah(order.total_price)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-500 font-semibold">Metode</p>
                                  <p className="text-xs font-bold text-white mt-0.5">
                                    {order.payment_method === 'COD' ? '💵 Bayar Cash ke Kurir' : '✅ Sudah Lunas (QRIS)'}
                                  </p>
                                </div>
                              </div>

                              {/* Courier Actions for Order */}
                              {item.status === 'pending' && batch.status === 'delivering' && (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <button
                                    onClick={() => completeDelivery(item.id, order.id)}
                                    className="py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-97 transition-all"
                                  >
                                    <CheckSquare className="w-4 h-4" />
                                    Terkirim & Lunas
                                  </button>
                                  <button
                                    onClick={() => failDelivery(item.id, order.id)}
                                    className="py-2.5 bg-slate-800 hover:bg-slate-700 text-red-400 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-700 active:scale-97 transition-all"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                    Gagal Kirim
                                  </button>
                                </div>
                              )}

                              {/* WhatsApp Contact Action */}
                              {item.status === 'pending' && (
                                <a
                                  href={getWhatsAppLink(order)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                  Hubungi Customer (WhatsApp)
                                </a>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          // --- TAB 2: SHOPPING SESSIONS (SHOPPING LIST) ---
          <div className="space-y-6">
            {/* Progress */}
            {totalShoppingItems > 0 && (
              <div className="glass rounded-2xl p-5 border border-slate-700/50">
                <div className="flex justify-between items-center mb-3">
                  <p className="font-bold text-white">Progress Belanja Pasar</p>
                  <span className="text-green-400 font-bold text-sm">{purchasedShoppingItems}/{totalShoppingItems}</span>
                </div>
                <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500"
                    style={{ width: `${totalShoppingItems > 0 ? (purchasedShoppingItems / totalShoppingItems) * 100 : 0}%` }}
                  />
                </div>
                {purchasedShoppingItems === totalShoppingItems && totalShoppingItems > 0 && (
                  <div className="flex items-center gap-2 mt-3 text-green-400 text-sm font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    Semua item belanjaan sudah dibeli! 🎉
                  </div>
                )}
              </div>
            )}

            {/* Items by session */}
            {Object.keys(bySessionDate).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Tidak Ada List Belanja</h3>
                <p className="text-slate-500 text-xs max-w-xs">
                  Sesi belanja dari pasar belum di-assign atau belum diaktifkan oleh admin.
                </p>
              </div>
            ) : (
              Object.entries(bySessionDate).map(([date, group]) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-bold text-slate-300">
                      📅 {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(date))}
                    </h2>
                    <Badge variant="green">{group.items.filter((i) => i.is_purchased).length}/{group.items.length}</Badge>
                  </div>

                  {/* Group items by category */}
                  {(() => {
                    const byCat: Record<string, { cat: any; items: ShoppingListItem[] }> = {}
                    group.items.forEach((item: any) => {
                      const catId = item.category_id || 'other'
                      if (!byCat[catId]) byCat[catId] = { cat: item.category, items: [] }
                      byCat[catId].items.push(item)
                    })
                    return Object.entries(byCat).map(([catId, catGroup]) => (
                      <div key={catId} className="space-y-2">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider pl-1">
                          {catGroup.cat?.icon} {catGroup.cat?.name || 'Lainnya'}
                        </p>
                        <div className="space-y-2">
                          {catGroup.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => toggleItem(item)}
                              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-98 text-left ${
                                item.is_purchased
                                  ? 'border-green-500/20 bg-green-500/5'
                                  : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                              }`}
                            >
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                  item.is_purchased ? 'bg-green-500 border-green-500' : 'border-slate-500'
                                }`}
                              >
                                {item.is_purchased && <CheckCircle className="w-4 h-4 text-white" />}
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-semibold ${item.is_purchased ? 'line-through text-slate-500' : 'text-white'}`}>
                                  {(item as any).product?.name}
                                </p>
                                {(item as any).product?.description && (
                                  <p className="text-xs text-slate-500 mt-0.5 truncate">{(item as any).product.description}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`font-extrabold text-lg ${item.is_purchased ? 'text-slate-500 line-through' : 'text-green-400'}`}>
                                  {item.total_quantity}
                                </p>
                                <p className="text-xs text-slate-500 font-semibold">{item.unit}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
