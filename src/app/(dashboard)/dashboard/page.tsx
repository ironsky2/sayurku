import { createClient } from '@/lib/supabase/server'
import { formatRupiah } from '@/lib/utils'
import {
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  Scale,
  BarChart2,
} from 'lucide-react'
import Link from 'next/link'

async function getDashboardData() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Build last 7 days array
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const [
    { count: totalOrdersToday },
    { count: pendingPayment },
    { count: confirmed },
    { count: delivering },
    { data: recentOrders },
    { data: revenue7days },
    { data: topProducts },
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('delivery_date', today),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending_payment'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['confirmed', 'shopping', 'ready']),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivering'),
    supabase.from('orders')
      .select('*, customer:profiles!orders_customer_id_fkey(full_name), order_items(count)')
      .order('created_at', { ascending: false })
      .limit(5),
    // Revenue per hari 7 hari terakhir
    supabase.from('orders')
      .select('delivery_date, total_price')
      .gte('delivery_date', last7[0])
      .lte('delivery_date', last7[6])
      .in('status', ['ready', 'delivering', 'delivered']),
    // Top products this week
    supabase.from('order_items')
      .select('product:products(name, unit), quantity')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
  ])

  // Aggregate revenue per day
  const revenueByDay: Record<string, number> = {}
  last7.forEach(d => { revenueByDay[d] = 0 })
  revenue7days?.forEach((o: any) => {
    revenueByDay[o.delivery_date] = (revenueByDay[o.delivery_date] || 0) + Number(o.total_price)
  })

  // Aggregate top products
  const productQty: Record<string, { name: string; unit: string; qty: number }> = {}
  topProducts?.forEach((item: any) => {
    const name = item.product?.name
    if (!name) return
    if (!productQty[name]) productQty[name] = { name, unit: item.product?.unit || '', qty: 0 }
    productQty[name].qty += Number(item.quantity)
  })
  const topProductList = Object.values(productQty)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  const todayRevenue = revenueByDay[today] || 0
  const chartData = last7.map(d => ({ date: d, value: revenueByDay[d] || 0 }))
  const maxRevenue = Math.max(...chartData.map(d => d.value), 1)

  return {
    totalOrdersToday, pendingPayment, confirmed, delivering,
    recentOrders, todayRevenue, chartData, maxRevenue, topProductList, last7,
  }
}

