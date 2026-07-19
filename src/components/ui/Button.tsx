'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer'

  const variants = {
    primary:
      'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30 hover:shadow-green-800/40',
    secondary:
      'bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600',
    ghost: 'hover:bg-slate-800 text-slate-300 hover:text-white',
    danger:
      'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30',
    outline:
      'border border-green-600/50 text-green-400 hover:bg-green-600/10',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
