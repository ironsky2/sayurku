import { BottomNav } from '@/components/customer/BottomNav'
import { FloatingCartBar } from '@/components/customer/FloatingCartBar'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      <main className="pb-20 max-w-lg mx-auto">{children}</main>
      <FloatingCartBar />
      <BottomNav />
    </div>
  )
}
