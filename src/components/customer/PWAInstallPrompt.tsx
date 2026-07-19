'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    // Check if already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches
    if (isInstalled) return

    // Check if already dismissed
    const dismissed = localStorage.getItem('sayurku-pwa-dismissed')
    if (dismissed) return

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    if (ios) {
      // Show iOS guide after 3 seconds
      setTimeout(() => setShowBanner(true), 3000)
      return
    }

    // Listen for beforeinstallprompt (Android/Desktop)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShowBanner(true), 2000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('sayurku-pwa-dismissed', '1')
  }

  const handleIOSInstall = () => {
    setShowIOSGuide(true)
  }

  if (!showBanner) return null

  return (
    <>
      {/* Install Banner */}
      <div className="fixed bottom-20 left-4 right-4 z-50 max-w-lg mx-auto">
        <div className="bg-slate-900 border border-green-500/30 rounded-2xl p-4 shadow-2xl shadow-black/50 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center text-2xl flex-shrink-0">
            🥬
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Install SayurKu</p>
            <p className="text-xs text-slate-400 mt-0.5">Akses langsung dari layar utama HP kamu!</p>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {isIOS ? (
              <button
                onClick={handleIOSInstall}
                className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
              >
                Cara Install
              </button>
            ) : (
              <button
                onClick={handleInstall}
                className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
              >
                Install
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="text-slate-500 text-xs text-center hover:text-slate-300"
            >
              Nanti saja
            </button>
          </div>
        </div>
      </div>

      {/* iOS Install Guide Modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end px-4 pb-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white mb-4">Install SayurKu di iPhone</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <p className="text-sm text-slate-300">Tekan tombol <strong className="text-white">Share</strong> (icon kotak dengan panah ke atas) di browser Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <p className="text-sm text-slate-300">Scroll ke bawah dan pilih <strong className="text-white">Add to Home Screen</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <p className="text-sm text-slate-300">Tekan <strong className="text-white">Add</strong> di pojok kanan atas</p>
              </div>
            </div>
            <button
              onClick={() => { setShowIOSGuide(false); handleDismiss() }}
              className="w-full mt-4 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl transition-all"
            >
              Mengerti!
            </button>
          </div>
        </div>
      )}
    </>
  )
}
