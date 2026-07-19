import { BottomNav } from '@/components/customer/BottomNav'
import { FloatingCartBar } from '@/components/customer/FloatingCartBar'
import { PWAInstallPrompt } from '@/components/customer/PWAInstallPrompt'
import Script from 'next/script'

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
      <PWAInstallPrompt />
      <Script
        id="register-sw"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
              })
            }
          `,
        }}
      />
    </div>
  )
}
