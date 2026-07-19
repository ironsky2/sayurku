'use client'

import { useAuth } from '@/lib/context/AuthContext'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingBag,
  ListOrdered,
  Truck,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  Leaf,
  Users,
  Tag,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const sellerNav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/orders', icon: ShoppingBag, label: 'Pesanan' },
  { href: '/dashboard/rekap', icon: ListOrdered, label: 'Rekap Belanja' },
  { href: '/dashboard/delivery', icon: Truck, label: 'Pengiriman' },
  { href: '/dashboard/products', icon: Package, label: 'Produk' },
]

const adminNav = [
  ...sellerNav,
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/categories', icon: Tag, label: 'Kategori' },
  { href: '/admin/settings', icon: Settings, label: 'Pengaturan' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = profile?.role === 'admin' ? adminNav : sellerNav

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 glass border-r border-slate-700/50 flex flex-col',
          'transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-700/50">
          <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">SayurKu</p>
            <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-green-600/20 text-green-400 border border-green-600/20'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                )}
              >
                <item.icon className="w-4.5 h-4.5" strokeWidth={active ? 2.5 : 1.75} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-700/50 space-y-1">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40">
            <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {profile?.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{profile?.phone}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-600/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
          <ThemeToggle className="w-full justify-center" />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden sticky top-0 z-30 glass border-b border-slate-700/50 flex items-center gap-4 px-4 py-3">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-400" />
            <span className="font-bold text-white text-sm">SayurKu</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="text-xs text-slate-500 capitalize bg-slate-800 px-2 py-1 rounded-lg">
              {profile?.role}
            </span>
          </div>
        </div>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
