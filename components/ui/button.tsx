import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-[#0F52BA] text-[#FFFFFF] hover:bg-[#0C4196] active:scale-[0.98]',
  secondary: 'border border-[#E2E0D8] bg-[#FFFFFF] text-[#111215] hover:bg-[#F1F0EC]',
  outline: 'border border-[#E2E0D8] bg-[#FFFFFF] text-[#111215] hover:bg-[#F1F0EC]',
  ghost: 'hover:bg-[#F1F0EC] text-[#52545D] hover:text-[#111215]',
  destructive: 'border border-[#111215] bg-[#FFFFFF] text-[#111215] hover:bg-[#F1F0EC]',
  link: 'text-[#111215] underline-offset-4 hover:underline',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'min-h-9 px-4 py-2 text-sm',
  sm: 'min-h-8 px-3 py-1.5 text-xs',
  lg: 'min-h-10 px-6 py-2.5 text-base',
  icon: 'min-h-9 min-w-9 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111215] disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
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
