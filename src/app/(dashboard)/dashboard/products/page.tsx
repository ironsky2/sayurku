'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Plus, Edit, Trash2, Search, Filter, Camera, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { convertToWebP } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardProductsPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [productModal, setProductModal] = useState<Product | 'new' | null>(null)
  
  // Form states
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState(0)
  const [unit, setUnit] = useState('kg')
  const [stock, setStock] = useState(0)
  const [isAvailableToday, setIsAvailableToday] = useState(true)
  const [isPoAvailable, setIsPoAvailable] = useState(true)
  const [stockType, setStockType] = useState<'fresh' | 'stock'>('fresh')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const adjustStock = async (productId: string, currentStock: number, amount: number) => {
    const newStock = Math.max(0, currentStock + amount)
    // Update UI secara optimistik (instan)
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
    )

    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId)

    if (error) {
      toast.error('Gagal memperbarui stok')
      loadData() // Revert data jika gagal
    } else {
      toast.success(`Stok diperbarui: ${newStock}`, { id: `stock-${productId}`, duration: 1000 })
    }
  }

  const handleRestore = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: true })
      .eq('id', id)

    if (error) {
      toast.error('Gagal memulihkan produk')
    } else {
      toast.success('Produk berhasil diaktifkan kembali!')
      loadData()
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true)
    } else if (e.type === "dragleave") {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        console.log('=== FILE DIDROP TERDETEKSI ===')
        console.log('File:', file.name, '(', file.size, 'bytes)')
        setImageFile(file)
      } else {
        toast.error('Hanya file gambar yang diperbolehkan!')
      }
    }
  }

  const loadData = async () => {
    const [{ data: prodData }, { data: catData }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').order('sort_order'),
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    ])
    setProducts(prodData || [])
    setCategories(catData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (productModal && productModal !== 'new') {
      setName(productModal.name)
      setCategoryId(productModal.category_id || '')
      setDescription(productModal.description || '')
      setPrice(productModal.price_per_unit)
      setUnit(productModal.unit)
      setStock(productModal.stock)
      setIsAvailableToday(productModal.is_available_today)
      setIsPoAvailable(productModal.is_po_available)
      setStockType((productModal as any).stock_type || 'fresh')
      setImageUrl(productModal.image_url || '')
    } else {
      setName('')
      setCategoryId(categories[0]?.id || '')
      setDescription('')
      setPrice(0)
      setUnit('kg')
      setStock(0)
      setIsAvailableToday(true)
      setIsPoAvailable(true)
      setStockType('fresh')
      setImageUrl('')
      setImageFile(null)
    }
  }, [productModal, categories])

  const handleUploadImage = async (): Promise<string> => {
    console.log('=== Mulai Upload Gambar ===')
    console.log('imageFile saat ini:', imageFile)
    if (!imageFile) {
      console.log('imageFile kosong, menggunakan imageUrl bawaan:', imageUrl)
      return imageUrl
    }

    // Konversi file ke WebP di browser
    let fileToUpload: File = imageFile
    try {
      console.log('Mengonversi gambar ke WebP client-side...')
      const webpBlob = await convertToWebP(imageFile, 0.8)
      const baseName = imageFile.name.substring(0, imageFile.name.lastIndexOf('.')) || imageFile.name
      fileToUpload = new File([webpBlob], `${baseName}.webp`, {
        type: 'image/webp',
      })
      console.log('Konversi sukses! Nama file:', fileToUpload.name, 'Ukuran:', (fileToUpload.size / 1024).toFixed(1), 'KB')
    } catch (webpErr) {
      console.error('Gagal konversi WebP, menggunakan file asli:', webpErr)
    }

    const formData = new FormData()
    formData.append('file', fileToUpload)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      console.log('Respon API upload status:', res.status)
      if (!res.ok) {
        const err = await res.json()
        console.error('API upload error:', err)
        throw new Error(err.error || 'Gagal mengupload gambar')
      }

      const data = await res.json()
      console.log('API upload sukses, URL gambar:', data.url)
      return data.url
    } catch (error) {
      console.error('Tangkap error di handleUploadImage:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      console.log('=== Submit Form Produk ===')
      const finalImageUrl = await handleUploadImage()
      console.log('finalImageUrl hasil upload:', finalImageUrl)

      const payload = {
        name,
        category_id: categoryId || null,
        description,
        price_per_unit: price,
        unit,
        stock,
        is_available_today: isAvailableToday,
        is_po_available: isPoAvailable,
        stock_type: stockType,
        image_url: finalImageUrl || null,
        is_active: true,
      }

      console.log('Payload yang dikirim ke Supabase:', payload)

      if (productModal === 'new') {
        const { data, error } = await supabase.from('products').insert(payload).select()
        console.log('Hasil INSERT Supabase:', { data, error })
        if (error) throw error
        toast.success('Produk baru ditambahkan!')
      } else if (productModal) {
        const { data, error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productModal.id)
          .select()
        console.log('Hasil UPDATE Supabase:', { data, error })
        if (error) throw error
        toast.success('Produk berhasil diperbarui!')
      }

      setProductModal(null)
      loadData()
    } catch (err: any) {
      console.error('Gagal simpan produk:', err)
      toast.error(err.message || 'Gagal menyimpan produk')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (product: any) => {
    // Jika produk sudah diarsip (is_active === false), hapus permanen dari DB
    if (!product.is_active) {
      if (confirm('Apakah Anda yakin ingin menghapus produk terarsip ini secara permanen dari database?')) {
        const { error } = await supabase.from('products').delete().eq('id', product.id)
        if (error) {
          toast.error('Gagal menghapus produk permanen')
        } else {
          toast.success('Produk berhasil dihapus permanen!')
          loadData()
        }
      }
      return
    }

    // Jika produk aktif, cek dulu apakah ada pesanan berjalan yang merujuk produk ini
    setLoading(true)
    try {
      const { data: activeOrders, error: checkError } = await supabase
        .from('order_items')
        .select('id, order:orders!inner(id, status)')
        .eq('product_id', product.id)
        .not('orders.status', 'in', '("delivered","cancelled")')

      if (checkError) throw checkError

      if (activeOrders && activeOrders.length > 0) {
        toast.error(`Tidak bisa menghapus! Produk ini sedang dipesan dalam ${activeOrders.length} transaksi berjalan.`)
        setLoading(false)
        return
      }

      if (confirm('Apakah Anda yakin ingin mengarsipkan produk ini? Produk akan ditarik dari daftar belanja customer, tapi riwayat pesanan lama tetap aman.')) {
        const { error: archiveError } = await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', product.id)

        if (archiveError) throw archiveError
        toast.success('Produk berhasil diarsipkan!')
        loadData()
      }
    } catch (err: any) {
      console.error('Error delete validation:', err)
      toast.error(err.message || 'Gagal memproses penghapusan')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.is_active === !showArchived &&
      (selectedCategory === 'all' || p.category_id === selectedCategory) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())))
  )

  return (
    <div className="fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Kelola Produk</h1>
          <p className="text-slate-500 text-sm">Tambah, edit stok, dan atur ketersediaan produk</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/products/daily-prices">
            <Button variant="outline" icon={<Edit className="w-4 h-4" />}>
              Update Harga Harian
            </Button>
          </Link>
          <Button onClick={() => setProductModal('new')} icon={<Plus className="w-4 h-4" />}>
            Produk Baru
          </Button>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            placeholder="Cari nama sayuran..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
        >
          <option value="all">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`px-4 py-2.5 text-sm font-semibold border rounded-xl transition-all flex items-center gap-1.5 ${
            showArchived
              ? 'bg-amber-600/20 text-amber-400 border-amber-500/30'
              : 'border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
        >
          {showArchived ? '📂 Tampilkan Aktif' : '📦 Tampilkan Arsip'}
        </button>
      </div>

      {/* Products list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl shimmer" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 text-slate-500">Tidak ada produk ditemukan</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="glass rounded-2xl p-4 border border-slate-700/50 flex gap-4 items-start"
            >
              <div className="w-20 h-20 bg-slate-800 rounded-xl overflow-hidden relative flex-shrink-0">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    {p.category?.icon || '🥬'}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate text-sm">{p.name}</h3>
                <p className="text-xs text-slate-500">{p.category?.name}</p>
                <p className="text-green-400 font-bold text-sm mt-1">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    maximumFractionDigits: 0,
                  }).format(p.price_per_unit)}
                  <span className="text-slate-500 font-normal text-xs">/{p.unit}</span>
                </p>

                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {/* Stock type badge */}
                  {(p as any).stock_type === 'stock' ? (
                    <Badge variant="blue">🏪 Stok Gudang</Badge>
                  ) : (
                    <Badge variant="green">🌿 Beli Harian</Badge>
                  )}
                  {p.is_available_today ? (
                    <Badge variant="green">Tersedia</Badge>
                  ) : (
                    <Badge variant="gray">Kosong</Badge>
                  )}
                  {p.is_po_available && <Badge variant="blue">PO</Badge>}
                </div>

                {/* Low stock warning — only for stock-type products */}
                {(p as any).stock_type === 'stock' && p.stock <= ((p as any).low_stock_threshold ?? 5) && p.stock > 0 && (
                  <div className="mt-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
                    ⚠️ Stok hampir habis! ({p.stock} tersisa)
                  </div>
                )}
                {(p as any).stock_type === 'stock' && p.stock === 0 && (
                  <div className="mt-1.5 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                    🚨 Stok habis!
                  </div>
                )}

                {/* Quick Stock Adjuster */}
                {p.is_active && (
                  <div className="flex items-center gap-1.5 mt-2 bg-slate-900/60 border border-slate-850 rounded-lg p-1 w-fit">
                    <button
                      onClick={(e) => { e.stopPropagation(); adjustStock(p.id, p.stock, -1) }}
                      className="w-4.5 h-4.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[10px]"
                    >
                      -
                    </button>
                    <span className="text-[11px] font-bold text-slate-300 min-w-[24px] text-center">Stok: {p.stock}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); adjustStock(p.id, p.stock, 1) }}
                      className="w-4.5 h-4.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[10px]"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {p.is_active ? (
                  <>
                    <button
                      onClick={() => setProductModal(p)}
                      className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 transition-all"
                      title="Arsipkan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleRestore(p.id)}
                      className="p-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-all"
                      title="Aktifkan Kembali"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-all"
                      title="Hapus Permanen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Form Modal */}
      <Modal
        open={!!productModal}
        onClose={() => setProductModal(null)}
        title={productModal === 'new' ? 'Tambah Produk Baru' : 'Edit Produk'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drag & Drop Upload Zone */}
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">Foto Produk</label>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => {
                console.log('Pemicuan input file manual via Ref...');
                fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[140px] gap-2 ${
                isDragActive
                  ? 'border-green-400 bg-green-500/10 scale-[1.01]'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/60'
              }`}
            >
              {imageFile ? (
                <div className="relative w-full max-h-48 aspect-video rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                    <p className="text-xs text-white bg-slate-800 px-3 py-1.5 rounded-lg font-semibold">Ganti Foto</p>
                  </div>
                </div>
              ) : imageUrl ? (
                <div className="relative w-full max-h-48 aspect-video rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
                  <img
                    src={imageUrl}
                    alt="Product"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                    <p className="text-xs text-white bg-slate-800 px-3 py-1.5 rounded-lg font-semibold">Ganti Foto</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Tarik & Lepas Gambar di Sini</p>
                    <p className="text-xs text-slate-500 mt-1">atau klik untuk menelusuri file komputer</p>
                  </div>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  console.log('=== INPUT FILE ONCHANGE TERPICU ===')
                  console.log('File terpilih:', file)
                  setImageFile(file)
                }}
                className="hidden"
              />
            </div>
            {imageFile && (
              <div className="mt-2 flex justify-between items-center bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-green-400 font-semibold truncate max-w-[80%]">
                  ✅ {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setImageFile(null)
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-bold"
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nama Produk"
              placeholder="Contoh: Kangkung Segar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Kategori</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                required
              >
                <option value="">Pilih kategori...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Textarea
            label="Deskripsi (opsional)"
            placeholder="Keterangan produk, kesegaran, dll..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Harga Jual (Rp)"
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              required
            />
            <Input
              label="Satuan"
              placeholder="kg, ikat, ikat kecil, pack"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
            />
            <Input
              label="Stok Saat Ini"
              type="number"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
              required
            />
          </div>

          {/* Stock Type Toggle */}
          <div className="py-2">
            <label className="text-sm font-medium text-slate-300 block mb-2">Jenis Produk</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-700/50 w-fit">
              <button
                type="button"
                onClick={() => setStockType('fresh')}
                className={`px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${
                  stockType === 'fresh'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                🌿 Beli Harian
              </button>
              <button
                type="button"
                onClick={() => setStockType('stock')}
                className={`px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${
                  stockType === 'stock'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                🏪 Stok Gudang
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              {stockType === 'fresh'
                ? 'Produk ini harus dibeli tiap hari di pasar → muncul di Rekap Belanja'
                : 'Produk ini diambil dari stok gudang → tidak muncul di Rekap Belanja'}
            </p>
          </div>

          <div className="flex gap-6 py-2 border-y border-slate-700/30">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailableToday}
                onChange={(e) => setIsAvailableToday(e.target.checked)}
                className="accent-green-500 w-4 h-4"
              />
              <span className="text-sm text-slate-200">Tersedia Hari Ini (Ready Stock)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isPoAvailable}
                onChange={(e) => setIsPoAvailable(e.target.checked)}
                className="accent-green-500 w-4 h-4"
              />
              <span className="text-sm text-slate-200">Bisa Dipesan via Pre-Order</span>
            </label>
          </div>


          <Button type="submit" fullWidth loading={submitting}>
            {productModal === 'new' ? 'Tambah Produk' : 'Simpan Perubahan'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
