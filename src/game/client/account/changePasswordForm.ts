import { passwordCodePointLength } from './claimNameForm';
import { mapEntryError } from './entryForm';
import type { AccountOperationError } from './types';

export function confirmationError(password: string, confirm: string, attempted: boolean): string | undefined {
  return attempted && password && confirm && password !== confirm ? "Passwords don't match." : undefined;
}

export function isPasswordChangeEnabled({ password, confirm, captchaRequired, token, submitting }: {
  password: string; confirm: string; captchaRequired: boolean; token: string | null; submitting: boolean;
}): boolean {
  const length = passwordCodePointLength(password);
  return length >= 10 && length <= 128 && password === confirm && !submitting && (!captchaRequired || Boolean(token));
}

export function mapPasswordChangeError(error: AccountOperationError): { password?: string; form?: string; entryCode?: string } {
  switch (error.code) {
    case 'INVALID_PASSWORD': return { password: 'Use 10–128 characters.' };
    case 'PASSWORD_UNCHANGED': return { password: 'Choose a different password from your temporary one.' };
    case 'INVALID_CREDENTIALS':
    case 'ACCOUNT_BLOCKED':
    case 'NAME_BANNED': return { entryCode: error.code };
    default: {
      const message = mapEntryError(error, '');
      return { form: `${message.title} ${error.code === 'CAPTCHA_REQUIRED' ? 'Then press SAVE PASSWORD again.' : message.detail}` };
    }
  }
}
