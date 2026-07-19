'use client'

import React, { useState } from 'react'
import { useCart } from '@/lib/context/CartContext'
import { Product } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { Minus, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'

const BUDGET_QUICK_PICKS = [2000, 5000, 10000, 20000]

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { items, addItem, updateQuantity, updateBudget, setItemOrderMode, removeItem } = useCart()
  const cartItem = items.find((item) => item.product.id === product.id)
  const qty = cartItem?.quantity || 0
  const currentMode = cartItem?.orderMode || 'by_quantity'
  const currentBudget = cartItem?.budgetAmount || 0

  // Local state for budget input before adding to cart
  const [localMode, setLocalMode] = useState<'by_quantity' | 'by_budget'>('by_quantity')
  const [localBudget, setLocalBudget] = useState<string>('')

  const step = product.unit === 'kg' ? 0.25 : 1

  const handleModeSwitch = (mode: 'by_quantity' | 'by_budget') => {
    setLocalMode(mode)
    if (cartItem) {
      if (mode === 'by_budget') {
        setItemOrderMode(product.id, 'by_budget', Number(localBudget) || 5000)
      } else {
        setItemOrderMode(product.id, 'by_quantity')
      }
    }
  }

  const handleAddQuantity = () => {
    addItem(product, step, undefined, 'by_quantity')
    toast.success(`${product.name} ditambahkan`, { duration: 1200 })
  }

  const handleAddBudget = (amount: number) => {
    const budget = amount || Number(localBudget)
    if (!budget || budget <= 0) {
      toast.error('Masukkan nominal budget')
      return
    }
    addItem(product, 1, undefined, 'by_budget', budget)
    toast.success(`${product.name} Rp${budget.toLocaleString('id-ID')} ditambahkan`, { duration: 1200 })
  }

  const handleBudgetChange = (amount: number) => {
    if (cartItem && currentMode === 'by_budget') {
      updateBudget(product.id, amount)
    } else {
      setLocalBudget(String(amount))
    }
  }

  const activeBudget = cartItem && currentMode === 'by_budget' ? currentBudget : Number(localBudget)

  return (
    <div className="themed-card rounded-2xl overflow-hidden card-hover border transition-colors flex flex-col">
      {/* Product Image */}
      <div className="relative aspect-square bg-slate-800/40 overflow-hidden flex items-center justify-center">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {product.category?.icon || '🥬'}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.is_available_today && (
            <Badge variant="green" dot>Tersedia</Badge>
          )}
          {product.is_po_available && !product.is_available_today && (
            <Badge variant="blue">Pre-Order</Badge>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">{product.category?.name}</p>
          <h3 className="text-sm font-semibold line-clamp-2">{product.name}</h3>
        </div>

        <div className="mt-auto space-y-2">
          <p className="text-xs text-green-600 font-bold">
            Harga pasar harian · per {product.unit}
          </p>

          {/* Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700/40 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => handleModeSwitch('by_quantity')}
              className={`flex-1 py-1.5 transition-all ${
                (cartItem ? currentMode : localMode) === 'by_quantity'
                  ? 'bg-green-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Per {product.unit}
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('by_budget')}
              className={`flex-1 py-1.5 transition-all ${
                (cartItem ? currentMode : localMode) === 'by_budget'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Per Nominal
            </button>
          </div>

          {/* Per Quantity Controls */}
          {(cartItem ? currentMode : localMode) === 'by_quantity' && (
            qty === 0 ? (
              <button
                onClick={handleAddQuantity}
                className="w-full py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all active:scale-95"
              >
                Tambah
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => updateQuantity(product.id, Number((qty - step).toFixed(2)))}
                  className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center transition-all active:scale-90"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-bold min-w-[2.5rem] text-center">
                  {qty} {product.unit}
                </span>
                <button
                  onClick={() => updateQuantity(product.id, Number((qty + step).toFixed(2)))}
                  className="w-8 h-8 rounded-lg bg-green-600/15 hover:bg-green-600/25 text-green-500 flex items-center justify-center transition-all active:scale-90"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}

          {/* Per Budget Controls */}
          {(cartItem ? currentMode : localMode) === 'by_budget' && (
            <div className="space-y-2">
              {/* Quick-select chips */}
              <div className="flex gap-1 flex-wrap">
                {BUDGET_QUICK_PICKS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleBudgetChange(amt)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      activeBudget === amt
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-600/50 text-slate-400 hover:border-blue-500/50 hover:text-blue-400'
                    }`}
                  >
                    {amt >= 1000 ? `${amt / 1000}rb` : formatRupiah(amt)}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">Rp</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Nominal lain..."
                  value={activeBudget || ''}
                  onChange={(e) => handleBudgetChange(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm font-bold text-center focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Add / Update button */}
              {cartItem && currentMode === 'by_budget' ? (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => updateBudget(product.id, activeBudget)}
                    className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all"
                  >
                    Budget: {formatRupiah(activeBudget)}
                  </button>
                  <button
                    onClick={() => removeItem(product.id)}
                    className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center text-sm transition-all"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAddBudget(activeBudget)}
                  disabled={!activeBudget || activeBudget <= 0}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all active:scale-95"
                >
                  {activeBudget > 0 ? `Beli Rp${activeBudget.toLocaleString('id-ID')}` : 'Masukkan nominal'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
