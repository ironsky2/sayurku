'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Plus, Edit, Trash2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminCategoriesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryModal, setCategoryModal] = useState<Category | 'new' | null>(null)
  
  // Form states
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🥬')
  const [color, setColor] = useState('#22c55e')
  const [sortOrder, setSortOrder] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')

    if (error) {
      toast.error('Gagal mengambil kategori')
    } else {
      setCategories(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (categoryModal && categoryModal !== 'new') {
      setName(categoryModal.name)
      setIcon(categoryModal.icon || '🥬')
      setColor(categoryModal.color || '#22c55e')
      setSortOrder(categoryModal.sort_order)
    } else {
      setName('')
      setIcon('🥬')
      setColor('#22c55e')
      setSortOrder(categories.length + 1)
    }
  }, [categoryModal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      name,
      icon,
      color,
      sort_order: sortOrder,
      is_active: true,
    }

    try {
      if (categoryModal === 'new') {
        const { error } = await supabase.from('categories').insert(payload)
        if (error) throw error
        toast.success('Kategori baru ditambahkan!')
      } else if (categoryModal) {
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', categoryModal.id)
        if (error) throw error
        toast.success('Kategori diperbarui!')
      }

      setCategoryModal(null)
      loadCategories()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan kategori')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kategori ini? Produk dengan kategori ini akan diset tanpa kategori.')) return

    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      toast.error('Gagal menghapus kategori')
    } else {
      toast.success('Kategori dihapus')
      loadCategories()
    }
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Kategori Produk</h1>
          <p className="text-slate-500 text-sm">Kelola kategori untuk mempermudah customer memfilter produk</p>
        </div>
        <Button onClick={() => setCategoryModal('new')} icon={<Plus className="w-4 h-4" />}>
          Kategori Baru
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl shimmer" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Belum ada kategori</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <div
              key={c.id}
              className="glass rounded-2xl p-4 border border-slate-700/50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-slate-800 rounded-xl">{c.icon}</span>
                <div>
                  <h3 className="font-bold text-white text-sm">{c.name}</h3>
                  <p className="text-[10px] text-slate-500">Urutan: {c.sort_order}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCategoryModal(c)}
                  className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
      <Modal
        open={!!categoryModal}
        onClose={() => setCategoryModal(null)}
        title={categoryModal === 'new' ? 'Kategori Baru' : 'Edit Kategori'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Kategori"
            placeholder="Contoh: Sayuran Hijau"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Emoji / Icon"
              placeholder="Contoh: 🥬"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              required
            />
            <Input
              label="Warna Hex (untuk UI)"
              placeholder="#22c55e"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              required
            />
          </div>

          <Input
            label="Urutan Tampilan"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            required
          />

          <Button type="submit" fullWidth loading={submitting}>
            Simpan Kategori
          </Button>
        </form>
      </Modal>
    </div>
  )
}
