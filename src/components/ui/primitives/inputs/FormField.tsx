import type { ReactNode } from 'react';

export interface FormFieldProps {
  htmlFor: string;
  messageId: string;
  label: ReactNode;
  hint: ReactNode;
  error?: string;
  children: ReactNode;
}

export function FormField({ htmlFor, messageId, label, hint, error, children }: FormFieldProps) {
  return (
    <div className="flex w-full flex-col gap-[12px] md:gap-[20px]">
      <label htmlFor={htmlFor} className="text-[20px] font-bold leading-normal md:text-[24px]">
        {label}
      </label>
      {children}
      <div
        id={messageId}
        aria-live="polite"
        className={`text-[14px] font-normal leading-[20px] md:text-[16px] md:leading-[22px] ${error ? 'text-[var(--shapeships-pastel-red)]' : 'text-white'}`}
      >
        {error || hint}
      </div>
    </div>
  );
}
