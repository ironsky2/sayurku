import { cn } from '@/lib/utils'
import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

export function Input({
  label,
  error,
  hint,
  icon,
  iconRight,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-xl bg-slate-800/80 border text-slate-100 placeholder-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50',
            'transition-all duration-200 text-sm',
            'py-3 px-4',
            icon && 'pl-10',
            iconRight && 'pr-10',
            error
              ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
              : 'border-slate-700/50',
            className
          )}
          {...props}
        />
        {iconRight && (
          <div className="absolute right-3 text-slate-400">{iconRight}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          'w-full rounded-xl bg-slate-800/80 border text-slate-100 placeholder-slate-500',
          'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50',
          'transition-all duration-200 text-sm py-3 px-4 resize-none',
          error ? 'border-red-500/50' : 'border-slate-700/50',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
