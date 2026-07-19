'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, ShoppingCart, ClipboardList, User, Sun, Moon } from 'lucide-react'
import { useCart } from '@/lib/context/CartContext'
import { useTheme } from '@/lib/context/ThemeContext'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', icon: Home, label: 'Beranda' },
  { href: '/products', icon: Search, label: 'Produk' },
  { href: '/cart', icon: ShoppingCart, label: 'Keranjang', showBadge: true },
  { href: '/orders', icon: ClipboardList, label: 'Pesanan' },
  { href: '/profile', icon: User, label: 'Profil' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { totalItems } = useCart()
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-slate-700/50 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200',
                'relative min-w-[56px]',
                active ? 'text-green-400' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <div className="relative">
                <item.icon
                  className={cn(
                    'w-6 h-6 transition-all duration-200',
                    active && 'scale-110'
                  )}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                {item.showBadge && totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium', active ? 'text-green-400' : 'text-slate-500')}>
                {item.label}
              </span>
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-green-400 rounded-full" />
              )}
            </Link>
          )
        })}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 min-w-[56px] text-slate-500 hover:text-amber-400"
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <Sun className="w-6 h-6" strokeWidth={1.75} />
            : <Moon className="w-6 h-6" strokeWidth={1.75} />}
          <span className="text-[10px] font-medium">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>
    </nav>
  )
}
