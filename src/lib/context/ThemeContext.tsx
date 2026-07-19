'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  mounted: false,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  // Only runs after hydration — safe to access localStorage & DOM
  useEffect(() => {
    try {
      const saved = (localStorage.getItem('sayurku-theme') as Theme) || 'dark'
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    } catch (_) {}
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    if (!mounted) return
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('sayurku-theme', next)
      document.documentElement.setAttribute('data-theme', next)
    } catch (_) {}
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
