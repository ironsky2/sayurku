// ============================================================
// SayurKu - TypeScript Types
// ============================================================

export type UserRole = 'customer' | 'seller' | 'admin' | 'anggota'

export type OrderType = 'DIRECT' | 'PRE_ORDER'

export type OrderStatus =
  | 'pending_payment'
  | 'payment_uploaded'
  | 'confirmed'
  | 'shopping'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled'

export type ShoppingSessionStatus = 'draft' | 'assigned' | 'shopping' | 'done'

export type DeliveryStatus = 'pending' | 'delivering' | 'done'

export type DeliveryItemStatus = 'pending' | 'delivered' | 'failed'

export type PaymentMethod = 'QRIS' | 'TRANSFER' | 'COD'

// ============================================================

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  role: UserRole
  address: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  category_id: string | null
  name: string
  description: string | null
  image_url: string | null
  price_per_unit: number
  unit: string
  stock: number
  stock_unit: string | null
  is_available_today: boolean
  is_po_available: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // Joined
  category?: Category
}

export interface OrderCutoff {
  id: string
  label: string
  cutoff_time: string
  delivery_offset_days: number
  is_active: boolean
}

export interface Order {
  id: string
  customer_id: string
  order_type: OrderType
  cutoff_id: string | null
  delivery_date: string
  status: OrderStatus
  total_price: number
  delivery_address: string
  delivery_lat: number | null
  delivery_lng: number | null
  delivery_notes: string | null
  payment_method: PaymentMethod
  payment_proof_url: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
  // Joined
  customer?: Profile
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit: string
  price_at_order: number
  subtotal: number
  notes: string | null
  created_at: string
  // Joined
  product?: Product
}

export interface ShoppingSession {
  id: string
  target_date: string
  created_by: string
  status: ShoppingSessionStatus
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  category_assignments?: CategoryAssignment[]
  shopping_list_items?: ShoppingListItem[]
}

export interface CategoryAssignment {
  id: string
  session_id: string
  anggota_id: string
  category_id: string
  created_at: string
  // Joined
  anggota?: Profile
  category?: Category
}

export interface ShoppingListItem {
  id: string
  session_id: string
  anggota_id: string | null
  product_id: string
  category_id: string | null
  total_quantity: number
  unit: string
  is_purchased: boolean
  actual_quantity: number | null
  purchase_price: number | null
  notes: string | null
  purchased_at: string | null
  created_at: string
  // Joined
  product?: Product
  category?: Category
  anggota?: Profile
}

export interface DeliveryBatch {
  id: string
  session_id: string | null
  label: string | null
  assigned_to: string | null
  status: DeliveryStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
  // Joined
  assigned_profile?: Profile
  delivery_items?: DeliveryItem[]
}

export interface DeliveryItem {
  id: string
  batch_id: string
  order_id: string
  delivery_sequence: number
  status: DeliveryItemStatus
  delivered_at: string | null
  delivery_notes: string | null
  created_at: string
  // Joined
  order?: Order
}

export interface StoreSetting {
  id: string
  key: string
  value: string | null
  description: string | null
  updated_at: string
}

// ============================================================
// Cart Types (client-side only, not stored in DB)
// ============================================================

export interface CartItem {
  product: Product
  quantity: number
  notes?: string
}

export interface Cart {
  items: CartItem[]
  total: number
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export type OrderStatusLabel = {
  [key in OrderStatus]: string
}

export const ORDER_STATUS_LABELS: OrderStatusLabel = {
  pending_payment: 'Menunggu Pembayaran',
  payment_uploaded: 'Bukti Dikirim',
  confirmed: 'Dikonfirmasi',
  shopping: 'Sedang Dibelanjakan',
  ready: 'Siap Dikirim',
  delivering: 'Dalam Pengiriman',
  delivered: 'Terkirim',
  cancelled: 'Dibatalkan',
}

export const ORDER_STATUS_COLORS: { [key in OrderStatus]: string } = {
  pending_payment: 'yellow',
  payment_uploaded: 'blue',
  confirmed: 'green',
  shopping: 'orange',
  ready: 'teal',
  delivering: 'purple',
  delivered: 'green',
  cancelled: 'red',
}
