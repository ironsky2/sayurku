'use client'

import { useCart } from '@/lib/context/CartContext'
import { ShoppingCart, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function FloatingCartBar() {
  const { items, totalItems } = useCart()
  const pathname = usePathname()

  // Don't show on cart/checkout pages
  const isCartPage = pathname === '/cart' || pathname === '/checkout'
  if (items.length === 0 || isCartPage) return null

  const itemCount = items.length
  const qtyText = items.map(i => `${i.quantity} ${i.product.unit}`).slice(0, 2).join(', ')
  const moreCount = items.length > 2 ? `+${items.length - 2} lagi` : ''

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 pointer-events-none px-4 max-w-lg mx-auto">
      <Link
        href="/cart"
        className="pointer-events-auto flex items-center gap-3 w-full bg-green-600 hover:bg-green-500 active:scale-98 shadow-2xl shadow-green-900/50 rounded-2xl px-4 py-3.5 transition-all duration-200"
        style={{
          animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Cart icon + badge */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-400 text-slate-900 text-[10px] font-black rounded-full flex items-center justify-center">
            {itemCount}
          </span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-none">
            {itemCount} produk di keranjang
          </p>
          <p className="text-green-200 text-[11px] mt-0.5 truncate font-medium">
            {qtyText}{moreCount ? ` • ${moreCount}` : ''}
          </p>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-1 bg-white/20 rounded-xl px-3 py-1.5 flex-shrink-0">
          <span className="text-white text-xs font-bold">Pesan</span>
          <ArrowRight className="w-3.5 h-3.5 text-white" />
        </div>
      </Link>

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  )
}
