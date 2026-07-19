'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, UserRole } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Search, UserCheck, ShieldAlert, UserMinus, Plus, User, Phone, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminUsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  // State untuk Modal Tambah Anggota
  const [modalOpen, setModalOpen] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('anggota')
  const [newAddress, setNewAddress] = useState('')
  const [addingLoading, setAddingLoading] = useState(false)

  const loadUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Gagal mengambil data user')
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFullName.trim() || !newPhone.trim()) {
      toast.error('Nama Lengkap dan Nomor WhatsApp wajib diisi!')
      return
    }

    setAddingLoading(true)
    const normalizedPhone = newPhone.trim()
    const dummyEmail = `wa_${normalizedPhone}@gmail.com`
    const newId = crypto.randomUUID()

    try {
      // Direct client-side insert to profiles table
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: newId,
          full_name: newFullName.trim(),
          phone: normalizedPhone,
          email: dummyEmail,
          role: newRole,
          address: newAddress.trim() || null,
          is_active: true
        })

      if (error) throw error

      toast.success(`Anggota baru berhasil didaftarkan sebagai ${newRole.toUpperCase()}!`)
      setModalOpen(false)
      setNewFullName('')
      setNewPhone('')
      setNewRole('anggota')
      setNewAddress('')
      loadUsers()
    } catch (err: any) {
      console.error('Error adding user:', err)
      toast.error(err.message || 'Gagal menambahkan anggota')
    } finally {
      setAddingLoading(false)
    }
  }
  const updateRole = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) {
      toast.error('Anda tidak bisa mengubah role Anda sendiri!')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      toast.error('Gagal memperbarui role')
    } else {
      toast.success('Role berhasil diperbarui!')
      loadUsers()
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUser?.id) {
      toast.error('Anda tidak bisa menonaktifkan akun Anda sendiri!')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !currentStatus })
      .eq('id', userId)

    if (error) {
      toast.error('Gagal memperbarui status user')
    } else {
      toast.success(`User berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
      loadUsers()
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone && u.phone.includes(search))
  )

  const roleColors: Record<UserRole, string> = {
    admin: 'red',
    seller: 'green',
    anggota: 'blue',
    customer: 'gray',
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Kelola Pengguna</h1>
          <p className="text-slate-500 text-sm">Ubah role pengguna (Admin, Seller, Anggota, Customer)</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Tambah Anggota
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          placeholder="Cari nama atau nomor HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl shimmer" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Tidak ada pengguna ditemukan</div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className={`glass rounded-2xl p-4 border border-slate-700/50 flex flex-col md:flex-row justify-between md:items-center gap-4 ${
                !u.is_active ? 'opacity-50' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{u.full_name}</span>
                  <Badge variant={roleColors[u.role] as any}>{u.role.toUpperCase()}</Badge>
                  {!u.is_active && <Badge variant="red">NONAKTIF</Badge>}
                </div>
                <p className="text-xs text-slate-400 mt-1">{u.phone || 'Tidak ada nomor HP'}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{u.id}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={u.role}
                  onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="customer">Customer</option>
                  <option value="anggota">Anggota Seller</option>
                  <option value="seller">Seller</option>
                  <option value="admin">Admin</option>
                </select>

                <Button
                  size="sm"
                  variant={u.is_active ? 'danger' : 'outline'}
                  onClick={() => toggleUserStatus(u.id, u.is_active)}
                >
                  {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah Anggota */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tambah Anggota Baru"
        size="md"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          <Input
            label="Nama Lengkap"
            placeholder="Tulis nama lengkap anggota..."
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
            required
            icon={<User className="w-4 h-4" />}
          />

          <Input
            label="Nomor WhatsApp"
            placeholder="Contoh: 08123456789"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            required
            icon={<Phone className="w-4 h-4" />}
          />

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-slate-300">Role Anggota</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="anggota">Anggota Seller (Kurir/Helper)</option>
              <option value="seller">Seller (Toko/Owner)</option>
              <option value="admin">Admin Utama</option>
            </select>
          </div>

          <Input
            label="Alamat (Opsional)"
            placeholder="Tulis alamat rumah anggota..."
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            icon={<MapPin className="w-4 h-4" />}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={addingLoading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={addingLoading}
            >
              Simpan Anggota
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
