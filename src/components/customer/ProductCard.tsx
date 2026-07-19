'use client'

import React from 'react'
import Image from 'next/image'
import { useCart } from '@/lib/context/CartContext'
import { Product } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { Minus, Plus, ShoppingCart, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart()
  const cartItem = items.find((item) => item.product.id === product.id)
  const qty = cartItem?.quantity || 0

  const handleAdd = () => {
    addItem(product, 1)
    toast.success(`${product.name} ditambahkan ke keranjang`, { duration: 1500 })
  }

  return (
    <div className="glass rounded-2xl overflow-hidden card-hover border border-slate-700/50 flex flex-col">
      {/* Product Image */}
      <div className="relative aspect-square bg-slate-800/60 overflow-hidden flex items-center justify-center">
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
            <Badge variant="blue">
              <Clock className="w-3 h-3" />
              Pre-Order
            </Badge>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">{product.category?.name}</p>
          <h3 className="text-sm font-semibold text-slate-100 line-clamp-2">{product.name}</h3>
        </div>

        <div className="mt-auto">
          <div className="text-green-700 font-extrabold text-xs">
            🥦 Harga pasar harian
            <span className="text-slate-500 font-semibold block mt-0.5">Satuan: per {product.unit}</span>
          </div>

          {/* Quantity control */}
          {(() => {
            const step = product.unit === 'kg' ? 0.25 : 1
            const handleAddStep = () => {
              addItem(product, step)
              toast.success(`${product.name} ditambahkan`, { duration: 1000 })
            }
            return qty === 0 ? (
              <Button
                size="sm"
                fullWidth
                onClick={handleAddStep}
                icon={<ShoppingCart className="w-3.5 h-3.5" />}
                className="mt-2"
              >
                Tambah
              </Button>
            ) : (
              <div className="flex items-center justify-between mt-2 gap-2">
                <button
                  onClick={() => updateQuantity(product.id, Number((qty - step).toFixed(2)))}
                  className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:bg-red-50 text-slate-200 hover:text-red-650 flex items-center justify-center transition-all active:scale-90"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-100 min-w-[2rem] text-center">
                  {qty} {product.unit}
                </span>
                <button
                  onClick={() => updateQuantity(product.id, Number((qty + step).toFixed(2)))}
                  className="w-8 h-8 rounded-lg bg-green-600/10 hover:bg-green-600/20 text-green-700 flex items-center justify-center transition-all active:scale-90"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
