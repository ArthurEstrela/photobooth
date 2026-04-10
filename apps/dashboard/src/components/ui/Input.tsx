import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descId = error ? `${inputId}-desc` : hint ? `${inputId}-desc` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-describedby={descId}
        aria-invalid={error ? true : undefined}
        className={`w-full px-3 py-2 text-sm border rounded-xl outline-none transition-all
          ${error
            ? 'border-red-400 focus:ring-2 focus:ring-red-200'
            : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
          }
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${className}`}
        {...props}
      />
      {error && <p id={descId} className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p id={descId} className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
};
