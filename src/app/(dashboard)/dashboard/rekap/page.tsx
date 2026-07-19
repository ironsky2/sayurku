'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShoppingSession, ShoppingListItem, CategoryAssignment, Profile, Category } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import {
  Sparkles, CheckCircle, ShoppingCart, Users,
  ChevronDown, ChevronUp, Printer, RefreshCw, Package, MessageSquare
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function RekapPage() {
  const supabase = createClient()
  const router = useRouter()
  const [sessions, setSessions] = useState<ShoppingSession[]>([]);

  const shareToWhatsApp = (session: any, byCategory: any) => {
    const formattedDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(session.target_date))
    let text = `🥦 *REKAP BELANJA SAYURKU* 🥦\n📅 *Tanggal:* ${formattedDate}\n\n`

    Object.entries(byCategory).forEach(([_, group]: any) => {
      const catIcon = group.category?.icon || '📦'
      const catName = group.category?.name || 'Lainnya'
      const anggotaName = group.anggota ? `(Belanja: ${group.anggota.full_name})` : '(Belum di-assign)'
      
      text += `*${catIcon} ${catName}* ${anggotaName}\n`
      text += `----------------------------\n`
      group.items.forEach((item: any) => {
        const checkbox = item.is_purchased ? '✅' : '[ ]'
        text += `${checkbox} ${item.product?.name}: ${item.total_quantity} ${item.unit}\n`
      })
      text += `\n`
    })

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank')
  }
  const [anggotaList, setAnggotaList] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0])
  const [generating, setGenerating] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [assignModal, setAssignModal] = useState<{ sessionId: string; categoryId: string } | null>(null)

  const loadData = async () => {
    const [{ data: sess }, { data: anggota }, { data: cats }] = await Promise.all([
      supabase.from('shopping_sessions')
        .select('*, shopping_list_items(*, product:products(name, unit, category:categories(name, icon)), category:categories(*)), category_assignments(*, anggota:profiles(full_name), category:categories(*))')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('profiles').select('*').eq('role', 'anggota').eq('is_active', true),
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    ])
    setSessions(sess || [])
    setAnggotaList(anggota || [])
    setCategories(cats || [])
  }

  useEffect(() => { loadData() }, [])

  const generateRekap = async () => {
    setGenerating(true)
    try {
      // Check if session already exists for this date
      const { data: existing } = await supabase
        .from('shopping_sessions')
        .select('id')
        .eq('target_date', targetDate)
        .single()

      let sessionId = existing?.id

      if (!sessionId) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: newSession, error } = await supabase
          .from('shopping_sessions')
          .insert({ target_date: targetDate, created_by: user!.id, status: 'draft' })
          .select()
          .single()
        if (error) throw error
        sessionId = newSession.id
      }

      // Call the database function to generate the list
      const { error: fnError } = await supabase.rpc('generate_shopping_list', {
        p_session_id: sessionId,
        p_target_date: targetDate,
      })
      if (fnError) throw fnError

      toast.success('Rekap belanja berhasil di-generate!')
      loadData()
      setExpandedSession(sessionId)
    } catch (err) {
      toast.error('Gagal generate rekap. Coba lagi.')
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const assignAnggota = async (sessionId: string, categoryId: string, anggotaId: string) => {
    // Upsert assignment
    const { error } = await supabase
      .from('category_assignments')
      .upsert({ session_id: sessionId, category_id: categoryId, anggota_id: anggotaId },
        { onConflict: 'session_id,category_id' })

    if (error) { toast.error('Gagal assign anggota'); return }

    // Update shopping list items for this category
    await supabase
      .from('shopping_list_items')
      .update({ anggota_id: anggotaId })
      .eq('session_id', sessionId)
      .eq('category_id', categoryId)

    toast.success('Anggota berhasil di-assign!')
    loadData()
    setAssignModal(null)
  }

  const toggleItemPurchased = async (itemId: string, current: boolean) => {
    await supabase
      .from('shopping_list_items')
      .update({ is_purchased: !current, purchased_at: !current ? new Date().toISOString() : null })
      .eq('id', itemId)
    loadData()
  }

  const updateSessionStatus = async (sessionId: string, status: string) => {
    await supabase.from('shopping_sessions').update({ status }).eq('id', sessionId)
    toast.success('Status sesi diupdate!')
    loadData()
  }

  const finishShopping = async (sessionId: string, targetDate: string) => {
    // 1. Update session status to done
    const { error: sessErr } = await supabase
      .from('shopping_sessions')
      .update({ status: 'done' })
      .eq('id', sessionId)

    if (sessErr) {
      toast.error('Gagal menyelesaikan belanja')
      return
    }

    // 2. Auto-update all orders for this target date from confirmed/shopping to ready
    const { error: orderErr } = await supabase
      .from('orders')
      .update({ status: 'ready' })
      .eq('delivery_date', targetDate)
      .in('status', ['confirmed', 'shopping'])

    if (orderErr) {
      console.error('Gagal update status pesanan:', orderErr)
      toast.error('Belanja selesai, tetapi gagal mengupdate status pesanan menjadi Siap Kirim')
    } else {
      toast.success('Belanja selesai! Semua pesanan hari ini diubah statusnya menjadi Siap Kirim.')
    }
    loadData()
  }

  const sessionStatusColors: Record<string, string> = {
    draft: 'yellow', assigned: 'blue', shopping: 'orange', done: 'green'
  }
  const sessionStatusLabels: Record<string, string> = {
    draft: 'Draft', assigned: 'Sudah Assign', shopping: 'Sedang Belanja', done: 'Selesai'
  }

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">Rekap Belanja</h1>
        <p className="text-slate-500 text-sm">Generate dan kelola daftar belanja harian ke pasar</p>
      </div>

      {/* Generate Card */}
      <div
        className="rounded-2xl p-6 border border-green-200 space-y-4 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-green-600" />
          <h2 className="font-bold text-slate-800">Generate Rekap Baru</h2>
        </div>
        <p className="text-sm text-slate-600 font-medium">
          Sistem akan otomatis menghitung total semua item yang perlu dibeli berdasarkan pesanan customer pada tanggal pengiriman yang dipilih.
        </p>
        <div className="flex gap-3">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="flex-1 bg-white border border-green-300 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50"
          />
          <Button
            onClick={generateRekap}
            loading={generating}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Generate
          </Button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Riwayat Rekap</h2>

        {sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada rekap. Generate sekarang!</p>
          </div>
        ) : (
          sessions.map((session) => {
            const items = (session as any).shopping_list_items || []
            const assignments = (session as any).category_assignments || []
            const totalItems = items.length
            const purchasedItems = items.filter((i: any) => i.is_purchased).length
            const isExpanded = expandedSession === session.id

            // Group items by category
            const byCategory: Record<string, { category: any; items: any[]; anggota?: any }> = {}
            items.forEach((item: any) => {
              const catId = item.category_id || 'uncategorized'
              if (!byCategory[catId]) {
                const assignment = assignments.find((a: any) => a.category_id === catId)
                byCategory[catId] = {
                  category: item.category || { name: 'Lainnya', icon: '📦' },
                  items: [],
                  anggota: assignment?.anggota,
                }
              }
              byCategory[catId].items.push(item)
            })

            return (
              <div key={session.id} className="glass rounded-2xl border border-slate-700/50 overflow-hidden">
                {/* Session Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/30 transition-all"
                  onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white">
                        {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(session.target_date))}
                      </p>
                      <Badge variant={sessionStatusColors[session.status] as any} dot>
                        {sessionStatusLabels[session.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {purchasedItems}/{totalItems} item selesai · {Object.keys(byCategory).length} kategori
                    </p>
                    {totalItems > 0 && (
                      <div className="w-32 h-1.5 bg-slate-700 rounded-full mt-2">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${(purchasedItems / totalItems) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {session.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={(e) => { e.stopPropagation(); updateSessionStatus(session.id, 'shopping') }}
                      >
                        Mulai Belanja
                      </Button>
                    )}
                    {session.status === 'shopping' && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={(e) => { e.stopPropagation(); finishShopping(session.id, session.target_date) }}
                      >
                        Selesai Belanja
                      </Button>
                    )}
                    {session.status === 'done' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); router.push('/dashboard/delivery') }}
                      >
                        🚚 Atur Pengiriman
                      </Button>
                    )}
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50 p-4 space-y-4">
                    {totalItems === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Tidak ada pesanan untuk tanggal ini</p>
                      </div>
                    ) : (
                      Object.entries(byCategory).map(([catId, group]) => (
                        <div key={catId} className="bg-slate-800/40 rounded-xl p-4">
                          {/* Category Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{group.category?.icon}</span>
                              <div>
                                <p className="text-sm font-bold text-white">{group.category?.name}</p>
                                {group.anggota ? (
                                  <p className="text-xs text-green-400">👤 {group.anggota.full_name}</p>
                                ) : (
                                  <p className="text-xs text-slate-500">Belum di-assign</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setAssignModal({ sessionId: session.id, categoryId: catId })}
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 transition-all"
                            >
                              <Users className="w-3 h-3" />
                              {group.anggota ? 'Ganti' : 'Assign'}
                            </button>
                          </div>

                          {/* Items */}
                          <div className="space-y-2">
                            {group.items.map((item: any) => (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                                  item.is_purchased ? 'opacity-60' : ''
                                }`}
                              >
                                <button
                                  onClick={() => toggleItemPurchased(item.id, item.is_purchased)}
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                    item.is_purchased
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-slate-500 hover:border-green-400'
                                  }`}
                                >
                                  {item.is_purchased && <CheckCircle className="w-3 h-3 text-white" />}
                                </button>
                                <div className="flex-1">
                                  <span className={`text-sm ${item.is_purchased ? 'line-through text-slate-500' : 'text-white'}`}>
                                    {item.product?.name}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-green-400">
                                  {item.total_quantity} {item.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Action Buttons */}
                    {totalItems > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                          onClick={() => window.print()}
                          className="flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-all"
                        >
                          <Printer className="w-4 h-4" />
                          Cetak Rekap
                        </button>
                        <button
                          onClick={() => shareToWhatsApp(session, byCategory)}
                          className="flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-emerald-400 hover:text-white border border-emerald-600/30 bg-emerald-600/10 hover:bg-emerald-600/30 rounded-xl transition-all"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Share WhatsApp
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Assign Anggota Modal */}
      <Modal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        title="Assign Anggota"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Pilih anggota yang akan berbelanja kategori ini:</p>
          {anggotaList.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Belum ada anggota terdaftar.
            </p>
          ) : (
            anggotaList.map((anggota) => (
              <button
                key={anggota.id}
                onClick={() => assignModal && assignAnggota(assignModal.sessionId, assignModal.categoryId, anggota.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-left transition-all"
              >
                <div className="w-9 h-9 bg-green-700 rounded-full flex items-center justify-center text-sm font-bold text-white">
                  {anggota.full_name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{anggota.full_name}</p>
                  <p className="text-xs text-slate-500">{anggota.phone}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
