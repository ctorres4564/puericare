import React, { InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Mensagem de erro de validação */
  error?: string;
  /** Texto auxiliar abaixo do campo */
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id: propId, ...rest }, ref) => {
    const generatedId = useId();
    const id = propId ?? generatedId;
    const errorId = `${id}-error`;
    const hintId  = `${id}-hint`;

    const describedBy = [
      error ? errorId : '',
      hint  ? hintId  : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium"
            style={{ color: 'var(--color-text)' }}
          >
            {label}
          </label>
        )}

        <input
          id={id}
          ref={ref}
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

Input.displayName = 'Input';
