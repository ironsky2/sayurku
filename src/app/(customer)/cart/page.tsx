'use client'

import { useCart } from '@/lib/context/CartContext'
import { formatRupiah } from '@/lib/utils'
import { Minus, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'

const BUDGET_QUICK_PICKS = [2000, 5000, 10000, 20000]

export default function CartPage() {
  const { items, removeItem, updateQuantity, updateNotes, updateBudget, totalPrice, clearCart } = useCart()

  if (items.length === 0) {
    return (
      <div className="fade-in flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="w-24 h-24 bg-slate-800/40 rounded-3xl flex items-center justify-center mb-6 border border-slate-700/50 text-5xl">
          🛒
        </div>
        <h2 className="text-xl font-bold mb-2">Keranjang Kosong</h2>
        <p className="text-slate-500 text-sm mb-8">
          Yuk, pilih sayuran segar untuk kebutuhan harian kamu!
        </p>
        <Link href="/products">
          <Button size="lg">Lihat Produk</Button>
        </Link>
      </div>
    )
  }

  const budgetItems = items.filter((i) => i.orderMode === 'by_budget')
  const qtyItems = items.filter((i) => i.orderMode !== 'by_budget')

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-700/50 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Keranjang</h1>
          <p className="text-xs text-slate-500">{items.length} produk dipilih</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-red-400 hover:text-red-300 font-semibold"
        >
          Hapus semua
        </button>
      </div>

      <div className="px-4 py-5 space-y-3">
        {items.map((item) => {
          const isBudget = item.orderMode === 'by_budget'
          const step = item.product.unit === 'kg' ? 0.25 : 1

          return (
            <div
              key={item.product.id}
              className={`themed-card rounded-2xl p-4 flex gap-4 border transition-colors ${
                isBudget ? 'border-blue-500/20 bg-blue-500/5' : ''
              }`}
            >
              {/* Image */}
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800/40 flex-shrink-0">
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
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold truncate">{item.product.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.product.category?.name}</p>
                    {isBudget ? (
                      <Badge variant="blue" className="mt-1">Per Nominal</Badge>
                    ) : (
                      <p className="text-xs text-green-600 font-bold mt-1">Harga pasar harian</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Notes */}
                <input
                  type="text"
                  placeholder="Catatan khusus (opsional)"
                  value={item.notes || ''}
                  onChange={(e) => updateNotes(item.product.id, e.target.value)}
                  className="w-full mt-2 bg-slate-900/40 border border-slate-700/40 rounded-xl px-2.5 py-1.5 text-[11px] placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500/50"
                />

                {/* Per Budget Controls */}
                {isBudget ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1 flex-wrap">
                      {BUDGET_QUICK_PICKS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => updateBudget(item.product.id, amt)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            item.budgetAmount === amt
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-slate-600/50 text-slate-400 hover:border-blue-400/50 hover:text-blue-400'
                          }`}
                        >
                          {amt >= 1000 ? `${amt / 1000}rb` : formatRupiah(amt)}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">Rp</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={item.budgetAmount || ''}
                        onChange={(e) => updateBudget(item.product.id, Number(e.target.value))}
                        placeholder="Nominal lain..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-800/40 border border-blue-500/30 text-sm font-bold focus:outline-none focus:border-blue-500/60"
                      />
                    </div>
                    <p className="text-[10px] text-blue-400 font-semibold">
                      Total item ini: {formatRupiah(item.budgetAmount || 0)}
                    </p>
                  </div>
                ) : (
                  /* Per Quantity Controls */
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, Number((item.quantity - step).toFixed(2)))}
                      className="w-7 h-7 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center transition-all active:scale-90"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold min-w-[3rem] text-center">
                      {item.quantity} {item.product.unit}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, Number((item.quantity + step).toFixed(2)))}
                      className="w-7 h-7 rounded-lg bg-green-600/10 hover:bg-green-600/20 text-green-500 flex items-center justify-center transition-all active:scale-90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Order Summary */}
      <div className="px-4 pb-6">
        <div className="themed-card rounded-2xl p-5 border space-y-4">
          <h3 className="font-bold text-sm">Ringkasan Pesanan</h3>
          <div className="space-y-2 border-b border-slate-700/20 pb-3">
            {qtyItems.map((item) => (
              <div key={item.product.id} className="flex justify-between text-xs text-slate-500">
                <span className="truncate flex-1 mr-4 font-semibold">{item.product.name}</span>
                <span className="font-bold">
                  {item.quantity} {item.product.unit} · <span className="text-slate-400">Harga menyusul</span>
                </span>
              </div>
            ))}
            {budgetItems.map((item) => (
              <div key={item.product.id} className="flex justify-between text-xs">
                <span className="truncate flex-1 mr-4 font-semibold text-blue-400">{item.product.name}</span>
                <span className="font-bold text-blue-400">{formatRupiah(item.budgetAmount || 0)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">Total Perkiraan</span>
              <span className="font-black text-green-400 text-base">
                {totalPrice > 0 ? formatRupiah(totalPrice) : '—'}
              </span>
            </div>
            {budgetItems.length > 0 && qtyItems.length > 0 && (
              <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                Item per nominal sudah fixed. Item per kg/satuan akan dihitung setelah ditimbang pagi hari.
              </p>
            )}
            {qtyItems.length > 0 && budgetItems.length === 0 && (
              <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                Total riil dihitung otomatis setelah ditimbang pagi hari.
              </p>
            )}
          </div>
        </div>

        <Link href="/checkout" className="block mt-4">
          <Button size="lg" fullWidth>Lanjut ke Checkout</Button>
        </Link>
      </div>
    </div>
  )
}
