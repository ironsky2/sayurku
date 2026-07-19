'use client'

import { useCart } from '@/lib/context/CartContext'
import { formatRupiah } from '@/lib/utils'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'

export default function CartPage() {
  const { items, removeItem, updateQuantity, updateNotes, totalPrice, clearCart } = useCart()

  if (items.length === 0) {
    return (
      <div className="fade-in flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="w-24 h-24 bg-slate-800/60 rounded-3xl flex items-center justify-center mb-6 border border-slate-700/50">
          <ShoppingBag className="w-10 h-10 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Keranjang Kosong</h2>
        <p className="text-slate-500 text-sm mb-8">
          Yuk, pilih sayuran segar untuk kebutuhan harian kamu!
        </p>
        <Link href="/products">
          <Button size="lg">Lihat Produk</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-700/50 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Keranjang</h1>
          <p className="text-xs text-slate-500">{items.length} produk dipilih</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus semua
        </button>
      </div>

      <div className="px-4 py-5 space-y-3">
        {items.map((item) => (
          <div
            key={item.product.id}
            className="glass rounded-2xl p-4 flex gap-4 border border-slate-700/50"
          >
            {/* Image */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800/60 flex-shrink-0">
              {item.product.image_url ? (
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  {item.product.category?.icon || '🥬'}
                </div>
              )}
            </div>
            {/* Details */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-100 truncate">{item.product.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{item.product.category?.name}</p>
              <div className="text-green-700 font-extrabold text-xs mt-1">
                🥦 Harga mengikuti pasar harian
              </div>
              
              {/* Catatan Kustom Item */}
              <div className="mt-1.5">
                <input
                  type="text"
                  placeholder="Catatan khusus (misal: minta 3 ons, dll)"
                  value={item.notes || ''}
                  onChange={(e) => updateNotes(item.product.id, e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500/50"
                />
              </div>

              {/* Quantity control */}
              {item.product.unit === 'kg' ? (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <select
                    value={[0.1, 0.25, 0.5, 1.0, 1.5, 2.0].includes(item.quantity) ? item.quantity : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'custom') {
                        // let them keep the current value and write details in notes
                        toast('Silakan ketik detail berat di kolom Catatan', { icon: '📝' })
                      } else {
                        updateQuantity(item.product.id, Number(val))
                      }
                    }}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value={0.1}>1 Ons (0.1 kg)</option>
                    <option value={0.25}>Seperempat (0.25 kg)</option>
                    <option value={0.5}>Setengah (0.5 kg)</option>
                    <option value={1.0}>1 kg</option>
                    <option value={1.5}>1.5 kg</option>
                    <option value={2.0}>2 kg</option>
                    <option value="custom">Kustom (Tulis di Catatan)</option>
                  </select>
                  {(![0.1, 0.25, 0.5, 1.0, 1.5, 2.0].includes(item.quantity) || item.quantity === 0) && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, Number((item.quantity - 0.25).toFixed(2)))}
                        className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 hover:bg-red-50 text-slate-100 flex items-center justify-center transition-all text-xs"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-slate-100">{item.quantity} kg</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, Number((item.quantity + 0.25).toFixed(2)))}
                        className="w-7 h-7 rounded-lg bg-green-600/10 hover:bg-green-600/20 text-green-700 flex items-center justify-center transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="ml-auto p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 hover:bg-red-50 text-slate-100 hover:text-red-650 flex items-center justify-center transition-all text-sm"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-bold text-slate-100 w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-7 h-7 rounded-lg bg-green-600/10 hover:bg-green-600/20 text-green-700 flex items-center justify-center transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-500 ml-1">{item.product.unit}</span>

                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="ml-auto p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order Summary */}
      <div className="px-4 pb-6">
        <div className="glass rounded-2xl p-5 border border-slate-700/50 space-y-4">
          <h3 className="font-bold text-slate-100 text-sm">Ringkasan Pesanan</h3>
          <div className="space-y-2 border-b border-slate-200/50 pb-3">
            {items.map((item) => (
              <div key={item.product.id} className="flex justify-between text-xs text-slate-350">
                <span className="truncate flex-1 mr-4 font-semibold">
                  🥦 {item.product.name}
                </span>
                <span className="font-bold text-slate-100">
                  {item.quantity} {item.product.unit}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-100 text-sm">Total Tagihan</span>
              <Badge variant="orange">⚖️ Menyusul (Ditimbang)</Badge>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal font-semibold">
              Sayur akan dibelanjakan subuh esok agar segar. Total tagihan riil dihitung otomatis setelah ditimbang pagi hari.
            </p>
          </div>
        </div>

        <Link href="/checkout" className="block mt-4">
          <Button size="lg" fullWidth icon={<ArrowRight className="w-5 h-5" />}>
            Lanjut ke Checkout
          </Button>
        </Link>
      </div>
    </div>
  )
}
