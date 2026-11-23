import { useState } from 'react';
import { InputField, type InputFieldProps } from './InputField';
import { VisibilityIcon } from '../icons/VisibilityIcon';
import { VisibilityOffIcon } from '../icons/VisibilityOffIcon';

export type PasswordInputProps = Omit<InputFieldProps, 'type' | 'trailing'>;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? VisibilityOffIcon : VisibilityIcon;
  return (
    <InputField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={(
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={props.disabled}
          onClick={() => setVisible((value) => !value)}
          className="flex size-[24px] cursor-pointer items-center justify-center text-white disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-shapeships-pastel-purple"
        >
          <Icon className="size-[24px]" />
        </button>
      )}
    />
  );
}
