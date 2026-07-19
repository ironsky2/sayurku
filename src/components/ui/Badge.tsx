import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'yellow' | 'blue' | 'orange' | 'purple' | 'red' | 'teal' | 'gray'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ variant = 'gray', children, className, dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full',
        `badge-${variant}`,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            {
              'bg-green-400': variant === 'green' || variant === 'teal',
              'bg-yellow-400': variant === 'yellow',
              'bg-blue-400': variant === 'blue',
              'bg-orange-400': variant === 'orange',
              'bg-purple-400': variant === 'purple',
              'bg-red-400': variant === 'red',
              'bg-slate-400': variant === 'gray',
            }
          )}
        />
      )}
      {children}
    </span>
  )
}
