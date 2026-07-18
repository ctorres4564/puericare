import React, { ReactNode } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const config: Record<AlertVariant, { icon: string; classes: string }> = {
  info: {
    icon: 'ℹ️',
    classes: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
  },
  success: {
    icon: '✅',
    classes: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200',
  },
  warning: {
    icon: '⚠️',
    classes: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
  },
  error: {
    icon: '❌',
    classes: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
  },
};

export function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  const { icon, classes } = config[variant];
  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-lg border p-3 text-sm ${classes} ${className}`}
    >
      <span className="mt-0.5 shrink-0 text-base leading-none">{icon}</span>
      <div>
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
