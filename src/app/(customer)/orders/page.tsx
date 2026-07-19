import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatRupiah, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Order, OrderStatus, ORDER_STATUS_LABELS } from '@/lib/types'
import Link from 'next/link'
import { ChevronRight, Package } from 'lucide-react'

const statusColors: Record<OrderStatus, string> = {
  pending_payment: 'yellow',
  payment_uploaded: 'blue',
  confirmed: 'green',
  shopping: 'orange',
  ready: 'teal',
  delivering: 'purple',
  delivered: 'green',
  cancelled: 'red',
}

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/orders')

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(count)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-700/50 px-4 py-4">
        <h1 className="text-xl font-bold text-white">Pesanan Saya</h1>
        <p className="text-xs text-slate-500">{orders?.length || 0} pesanan total</p>
      </div>

      <div className="px-4 py-5">
        {orders && orders.length > 0 ? (
          <div className="space-y-3">
            {(orders as Order[]).map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block glass rounded-2xl p-4 border border-slate-700/50 card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500 font-mono">
                        #{order.id.split('-')[0].toUpperCase()}
                      </span>
                      <Badge
                        variant={statusColors[order.status as OrderStatus] as any}
                        dot
                      >
                        {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400">
                      Pengiriman: <span className="text-white font-medium">{formatDate(order.delivery_date)}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {order.order_type === 'PRE_ORDER' ? '📅 Pre-Order' : '⚡ Langsung'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {['ready', 'delivering', 'delivered'].includes(order.status) && Number(order.total_price) > 0 ? (
                      <p className="font-bold text-green-400">{formatRupiah(order.total_price)}</p>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                        ⚖️ Menunggu Timbangan
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 ml-auto mt-1.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-800/60 rounded-3xl flex items-center justify-center mb-5 border border-slate-700/50">
              <Package className="w-9 h-9 text-slate-600" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Belum Ada Pesanan</h3>
            <p className="text-slate-500 text-sm mb-6">Yuk, pesan sayur segar pertamamu!</p>
            <Link href="/products" className="text-green-400 text-sm font-semibold hover:text-green-300">
              Mulai Belanja →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
