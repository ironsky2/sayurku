'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order } from '@/lib/types'
import { formatRupiah, formatDateTime, convertToWebP } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Upload, CheckCircle, Clock, QrCode } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface PaymentPageProps {
  params: Promise<{ orderId: string }>
}

export default function PaymentPage({ params }: PaymentPageProps) {
  const { orderId } = use(params)
  const supabase = createClient()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [qrisUrl, setQrisUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const loadOrder = async () => {
      const [{ data: orderData }, { data: settings }] = await Promise.all([
        supabase.from('orders').select('*, order_items(*, product:products(*))').eq('id', orderId).single(),
        supabase.from('store_settings').select('*').eq('key', 'qris_image_url').single(),
      ])
      setOrder(orderData)
      setQrisUrl(settings?.value || null)
      setLoading(false)
    }
    loadOrder()

    // Real-time status update
    const channel = supabase
      .channel(`order:${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        setOrder((prev) => prev ? { ...prev, ...payload.new } : null)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    let fileToUpload = file
    try {
      console.log('Mengonversi bukti bayar ke WebP...')
      const webpBlob = await convertToWebP(file, 0.8)
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      fileToUpload = new File([webpBlob], `${baseName}.webp`, { type: 'image/webp' })
    } catch (webpErr) {
      console.error('Gagal konversi WebP, menggunakan file asli:', webpErr)
    }

    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Gagal mengupload bukti pembayaran')
      }

      const data = await res.json()
      const publicUrl = data.url

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'payment_uploaded', payment_proof_url: publicUrl })
        .eq('id', orderId)

      if (updateError) throw updateError

      toast.success('Bukti pembayaran berhasil dikirim!')
      setOrder((prev) => prev ? { ...prev, status: 'payment_uploaded', payment_proof_url: publicUrl } : null)
    } catch (err: any) {
      console.error('Gagal upload bukti bayar:', err)
      toast.error(err.message || 'Gagal upload bukti. Coba lagi.')
    } finally {
      setUploading(false)
    }
  }

  const handleCOD = async () => {
    setUploading(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_method: 'COD',
          status: 'confirmed', // otomatis masuk ke admin untuk diproses
        })
        .eq('id', orderId)

      if (error) throw error

      toast.success('Pilihan COD / Bayar Belakangan disimpan!')
      router.push(`/orders/${orderId}`)
    } catch (err: any) {
      console.error('Gagal menyimpan pilihan COD:', err)
      toast.error(err.message || 'Gagal memproses metode COD')
    } finally {
      setUploading(false)
    }
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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-400">Pesanan tidak ditemukan</p>
      </div>
    )
  }

  const isPaid = order.status !== 'pending_payment'

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-700/50 px-4 py-4">
        <h1 className="text-xl font-bold text-white">Pembayaran</h1>
        <p className="text-xs text-slate-500">#{order.id.split('-')[0].toUpperCase()}</p>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Status Banner */}
        {isPaid ? (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-400">Bukti Pembayaran Terkirim</p>
              <p className="text-xs text-slate-400 mt-0.5">Sedang diverifikasi oleh seller</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
            <Clock className="w-6 h-6 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-400">Menunggu Pembayaran</p>
              <p className="text-xs text-slate-400 mt-0.5">Transfer dan upload bukti bayar</p>
            </div>
          </div>
        )}

        {/* Total Amount */}
        <div className="glass rounded-2xl p-5 border border-slate-700/50 text-center">
          <p className="text-slate-400 text-sm">Total Pembayaran</p>
          <p className="text-4xl font-extrabold text-green-400 mt-1">{formatRupiah(order.total_price)}</p>
          <p className="text-xs text-slate-500 mt-1">Dipesan {formatDateTime(order.created_at)}</p>
        </div>

        {/* QRIS */}
        <div className="glass rounded-2xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-5 h-5 text-green-400" />
            <h3 className="font-bold text-white">Scan QRIS</h3>
          </div>
          {qrisUrl ? (
            <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
              <img
                src={qrisUrl}
                alt="QRIS Payment"
                className="object-contain max-h-[240px]"
              />
            </div>
          ) : (
            <div className="bg-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
              <QrCode className="w-16 h-16 text-slate-600" />
              <p className="text-slate-500 text-sm text-center">
                Gambar QRIS belum diupload oleh seller.
                <br />Hubungi seller untuk info pembayaran.
              </p>
            </div>
          )}
          <p className="text-xs text-slate-500 text-center mt-3">
            Scan dengan aplikasi dompet digital manapun
          </p>
        </div>

        {/* Upload Proof */}
        {!isPaid && (
          <div className="glass rounded-2xl p-5 border border-slate-700/50">
            <h3 className="font-bold text-white mb-3">Upload Bukti Transfer</h3>
            <p className="text-xs text-slate-400 mb-4">
              Setelah transfer, screenshot bukti bayar dan upload di sini
            </p>
            <label
              htmlFor="proof-image-upload"
              className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 w-full px-5 py-2.5 text-sm border border-green-600/50 text-green-400 hover:bg-green-600/10 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {uploading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : <Upload className="w-4 h-4" />}
              {uploading ? 'Mengupload...' : 'Pilih Foto Bukti'}
            </label>
            <input
              id="proof-image-upload"
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Tombol Bayar Nanti / COD */}
        {!isPaid && (
          <button
            onClick={handleCOD}
            disabled={uploading}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-semibold py-2.5 rounded-xl text-sm transition-all border border-slate-700/60 hover:border-slate-500 text-center flex items-center justify-center gap-1.5"
          >
            🤝 Bayar Nanti (COD / Bayar Belakangan)
          </button>
        )}

        {/* Payment Proof Preview */}
        {order.payment_proof_url && (
          <div className="glass rounded-2xl p-4 border border-green-500/20">
            <p className="text-xs font-semibold text-green-400 mb-3">✅ Bukti Pembayaran</p>
            <div className="rounded-xl overflow-hidden">
              <img
                src={order.payment_proof_url}
                alt="Bukti Transfer"
                className="object-cover w-full max-h-[300px]"
              />
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="glass rounded-2xl p-5 border border-slate-700/50">
          <h3 className="font-bold text-white mb-3">Detail Pesanan</h3>
          <div className="space-y-2">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-slate-400 flex-1 truncate mr-2">
                  {item.product?.name} × {item.quantity} {item.unit}
                </span>
                <span className="text-slate-300">{formatRupiah(item.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2 flex justify-between font-bold">
              <span className="text-white">Total</span>
              <span className="text-green-400">{formatRupiah(order.total_price)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
