/**
 * Input Field
 * Used on Login screens
 * States: Default, Hover, Focus, Error
 */

import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'text' | 'password' | 'email';
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
  name?: string;
  autoComplete?: string;
  autoCapitalize?: InputHTMLAttributes<HTMLInputElement>['autoCapitalize'];
  spellCheck?: boolean;
  'aria-describedby'?: string;
  trailing?: ReactNode;
}

export function InputField({ 
  value, 
  onChange, 
  placeholder = "Input Field",
  error = false,
  disabled = false, 
  className = "",
  type = 'text',
  onKeyDown,
  id,
  name,
  autoComplete,
  autoCapitalize,
  spellCheck,
  'aria-describedby': describedBy,
  trailing,
}: InputFieldProps) {
  return (
    <div className={`relative w-full ${className}`}>
      <input
        id={id}
        name={name}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        aria-describedby={describedBy}
        aria-invalid={error || undefined}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          bg-black
          content-stretch flex items-center justify-center 
          px-[20px] py-[19px] 
          relative rounded-[10px] 
          w-full
          font-normal leading-[normal] text-[24px] text-white
          border-2 border-solid border-[var(--shapeships-grey-70)]
          focus:border-white
          hover:border-[var(--shapeships-grey-50)]
          disabled:opacity-50 disabled:cursor-not-allowed
          outline-none
          placeholder:text-white
          ${trailing ? 'pr-[60px]' : ''}
          ${error ? '!border-[var(--shapeships-pastel-red)]' : ''}
        `}
      />
      {trailing && (
        <div className="absolute right-[20px] top-1/2 flex -translate-y-1/2 items-center">
          {trailing}
        </div>
      )}
    </div>
  );
}
