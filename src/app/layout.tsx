import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/context/AuthContext'
import { CartProvider } from '@/lib/context/CartContext'
import { ThemeProvider } from '@/lib/context/ThemeContext'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'SayurKu — Belanja Sayur Segar Online',
  description: 'Platform belanja sayur segar online dengan pengiriman langsung ke rumah. Pesan sekarang atau Pre-Order untuk besok!',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SayurKu',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  keywords: ['sayur', 'belanja sayur', 'sayur segar', 'delivery sayur', 'online grocery'],
  openGraph: {
    title: 'SayurKu — Belanja Sayur Segar Online',
    description: 'Platform belanja sayur segar online dengan pengiriman langsung ke rumah.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Blocking script: sets data-theme BEFORE first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sayurku-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <CartProvider>
            <ThemeProvider>
              {children}
              <Toaster
                position="top-center"
                toastOptions={{
                  style: {
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '14px',
                  },
                  success: {
                    iconTheme: { primary: '#22c55e', secondary: '#0f172a' },
                  },
                  error: {
                    iconTheme: { primary: '#ef4444', secondary: '#0f172a' },
                  },
                }}
              />
            </ThemeProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
