# 🥦 SayurKu — Catatan Riwayat Pengembangan (Development Log)

File ini mencatat seluruh fitur baru, perbaikan database, perubahan skema, kebijakan keamanan RLS, dan perbaikan bug yang telah kita selesaikan hari ini (**18 Juli 2026**). Catatan ini berfungsi agar developer atau AI assistant di sesi berikutnya dapat memahami kondisi terkini proyek secara utuh tanpa hambatan.

---

## 🚀 Fitur Baru & UX Improvements (Hari Ini)

### 1. 🔑 Autentikasi Tanpa Password (WhatsApp Only)
* **Konsep**: Customer masuk cukup menginput nomor WhatsApp.
* **Email Dummy**: Di latar belakang, sistem memetakan ke email dummy `wa_[nomor_hp]@gmail.com` dan password `[nomor_hp]`.
* **Fallback Kompatibilitas Akun Lama**: Jika login format baru gagal, sistem otomatis mencoba format lama `[nomor_hp]@sayurku.com` agar admin/user lama tidak terputus dari database.
* **Smart Redirect**: Setelah sukses login, sistem mengecek role. Jika **Admin/Seller**, browser otomatis dialihkan ke Seller Dashboard (`/dashboard`). Jika **Anggota (Kurir)**, otomatis dialihkan ke halaman khusus tugas pengiriman (`/anggota`). Jika **Customer**, dialihkan ke halaman belanja (`/`).

### 2. 👤 Halaman Profil Customer (`/profile`)
* Halaman mobile-first premium baru untuk mengedit Nama Lengkap, Alamat Pengiriman Default, Logout, serta tombol jalan pintas khusus **"Masuk Dashboard Seller"** (hanya muncul jika role user adalah admin/seller).

### 3. 🗺️ Auto-Fill Alamat Pengiriman di Checkout
* Kolom Alamat Pengiriman di Checkout otomatis terisi secara asinkron dari data `profiles.address` di database, dengan cadangan (*fallback*) dari alamat pengiriman terakhir di `localStorage`.

### 4. 🛒 Catatan Eceran Kustom (Catatan Belanjaan)
* Customer dapat menambahkan catatan belanja per item di halaman Keranjang (misal: *"minta cabai rawit 3 ons"*). Catatan ini disimpan di tabel `order_items.notes` saat checkout.
* Seller dapat menyesuaikan berat (desimal) dan harga belanjaan eceran tersebut secara fleksibel sebelum pembayaran lunas di panel Admin (`/dashboard/orders`).

### 5. ⚡ Timeline Progress Tracking Real-Time
* Indikator progres visual pesanan (`Dipesan ──> Dibayar ──> Diproses ──> Dikirim`) di layar customer menggunakan listener **Supabase Realtime** sehingga status bergeser otomatis tanpa refresh browser.

### 6. 📊 Bulk Daily Prices (Update Harga Massal Harian)
* Halaman baru `/dashboard/products/daily-prices` yang menampilkan seluruh sayur aktif dalam bentuk baris input. Admin dapat mengupdate harga pasar seluruh produk sekaligus secara cepat sebelum toko buka.

### 7. ➕/➖ Quick Stock Adjuster
* Tombol cepat `+` dan `-` pada kartu produk di list seller dashboard untuk menambah/mengurangi stok sayur secara langsung tanpa perlu masuk ke modal editor.

### 8. 🤝 Alur COD (Cash on Delivery) & Integrasi Dashboard Admin
* **Pilihan COD**: Customer dapat memilih pembayaran "Bayar Nanti (COD / Bayar Belakangan)" di halaman `/payment/[id]`.
* **Pembaruan DB Otomatis**: Menekan tombol COD akan mengupdate `payment_method` menjadi `'COD'` dan mengubah `status` pesanan menjadi `'confirmed'` (Dikonfirmasi). Pesanan otomatis langsung terdaftar di admin untuk dikirim!
* **Badge Dashboard**: Di list pesanan dashboard admin, ditambahkan badge warna-warni untuk membedakan metode pembayaran (`🤝 COD` warna oranye dan `💳 QRIS` warna hijau toska).

### 9. ➕ Tambah Anggota Langsung oleh Admin (Tanpa Service Role Key)
* **UI Form**: Tombol "Tambah Anggota" di `/admin/users` membuka Modal Form untuk mendaftarkan Anggota Baru (Kurir/Seller/Admin) langsung dari dashboard.
* **Direct Client-Side Insert**: Data anggota baru langsung di-insert dari sisi client ke tabel `profiles` menggunakan ID acak (UUID). Cara ini diizinkan oleh kebijakan RLS Admin (`Admins can manage profiles`) dan **tidak memerlukan Service Role Key atau API route**.
* **Trigger Sync-on-Signup**: Trigger database `handle_new_user` disesuaikan agar ketika anggota melakukan login pertama kali, ia akan langsung disinkronkan dengan data profil pra-input yang dibuat oleh admin.

