'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { CheckCircle, ChevronLeft, Printer, RefreshCw, Zap } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface WeighRow {
  orderItemId: string
  orderId: string
  customerName: string
  customerPhone: string
  productId: string
  productName: string
  unit: string
  orderedQty: number
  actualQty: number
  pricePerUnit: number
  notes?: string
  isBudget: boolean
  budgetAmount: number
}

interface ProductGroup {
  productId: string
  productName: string
  unit: string
  suggestedPrice: number
  rows: WeighRow[]
}

export default function BulkWeighPage() {
  const supabase = createClient()
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all active orders
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer:profiles!orders_customer_id_fkey(full_name, phone),
          order_items(id, product_id, quantity, unit, price_at_order, notes, order_mode, budget_amount, product:products(name, unit, price_per_unit))
        `)
        .in('status', ['confirmed', 'shopping'])
        .order('created_at', { ascending: true })

      if (error) throw error

      // Fetch today's daily prices
      const allProductIds = (orders || [])
        .flatMap(o => (o.order_items || []).map((i: any) => i.product_id))
        .filter(Boolean)
      const uniqueProductIds = [...new Set(allProductIds)]

      const { data: dpData } = await supabase
        .from('daily_prices')
        .select('product_id, price')
        .in('product_id', uniqueProductIds)
        .eq('date', today)

      const dpMap: Record<string, number> = {}
      dpData?.forEach((r: any) => { dpMap[r.product_id] = r.price })

      // Build flat row list
      const allRows: WeighRow[] = []
      for (const order of (orders || [])) {
        for (const item of (order.order_items || [] as any[])) {
          const prod = Array.isArray(item.product) ? item.product[0] : item.product as any
          const isBudget = item.order_mode === 'by_budget'
          const budgetAmount = Number(item.budget_amount || 0)
          const suggested = dpMap[item.product_id] ?? prod?.price_per_unit ?? 0
          allRows.push({
            orderItemId: item.id,
            orderId: order.id,
            customerName: (order.customer as any)?.full_name || 'Unknown',
            customerPhone: (order.customer as any)?.phone || '',
            productId: item.product_id,
            productName: prod?.name || '',
            unit: item.unit || prod?.unit || '',
            orderedQty: Number(item.quantity),
            actualQty: Number(item.quantity) || 0,
            pricePerUnit: isBudget
              ? (budgetAmount > 0 && Number(item.quantity) > 0 ? budgetAmount / Number(item.quantity) : 0)
              : (Number(item.price_at_order) > 0 ? Number(item.price_at_order) : suggested),
            notes: item.notes,
            isBudget,
            budgetAmount,
          })
        }
      }

      // Group by product
      const groupMap: Record<string, ProductGroup> = {}
      for (const row of allRows) {
        if (!groupMap[row.productId]) {
          groupMap[row.productId] = {
            productId: row.productId,
            productName: row.productName,
            unit: row.unit,
            suggestedPrice: dpMap[row.productId] ?? row.pricePerUnit,
            rows: [],
          }
        }
        groupMap[row.productId].rows.push(row)
      }

      setGroups(Object.values(groupMap).sort((a, b) => a.productName.localeCompare(b.productName)))
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { loadData() }, [loadData])

  const updateRow = (orderItemId: string, field: 'actualQty' | 'pricePerUnit', value: number) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      rows: g.rows.map(r => r.orderItemId === orderItemId ? { ...r, [field]: value } : r),
    })))
  }

  const applyPriceToGroup = (productId: string, price: number) => {
    setGroups(prev => prev.map(g =>
      g.productId === productId
        ? { ...g, suggestedPrice: price, rows: g.rows.map(r => ({ ...r, pricePerUnit: price })) }
        : g
    ))
  }

  const handleSaveAll = async () => {
    // Validate: all by_quantity items must have price; budget items just need actual qty
    const missingPrice = groups.flatMap(g => g.rows).filter(r => !r.isBudget && r.pricePerUnit <= 0)
    const missingQty   = groups.flatMap(g => g.rows).filter(r => r.isBudget && r.actualQty <= 0)
    if (missingPrice.length > 0) {
      toast.error(`Masukkan harga untuk: ${[...new Set(missingPrice.map(r => r.productName))].join(', ')}`)
      return
    }
    if (missingQty.length > 0) {
      toast.error(`Masukkan berat aktual untuk: ${[...new Set(missingQty.map(r => r.productName))].join(', ')}`)
      return
    }

    setSaving(true)
    try {
      // Save all order_items
      const allRows = groups.flatMap(g => g.rows)
      for (const row of allRows) {
        if (row.isBudget) {
          // Budget item: actual qty is what admin weighed, price = budget / actual_qty
          const pricePerUnit = row.actualQty > 0 ? Math.round(row.budgetAmount / row.actualQty) : 0
          await supabase.from('order_items').update({
            quantity: row.actualQty,
            price_at_order: pricePerUnit,
          }).eq('id', row.orderItemId)
        } else {
          await supabase.from('order_items').update({
            quantity: row.actualQty,
            price_at_order: row.pricePerUnit,
          }).eq('id', row.orderItemId)
        }
      }

      // Update order totals and mark as ready
      const orderIds = [...new Set(allRows.map(r => r.orderId))]
      for (const orderId of orderIds) {
        const orderRows = allRows.filter(r => r.orderId === orderId)
        // Budget items: use budgetAmount (fixed). Qty items: use actualQty × pricePerUnit
        const newTotal = orderRows.reduce((s, r) =>
          s + (r.isBudget ? r.budgetAmount : r.actualQty * r.pricePerUnit), 0)
        await supabase.from('orders').update({ total_price: newTotal, status: 'ready' }).eq('id', orderId)
      }

      toast.success(`${orderIds.length} pesanan berhasil ditimbang & ditandai Siap Kirim!`)
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const totalOrders = new Set(groups.flatMap(g => g.rows.map(r => r.orderId))).size
  const totalRevenue = groups.flatMap(g => g.rows).reduce((s, r) => s + r.actualQty * r.pricePerUnit, 0)

  return (
    <div className="fade-in space-y-6 max-w-5xl mx-auto print:max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/orders" className="text-slate-400 hover:text-white transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              ⚖️ Mode Timbang Massal
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {totalOrders} pesanan aktif — {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} icon={<RefreshCw className="w-4 h-4" />} disabled={loading || saving}>
            Segarkan
          </Button>
          <Button variant="outline" onClick={handlePrint} icon={<Printer className="w-4 h-4" />}>
            Cetak
          </Button>
          <Button onClick={handleSaveAll} loading={saving} icon={<CheckCircle className="w-4 h-4" />}>
            ✅ Simpan & Siap Kirim Semua
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Daftar Timbangan Harian</h1>
        <p className="text-gray-500">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}</p>
      </div>

      {/* Summary bar */}
      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-3 gap-4 print:hidden">
          <div className="glass rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-500">Total Pesanan</p>
            <p className="text-2xl font-black text-white mt-1">{totalOrders}</p>
          </div>
          <div className="glass rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-500">Total Jenis Produk</p>
            <p className="text-2xl font-black text-white mt-1">{groups.length}</p>
          </div>
          <div className="glass rounded-xl p-4 border border-green-500/20 bg-green-500/5">
            <p className="text-xs text-slate-500">Estimasi Omzet</p>
            <p className="text-xl font-black text-green-400 mt-1">{formatRupiah(totalRevenue)}</p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl shimmer" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl border border-slate-700/50">
          <span className="text-5xl block mb-4">⚖️</span>
          <p className="text-slate-400 font-semibold">Tidak ada pesanan aktif yang perlu ditimbang</p>
          <p className="text-slate-600 text-sm mt-1">Semua pesanan sudah diproses atau belum ada pesanan masuk</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const groupTotal = group.rows.reduce((s, r) => s + r.actualQty * r.pricePerUnit, 0)
            const groupQty = group.rows.reduce((s, r) => s + r.actualQty, 0)
            return (
              <div key={group.productId} className="glass rounded-2xl border border-slate-700/50 overflow-hidden print:border print:border-gray-300 print:rounded-none print:mb-6">
                {/* Product group header */}
                <div className="bg-slate-800/60 px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 print:bg-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🥦</span>
                    <div>
                      <h3 className="font-bold text-white print:text-black">{group.productName}</h3>
                      <p className="text-xs text-slate-400 print:text-gray-500">
                        {group.rows.length} customer · Total: <strong className="text-slate-200 print:text-black">{groupQty} {group.unit}</strong>
                      </p>
                    </div>
                  </div>
                  {/* Shared price input - only for non-budget groups */}
                  {group.rows.some(r => !r.isBudget) && (
                    <div className="flex items-center gap-2 print:hidden">
                      <span className="text-xs text-slate-400 whitespace-nowrap">Harga /{group.unit}:</span>
                      <input
                        type="number"
                        min="0"
                        value={group.rows.find(r => !r.isBudget)?.pricePerUnit || ''}
                        onChange={(e) => applyPriceToGroup(group.productId, Number(e.target.value))}
                        className="w-28 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                        placeholder="Rp/unit"
                      />
                      <button
                        onClick={() => applyPriceToGroup(group.productId, group.suggestedPrice)}
                        className="text-[10px] text-green-400 hover:text-green-300 bg-green-500/10 border border-green-500/20 px-2 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        Sugesti {formatRupiah(group.suggestedPrice)}
                      </button>
                      <span className="text-xs font-bold text-green-400 whitespace-nowrap">
                        = {formatRupiah(groupTotal)}
                      </span>
                    </div>
                  )}
                  {group.rows.every(r => r.isBudget) && (
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                      Per Nominal — Total Budget: {formatRupiah(group.rows.reduce((s, r) => s + r.budgetAmount, 0))}
                    </span>
                  )}
                </div>

                {/* Rows table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/30 text-slate-500 text-xs font-semibold">
                        <th className="px-5 py-2 text-left">Customer</th>
                        <th className="px-5 py-2 text-center">Pesan</th>
                        <th className="px-5 py-2 text-center print:hidden">Berat Aktual</th>
                        <th className="px-5 py-2 text-right print:hidden">Subtotal</th>
                        <th className="px-5 py-2 text-right hidden print:table-cell">Qty</th>
                        <th className="px-5 py-2 text-right hidden print:table-cell">Harga</th>
                        <th className="px-5 py-2 text-right hidden print:table-cell">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, idx) => (
                        <tr key={row.orderItemId} className={`border-b border-slate-700/20 last:border-0 ${idx % 2 === 0 ? '' : 'bg-slate-800/10'}`}>
                          <td className="px-5 py-3">
                            <p className="font-semibold text-white print:text-black text-sm">{row.customerName}</p>
                            {row.isBudget && (
                              <span className="inline-block text-[9px] font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded mt-0.5">Per Nominal</span>
                            )}
                            {row.notes && (
                              <p className="text-[10px] text-amber-400 mt-0.5">{row.notes}</p>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-300 print:text-black font-mono text-xs">
                            {row.isBudget
                              ? <span className="text-blue-400 font-bold">{formatRupiah(row.budgetAmount)}</span>
                              : <>{row.orderedQty} {row.unit}</>}
                          </td>
                          {/* Editable qty */}
                          <td className="px-5 py-3 text-center print:hidden">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.actualQty || ''}
                              onChange={(e) => updateRow(row.orderItemId, 'actualQty', Number(e.target.value))}
                              className={`w-20 bg-slate-800 border rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:ring-1 ${
                                row.isBudget ? 'border-blue-500/40 focus:ring-blue-500' : 'border-slate-700 focus:ring-green-500'
                              }`}
                              placeholder={row.isBudget ? 'kg dapat' : '0'}
                            />
                          </td>
                          <td className="px-5 py-3 text-right font-bold print:hidden">
                            {row.isBudget ? (
                              <span className="text-blue-400">
                                {formatRupiah(row.budgetAmount)}
                                <span className="text-[9px] text-blue-500 block font-normal">Fixed</span>
                              </span>
                            ) : (
                              <span className={row.pricePerUnit > 0 ? 'text-green-400' : 'text-amber-500 text-xs'}>
                                {row.pricePerUnit > 0 ? formatRupiah(row.actualQty * row.pricePerUnit) : 'Belum diisi'}
                              </span>
                            )}
                          </td>
                          {/* Print columns */}
                          <td className="px-5 py-3 text-right hidden print:table-cell font-mono text-xs">{row.actualQty} {row.unit}</td>
                          <td className="px-5 py-3 text-right hidden print:table-cell font-mono text-xs">
                            {row.isBudget ? `Budget: ${formatRupiah(row.budgetAmount)}` : formatRupiah(row.pricePerUnit)}
                          </td>
                          <td className="px-5 py-3 text-right hidden print:table-cell font-bold">
                            {row.isBudget ? formatRupiah(row.budgetAmount) : formatRupiah(row.actualQty * row.pricePerUnit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {/* Grand total */}
          <div className="glass rounded-2xl border border-green-500/20 bg-green-500/5 p-5 flex justify-between items-center print:border print:border-gray-300">
            <div>
              <p className="text-sm font-bold text-slate-300">Total Omzet Hari Ini</p>
              <p className="text-xs text-slate-500">{totalOrders} pesanan · {groups.length} jenis produk</p>
            </div>
            <p className="text-2xl font-black text-green-400">{formatRupiah(totalRevenue)}</p>
          </div>

          {/* Submit button */}
          <div className="flex justify-end print:hidden">
            <Button
              size="lg"
              loading={saving}
              onClick={handleSaveAll}
            >
              Simpan Semua & Tandai Siap Kirim ({totalOrders} pesanan)
            </Button>
          </div>
        </div>
      )}

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .glass { background: white !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  )
}
