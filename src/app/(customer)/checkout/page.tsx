'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/lib/context/CartContext'
import { useAuth } from '@/lib/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/Input'
import { MapPin, Calendar, Clock, ChevronRight, Package, Repeat } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart()
  const { user, profile } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [orderType, setOrderType] = useState<'DIRECT' | 'PRE_ORDER'>('DIRECT')
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [address, setAddress] = useState(profile?.address || '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Prefill address from profile or localStorage
  useEffect(() => {
    if (profile?.address) {
      setAddress(profile.address)
    } else {
      const savedAddress = localStorage.getItem('sayurku_last_address')
      if (savedAddress) {
        setAddress(savedAddress)
      }
    }
  }, [profile])

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const hasPoItems = items.some((i) => !i.product.is_available_today)
  const hasDirectItems = items.some((i) => i.product.is_available_today)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <h2 className="text-xl font-bold text-white mb-4">Keranjang Kosong</h2>
        <Link href="/products">
          <Button>Belanja Dulu</Button>
        </Link>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <h2 className="text-xl font-bold text-white mb-4">Login Dulu</h2>
        <Link href="/login?redirect=/checkout">
          <Button>Login</Button>
        </Link>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!address.trim()) {
      toast.error('Masukkan alamat pengiriman!')
      return
    }

    setLoading(true)
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          order_type: orderType,
          delivery_date: orderType === 'DIRECT' ? today : deliveryDate,
          status: 'confirmed', // Confirmed directly, skipping payment screen
          total_price: 0, // Calculated after weighing
          delivery_address: address,
          delivery_notes: notes,
          payment_method: 'COD', // Default payment COD/Cash (can be changed on delivery)
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit: item.product.unit,
        price_at_order: 0, // Finalized after weighing harian
        notes: item.notes || null,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) throw itemsError

      clearCart()
      // Simpan alamat untuk order berikutnya agar mempermudah user
      localStorage.setItem('sayurku_last_address', address)
      toast.success('Pesanan berhasil dibuat! Kami akan belanjakan esok pagi.')
      router.push(`/orders/${order.id}`)
    } catch (err) {
      toast.error('Gagal membuat pesanan. Coba lagi.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-700/50 px-4 py-4">
        <h1 className="text-xl font-bold text-white">Checkout</h1>
        <p className="text-xs text-slate-500">{items.length} produk terpilih</p>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Order Type */}
        <div>
          <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-green-400" />
            Jenis Pesanan
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOrderType('DIRECT')}
              disabled={!hasDirectItems}
              className={`rounded-2xl p-4 border text-left transition-all ${
                orderType === 'DIRECT'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-slate-700/50 bg-slate-800/40 disabled:opacity-40'
              }`}
            >
              <div className="text-xl mb-2">⚡</div>
              <div className="font-semibold text-white text-sm">Langsung</div>
              <div className="text-xs text-slate-400 mt-0.5">Stok tersedia hari ini</div>
            </button>
            <button
              onClick={() => { setOrderType('PRE_ORDER'); setDeliveryDate(tomorrow) }}
              className={`rounded-2xl p-4 border text-left transition-all ${
                orderType === 'PRE_ORDER'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700/50 bg-slate-800/40'
              }`}
            >
              <div className="text-xl mb-2">📅</div>
              <div className="font-semibold text-white text-sm">Pre-Order</div>
              <div className="text-xs text-slate-400 mt-0.5">Pilih tanggal pengiriman</div>
            </button>
          </div>
        </div>

        {/* Delivery Date (PO only) */}
        {orderType === 'PRE_ORDER' && (
          <div>
            <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Tanggal Pengiriman
            </h2>
            <input
              type="date"
              value={deliveryDate}
              min={tomorrow}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
          </div>
        )}

        {/* Delivery Address */}
        <div>
          <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-400" />
            Alamat Pengiriman
          </h2>
          <Textarea
            placeholder="Tulis alamat lengkap (nama jalan, nomor rumah, RT/RW, kelurahan...)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
          />
        </div>

        {/* Notes */}
        <div>
          <Input
            label="Catatan untuk Seller (opsional)"
            placeholder="Contoh: tolong pilihkan yang masih segar"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Order Summary */}
        <div className="glass rounded-2xl p-5 border border-slate-700/50">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Ringkasan Pesanan</h3>
          <div className="space-y-2 mb-3 border-b border-slate-200/50 pb-3">
            {items.map((item) => (
              <div key={item.product.id} className="flex justify-between text-xs text-slate-600">
                <span className="truncate flex-1 mr-2 font-semibold">
                  🥦 {item.product.name}
                </span>
                <span className="font-bold text-slate-800">
                  {item.quantity} {item.product.unit}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 text-sm">Total Tagihan</span>
              <Badge variant="orange">⚖️ Menyusul (Ditimbang)</Badge>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal font-semibold">
              Sayur akan dibelanjakan subuh esok agar segar. Total tagihan riil dihitung otomatis setelah ditimbang pagi hari.
            </p>
          </div>
        </div>

        {/* Info cutoff */}
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-400">Informasi Cut-off</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Pesanan di atas jam yang ditentukan akan diproses pada keesokan harinya.
            </p>
          </div>
        </div>

        <Button
          size="lg"
          fullWidth
          loading={loading}
          onClick={handleSubmit}
          icon={<ChevronRight className="w-5 h-5" />}
        >
          Buat Pesanan Sekarang
        </Button>
      </div>
    </div>
  )
}
