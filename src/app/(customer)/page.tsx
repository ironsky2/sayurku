import { ProductCard } from '@/components/customer/ProductCard'
import { Category, Product } from '@/lib/types'
import Link from 'next/link'
import { ChevronRight, Sparkles, Clock, Leaf } from 'lucide-react'

async function getHomeData() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const [{ data: categories }, { data: featuredProducts }, { data: poProducts }] = await Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('products').select('*, category:categories(*)').eq('is_active', true).eq('is_available_today', true).order('sort_order').limit(6),
      supabase.from('products').select('*, category:categories(*)').eq('is_active', true).eq('is_po_available', true).eq('is_available_today', false).order('sort_order').limit(4),
    ])

    return { categories: categories || [], featuredProducts: featuredProducts || [], poProducts: poProducts || [] }
  } catch {
    return { categories: [], featuredProducts: [], poProducts: [] }
  }
}

export default async function HomePage() {
  const { categories, featuredProducts, poProducts } = await getHomeData()

  return (
    <div className="fade-in">
      {/* Hero Section */}
      <div
        className="relative overflow-hidden px-5 pt-12 pb-8"
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-green-500/5 rounded-full blur-3xl -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/5 rounded-full blur-2xl translate-y-8 -translate-x-8" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="pulse-dot" />
            <span className="text-green-700 text-xs font-bold uppercase tracking-wider">
              Segar Setiap Hari
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight mb-2">
            Sayuran Segar 🥬
            <br />
            <span className="gradient-text">Langsung ke Rumahmu</span>
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">
            Pesan sayur segar pilihan petani lokal. Tersedia setiap hari
            dengan harga terjangkau!
          </p>

          {/* Quick stats */}
          <div className="flex gap-3">
            {[
              { icon: Leaf, label: 'Segar Setiap Hari' },
              { icon: Clock, label: 'PO Tersedia' },
              { icon: Sparkles, label: 'Kualitas Terjamin' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 border border-green-200/60 shadow-sm"
              >
                <stat.icon className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs text-slate-700 font-semibold whitespace-nowrap">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 space-y-7 py-6">
        {/* Categories */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Kategori</h2>
            <Link
              href="/products"
              className="text-xs text-green-400 hover:text-green-300 flex items-center gap-0.5"
            >
              Lihat semua <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide no-scrollbar">
            <Link
              href="/products"
              className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 min-w-[72px] hover:border-green-500/50 transition-all"
            >
              <span className="text-2xl">🛒</span>
              <span className="text-[10px] text-slate-400 font-medium text-center">Semua</span>
            </Link>
            {(categories as Category[] || []).map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.id}`}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 min-w-[72px] hover:border-green-500/50 transition-all"
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-[10px] text-slate-400 font-medium text-center line-clamp-2 leading-tight">
                  {cat.name.split(' ')[0]}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Available Today */}
        {featuredProducts && featuredProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Tersedia Hari Ini</h2>
                <p className="text-xs text-slate-500 mt-0.5">Langsung pesan, langsung disiapkan</p>
              </div>
              <Link href="/products?filter=today" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-0.5">
                Semua <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(featuredProducts as (Product & { category: Category })[]).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Pre-Order */}
        {poProducts && poProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Pre-Order</h2>
                <p className="text-xs text-slate-500 mt-0.5">Pesan sekarang, terima besok</p>
              </div>
              <Link href="/products?filter=po" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-0.5">
                Semua <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(poProducts as (Product & { category: Category })[]).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {(!featuredProducts || featuredProducts.length === 0) &&
          (!poProducts || poProducts.length === 0) && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="text-6xl mb-4">🥬</span>
              <h3 className="text-lg font-bold text-white mb-2">Toko Sedang Disiapkan</h3>
              <p className="text-slate-500 text-sm">
                Produk akan segera tersedia. Pantau terus ya!
              </p>
            </div>
          )}

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>
    </div>
  )
}
