import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  id,
  className = '',
  ...props
}) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descId = error ? `${inputId}-desc` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={inputId}
          aria-describedby={descId}
          aria-invalid={error ? true : undefined}
          className={`w-full appearance-none px-3 py-2 pr-9 text-sm border rounded-xl outline-none transition-all bg-white
            ${error
              ? 'border-red-400 focus:ring-2 focus:ring-red-200'
              : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
            }
            disabled:bg-gray-50 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>
      {error && <p id={descId} className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
