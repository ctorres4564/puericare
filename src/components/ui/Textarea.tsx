import React, { TextareaHTMLAttributes, forwardRef, useId } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id: propId, rows = 3, ...rest }, ref) => {
    const generatedId = useId();
    const id = propId ?? generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const describedBy = [error ? errorId : '', hint ? hintId : '']
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {label}
          </label>
        )}

        <textarea
          id={id}
          ref={ref}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={`rounded-md border px-3 py-2 text-sm shadow-sm transition-colors
            focus:outline-none focus:ring-2 focus:ring-offset-1
            disabled:cursor-not-allowed disabled:opacity-50
            ${error
              ? 'border-red-400 focus:ring-red-400'
              : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]'
            }
            bg-[var(--color-bg-card)] text-[var(--color-text)]
            placeholder:text-[var(--color-text-subtle)]
            ${className}`}
          {...rest}
        />

        {error && (
          <p id={errorId} role="alert" className="text-xs text-red-500">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
