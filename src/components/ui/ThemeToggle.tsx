'use client'

import { useTheme } from '@/lib/context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-slate-800/60 border-slate-700/50 text-amber-400 hover:bg-slate-700/60'
          : 'bg-amber-50 border-amber-200/60 text-amber-600 hover:bg-amber-100'
      } ${className}`}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4" />
          <span className="text-xs font-semibold hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4" />
          <span className="text-xs font-semibold hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  )
}
