import React from 'react';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'neutral' | 'primary';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700',
  error:   'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  neutral: 'bg-gray-100 text-gray-600',
  primary: 'bg-primary-light text-primary',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}
  >
    {children}
  </span>
);
