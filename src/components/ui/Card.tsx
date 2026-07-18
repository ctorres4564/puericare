import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adiciona padding interno padrão */
  padded?: boolean;
}

export function Card({ children, className = '', padded = true }: CardProps) {
  return (
    <div
      className={`
        rounded-xl border bg-[var(--color-bg-card)]
        border-[var(--color-border)]
        shadow-[var(--shadow-md)]
        ${padded ? 'p-6' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function CardHeader({ title, description, children }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
