import { ProductCard } from '@/components/customer/ProductCard'
import { Category, Product } from '@/lib/types'
import { Search } from 'lucide-react'

interface ProductsPageProps {
  searchParams: Promise<{ category?: string; filter?: string; q?: string }>
}

async function getProductsData(category?: string, filter?: string, q?: string) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    let query = supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('is_active', true)
      .order('sort_order')

    if (category) query = query.eq('category_id', category)
    if (filter === 'today') query = query.eq('is_available_today', true)
    if (filter === 'po') query = query.eq('is_po_available', true)
    if (q) query = query.ilike('name', `%${q}%`)

    const { data: products } = await query
    return { categories: categories || [], products: products || [] }
  } catch {
    return { categories: [], products: [] }
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category, filter, q } = await searchParams
  const { categories, products } = await getProductsData(category, filter, q)

  const selectedCategory = categories?.find((c: Category) => c.id === category)

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-700/50 px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold text-white mb-3">
          {selectedCategory ? selectedCategory.name : 'Semua Produk'}
        </h1>

        {/* Search */}
        <form action="/products" method="get" className="relative">
          {category && <input type="hidden" name="category" value={category} />}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari sayuran..."
              className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>
        </form>

        {/* Category Filter Chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
          <a
            href="/products"
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !category && !filter
                ? 'bg-green-600 text-white border-green-600'
                : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            Semua
          </a>
          <a
            href="/products?filter=today"
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === 'today'
                ? 'bg-green-600 text-white border-green-600'
                : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            🟢 Tersedia Hari Ini
          </a>
          <a
            href="/products?filter=po"
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === 'po'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            🕐 Pre-Order
          </a>
          {(categories as Category[]).map((cat) => (
            <a
              key={cat.id}
              href={`/products?category=${cat.id}`}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                category === cat.id
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {cat.icon} {cat.name.split(' ')[0]}
            </a>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 py-5">
        {products && products.length > 0 ? (
          <>
            <p className="text-xs text-slate-500 mb-4">
              {products.length} produk ditemukan
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(products as (Product & { category: Category })[]).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">🥬</span>
            <h3 className="text-base font-bold text-white mb-2">
              {products.length === 0 && !category && !filter && !q
                ? 'Produk Belum Tersedia'
                : 'Produk tidak ditemukan'}
            </h3>
            <p className="text-slate-500 text-sm">
              {products.length === 0 && !category && !filter && !q
                ? 'Hubungkan Supabase untuk melihat produk'
                : 'Coba kata kunci atau filter yang berbeda'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
