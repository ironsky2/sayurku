'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, DeliveryBatch } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Truck, Plus, MapPin, CheckCircle, Package, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'

export default function DeliveryPage() {
  const supabase = createClient()
  const [batches, setBatches] = useState<DeliveryBatch[]>([])
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [anggotaList, setAnggotaList] = useState<any[]>([])
  const [newBatchModal, setNewBatchModal] = useState(false)
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [batchLabel, setBatchLabel] = useState('Pengiriman Pagi')
  const [selectedAnggota, setSelectedAnggota] = useState('')
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])

  const loadData = async () => {
    const [{ data: b }, { data: o }, { data: a }] = await Promise.all([
      supabase.from('delivery_batches')
        .select('*, assigned_profile:profiles(full_name, phone), delivery_items(*, order:orders(*, customer:profiles!orders_customer_id_fkey(full_name, phone, address)))')
        .order('created_at', { ascending: false }),
      supabase.from('orders')
        .select('*, customer:profiles!orders_customer_id_fkey(full_name, phone)')
        .eq('status', 'ready')
        .order('delivery_date'),
      supabase.from('profiles').select('*').in('role', ['anggota', 'seller']).eq('is_active', true),
    ])
    setBatches(b || [])
    setReadyOrders(o || [])
    setAnggotaList(a || [])
  }

  useEffect(() => { loadData() }, [])

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    const updated = [...selectedOrders]
    if (direction === 'up' && index > 0) {
      const temp = updated[index]
      updated[index] = updated[index - 1]
      updated[index - 1] = temp
    } else if (direction === 'down' && index < updated.length - 1) {
      const temp = updated[index]
      updated[index] = updated[index + 1]
      updated[index + 1] = temp
    }
    setSelectedOrders(updated)
  }

  const createBatch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: batch, error } = await supabase
      .from('delivery_batches')
      .insert({
        label: batchLabel,
        assigned_to: selectedAnggota || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) { toast.error('Gagal buat batch'); return }

    // Add delivery items
    const items = selectedOrders.map((orderId, idx) => ({
      batch_id: batch.id,
      order_id: orderId,
      delivery_sequence: idx + 1,
      status: 'pending',
    }))

    if (items.length > 0) {
      await supabase.from('delivery_items').insert(items)
      // Update orders status to delivering
      await supabase.from('orders').update({ status: 'delivering' }).in('id', selectedOrders)
    }

    toast.success('Batch pengiriman dibuat!')
    setNewBatchModal(false)
    setSelectedOrders([])
    loadData()
  }

  const markDelivered = async (deliveryItemId: string, orderId: string) => {
    await Promise.all([
      supabase.from('delivery_items').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', deliveryItemId),
      supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId),
    ])
    toast.success('Pesanan ditandai terkirim!')
    loadData()
  }

  const batchStatusColors: Record<string, string> = { pending: 'yellow', delivering: 'purple', done: 'green' }
  const batchStatusLabels: Record<string, string> = { pending: 'Menunggu', delivering: 'Dalam Pengiriman', done: 'Selesai' }

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Pengiriman</h1>
          <p className="text-slate-500 text-sm">{readyOrders.length} pesanan siap dikirim</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setNewBatchModal(true)}
          disabled={readyOrders.length === 0}
        >
          Buat Batch
        </Button>
      </div>

      {/* Ready Orders Summary */}
      {readyOrders.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-amber-400 font-semibold text-sm mb-2">
            📦 {readyOrders.length} pesanan siap dikirim
          </p>
          <div className="space-y-1.5">
            {readyOrders.slice(0, 3).map((o) => (
              <div key={o.id} className="flex justify-between text-xs text-slate-400">
                <span>{(o as any).customer?.full_name}</span>
                <span className="text-amber-400">{formatRupiah(o.total_price)}</span>
              </div>
            ))}
            {readyOrders.length > 3 && (
              <p className="text-xs text-slate-500">+{readyOrders.length - 3} lainnya</p>
            )}
          </div>
        </div>
      )}

      {/* Delivery Batches */}
      <div className="space-y-3">
        {batches.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada batch pengiriman</p>
          </div>
        ) : (
          batches.map((batch) => {
            const items = (batch as any).delivery_items || []
            const delivered = items.filter((i: any) => i.status === 'delivered').length
            const isExpanded = expandedBatch === batch.id

            return (
              <div key={batch.id} className="glass rounded-2xl border border-slate-700/50 overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/30 transition-all"
                  onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{batch.label}</span>
                      <Badge variant={batchStatusColors[batch.status] as any} dot>
                        {batchStatusLabels[batch.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(batch as any).assigned_profile?.full_name || 'Belum di-assign'} ·{' '}
                      {delivered}/{items.length} terkirim
                    </p>
                    {items.length > 0 && (
                      <div className="w-32 h-1.5 bg-slate-700 rounded-full mt-2">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${(delivered / items.length) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-700/50 p-4 space-y-3">
                    {items.map((item: any, idx: number) => (
                      <div
                        key={item.id}
                        className={`flex gap-3 p-3 rounded-xl border transition-all ${
                          item.status === 'delivered'
                            ? 'border-green-500/20 bg-green-500/5 opacity-70'
                            : 'border-slate-700/50 bg-slate-800/40'
                        }`}
                      >
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {item.order?.customer?.full_name}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {item.order?.delivery_address}
                          </p>
                          <p className="text-xs text-green-400 font-semibold mt-1">
                            {formatRupiah(item.order?.total_price)}
                          </p>
                        </div>
                        {item.status !== 'delivered' && (
                          <button
                            onClick={() => markDelivered(item.id, item.order_id)}
                            className="flex-shrink-0 p-2 rounded-xl bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-all"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        {item.status === 'delivered' && (
                          <div className="flex-shrink-0 p-2">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* New Batch Modal */}
      <Modal open={newBatchModal} onClose={() => setNewBatchModal(false)} title="Buat Batch Pengiriman" size="lg">
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-1.5">Label Pengiriman</label>
            <input
              value={batchLabel}
              onChange={(e) => setBatchLabel(e.target.value)}
              placeholder="Pengiriman Pagi"
              className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 block mb-1.5">Pengantar</label>
            <select
              value={selectedAnggota}
              onChange={(e) => setSelectedAnggota(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
            >
              <option value="">Pilih pengantar...</option>
              {anggotaList.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">
              Pilih Pesanan ({selectedOrders.length} dipilih)
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {readyOrders.map((order) => (
                <label
                  key={order.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedOrders.includes(order.id)
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-slate-700/50 bg-slate-800/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(order.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedOrders([...selectedOrders, order.id])
                      else setSelectedOrders(selectedOrders.filter((id) => id !== order.id))
                    }}
                    className="accent-green-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{(order as any).customer?.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{order.delivery_address}</p>
                  </div>
                  <span className="text-green-400 text-sm font-bold">{formatRupiah(order.total_price)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sorter Urutan Pengiriman */}
          {selectedOrders.length > 0 && (
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Urutan Pengantaran Kurir (Prioritas Teratas Diantar Pertama)
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedOrders.map((orderId, idx) => {
                  const order = readyOrders.find((o) => o.id === orderId)
                  if (!order) return null
                  return (
                    <div key={orderId} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/30 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-green-600/20 text-green-400 border border-green-600/30 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-200 truncate">{(order as any).customer?.full_name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{order.delivery_address}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveOrder(idx, 'up')}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-all"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === selectedOrders.length - 1}
                          onClick={() => moveOrder(idx, 'down')}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-all"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <Button
            fullWidth
            size="lg"
            onClick={createBatch}
            disabled={selectedOrders.length === 0}
            icon={<Truck className="w-4 h-4" />}
          >
            Buat Batch ({selectedOrders.length} pesanan)
          </Button>
        </div>
      </Modal>
    </div>
  )
}
