'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useRouter, useSearchParams } from 'next/navigation'
import { Leaf, Phone, MapPin, User } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const supabase = createClient()

  const [step, setStep] = useState<'phone' | 'register'>('phone')
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPreRegistered, setIsPreRegistered] = useState(false)
  const [preRegisteredRole, setPreRegisteredRole] = useState('customer')

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return

    setLoading(true)
    const normalizedPhone = phone.trim()
    const dummyEmail = `wa_${normalizedPhone}@gmail.com`
    const dummyPassword = normalizedPhone

    try {
      // 1. Cari profile berdasarkan nomor HP menggunakan RPC (mem-bypass RLS karena belum login)
      console.log('Mencari profile untuk nomor HP:', normalizedPhone)
      const { data: profileList } = await supabase
        .rpc('get_profile_by_phone', { p_phone: normalizedPhone })

      const existingProfile = profileList && profileList.length > 0 ? profileList[0] : null

      let loginEmail = dummyEmail
      if (existingProfile) {
        loginEmail = existingProfile.email || `${normalizedPhone}@sayurku.com`
        // Prefill name & address if pre-registered by admin
        if (existingProfile.full_name) setFullName(existingProfile.full_name)
        if (existingProfile.address) setAddress(existingProfile.address)
        setIsPreRegistered(true)
        setPreRegisteredRole(existingProfile.role || 'customer')
      } else {
        setIsPreRegistered(false)
        setPreRegisteredRole('customer')
      }

      console.log('Mencoba login dengan email:', loginEmail)
      let { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: dummyPassword,
      })

      // Fallback: Jika gagal, coba format email sebaliknya
      if (loginError) {
        const alternativeEmail = loginEmail.includes('gmail.com')
          ? `${normalizedPhone}@sayurku.com`
          : `wa_${normalizedPhone}@gmail.com`
        
        console.log('Mencoba login dengan email alternatif:', alternativeEmail)
        const altResult = await supabase.auth.signInWithPassword({
          email: alternativeEmail,
          password: dummyPassword,
        })
        if (!altResult.error) {
          loginData = altResult.data
          loginError = null
        }
      }

      if (!loginError && loginData && loginData.user) {
        // Ambil data profile secara aman (maybeSingle untuk menghindari error 406)
        let { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', loginData.user.id)
          .maybeSingle()

        // Self-healing: Jika user berhasil login di auth tapi profilnya kosong/belum ada di tabel profiles
        if (!profileData) {
          console.log('Self-healing: Profil kosong, membuat profil default untuk nomor:', normalizedPhone)
          
          // Cek apakah nomor HP ini sudah dipakai profil lain (menghindari error UNIQUE constraint)
          const { data: phoneConflict } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', normalizedPhone)
            .maybeSingle()

          if (!phoneConflict) {
            const { error: insertErr } = await supabase
              .from('profiles')
              .insert({
                id: loginData.user.id,
                full_name: loginData.user.user_metadata?.full_name || 'User SayurKu',
                phone: normalizedPhone,
                email: loginData.user.email || loginEmail,
                role: 'customer',
              })

            if (!insertErr) {
              profileData = { role: 'customer' }
            } else {
              console.error('Self-healing gagal:', insertErr)
            }
          } else {
            console.log('Nomor HP sudah diklaim profil dengan ID:', phoneConflict.id)
          }
        }

        toast.success('Selamat datang kembali!')
        
        const hasRedirectParam = searchParams.get('redirect')
        if (hasRedirectParam) {
          router.push(redirect)
        } else if (profileData?.role === 'admin' || profileData?.role === 'seller') {
          router.push('/dashboard')
        } else if (profileData?.role === 'anggota') {
          router.push('/anggota')
        } else {
          router.push('/')
        }
        
        router.refresh()
        return
      }

      // Jika login gagal karena email belum terdaftar
      if (loginError && (loginError.message.toLowerCase().includes('invalid login credentials') || loginError.message.toLowerCase().includes('not found'))) {
        if (isPreRegistered) {
          toast.success('Akun Anda sudah didaftarkan! Konfirmasi data untuk mengaktifkan.')
        } else {
          toast.success('Nomor WhatsApp belum terdaftar. Silakan lengkapi profil Anda.')
        }
        setStep('register')
      } else if (loginError) {
        throw loginError
      }
    } catch (err: any) {
      console.error('Login error:', err)
      toast.error(err.message || 'Gagal memproses nomor WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !address.trim()) {
      toast.error('Nama Lengkap dan Alamat wajib diisi!')
      return
    }

    setLoading(true)
    const normalizedPhone = phone.trim()
    const dummyEmail = `wa_${normalizedPhone}@gmail.com`
    const dummyPassword = normalizedPhone

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: dummyEmail,
        password: dummyPassword,
        options: {
          data: { 
            full_name: fullName.trim(), 
            phone: normalizedPhone, 
            role: preRegisteredRole 
          },
        },
      })

      if (signUpError) throw signUpError

      let userRole = 'customer'

      if (signUpData.user) {
        // Dapatkan role yang di-assign oleh database trigger
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', signUpData.user.id)
          .single()

        if (profileData) {
          userRole = profileData.role
        }

        // Simpan alamat, no hp, dan email dummy ke tabel profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ address: address.trim(), phone: normalizedPhone, email: dummyEmail })
          .eq('id', signUpData.user.id)

        if (profileError) {
          console.error('Gagal update data profile:', profileError)
        }
      }

      toast.success('Pendaftaran berhasil! Akun langsung aktif.')
      
      const hasRedirectParam = searchParams.get('redirect')
      if (hasRedirectParam) {
        router.push(redirect)
      } else if (userRole === 'admin' || userRole === 'seller') {
        router.push('/dashboard')
      } else if (userRole === 'anggota') {
        router.push('/anggota')
      } else {
        router.push('/')
      }
      
      router.refresh()
    } catch (err: any) {
      console.error('Registration error:', err)
      toast.error(err.message || 'Registrasi gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 bg-green-600 rounded-3xl flex items-center justify-center mb-4 shadow-xl shadow-green-600/20">
          <Leaf className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">SayurKu</h1>
        <p className="text-slate-600 text-sm mt-1 font-semibold">Sayur segar langsung ke rumahmu</p>
      </div>

      <div className="glass border border-slate-200 p-6 rounded-3xl max-w-sm mx-auto w-full">
        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <h2 className="text-lg font-bold text-white text-center">Masuk / Daftar</h2>
            <p className="text-xs text-slate-400 text-center mb-4">Masukkan nomor WhatsApp kamu untuk memulai belanja</p>
            
            <Input
              label="Nomor WhatsApp"
              placeholder="Contoh: 08123456789"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              icon={<Phone className="w-4 h-4" />}
            />

            <Button type="submit" fullWidth size="lg" loading={loading} className="mt-4">
              Lanjut
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <h2 className="text-lg font-bold text-white text-center">
              {isPreRegistered ? 'Aktivasi Akun' : 'Lengkapi Profil'}
            </h2>
            <p className="text-xs text-slate-400 text-center mb-4 leading-normal">
              {isPreRegistered 
                ? `Akun ${preRegisteredRole.toUpperCase()} Anda sudah didaftarkan Admin. Silakan konfirmasi untuk mengaktifkan!` 
                : 'Lengkapi data agar pengiriman belanjaan tidak salah alamat'}
            </p>
            
            <Input
              label="Nama Lengkap"
              placeholder="Nama kamu"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              icon={<User className="w-4 h-4" />}
            />

            <Input
              label="Alamat Pengiriman"
              placeholder="Alamat lengkap (RT/RW, No. Rumah)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              icon={<MapPin className="w-4 h-4" />}
            />

            <Button type="submit" fullWidth size="lg" loading={loading} className="mt-6">
              {isPreRegistered ? 'Aktifkan Akun' : 'Daftar & Belanja'}
            </Button>

            <button
              type="button"
              onClick={() => setStep('phone')}
              className="text-xs text-slate-500 hover:text-white block text-center w-full mt-3"
            >
              Kembali ke Masuk
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #052e16 0%, #14532d 30%, #0f172a 100%)' }}>
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
