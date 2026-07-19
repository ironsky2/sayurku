'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StoreSetting } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Camera, Settings, DollarSign, Phone, MapPin, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { convertToWebP } from '@/lib/utils'

export default function AdminSettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<StoreSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Settings values states
  const [storeName, setStoreName] = useState('SayurKu')
  const [storePhone, setStorePhone] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [qrisUrl, setQrisUrl] = useState('')
  const [minOrder, setMinOrder] = useState(15000)
  const [deliveryFee, setDeliveryFee] = useState(5000)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const loadSettings = async () => {
    const { data, error } = await supabase.from('store_settings').select('*')
    if (error) {
      toast.error('Gagal mengambil pengaturan')
    } else if (data) {
      setSettings(data)
      // Map database keys to state variables
      data.forEach((s) => {
        if (s.key === 'store_name') setStoreName(s.value || 'SayurKu')
        if (s.key === 'store_phone') setStorePhone(s.value || '')
        if (s.key === 'store_address') setStoreAddress(s.value || '')
        if (s.key === 'qris_image_url') setQrisUrl(s.value || '')
        if (s.key === 'min_order_amount') setMinOrder(Number(s.value || 15000))
        if (s.key === 'default_delivery_fee') setDeliveryFee(Number(s.value || 5000))
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleUploadQris = async (file: File) => {
    setUploadingImage(true)
    let fileToUpload = file
    try {
      console.log('Mengonversi QRIS ke WebP...')
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
        throw new Error(err.error || 'Gagal mengupload QRIS')
      }

      const data = await res.json()
      const publicUrl = data.url

      setQrisUrl(publicUrl)
      // Save directly to settings key
      await supabase
        .from('store_settings')
        .upsert({ key: 'qris_image_url', value: publicUrl }, { onConflict: 'key' })

      toast.success('Gambar QRIS berhasil diperbarui!')
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengupload QRIS')
    } finally {
      setUploadingImage(false)
      setImageFile(null)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const updates = [
      { key: 'store_name', value: storeName },
      { key: 'store_phone', value: storePhone },
      { key: 'store_address', value: storeAddress },
      { key: 'min_order_amount', value: String(minOrder) },
      { key: 'default_delivery_fee', value: String(deliveryFee) },
    ]

    try {
      const { error } = await supabase.from('store_settings').upsert(updates, { onConflict: 'key' })
      if (error) throw error
      toast.success('Pengaturan berhasil disimpan!')
      loadSettings()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 rounded-xl shimmer" />
        <div className="h-64 rounded-2xl shimmer" />
      </div>
    )
  }

  return (
    <div className="fade-in space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-green-500" />
          Pengaturan Toko
        </h1>
        <p className="text-slate-500 text-sm">Sesuaikan informasi toko, QRIS, minimal order, dan ongkos kirim</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* QRIS Upload Box */}
        <div className="md:col-span-1 glass rounded-2xl p-5 border border-slate-700/50 flex flex-col items-center text-center gap-4 h-fit">
          <h3 className="font-bold text-white text-sm">QRIS Pembayaran</h3>
          <div className="w-full aspect-square bg-slate-800 rounded-xl overflow-hidden relative border border-slate-700 flex items-center justify-center">
            {qrisUrl ? (
              <img src={qrisUrl} alt="Store QRIS" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="text-slate-600 flex flex-col items-center gap-2">
                <Camera className="w-10 h-10" />
                <span className="text-xs">Belum ada QRIS</span>
              </div>
            )}
          </div>
          <label
            htmlFor="qris-image-upload"
            className="cursor-pointer w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition-all text-center"
          >
            {uploadingImage ? 'Mengupload...' : 'Ganti Gambar QRIS'}
          </label>
          <input
            id="qris-image-upload"
            type="file"
            accept="image/*"
            disabled={uploadingImage}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUploadQris(file)
            }}
            className="hidden"
          />
          <p className="text-[10px] text-slate-500">QRIS ini akan ditampilkan saat customer checkout pesanan.</p>
        </div>

        {/* Text Settings Form */}
        <form onSubmit={handleSaveSettings} className="md:col-span-2 space-y-5">
          <div className="glass rounded-2xl p-6 border border-slate-700/50 space-y-4">
            <h3 className="font-bold text-white text-base border-b border-slate-700/50 pb-2">Informasi Toko</h3>
            
            <Input
              label="Nama Toko"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
            />
            
            <Input
              label="Nomor WhatsApp Toko"
              placeholder="Contoh: 08123456789"
              value={storePhone}
              onChange={(e) => setStorePhone(e.target.value)}
              icon={<Phone className="w-4 h-4" />}
            />
            
            <Input
              label="Alamat Toko / Gudang"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              icon={<MapPin className="w-4 h-4" />}
            />
          </div>

          <div className="glass rounded-2xl p-6 border border-slate-700/50 space-y-4">
            <h3 className="font-bold text-white text-base border-b border-slate-700/50 pb-2">Transaksi & Pengiriman</h3>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Minimal Belanja (Rp)"
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(Number(e.target.value))}
                required
                icon={<DollarSign className="w-4 h-4" />}
              />
              <Input
                label="Ongkos Kirim Default (Rp)"
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(Number(e.target.value))}
                required
                icon={<DollarSign className="w-4 h-4" />}
              />
            </div>
          </div>

          <Button type="submit" fullWidth size="lg" loading={saving}>
            Simpan Pengaturan
          </Button>
        </form>
      </div>
    </div>
  )
}
