/** Entry form only. Account/session requests are supplied by the client runtime. */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createNameCheckScheduler } from '../../game/client/account/nameCheckScheduler';
import type { NameCheckResult } from '../../game/client/account/claimNameForm';
import {
  DISCORD_URL, ENTRY_NAME_ERROR, entryState, isEntryEnabled, resolveEntryPlay,
  type EntryAccountActions, type EntryNotice, type EntryResult, type PasswordChangeContext,
} from '../../game/client/account/entryForm';
import type { AccountOperationError } from '../../game/client/account/types';
import { InputField } from '../ui/primitives/inputs/InputField';
import { PasswordInput } from '../ui/primitives/inputs/PasswordInput';
import { PrimaryButton } from '../ui/primitives/buttons/PrimaryButton';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../ui/turnstile/TurnstileWidget';

interface AlphaEntryPanelProps {
  actions: EntryAccountActions;
  notice: EntryNotice | null;
  initialCaptchaRequired?: boolean;
  rememberedUnavailable: boolean;
  onNoticeConsumed(): void;
  onPlay(name: string): Promise<EntryResult>;
  onEntered(): void;
  onPasswordChange(context: PasswordChangeContext): void;
  onBusyChange(busy: boolean): void;
  onAttempt(): void;
  primaryButtonLabel?: string;
}

