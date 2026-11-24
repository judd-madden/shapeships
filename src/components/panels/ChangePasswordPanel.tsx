import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { confirmationError, isPasswordChangeEnabled, mapPasswordChangeError } from '../../game/client/account/changePasswordForm';
import { passwordCodePointLength } from '../../game/client/account/claimNameForm';
import { DISCORD_URL, type EntryAccountActions, type PasswordChangeContext } from '../../game/client/account/entryForm';
import { FormField } from '../ui/primitives/inputs/FormField';
import { PasswordInput } from '../ui/primitives/inputs/PasswordInput';
import { MenuButton } from '../ui/primitives/buttons/MenuButton';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../ui/turnstile/TurnstileWidget';

interface ChangePasswordPanelProps {
  context: PasswordChangeContext;
  actions: EntryAccountActions;
  onEntered(): void;
  onCancel(): void;
  onEntryError(code: string, captchaRequired: boolean): void;
  onBusyChange(busy: boolean): void;
  onAttempt(): void;
}

export function ChangePasswordPanel({ context, actions, onEntered, onCancel, onEntryError, onBusyChange, onAttempt }: ChangePasswordPanelProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [feedback, setFeedback] = useState<{ password?: string; form?: string }>({});
  const [captchaRequired, setCaptchaRequired] = useState(context.captchaRequired);
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(false);
  const busy = useRef(false);
  const widgetRef = useRef<TurnstileWidgetHandle>(null);
  const latest = useRef({ actions, onEntered, onEntryError, onBusyChange, onAttempt });
  latest.current = { actions, onEntered, onEntryError, onBusyChange, onAttempt };
  const id = useId();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; latest.current.onBusyChange(false); };
  }, []);
  const passwordError = passwordCodePointLength(password) > 128 ? 'Use 128 characters or fewer.' : feedback.password;
  const mismatch = confirmationError(password, confirm, attempted);
  const enabled = isPasswordChangeEnabled({ password, confirm, captchaRequired, token, submitting });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!enabled || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setFeedback({});
    latest.current.onBusyChange(true);
    latest.current.onAttempt();
    try {
      const result = await latest.current.actions.changePassword({ name: context.name,
        currentPassword: context.temporaryPassword, newPassword: password, ...(token ? { turnstileToken: token } : {}) });
      if (!mounted.current) return;
      if (result.kind === 'ok') {
        setPassword(''); setConfirm('');
        latest.current.onEntered();
        return;
      }
      setToken(null);
      widgetRef.current?.reset();
      if (result.kind === 'error') {
        const next = mapPasswordChangeError(result.error);
        if (next.entryCode) {
          setPassword(''); setConfirm('');
          latest.current.onEntryError(next.entryCode, captchaRequired);
          return;
        }
        if (result.error.code === 'CAPTCHA_REQUIRED') setCaptchaRequired(true);
        setFeedback(next);
      }
    } catch {
      if (mounted.current) {
        setFeedback(mapPasswordChangeError({ code: 'ACCOUNT_SERVICE_UNAVAILABLE' }));
        setToken(null);
        widgetRef.current?.reset();
      }
    } finally {
      if (mounted.current) {
        busy.current = false; setSubmitting(false); latest.current.onBusyChange(false);
      }
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="mx-auto flex w-full max-w-[520px] flex-col gap-[32px] text-white md:gap-[56px] xl:max-w-[958px]">
      <div className="flex flex-col gap-[16px] text-center md:text-left">
        <h2 id={`${id}-heading`} className="text-[24px] font-black leading-[28px] sm:text-[36px] sm:leading-[42px]">Choose a New Password</h2>
        <p className="text-[15px] leading-[18px] sm:text-[20px] sm:leading-[24px]">Your password was reset. Set a new one to continue.</p>
      </div>
      <div className="flex w-full flex-col items-center gap-[32px] md:items-start md:gap-[48px] xl:grid xl:grid-cols-[minmax(300px,520fr)_2px_minmax(0,340fr)] xl:items-stretch xl:gap-x-[48px] xl:gap-y-0">
        <form onSubmit={(event) => { void submit(event); }} onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
            event.preventDefault(); void submit(event);
          }
        }} aria-busy={submitting} className="flex w-full max-w-[520px] min-w-0 flex-col">
          <div className="flex flex-col gap-[28px] md:gap-[44px]">
            <FormField htmlFor={`${id}-new`} messageId={`${id}-new-message`} label="New password"
              hint={<>10+ characters, case sensitive.<br />Password resets are via Discord.</>} error={passwordError}>
              <PasswordInput id={`${id}-new`} name="new-password" value={password} placeholder="New password" autoComplete="new-password"
                error={Boolean(passwordError)} aria-describedby={`${id}-new-message`} disabled={submitting}
                onChange={(value) => { setPassword(value); setFeedback((previous) => ({ ...previous, password: undefined })); }} />
            </FormField>
            <FormField htmlFor={`${id}-confirm`} messageId={`${id}-confirm-message`} label="Confirm new password" hint="" error={mismatch}>
              <PasswordInput id={`${id}-confirm`} name="confirm-new-password" value={confirm} placeholder="Confirm new password" autoComplete="new-password"
                error={Boolean(mismatch)} aria-describedby={`${id}-confirm-message`} disabled={submitting} onChange={setConfirm}
                onBlur={() => { if (password && confirm) setAttempted(true); }} />
            </FormField>
          </div>
          {captchaRequired && <div className="mt-[28px] md:mt-[44px]"><TurnstileWidget ref={widgetRef} action="sign-in"
            onTokenChange={setToken} onUnavailable={() => setFeedback({ form: "Verification isn't available right now. Please try again later." })} /></div>}
          <div className="mt-[28px] flex flex-col items-center gap-[20px] md:mt-[42px] md:items-start">
            {feedback.form && <p role="status" aria-live="polite" className="text-[16px] leading-[22px] text-[var(--shapeships-pastel-red)]">{feedback.form}</p>}
            <MenuButton variant="private" disabled={!enabled}>{submitting ? 'SAVING...' : 'SAVE PASSWORD'}</MenuButton>
            <button type="button" disabled={submitting} onClick={() => {
              if (busy.current) return;
              setPassword(''); setConfirm(''); setToken(null); onCancel();
            }} className="cursor-pointer underline disabled:cursor-default">Use a different name</button>
          </div>
        </form>
        <div aria-hidden="true" className="h-[2px] w-full max-w-[520px] bg-shapeships-grey-70 xl:h-auto xl:w-[2px]" />
        <div className="flex w-full max-w-[520px] min-w-0 flex-col gap-[12px] text-[15px] leading-[20px] md:gap-[20px] md:text-[18px] md:leading-[24px] xl:max-w-[340px]">
          <p className="font-bold">Signing in as {context.displayName}</p>
          <p>You signed in with a temporary password. Choose a new one to finish. Your name and settings stay the same.</p>
          <p>Need help? Message juddly on <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="underline">Discord</a>.</p>
        </div>
      </div>
    </section>
  );
}
