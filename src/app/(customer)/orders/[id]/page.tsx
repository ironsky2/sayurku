'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, OrderStatus } from '@/lib/types'
import { formatRupiah, formatDate, formatDateTime, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChevronLeft, MessageSquare, MapPin, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/context/AuthContext'

interface OrderDetailPageProps {
  params: Promise<{ id: string }>
}

const statusColors: Record<string, string> = {
  pending_payment: 'yellow',
  payment_uploaded: 'blue',
  confirmed: 'green',
  shopping: 'orange',
  ready: 'teal',
  delivering: 'purple',
  delivered: 'green',
  cancelled: 'red',
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()
  const { profile: authProfile } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [storePhone, setStorePhone] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const [{ data: orderData }, { data: settings }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*, product:products(name, unit))')
        .eq('id', id)
        .single(),
      supabase.from('store_settings').select('*').eq('key', 'store_phone').single(),
    ])

    setOrder(orderData)
    setStorePhone(settings?.value || '')
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    // Real-time listener untuk update status pesanan
    const channel = supabase
      .channel(`order-detail:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          setOrder((prev) => (prev ? { ...prev, ...payload.new } : null))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  const sendWhatsAppMessage = () => {
    if (!order) return

    const shortId = order.id.split('-')[0].toUpperCase()
    // Gunakan nama dari authProfile (user yang login) karena ini pesanan sendiri
    const customerName = authProfile?.full_name || (order as any).customer?.full_name || 'Pelanggan'
    
    const activeItems = order.order_items?.filter((item: any) => item.item_status !== 'cancelled')
    const itemsList = activeItems
      ?.map((item: any) => `- ${item.product?.name} (${item.quantity} ${item.unit})`)
      .join('\n')

    const totalDisplay = (isPriceFinalized && Number(order.total_price) > 0)
      ? formatRupiah(order.total_price)
      : '(Menunggu hasil timbangan pasar)'

    const message = `Halo SayurKu! Saya mau konfirmasi pesanan saya:\n\n*ID Pesanan:* #${shortId}\n*Status Saat Ini:* ${
      ORDER_STATUS_LABELS[order.status as OrderStatus]
    }\n*Nama Penerima:* ${customerName}\n*Total Belanja:* ${totalDisplay}\n*Alamat:* ${order.delivery_address}\n\n*Item Pesanan:*\n${itemsList}\n\nMohon bantuannya ya! 🥦`

    const cleanPhone = storePhone.replace(/[^0-9]/g, '')
    const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone

    const waUrl = `https://wa.me/${waPhone || '628123456789'}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-6 text-center">
        <p className="text-slate-400 mb-4">Pesanan tidak ditemukan</p>
        <Link href="/orders">
          <Button variant="outline">Kembali ke Daftar Pesanan</Button>
        </Link>
      </div>
    )
  }

  const getStepNumber = (status: string): number => {
    switch (status) {
      case 'pending_payment':
      case 'payment_uploaded':
        return 1
      case 'confirmed':
        return 2
      case 'shopping':
      case 'ready':
        return 3
      case 'delivering':
      case 'delivered':
        return 4
      default:
        return 1
    }
  }

  const currentStep = getStepNumber(order.status)
  
  const steps = [
    { label: 'Dipesan', desc: 'Diterima' },
    { label: 'Di Pasar', desc: (order.status === 'confirmed' || order.status === 'shopping') ? 'Diproses' : (getStepNumber(order.status) > 2 ? 'Selesai' : 'Antrian') },
    { label: 'Siap Kirim', desc: order.status === 'ready' ? 'Siap' : (getStepNumber(order.status) > 3 ? 'Selesai' : 'Proses Timbang') },
    { label: 'Dikirim', desc: order.status === 'delivered' ? 'Selesai' : order.status === 'delivering' ? 'Di Jalan' : 'Belum Kirim' },
  ]

  const isPriceFinalized = ['ready', 'delivering', 'delivered'].includes(order.status)

  return (
    <div className="fade-in max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-700/50 px-4 py-4 flex items-center gap-3">
        <Link href="/orders" className="text-slate-400 hover:text-white">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white">Detail Pesanan</h1>
          <p className="text-xs text-slate-500">#{order.id.split('-')[0].toUpperCase()}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Visual Timeline Progress Bar */}
        <Card className="p-5 border border-slate-700/50 bg-slate-800/10 relative overflow-hidden">
          <div className="relative flex items-center justify-between">
            {/* Background Line */}
            <div className="absolute left-4 right-4 top-[15px] h-[3px] bg-slate-800 -z-10 rounded-full" />
            
            {/* Progress Active Line */}
            <div 
              className="absolute left-4 top-[15px] h-[3px] bg-green-500 -z-10 rounded-full transition-all duration-700"
              style={{ width: `calc(${((currentStep - 1) / (steps.length - 1)) * 100}% - 8px)` }}
            />

            {steps.map((step, idx) => {
              const stepNum = idx + 1
              const isCompleted = currentStep > stepNum
              const isActive = currentStep === stepNum
              const isPending = currentStep < stepNum

              return (
                <div key={idx} className="flex flex-col items-center z-10 w-20">
                  <div 
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 relative",
                      isCompleted && "bg-green-500 text-white shadow-lg shadow-green-500/25",
                      isActive && "bg-slate-900 text-green-400 border-2 border-green-400 ring-4 ring-green-400/20 scale-105",
                      isPending && "bg-slate-800 text-slate-500 border border-slate-700"
                    )}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{stepNum}</span>
                    )}

                    {/* Active pulse effect */}
                    {isActive && (
                      <span className="absolute -inset-1 rounded-full border border-green-400 animate-ping opacity-35" />
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold mt-2",
                    isActive ? "text-green-400 font-extrabold" : isCompleted ? "text-slate-200" : "text-slate-500"
                  )}>
                    {step.label}
                  </span>
                  <span className="text-[9px] text-slate-500 mt-0.5 text-center leading-none">
                    {step.desc}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Status Alert Banner */}
          <div className="mt-5 pt-4 border-t border-slate-700/50 flex items-center gap-3">
            {order.status === 'delivered' ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-slate-200">
                {ORDER_STATUS_LABELS[order.status as OrderStatus]}
              </p>
              <p className="text-slate-400 mt-0.5">Estimasi Antar: {formatDate(order.delivery_date)}</p>
            </div>
          </div>
        </Card>

        {/* Weighed Price Update Card for Customer */}
        {isPriceFinalized && Number(order.total_price) > 0 ? (
          <div className="bg-gradient-to-r from-emerald-500/15 to-green-500/15 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl flex-shrink-0">
              🎉
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-extrabold text-emerald-400">Timbangan & Tagihan Selesai!</h4>
              <p className="text-xs text-slate-300 mt-1">
                Total tagihan final pesanan kamu adalah <strong className="text-emerald-400 text-sm font-black">{formatRupiah(order.total_price)}</strong>
              </p>
              {order.payment_method === 'COD' ? (
                <p className="text-[11px] text-slate-400 mt-1.5 bg-slate-800/40 p-2 rounded-lg border border-slate-700/30">
                  🤝 Siapkan uang pas <strong className="text-white font-bold">{formatRupiah(order.total_price)}</strong> saat kurir mengantarkan pesanan.
                </p>
              ) : !order.payment_proof_url ? (
                <div className="mt-2.5">
                  <Link href={`/payment/${order.id}`}>
                    <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-500">
                      💳 Bayar Sekarang via QRIS ({formatRupiah(order.total_price)})
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-[11px] text-green-400 mt-1.5 font-semibold">
                  ✅ Bukti pembayaran telah diterima. Pesanan siap dikirim!
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
              ⚖️
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-400">Sedang Diproses & Ditimbang</h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Sayur dan belanjaan kamu sedang diproses di pasar. Total tagihan akan otomatis muncul di sini setelah selesai ditimbang!
              </p>
            </div>
          </div>
        )}

        {/* Alamat Pengiriman */}
        <Card>
          <h3 className="text-sm font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-green-700 flex-shrink-0" />
            Alamat Pengiriman
          </h3>
          <p className="text-sm text-slate-650 leading-relaxed font-semibold">{order.delivery_address}</p>
          {order.delivery_notes && (
            <p className="text-xs text-slate-500 mt-2 bg-slate-800/30 p-2.5 rounded-lg border border-slate-700/30">
              Catatan: {order.delivery_notes}
            </p>
          )}
        </Card>

        {/* Item Pesanan */}
        <Card>
          <h3 className="text-sm font-bold text-slate-800 mb-3">Item yang Dipesan</h3>

          {/* Admin-modified banner */}
          {order.order_items?.some((i: any) => i.item_status === 'cancelled' || i.item_status === 'substituted' || i.substitute_for) && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex gap-2 items-start">
              <span className="text-base flex-shrink-0">ℹ️</span>
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Admin telah melakukan perubahan pada pesanan ini (ada item dibatalkan atau diganti). Hubungi toko jika ada pertanyaan.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {order.order_items?.map((item: any) => {
              const isCancelled = item.item_status === 'cancelled'
              const isSubstituted = item.item_status === 'substituted'
              const isSubstituteOf = !!item.substitute_for
              const subtotal = Number(item.quantity) * Number(item.price_at_order)

              return (
                <div
                  key={item.id}
                  className={`flex justify-between items-start text-sm border-b border-slate-200/40 pb-2.5 last:border-b-0 last:pb-0 ${
                    isCancelled || isSubstituted ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`font-bold text-slate-800 ${isCancelled || isSubstituted ? 'line-through' : ''}`}>
                        🥦 {item.product?.name}
                      </p>
                      {isCancelled && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                          ❌ Tidak Tersedia
                        </span>
                      )}
                      {isSubstituted && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          🔄 Digantikan
                        </span>
                      )}
                      {isSubstituteOf && (
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                          ✅ Pengganti
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 font-semibold ${isCancelled || isSubstituted ? 'text-slate-400 line-through' : 'text-slate-500'}`}>
                      Kuantitas: {Number(item.quantity)} {item.unit}
                    </p>
                    {isCancelled && item.cancel_reason && (
                      <p className="text-[10px] text-red-500 mt-0.5 italic">
                        Alasan: {item.cancel_reason}
                      </p>
                    )}
                    {item.notes && !isCancelled && (
                      <span className="block text-[10px] text-amber-600 font-semibold italic mt-0.5">
                        Catatan: "{item.notes}"
                      </span>
                    )}
                  </div>
                  <span className={`font-bold flex-shrink-0 ${isCancelled || isSubstituted ? 'text-slate-400 line-through' : 'text-slate-850'}`}>
                    {isCancelled || isSubstituted
                      ? 'Dibatalkan'
                      : isPriceFinalized && item.price_at_order > 0
                        ? formatRupiah(subtotal)
                        : '⚖️ Ditimbang'
                    }
                  </span>
                </div>
              )
            })}
            
            <div className="border-t border-slate-200/50 pt-3 flex justify-between font-bold">
              <span className="text-slate-500 text-sm">Total Belanja</span>
              {isPriceFinalized && order.total_price > 0 ? (
                <span className="text-green-700 text-lg">{formatRupiah(order.total_price)}</span>
              ) : (
                <Badge variant="orange">⚖️ Menunggu Timbangan Pagi</Badge>
              )}
            </div>
          </div>
        </Card>


        {/* Detail Pembayaran */}
        <Card>
          <h3 className="text-sm font-bold text-slate-800 mb-2.5">Metode Pembayaran</h3>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Pilihan:</span>
              <span className="font-bold text-slate-800">
                {order.payment_method === 'COD' ? '🤝 Tunai di Tempat (COD)' : '💳 Non-Tunai / QRIS'}
              </span>
            </div>
            
            {order.payment_method === 'QRIS' && (
              <div className="flex justify-between items-center border-t border-slate-200/50 pt-2">
                <span className="text-slate-500">Status Bayar:</span>
                {!isPriceFinalized ? (
                  <Badge variant="orange">⚖️ Menunggu Total Timbangan</Badge>
                ) : order.payment_proof_url ? (
                  <span className="text-green-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Bukti Pembayaran Terkirim
                  </span>
                ) : (
                  <Link href={`/payment/${order.id}`}>
                    <Button size="sm">Bayar Sekarang via QRIS</Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          {order.payment_proof_url && (
            <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden max-h-48 relative">
              <img
                src={order.payment_proof_url}
                alt="Bukti Transfer"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </Card>

        {/* WhatsApp Button */}
        <Button
          fullWidth
          size="lg"
          onClick={sendWhatsAppMessage}
          icon={<MessageSquare className="w-5 h-5" />}
          className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20"
        >
          Hubungi Toko (WhatsApp)
        </Button>
      </div>
    </div>
  )
}