export function AlphaEntryPanel({ actions, notice, initialCaptchaRequired = false, rememberedUnavailable,
  onNoticeConsumed, onPlay, onEntered, onPasswordChange, onBusyChange, onAttempt,
  primaryButtonLabel = 'PLAY' }: AlphaEntryPanelProps) {
  const [name, setName] = useState(notice?.name ?? '');
  const [password, setPassword] = useState('');
  const [lookup, setLookup] = useState<NameCheckResult>(null);
  const [error, setError] = useState<AccountOperationError | undefined>(notice ? { code: notice.code } : undefined);
  const [captchaRequired, setCaptchaRequired] = useState(initialCaptchaRequired);
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [focusPassword, setFocusPassword] = useState(Boolean(notice?.code === 'INVALID_CREDENTIALS'));
  const schedulerRef = useRef<ReturnType<typeof createNameCheckScheduler> | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<TurnstileWidgetHandle>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const openingName = useRef(name);
  const latest = useRef({ actions, onPlay, onEntered, onPasswordChange, onBusyChange, onAttempt, onNoticeConsumed });
  latest.current = { actions, onPlay, onEntered, onPasswordChange, onBusyChange, onAttempt, onNoticeConsumed };
  const id = useId();
  const state = entryState(name, lookup, error);
  const enabled = isEntryEnabled({ name, mode: state.mode, password, captchaRequired, token,
    submitting: submitting || retrying, formatError: state.formatError });

  useEffect(() => {
    mounted.current = true;
    const scheduler = createNameCheckScheduler({
      checkName: (value) => latest.current.actions.checkName(value),
      invalidate: () => latest.current.actions.invalidateNameChecks(),
      onResult: (_value, result) => setLookup(result),
    });
    schedulerRef.current = scheduler;
    scheduler.open(openingName.current);
    latest.current.onNoticeConsumed();
    return () => {
      mounted.current = false;
      scheduler.dispose();
      schedulerRef.current = null;
      latest.current.onBusyChange(false);
    };
  }, []);

  useEffect(() => {
    if (focusPassword && state.mode === 'claimed') {
      passwordRef.current?.focus();
      setFocusPassword(false);
    }
  }, [focusPassword, state.mode]);

  function resetVerification() {
    setToken(null);
    widgetRef.current?.reset();
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!enabled || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    latest.current.onBusyChange(true);
    latest.current.onAttempt();
    try {
      let result: EntryResult;
      if (state.mode === 'claimed') {
        schedulerRef.current?.cancel();
        result = await latest.current.actions.signIn({ name, password, ...(token ? { turnstileToken: token } : {}) });
      } else {
        const scheduler = schedulerRef.current;
        if (!scheduler) return;
        const checked = await resolveEntryPlay(name, scheduler);
        if (!mounted.current) return;
        setLookup(checked);
        const decision = entryState(name, checked);
        if (decision.mode !== 'guest') {
          setError(undefined);
          if (decision.mode === 'claimed') setFocusPassword(true);
          return;
        }
        result = await latest.current.onPlay(name);
      }
      if (!mounted.current) return;
      if (result.kind === 'ok') {
        setPassword('');
        latest.current.onEntered();
        return;
      }
      resetVerification();
      if (result.kind === 'passwordChangeRequired') {
        setPassword('');
        latest.current.onPasswordChange({ name, displayName: state.displayName, temporaryPassword: password, captchaRequired });
      } else if (result.kind === 'error') {
        setError(result.error);
        if (result.error.code === 'CAPTCHA_REQUIRED') setCaptchaRequired(true);
        if (['INVALID_CREDENTIALS', 'INVALID_PASSWORD'].includes(result.error.code)) {
          setPassword('');
          setFocusPassword(true);
        }
      }
    } catch {
      if (mounted.current) {
        setError({ code: state.mode === 'claimed' ? 'ACCOUNT_SERVICE_UNAVAILABLE' : 'GUEST_SESSION_FAILED' });
        resetVerification();
      }
    } finally {
      if (mounted.current) {
        busy.current = false;
        setSubmitting(false);
        latest.current.onBusyChange(false);
      }
    }
  };

  const retry = async () => {
    if (busy.current) return;
    busy.current = true;
    setRetrying(true);
    latest.current.onBusyChange(true);
    latest.current.onAttempt();
    schedulerRef.current?.cancel();
    try {
      const result = await latest.current.actions.retryRemembered();
      if (mounted.current && result.kind === 'ok') latest.current.onEntered();
    } finally {
      if (mounted.current) {
        busy.current = false;
        setRetrying(false);
        latest.current.onBusyChange(false);
      }
    }
  };

  const messageClasses = 'text-center text-[14px] leading-[18px] text-[var(--shapeships-pastel-purple)] sm:text-[18px] sm:leading-[22px]';
  const message = state.message;
  return (
    <div className="content-stretch relative flex w-full shrink-0 flex-col items-center">
      <div className="content-stretch relative flex w-full max-w-[600px] shrink-0 flex-col items-center gap-[32px] sm:gap-[40px] md:gap-[50px]">
        <div className="content-stretch relative flex w-full flex-col items-center gap-[20px] px-[20px] sm:px-[32px] sm:py-[25px] md:px-[40px]">
          <h2 id={`${id}-heading`} className="relative w-full shrink-0 text-center text-[27px] font-black leading-normal sm:text-[36px]">Enter your name</h2>
          {(rememberedUnavailable || retrying) && (
            <div aria-live="polite" className={messageClasses}>
              <p className="font-bold">We couldn't reach your account.</p>
              <p><button type="button" disabled={submitting || retrying} onClick={() => { void retry(); }} className="cursor-pointer underline disabled:cursor-default">{retrying ? 'Trying...' : 'Try again'}</button> or play as a guest.</p>
            </div>
          )}
          <form onSubmit={(event) => { void submit(event); }} aria-labelledby={`${id}-heading`} aria-busy={submitting || retrying} className="flex w-full flex-col items-stretch gap-[20px]">
            <div className="w-full">
              <InputField id={`${id}-name`} name="username" value={name} placeholder="Player name" align="center"
                autoComplete="username" autoCapitalize="none" spellCheck={false} error={state.formatError}
                disabled={submitting || retrying} aria-describedby={`${id}-name-message`}
                onChange={(value) => {
                  if (busy.current) return;
                  latest.current.actions.leaveSignIn();
                  setName(value); setPassword(''); setError(undefined); setCaptchaRequired(false);
                  resetVerification();
                  schedulerRef.current?.update(value);
                }} />
              {state.formatError && <p id={`${id}-name-message`} className="mt-2 text-[10.5px] font-normal text-[var(--shapeships-pastel-red)] sm:text-[14px]">{ENTRY_NAME_ERROR}</p>}
            </div>
            <div id={state.formatError ? undefined : `${id}-name-message`} aria-live="polite" className={message ? messageClasses : 'sr-only'}>
              {message && <><p className="font-bold">{message.title}</p><p>{message.discord ? <>{message.detail.split('Discord')[0]}<a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="underline">Discord</a>{message.detail.split('Discord')[1]}</> : message.detail}</p></>}
            </div>
            {state.mode === 'claimed' && <PasswordInput inputRef={passwordRef} id={`${id}-password`} name="password"
              value={password} onChange={setPassword} placeholder="Password" align="center" autoComplete="current-password"
              disabled={submitting || retrying} />}
            {state.mode === 'claimed' && captchaRequired && <TurnstileWidget ref={widgetRef} action="sign-in"
              onTokenChange={setToken} onUnavailable={() => setError({ code: 'CAPTCHA_UNAVAILABLE' })} />}
            <PrimaryButton disabled={!enabled} loading={submitting} loadingLabel="ENTERING VOID..." className="w-full">{primaryButtonLabel}</PrimaryButton>
          </form>
        </div>
        <div className="relative flex w-full flex-col items-center gap-[20px] px-[20px] py-0 sm:px-[32px] sm:py-[25px] md:px-[40px]">
          <p className="relative w-full text-center text-[12px] font-normal leading-[16px] sm:text-[16px] sm:leading-[22px]"><br aria-hidden="true" />3–20 letters or numbers, no spaces or symbols.</p>
        </div>
      </div>
    </div>
  );
}