### 10. 🔄 Penyederhanaan Alur Rekap Belanja & Pengiriman (Skip Shopping-Assign)
* **Mulai Belanja Instan**: Tombol **"Mulai Belanja"** kini bisa diklik langsung dari status `draft`. Menghilangkan keharusan membagi kategori belanjaan per anggota saat awal belanja.
* **Selesai Belanja Massal**: Menambahkan tombol **"Selesai Belanja"** pada status `shopping`. Saat diklik, sistem otomatis mengubah status **semua pesanan hari tersebut** menjadi **`'ready'` (Siap Kirim)** secara massal.
* **Tombol Cepat Assign Kurir**: Pada status selesai (`done`), ditambahkan tombol **`[🚚 Atur Pengiriman]`** yang langsung mengarahkan admin ke halaman kelola pengiriman (`/dashboard/delivery`) untuk menentukan kurir mana yang akan mengantarkan pesanan tersebut secara terperinci.

### 11. ☀️ Transformasi Tema Terang (Light Theme Premium)
* **Inversi Variabel Warna (Tailwind v4 `@theme`)**: Mengubah seluruh skema warna basis Slate (`slate-950` hingga `slate-50`) menggunakan blok `@theme` resmi Tailwind v4 agar terkompilasi sempurna saat *build*. Halaman web sekarang memiliki latar belakang putih/abu-abu terang dengan teks gelap yang kontras tinggi, sangat memudahkan kalangan ibu-ibu saat berbelanja.
* **Pembersihan Gradient Gelap**: Menghapus dan mengubah seluruh background gradient hijau gelap yang ter-hardcode di halaman utama/customer (Hero Banner), halaman admin (Kartu Omzet/Revenue), dan halaman Login menjadi gradient hijau pastel segar (`#f0fdf4` ke `#dcfce7`) yang kontras tinggi dan cerah.
* **Peningkatan Kontras Tombol, Input & Teks**: 
  - Mengubah pemetaan class warna aksen terang (`text-green-400`, `text-red-400`, `text-amber-400`, dll.) secara otomatis menjadi warna gelap yang tajam (`green-600`, `red-600`, `amber-600`, dll.) agar tidak samar di latar belakang putih.
  - Mengoreksi seluruh teks di dalam tag input, select dropdown, dan textarea yang menggunakan class `text-white` atau `text-slate-100/200` agar otomatis berubah menjadi **hitam pekat (`#0f172a`)** secara global.
  - Memastikan seluruh tombol manual (`button.bg-slate-800`, dll.) memiliki teks gelap ber-border abu sehingga tombol-tombol navigasi/COD tetap terlihat jelas.
  - Mengoreksi placeholder input agar tidak terlalu redup.
* **Badge Kontras Tinggi**: Seluruh badge status (pending, dikonfirmasi, dikirim) kini menggunakan warna pastel lembut dengan teks pekat agar sangat mudah dibaca.

### 12. 🛵 Layar Khusus Tugas Pengantaran Kurir (`/anggota`)
* **Layout Tab Ganda**: Halaman anggota kini memisahkan tugas menjadi **Tugas Antar** (tugas aktif/riwayat pengiriman) dan **List Belanja** (jika bertugas belanja di pasar).
* **Alur Pengantaran Komplit**:
  - Tombol **"🚀 Mulai Jalan Mengantarkan"**: Mengubah status batch dan semua pesanan di dalamnya menjadi sedang diantar.
  - Urutan Antrean, Nama Customer, Alamat Lengkap, Catatan Pengiriman, dan Detail Tagihan (QRIS/COD) tampil dengan jelas dan ramah seluler.
  - Tombol **"💬 Hubungi Customer (WhatsApp)"**: Membuka WhatsApp secara instan dengan pesan otomatis siap kirim.
  - Tombol **"✅ Terkirim & Lunas"** & **"❌ Gagal Kirim"**: Untuk menyelesaikan tugas pengantaran di lapangan secara real-time.

---

## 🛠️ Perubahan Skema & Keamanan Database (Supabase)