export default async function DashboardPage() {
  const {
    totalOrdersToday, pendingPayment, confirmed, delivering,
    recentOrders, todayRevenue, chartData, maxRevenue, topProductList,
  } = await getDashboardData()

  const stats = [
    { label: 'Pesanan Hari Ini', value: totalOrdersToday || 0, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Menunggu Bayar', value: pendingPayment || 0, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    { label: 'Diproses', value: confirmed || 0, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { label: 'Dikirim', value: delivering || 0, icon: Truck, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ]

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  return (
    <div className="fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
          </p>
        </div>
        <Link
          href="/dashboard/orders/timbang"
          className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
        >
          <Scale className="w-4 h-4" />
          ⚖️ Timbang
        </Link>
      </div>

      {/* Revenue Card */}
      <div
        className="rounded-2xl p-6 border border-green-200 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <p className="text-green-800 text-sm font-bold">Omzet Hari Ini</p>
        </div>
        <p className="text-4xl font-extrabold text-slate-900">{formatRupiah(todayRevenue)}</p>
        <p className="text-green-700 text-xs font-semibold mt-2">Dari {totalOrdersToday} pesanan · status ready/kirim/selesai</p>
      </div>

      {/* Alur Hari Ini - Workflow Steps */}
      <div className="glass rounded-2xl border border-slate-700/50 p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">⚡ Alur Kerja Hari Ini</p>
        <div className="flex items-center gap-1">
          <Link href="/dashboard/rekap" className="flex-1 group">
            <div className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-blue-500/10 transition-all border border-transparent hover:border-blue-500/20">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl">
                📋
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-blue-400">Step 1</p>
                <p className="text-[10px] text-slate-300 font-semibold">Rekap Belanja</p>
                <p className="text-[9px] text-slate-600">Sebelum ke pasar</p>
              </div>
            </div>
          </Link>
          <span className="text-slate-600 font-bold flex-shrink-0">›</span>
          <Link href="/dashboard/orders/timbang" className="flex-1 group">
            <div className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-amber-500/10 transition-all border border-transparent hover:border-amber-500/20">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">
                ⚖️
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-amber-400">Step 2</p>
                <p className="text-[10px] text-slate-300 font-semibold">Timbang + Harga</p>
                <p className="text-[9px] text-slate-600">Setelah dari pasar</p>
              </div>
            </div>
          </Link>
          <span className="text-slate-600 font-bold flex-shrink-0">›</span>
          <Link href="/dashboard/delivery" className="flex-1 group">
            <div className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-green-500/10 transition-all border border-transparent hover:border-green-500/20">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xl">
                🚚
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-green-400">Step 3</p>
                <p className="text-[10px] text-slate-300 font-semibold">Kirim</p>
                <p className="text-[9px] text-slate-600">Kurir berangkat</p>
              </div>
            </div>
          </Link>
        </div>
        <p className="text-[10px] text-slate-600 text-center mt-2 pt-2 border-t border-slate-700/30">
          Rekap = daftar belanja ke pasar · Timbang = input harga setelah pulang
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-2xl p-4 border ${stat.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-slate-400">{stat.label}</span>
            </div>
            <p className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* 7-Day Revenue Chart */}
      <div className="glass rounded-2xl border border-slate-700/50 p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart2 className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-bold text-white">Omzet 7 Hari Terakhir</h2>
        </div>
        <div className="flex items-end gap-2 h-32">
          {chartData.map((day, i) => {
            const isToday = i === chartData.length - 1
            const heightPct = maxRevenue > 0 ? (day.value / maxRevenue) * 100 : 0
            const dayName = dayNames[new Date(day.date + 'T00:00:00').getDay()]
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Tooltip */}
                {day.value > 0 && (
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-xl z-10">
                    {formatRupiah(day.value)}
                  </div>
                )}
                {/* Bar */}
                <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      isToday
                        ? 'bg-green-500'
                        : day.value > 0
                          ? 'bg-slate-600 hover:bg-slate-500'
                          : 'bg-slate-800/50'
                    }`}
                    style={{ height: heightPct > 0 ? `${Math.max(heightPct, 6)}%` : '4px' }}
                  />
                </div>
                {/* Label */}
                <span className={`text-[10px] font-semibold ${isToday ? 'text-green-400' : 'text-slate-500'}`}>
                  {dayName}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-slate-600 border-t border-slate-700/30 pt-2">
          <span>Hijau = Hari ini</span>
          <span>Total: {formatRupiah(chartData.reduce((s, d) => s + d.value, 0))}</span>
        </div>
      </div>

      {/* Top Products */}
      {topProductList.length > 0 && (
        <div className="glass rounded-2xl border border-slate-700/50 p-5">
          <h2 className="text-sm font-bold text-white mb-4">🏆 Produk Terlaris (7 Hari)</h2>
          <div className="space-y-3">
            {topProductList.map((product, idx) => {
              const maxQty = topProductList[0].qty
              const pct = maxQty > 0 ? (product.qty / maxQty) * 100 : 0
              return (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="text-sm font-black text-slate-500 w-5 text-center">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-white truncate">{product.name}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-2 font-mono">
                        {product.qty} {product.unit}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Aksi Cepat</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/orders" className="glass rounded-2xl p-4 border border-slate-700/50 card-hover flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Pesanan</p>
              <p className="text-xs text-slate-500">Kelola order</p>
            </div>
          </Link>
          <Link href="/dashboard/orders/timbang" className="glass rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 card-hover flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Timbang Massal</p>
              <p className="text-xs text-slate-500">Isi harga sekaligus</p>
            </div>
          </Link>
          <Link href="/dashboard/rekap" className="glass rounded-2xl p-4 border border-slate-700/50 card-hover flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Rekap</p>
              <p className="text-xs text-slate-500">Generate belanja</p>
            </div>
          </Link>
          <Link href="/dashboard/products/daily-prices" className="glass rounded-2xl p-4 border border-slate-700/50 card-hover flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Harga Harian</p>
              <p className="text-xs text-slate-500">Update harga pasar</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Pesanan Terbaru</h2>
          <Link href="/dashboard/orders" className="text-xs text-green-400 hover:text-green-300">
            Lihat semua →
          </Link>
        </div>
        <div className="space-y-2">
          {recentOrders?.map((order: any) => (
            <div
              key={order.id}
              className="flex items-center justify-between glass rounded-xl px-4 py-3 border border-slate-700/50"
            >
              <div>
                <p className="text-sm text-white font-medium">{order.customer?.full_name}</p>
                <p className="text-xs text-slate-500">#{order.id.split('-')[0].toUpperCase()} · {order.status}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-400">
                  {Number(order.total_price) > 0 ? formatRupiah(order.total_price) : '⚖️ Belum ditimbang'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
