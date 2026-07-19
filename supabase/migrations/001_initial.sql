-- ============================================================
-- SayurKu Database Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'seller', 'admin', 'anggota')),
  address TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
  old_full_name TEXT;
  old_role TEXT;
  old_address TEXT;
  old_avatar_url TEXT;
  old_is_active BOOLEAN;
  new_phone TEXT;
BEGIN
  new_phone := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);

  -- 1. Cari apakah profil dengan nomor HP ini sudah dibuat oleh Admin sebelumnya
  SELECT id, full_name, role, address, avatar_url, is_active 
  INTO existing_id, old_full_name, old_role, old_address, old_avatar_url, old_is_active
  FROM public.profiles 
  WHERE phone = new_phone;

  IF existing_id IS NOT NULL THEN
    -- 2. Kosongkan phone & email lama agar tidak melanggar UNIQUE constraint saat insert baris baru
    UPDATE public.profiles 
    SET phone = NULL, email = NULL 
    WHERE id = existing_id;

    -- 3. Insert baris baru dengan ID Auth baru (NEW.id)
    INSERT INTO public.profiles (id, full_name, phone, email, role, address, avatar_url, is_active)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', old_full_name),
      new_phone,
      NEW.email,
      old_role,
      old_address,
      old_avatar_url,
      old_is_active
    );

    -- 4. Alihkan semua relasi tabel lain dari ID lama ke ID baru
    UPDATE public.delivery_batches SET assigned_to = NEW.id WHERE assigned_to = existing_id;
    UPDATE public.shopping_list_items SET anggota_id = NEW.id WHERE anggota_id = existing_id;
    UPDATE public.category_assignments SET anggota_id = NEW.id WHERE anggota_id = existing_id;
    UPDATE public.orders SET customer_id = NEW.id WHERE customer_id = existing_id;
    UPDATE public.orders SET confirmed_by = NEW.id WHERE confirmed_by = existing_id;
    UPDATE public.shopping_sessions SET created_by = NEW.id WHERE created_by = existing_id;

    -- 5. Hapus profil sementara yang lama
    DELETE FROM public.profiles WHERE id = existing_id;
  ELSE
    -- 6. Jika belum ada, buat baru seperti biasa
    INSERT INTO public.profiles (id, full_name, phone, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      new_phone,
      NEW.email,
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN 'admin' 
           ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'customer') END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-delete profile on user deletion (remplaces ON DELETE CASCADE)
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT,                        -- emoji or icon name
  color TEXT,                       -- hex color for UI
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price_per_unit NUMERIC(12,2) NOT NULL CHECK (price_per_unit > 0),
  unit TEXT NOT NULL DEFAULT 'pcs',  -- 'kg', 'ikat', 'buah', 'gr', 'pcs'
  stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_unit TEXT,                   -- display unit for stock
  is_available_today BOOLEAN NOT NULL DEFAULT false,
  is_po_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDER CUT-OFF SCHEDULES
-- ============================================================
CREATE TABLE order_cutoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,               -- "Pengiriman Pagi", "Pengiriman Sore"
  cutoff_time TIME NOT NULL,         -- jam cut-off (e.g., 20:00)
  delivery_offset_days INT NOT NULL DEFAULT 1, -- berapa hari setelah order
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_type TEXT NOT NULL DEFAULT 'DIRECT' CHECK (order_type IN ('DIRECT', 'PRE_ORDER')),
  cutoff_id UUID REFERENCES order_cutoffs(id),
  delivery_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment',   -- menunggu pembayaran
    'payment_uploaded',  -- bukti sudah diupload
    'confirmed',         -- seller konfirmasi
    'shopping',          -- anggota sedang belanja
    'ready',             -- sudah siap dikirim
    'delivering',        -- dalam pengiriman
    'delivered',         -- sudah terkirim
    'cancelled'          -- dibatalkan
  )),
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC(10,8),
  delivery_lng NUMERIC(11,8),
  delivery_notes TEXT,
  payment_method TEXT NOT NULL DEFAULT 'QRIS' CHECK (payment_method IN ('QRIS', 'TRANSFER', 'COD')),
  payment_proof_url TEXT,
  confirmed_by UUID REFERENCES profiles(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  price_at_order NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * price_at_order) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SHOPPING SESSIONS (rekap belanja harian)
-- ============================================================
CREATE TABLE shopping_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',     -- baru dibuat
    'assigned',  -- sudah di-assign ke anggota
    'shopping',  -- anggota sedang belanja
    'done'       -- selesai belanja
  )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORY ASSIGNMENTS (anggota → kategori)
-- ============================================================
CREATE TABLE category_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES shopping_sessions(id) ON DELETE CASCADE,
  anggota_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, category_id)   -- 1 kategori = 1 anggota per sesi
);

