'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { User, Phone, MapPin, LogOut, LayoutDashboard, Save, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function CustomerProfilePage() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setAddress(profile.address || '')
    }
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!fullName.trim() || !address.trim()) {
      toast.error('Nama Lengkap dan Alamat wajib diisi!')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          address: address.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error
      toast.success('Profil berhasil diperbarui!')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui profil')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
      try {
        await signOut()
        toast.success('Berhasil keluar akun')
        router.push('/login')
        router.refresh()
      } catch (err) {
        toast.error('Gagal keluar akun')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[85vh]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-6 text-center">
        <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
          <User className="w-10 h-10 text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Belum Masuk Akun</h2>
        <p className="text-slate-500 text-sm mb-6">Silakan masuk menggunakan nomor WhatsApp kamu untuk mengelola profil.</p>
        <Link href="/login?redirect=/profile">
          <Button size="lg">Masuk Akun</Button>
        </Link>
      </div>
    )
  }

  const initialLetter = fullName ? fullName.charAt(0).toUpperCase() : 'U'
  const isAdminOrSeller = profile?.role === 'admin' || profile?.role === 'seller'

  return (
    <div className="fade-in max-w-lg mx-auto pb-24 px-4 py-6">
      {/* Profile Header Visual */}
      <div className="flex flex-col items-center mb-8 mt-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-green-600 to-emerald-400 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-green-900/30 mb-4 border-2 border-slate-700/50 relative">
          {initialLetter}
          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-green-500 border-2 border-slate-900 flex items-center justify-center" title="Akun Aktif">
            <CheckCircle className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white">{profile?.full_name || 'User SayurKu'}</h2>
        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 bg-slate-850 border border-slate-800 px-3 py-1 rounded-full">
          <Phone className="w-3 h-3 text-green-400" />
          {profile?.phone || 'Tanpa Nomor HP'}
        </p>
      </div>

      {/* Admin Quick Link */}
      {isAdminOrSeller && (
        <div className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-xs text-green-400 mb-2">Anda login sebagai <strong>{profile?.role.toUpperCase()}</strong></p>
          <Link href="/dashboard">
            <Button fullWidth variant="primary" className="flex items-center justify-center gap-2" icon={<LayoutDashboard className="w-4 h-4" />}>
              Masuk Dashboard Seller
            </Button>
          </Link>
        </div>
      )}

      {/* Form Details */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="glass border border-slate-700/50 p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2 mb-1">Rincian Informasi Profil</h3>
          
          <Input
            label="Nama Lengkap"
            placeholder="Nama kamu"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            icon={<User className="w-4 h-4 text-slate-400" />}
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 block">Alamat Pengiriman Default</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <textarea
                placeholder="Tulis alamat pengiriman lengkap kamu..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 min-h-[90px]"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={saving}
            icon={<Save className="w-5 h-5" />}
          >
            Simpan Perubahan
          </Button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-semibold py-3 px-5 rounded-xl text-sm transition-all border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            Keluar Akun (Logout)
          </button>
        </div>
      </form>
    </div>
  )
}
