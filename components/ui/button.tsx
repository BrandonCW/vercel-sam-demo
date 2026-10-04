import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-[#14233b] text-white hover:bg-[#213858] shadow-sm',
  secondary: 'bg-white text-[#14233b] hover:bg-[#edf2f8] shadow-sm',
  outline: 'border border-[#dfe5ed] bg-white text-[#152238] hover:bg-[#f8fafc]',
  ghost: 'hover:bg-black/5 text-[#52647b]',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  link: 'text-[#477fb8] underline-offset-4 hover:underline',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-10 px-6 text-base',
  icon: 'h-9 w-9 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fc2e1] disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