Seluruh perubahan database di bawah ini telah sukses diimplementasikan dan disinkronkan ke dalam file migrasi lokal [`supabase/migrations/001_initial.sql`](file:///d:/Sayuran/sayurku/supabase/migrations/001_initial.sql).

### 1. Kolom, Constraint & Pemetaan Join Database
* **Tabel `profiles`**: Ditambahkan kolom `email TEXT UNIQUE` untuk mendokumentasikan email dummy secara transparan di tabel profil.
* **Tabel `order_items`**: Ditambahkan kolom `notes TEXT` untuk menyimpan catatan eceran/kustom per item belanjaan.
* **Tabel `orders`**: Memperbarui check constraint `orders_payment_method_check` agar mengizinkan nilai `'COD'` selain `'QRIS'` dan `'TRANSFER'`.
* **Pelepasan Foreign Key `profiles_id_fkey`**: Melepas constraint foreign key `profiles.id REFERENCES auth.users(id)` agar Admin bisa mendaftarkan profil kurir/anggota baru dengan UUID acak sebelum kurir melakukan registrasi auth.
* **Trigger Hapus Pengguna Baru (`handle_deleted_user`)**: Ditambahkan trigger `on_auth_user_deleted` untuk menggantikan fungsi `ON DELETE CASCADE` bawaan foreign key yang dilepas, agar profil otomatis terhapus jika akun auth-nya dihapus oleh admin.
* **Pemetaan Relasi (PostgREST PGRST201 Fix)**: Menentukan relasi secara eksplisit menggunakan `customer:profiles!orders_customer_id_fkey` karena tabel `orders` memiliki dua foreign key ke tabel `profiles` (`customer_id` dan `confirmed_by`). Ini memecahkan error 406/500 API Supabase di dashboard admin.

### 2. Tipe TypeScript (`types/index.ts`)
* Menambahkan nilai `'COD'` ke dalam union type `PaymentMethod` agar proses build TypeScript berjalan mulus.

### 3. Fungsi Trigger Pendaftaran Baru (`handle_new_user`)
Memperbarui trigger pendaftaran otomatis dengan metode **Copy-Insert-Cascade** yang sangat aman:
1. Menangkap nomor telepon dari metadata registrasi auth.
2. Membaca email registrasi dari `auth.users` ke tabel `profiles.email`.
3. Menangani kasus profil pra-input dari Admin (menghindari error referensi foreign key):
   - Mengosongkan data `phone`/`email` pada profil lama terlebih dahulu agar tidak melanggar constraint unik.
   - Melakukan insert baris profil baru dengan ID Auth (`NEW.id`).
   - Mengalihkan seluruh relasi di tabel lain (`orders`, `delivery_batches`, `shopping_list_items`, dll.) ke ID baru.
   - Menghapus profil lama yang lama.
4. Menjadikan pendaftar pertama di database sebagai `admin` secara otomatis jika tabel kosong.

### 4. Bypass RLS via RPC (`get_profile_by_phone`)
Membuat fungsi database `SECURITY DEFINER` untuk melakukan pencarian profil & email dummy berdasarkan nomor HP pada layar login secara aman, serta mengambil nama lengkap dan alamat yang di-input admin untuk auto-prefill:
```sql
CREATE OR REPLACE FUNCTION get_profile_by_phone(p_phone TEXT)
RETURNS TABLE (email TEXT, role TEXT, full_name TEXT, address TEXT) AS $$
BEGIN
  RETURN QUERY 
  SELECT p.email, p.role, p.full_name, p.address FROM profiles p WHERE p.phone = p_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5. Kebijakan Keamanan RLS Baru (Row Level Security)
* **Tabel `profiles`**: 
  - Ditambahkan kebijakan `INSERT` bagi user terotentikasi agar proses pembuatan profil otomatis (*self-healing*) di Next.js berjalan lancar.
  - Ditambahkan kebijakan `SELECT` bagi **anggota** untuk membaca nama & alamat customer.
* **Tabel `orders`**: 
  - Memperbarui kebijakan `UPDATE` dengan menambahkan klausul `WITH CHECK` agar customer diizinkan mengunggah bukti bayar dan mengubah status order.
  - Ditambahkan kebijakan `SELECT` & `UPDATE` bagi **anggota** untuk membaca dan mengubah status pesanan yang ditugaskan kepada mereka.
* **Tabel `delivery_batches` & `delivery_items`**:
  - Ditambahkan kebijakan `UPDATE` pada `delivery_batches` bagi **anggota** agar dapat mengaktifkan status jalan ("delivering") dan selesai ("done").
  - Ditambahkan kebijakan `SELECT` & `UPDATE` pada `delivery_items` bagi **anggota** agar dapat melihat dan menyelesaikan tugas antar masing-masing di lapangan.

---

## 🛡️ Sistem Self-Healing & Penanganan Error Penting

1. **Hydration/Runtime Error `useCart`**:
   - Terjadi karena kompilasi HMR (Hot Module Replacement) Next.js Turbopack menduplikasi modul context `CartContext` di memori dev. **Solusi**: Matikan dev server (`Ctrl + C`) lalu jalankan kembali `npm run dev`.
2. **Error `406 (Not Acceptable)`**:
   - Terjadi jika query `.single()` mengembalikan 0 baris (tidak menemukan data profil). **Solusi**: Diubah menjadi `.maybeSingle()` di `AuthContext.tsx` dan `login/page.tsx` agar mengembalikan `null` secara anggun.
3. **Self-Healing Profile**:
   - Jika user berhasil login di `auth.users` tetapi baris profilnya di `profiles` hilang (akibat bentrok nomor HP lama), Next.js akan langsung mendeteksi nilai `null` dan **otomatis menyisipkan baris profil baru secara instan di latar belakang** saat login berhasil.
4. **Type Error 'PaymentMethod' and 'COD' Comparison**:
   - Terjadi karena tipe data `PaymentMethod` di Next.js awalnya hanya mendukung `'QRIS' | 'TRANSFER'`. **Solusi**: Menambahkan `'COD'` ke union type `PaymentMethod` di `src/lib/types/index.ts`.
