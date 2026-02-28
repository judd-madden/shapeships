/**
 * Input Field
 * Used on Login screens
 * States: Default, Hover, Focus, Error
 */

interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'text' | 'password' | 'email';
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function InputField({ 
  value, 
  onChange, 
  placeholder = "Input Field",
  error = false,
  disabled = false, 
  className = "",
  type = 'text',
  onKeyDown
}: InputFieldProps) {
  return (
    <div className={`relative w-full ${className}`}>
      <input
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
          font-['Roboto'] font-normal leading-[normal] text-[24px] text-white
          border-2 border-solid border-[#555555]
          focus:border-white
          hover:border-[#888888]
          disabled:opacity-50 disabled:cursor-not-allowed
          outline-none
          placeholder:text-white
          ${error ? '!border-[#FF8282]' : ''}
        `}
        style={{ 
          fontVariationSettings: "'wdth' 100"
        }}
      />
    </div>
  );
}