-- ============================================================
-- SHOPPING LIST ITEMS (daftar belanja per anggota)
-- ============================================================
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES shopping_sessions(id) ON DELETE CASCADE,
  anggota_id UUID REFERENCES profiles(id),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories(id),
  total_quantity NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL,
  is_purchased BOOLEAN NOT NULL DEFAULT false,
  actual_quantity NUMERIC(10,2),    -- qty aktual yang dibeli (bisa beda)
  purchase_price NUMERIC(12,2),     -- harga beli aktual di pasar
  notes TEXT,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DELIVERY BATCHES (gelombang pengiriman)
-- ============================================================
CREATE TABLE delivery_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES shopping_sessions(id),
  label TEXT,                        -- "Pengiriman Pagi", "Pengiriman Sore"
  assigned_to UUID REFERENCES profiles(id),  -- siapa yang antar
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'delivering', 'done'
  )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DELIVERY ITEMS (pesanan dalam sebuah batch)
-- ============================================================
CREATE TABLE delivery_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES delivery_batches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  delivery_sequence INT NOT NULL DEFAULT 0,   -- urutan pengiriman
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  delivered_at TIMESTAMPTZ,
  delivery_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STORE SETTINGS
-- ============================================================
CREATE TABLE store_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_shopping_list_session ON shopping_list_items(session_id);
CREATE INDEX idx_shopping_list_anggota ON shopping_list_items(anggota_id);
CREATE INDEX idx_delivery_items_batch ON delivery_items(batch_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_cutoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "Admins can manage profiles" ON profiles FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Anggota can view customer profiles" ON profiles FOR SELECT USING (get_user_role() = 'anggota' AND role = 'customer');

-- PRODUCTS policies (public read)
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Admin/Seller can manage products" ON products FOR ALL USING (get_user_role() IN ('admin', 'seller'));

-- CATEGORIES policies (public read)
CREATE POLICY "Anyone can view active categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage categories" ON categories FOR ALL USING (get_user_role() IN ('admin', 'seller'));

-- ORDERS policies
CREATE POLICY "Customer can view own orders" ON orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Customer can create orders" ON orders FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customer can update own pending orders" ON orders FOR UPDATE USING (
  auth.uid() = customer_id AND status = 'pending_payment'
) WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Seller/Admin can view all orders" ON orders FOR SELECT USING (get_user_role() IN ('seller', 'admin'));
CREATE POLICY "Seller/Admin can update orders" ON orders FOR UPDATE USING (get_user_role() IN ('seller', 'admin'));
CREATE POLICY "Anggota can view assigned orders" ON orders FOR SELECT USING (EXISTS (SELECT 1 FROM delivery_items JOIN delivery_batches ON delivery_batches.id = delivery_items.batch_id WHERE delivery_items.order_id = orders.id AND delivery_batches.assigned_to = auth.uid()));
CREATE POLICY "Anggota can update assigned orders" ON orders FOR UPDATE USING (EXISTS (SELECT 1 FROM delivery_items JOIN delivery_batches ON delivery_batches.id = delivery_items.batch_id WHERE delivery_items.order_id = orders.id AND delivery_batches.assigned_to = auth.uid()));

-- ORDER ITEMS policies
CREATE POLICY "Customer can view own order items" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY "Customer can insert order items" ON order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY "Seller/Admin can view all order items" ON order_items FOR SELECT USING (get_user_role() IN ('seller', 'admin'));
CREATE POLICY "Anggota can view assigned order items" ON order_items FOR SELECT USING (EXISTS (SELECT 1 FROM delivery_items JOIN delivery_batches ON delivery_batches.id = delivery_items.batch_id WHERE delivery_items.order_id = order_items.order_id AND delivery_batches.assigned_to = auth.uid()));

-- SHOPPING SESSIONS policies
CREATE POLICY "Seller/Admin can manage sessions" ON shopping_sessions FOR ALL USING (get_user_role() IN ('seller', 'admin'));
CREATE POLICY "Anggota can view sessions" ON shopping_sessions FOR SELECT USING (get_user_role() = 'anggota');

-- SHOPPING LIST ITEMS policies
CREATE POLICY "Anggota can view own list" ON shopping_list_items FOR SELECT USING (auth.uid() = anggota_id);
CREATE POLICY "Anggota can update own list" ON shopping_list_items FOR UPDATE USING (auth.uid() = anggota_id);
CREATE POLICY "Seller/Admin can manage shopping lists" ON shopping_list_items FOR ALL USING (get_user_role() IN ('seller', 'admin'));

-- DELIVERY policies
CREATE POLICY "Seller/Admin can manage delivery" ON delivery_batches FOR ALL USING (get_user_role() IN ('seller', 'admin'));
CREATE POLICY "Anggota can view assigned delivery" ON delivery_batches FOR SELECT USING (auth.uid() = assigned_to);
CREATE POLICY "Anggota can update assigned delivery" ON delivery_batches FOR UPDATE USING (auth.uid() = assigned_to) WITH CHECK (auth.uid() = assigned_to);
CREATE POLICY "Seller/Admin can manage delivery items" ON delivery_items FOR ALL USING (get_user_role() IN ('seller', 'admin'));
CREATE POLICY "Anggota can view assigned delivery items" ON delivery_items FOR SELECT USING (EXISTS (SELECT 1 FROM delivery_batches WHERE delivery_batches.id = delivery_items.batch_id AND delivery_batches.assigned_to = auth.uid()));
CREATE POLICY "Anggota can update assigned delivery items" ON delivery_items FOR UPDATE USING (EXISTS (SELECT 1 FROM delivery_batches WHERE delivery_batches.id = delivery_items.batch_id AND delivery_batches.assigned_to = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM delivery_batches WHERE delivery_batches.id = delivery_items.batch_id AND delivery_batches.assigned_to = auth.uid()));

-- STORE SETTINGS (admin only)
CREATE POLICY "Anyone can view store settings" ON store_settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON store_settings FOR ALL USING (get_user_role() = 'admin');

-- ORDER CUTOFFS
CREATE POLICY "Anyone can view cutoffs" ON order_cutoffs FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage cutoffs" ON order_cutoffs FOR ALL USING (get_user_role() IN ('admin', 'seller'));

-- ============================================================
-- SEED DATA
-- ============================================================

-- Categories
INSERT INTO categories (name, icon, color, sort_order) VALUES
  ('Sayuran Daun & Batang', '🥬', '#22c55e', 1),
  ('Cabe & Bumbu Segar', '🌶️', '#ef4444', 2),
  ('Daging & Ayam', '🍗', '#f97316', 3),
  ('Ikan & Seafood', '🐟', '#3b82f6', 4),
  ('Buah-buahan', '🍎', '#ec4899', 5),
  ('Bumbu Kering & Rempah', '🧄', '#a16207', 6),
  ('Tahu, Tempe & Telur', '🥚', '#eab308', 7),
  ('Lainnya', '🛒', '#6b7280', 8);

-- Default Order Cut-off
INSERT INTO order_cutoffs (label, cutoff_time, delivery_offset_days) VALUES
  ('Pengiriman Pagi Hari (H+1)', '20:00:00', 1),
  ('Pengiriman Siang Hari (H+1)', '22:00:00', 1);

-- Store Settings
INSERT INTO store_settings (key, value, description) VALUES
  ('store_name', 'SayurKu', 'Nama toko'),
  ('store_phone', '', 'Nomor WhatsApp toko'),
  ('store_address', '', 'Alamat toko'),
  ('qris_image_url', '', 'URL gambar QRIS untuk pembayaran'),
  ('min_order_amount', '15000', 'Minimum order dalam rupiah'),
  ('default_delivery_fee', '5000', 'Ongkir default dalam rupiah'),
  ('order_notes', 'Terima kasih sudah berbelanja di SayurKu! 🥦', 'Pesan default untuk customer');

-- ============================================================
-- FUNCTION: Generate Shopping List from Orders
-- ============================================================
CREATE OR REPLACE FUNCTION generate_shopping_list(p_session_id UUID, p_target_date DATE)
RETURNS VOID AS $$
BEGIN
  -- Clear existing items for this session
  DELETE FROM shopping_list_items WHERE session_id = p_session_id;

  -- Aggregate all order items for the target date
  INSERT INTO shopping_list_items (session_id, product_id, category_id, total_quantity, unit)
  SELECT
    p_session_id,
    oi.product_id,
    p.category_id,
    SUM(oi.quantity) as total_quantity,
    oi.unit
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  WHERE o.delivery_date = p_target_date
    AND o.status IN ('confirmed', 'shopping')
  GROUP BY oi.product_id, p.category_id, oi.unit;

  -- Auto-assign anggota based on category_assignments
  UPDATE shopping_list_items sli
  SET anggota_id = ca.anggota_id
  FROM category_assignments ca
  WHERE ca.session_id = p_session_id
    AND ca.category_id = sli.category_id
    AND sli.session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Get Profile by Phone (Bypasses RLS for login lookup)
-- ============================================================
CREATE OR REPLACE FUNCTION get_profile_by_phone(p_phone TEXT)
RETURNS TABLE (email TEXT, role TEXT, full_name TEXT, address TEXT) AS $$
BEGIN
  RETURN QUERY 
  SELECT p.email, p.role, p.full_name, p.address FROM profiles p WHERE p.phone = p_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: Auto-recalculate orders.total_price based on order_items
-- ============================================================
CREATE OR REPLACE FUNCTION update_order_total_price()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_total NUMERIC(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- Calculate the sum of subtotals (quantity * price_at_order)
  SELECT COALESCE(SUM(quantity * price_at_order), 0) INTO v_total
  FROM public.order_items
  WHERE order_id = v_order_id;

  -- Update total_price in orders table
  UPDATE public.orders
  SET total_price = v_total
  WHERE id = v_order_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_order_total_price ON public.order_items;

CREATE TRIGGER trigger_update_order_total_price
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION update_order_total_price();

