'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Save, RefreshCw, ChevronLeft, Copy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface PriceRow {
  id: string
  name: string
  categoryName: string
  unit: string
  priceYesterday: number
  priceToday: number
}

export default function DailyPricesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const loadPrices = async () => {
    setLoading(true)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, unit, price_per_unit, category:categories(name)')
      .eq('is_active', true)
      .order('sort_order')

    if (error || !products) {
      toast.error('Gagal memuat produk')
      setLoading(false)
      return
    }

    const productIds = products.map(p => p.id)

    const [{ data: todayPrices }, { data: yesterdayPrices }] = await Promise.all([
      supabase.from('daily_prices').select('product_id, price').in('product_id', productIds).eq('date', today),
      supabase.from('daily_prices').select('product_id, price').in('product_id', productIds).eq('date', yesterday),
    ])

    const todayMap: Record<string, number> = {}
    const yesterdayMap: Record<string, number> = {}
    todayPrices?.forEach((r: any) => { todayMap[r.product_id] = r.price })
    yesterdayPrices?.forEach((r: any) => { yesterdayMap[r.product_id] = r.price })

    setRows(products.map((p: any) => ({
      id: p.id,
      name: p.name,
      categoryName: p.category?.name || 'Lainnya',
      unit: p.unit,
      priceYesterday: yesterdayMap[p.id] ?? p.price_per_unit,
      priceToday: todayMap[p.id] ?? yesterdayMap[p.id] ?? p.price_per_unit,
    })))
    setLoading(false)
  }

  useEffect(() => { loadPrices() }, [])

  const handlePriceChange = (productId: string, val: number) => {
    setRows(prev => prev.map(r => r.id === productId ? { ...r, priceToday: val } : r))
  }

  const handleCopyFromYesterday = () => {
    setRows(prev => prev.map(r => ({ ...r, priceToday: r.priceYesterday })))
    toast.success('Semua harga disalin dari kemarin!')
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const { data: activeOrders } = await supabase
        .from('orders').select('id').in('status', ['confirmed', 'shopping'])
      const activeIds = activeOrders?.map(o => o.id) || []

      for (const row of rows) {
        await supabase.from('daily_prices').upsert(
          { product_id: row.id, price: row.priceToday, date: today },
          { onConflict: 'product_id,date' }
        )
        await supabase.from('products').update({ price_per_unit: row.priceToday }).eq('id', row.id)
        if (activeIds.length > 0) {
          await supabase.from('order_items')
            .update({ price_at_order: row.priceToday })
            .eq('product_id', row.id)
            .in('order_id', activeIds)
        }
      }
      toast.success(`✅ ${rows.length} harga berhasil disimpan & disinkronkan ke order aktif!`)
      loadPrices()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan harga')
    } finally {
      setSaving(false)
    }
  }

  const formatRp = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="fade-in space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/products" className="text-slate-400 hover:text-white transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Update Harga Harian</h1>
            <p className="text-slate-500 text-sm">
              {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopyFromYesterday} disabled={saving} icon={<Copy className="w-4 h-4" />}>
            Salin Kemarin
          </Button>
          <Button variant="outline" onClick={loadPrices} icon={<RefreshCw className="w-4 h-4" />} disabled={saving}>
            Segarkan
          </Button>
          <Button onClick={handleSaveAll} loading={saving} icon={<Save className="w-4 h-4" />}>
            Simpan Semua
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-slate-500 glass rounded-2xl border border-slate-700/50">
          Belum ada produk aktif
        </div>
      ) : (
        <div className="glass rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40 text-slate-400 font-semibold text-xs uppercase tracking-wide">
                  <th className="p-4">Produk</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4 text-right">Harga Kemarin</th>
                  <th className="p-4 w-52">Harga Hari Ini (Rp)</th>
                  <th className="p-4 text-center">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const diff = row.priceToday - row.priceYesterday
                  const pct = row.priceYesterday > 0 ? ((diff / row.priceYesterday) * 100).toFixed(1) : '0'
                  return (
                    <tr key={row.id} className="border-b border-slate-700/20 hover:bg-slate-800/20 transition-all">
                      <td className="p-4 font-semibold text-white">{row.name}</td>
                      <td className="p-4 text-slate-400 text-xs">{row.categoryName}</td>
                      <td className="p-4 text-right font-mono text-slate-400 text-xs">
                        {formatRp(row.priceYesterday)}
                        <span className="text-slate-600"> /{row.unit}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={row.priceToday}
                            onChange={(e) => handlePriceChange(row.id, Number(e.target.value))}
                            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                          />
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">/{row.unit}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-xs font-bold">
                        {diff > 0 && (
                          <span className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">
                            <TrendingUp className="w-3 h-3" /> +{pct}%
                          </span>
                        )}
                        {diff < 0 && (
                          <span className="inline-flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">
                            <TrendingDown className="w-3 h-3" /> {pct}%
                          </span>
                        )}
                        {diff === 0 && (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Minus className="w-3 h-3" /> Sama
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
