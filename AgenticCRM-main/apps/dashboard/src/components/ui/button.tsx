import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-signal text-primary-foreground hover:bg-signal/90 shadow-glow',
        secondary: 'border border-line-strong bg-raised text-ink hover:bg-overlay',
        ghost: 'text-ink-dim hover:bg-raised hover:text-ink',
        danger: 'bg-negative/15 text-negative hover:bg-negative/25',
      },
      size: { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4 text-sm', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props }, ref,
) {
  return <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...props} />;
});
