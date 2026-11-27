import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  isClaimEnabled, mapClaimError, nameFieldError, passwordCodePointLength,
  NAME_HINT, VERIFICATION_UNAVAILABLE,
  type ClaimFeedback, type ClaimNameActions,
} from '../../game/client/account/claimNameForm';
import { DISCORD_URL } from '../../game/client/account/entryForm';
import { createNameCheckScheduler } from '../../game/client/account/nameCheckScheduler';
import type { NameCheckBody } from '../../game/client/account/types';
import { FormField } from '../ui/primitives/inputs/FormField';
import { InputField } from '../ui/primitives/inputs/InputField';
import { PasswordInput } from '../ui/primitives/inputs/PasswordInput';
import { VerifiedUserIcon } from '../ui/primitives/icons/VerifiedUserIcon';
import { MenuButton } from '../ui/primitives/buttons/MenuButton';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../ui/turnstile/TurnstileWidget';

interface ClaimNamePanelProps {
  currentName: string;
  actions: ClaimNameActions;
  onClaimed(): void;
}

export function ClaimNamePanel({ currentName, actions, onClaimed }: ClaimNamePanelProps) {
  const [name, setName] = useState(currentName);
  const [password, setPassword] = useState('');
  const [outcome, setOutcome] = useState<NameCheckBody['outcome']>();
  const [feedback, setFeedback] = useState<ClaimFeedback>({});
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const id = useId();
  const widgetRef = useRef<TurnstileWidgetHandle>(null);
  const schedulerRef = useRef<ReturnType<typeof createNameCheckScheduler> | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const latest = useRef({ actions, onClaimed });
  latest.current = { actions, onClaimed };
  const openingName = useRef(currentName);

  useEffect(() => {
    mounted.current = true;
    const scheduler = createNameCheckScheduler({
      checkName: (value) => latest.current.actions.checkName(value),
      invalidate: () => latest.current.actions.invalidateNameChecks(),
      onResult: (_value, result) => setOutcome(result?.kind === 'ok' ? result.data.outcome : undefined),
    });
    schedulerRef.current = scheduler;
    scheduler.open(openingName.current);
    return () => {
      mounted.current = false;
      scheduler.dispose();
      schedulerRef.current = null;
    };
  }, []);

  const nameError = nameFieldError(name, outcome, feedback.name);
  const passwordError = passwordCodePointLength(password) > 128 ? 'Use 128 characters or fewer.' : feedback.password;
  const enabled = isClaimEnabled({ name, password, outcome, nameError, token, submitting });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!enabled || busy.current || !token) return;
    busy.current = true;
    setSubmitting(true);
    setFeedback({});
    schedulerRef.current?.cancel();
    try {
      const result = await latest.current.actions.claim({ name, password, turnstileToken: token });
      if (!mounted.current) return;
      if (result.kind === 'ok') {
        setPassword('');
        latest.current.onClaimed();
        return;
      }
      if (result.kind === 'error') setFeedback(mapClaimError(result.error));
      widgetRef.current?.reset();
    } catch {
      if (mounted.current) {
        setFeedback(mapClaimError({ code: 'ACCOUNT_SERVICE_UNAVAILABLE' }));
        widgetRef.current?.reset();
      }
    } finally {
      if (mounted.current) { busy.current = false; setSubmitting(false); }
    }
  };

  return (
    <section className="flex w-full flex-col gap-[32px] text-white md:gap-[56px]" aria-labelledby={`${id}-heading`}>
      <div className="flex items-start justify-center gap-[10px] md:justify-start">
        <VerifiedUserIcon className="size-[36px] shrink-0 text-shapeships-pastel-purple sm:size-[48px]" />
        <div className="flex min-w-0 flex-col gap-[16px] text-center md:text-left">
          <h1 id={`${id}-heading`} className="text-[24px] font-black leading-[28px] sm:text-[36px] sm:leading-[42px]">
            Claim Your Name
          </h1>
          <p className="text-[15px] font-normal leading-[18px] sm:text-[20px] sm:leading-[24px]">Only you can use your name. This creates a simple account.</p>
        </div>
      </div>
      <div className="flex w-full flex-col items-center gap-[32px] md:ml-[58px] md:w-[calc(100%_-_58px)] md:items-start md:gap-[48px] xl:grid xl:max-w-[958px] xl:grid-cols-[minmax(300px,520fr)_2px_minmax(0,340fr)] xl:items-stretch xl:gap-x-[48px] xl:gap-y-0">
        <form onSubmit={submit} className="flex w-full max-w-[520px] min-w-0 flex-col" aria-busy={submitting}>
          <div className="flex flex-col gap-[28px] md:gap-[44px]">
            <FormField htmlFor={`${id}-name`} messageId={`${id}-name-message`} label="Enter your name" hint={NAME_HINT} error={nameError}>
              <InputField
                id={`${id}-name`} name="username" value={name} placeholder="Player name"
                autoComplete="username" autoCapitalize="none" spellCheck={false}
                aria-describedby={`${id}-name-message`} error={Boolean(nameError)} disabled={submitting}
                onChange={(value) => {
                  setName(value);
                  setFeedback((previous) => ({ ...previous, name: undefined }));
                  schedulerRef.current?.update(value);
                }}
              />
            </FormField>
            <FormField
              htmlFor={`${id}-password`} messageId={`${id}-password-message`} label="Set password"
              hint={<>10+ characters, case sensitive.<br />Password resets are via <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="underline">Discord</a>.</>}
              error={passwordError}
            >
              <PasswordInput
                id={`${id}-password`} name="password" value={password} placeholder="Password" autoComplete="new-password"
                aria-describedby={`${id}-password-message`} error={Boolean(passwordError)} disabled={submitting}
                onChange={(value) => {
                  setPassword(value);
                  setFeedback((previous) => ({ ...previous, password: undefined }));
                }}
              />
            </FormField>
          </div>
          <div className="mt-[28px] md:mt-[44px]">
            <TurnstileWidget
              ref={widgetRef} action="claim"
              onTokenChange={(value) => {
                setToken(value);
                if (value) setFeedback((previous) => ({ ...previous, verification: undefined }));
              }}
              onUnavailable={() => setFeedback((previous) => ({ ...previous, verification: VERIFICATION_UNAVAILABLE }))}
            />
          </div>
          <div className="mt-[28px] flex flex-col items-center gap-[20px] md:mt-[42px] md:items-start">
            {(feedback.verification || feedback.form) && (
              <p role="status" aria-live="polite" className="text-[16px] leading-[22px] text-[var(--shapeships-pastel-red)]">
                {feedback.verification || feedback.form}
              </p>
            )}
            <MenuButton variant="private" disabled={!enabled}>{submitting ? 'CREATING...' : 'CREATE ACCOUNT'}</MenuButton>
          </div>
        </form>
        <div aria-hidden="true" className="h-[2px] w-full max-w-[520px] bg-shapeships-grey-70 xl:h-auto xl:w-[2px]" />
        <div className="flex w-full max-w-[520px] min-w-0 flex-col gap-[12px] text-[15px] leading-[20px] text-shapeships-grey-20 md:gap-[20px] md:text-[18px] md:leading-[24px] xl:max-w-[340px]">
          <p className="font-bold">No email address required.</p>
          <div className="flex flex-col gap-[8px] md:gap-[12px]">
            <p>Your account only stores:</p>
            <ul role="list" className="list-none m-0 p-0 flex flex-wrap gap-[8px] md:gap-[12px]">
              {['Player Name', 'Game Settings', 'Password (securely hashed)', 'Win Streak', 'Lore Unlocks'].map((label) => (
                <li key={label} className="rounded-[8px] bg-shapeships-grey-90 text-shapeships-grey-20 whitespace-nowrap px-[12px] py-[6px] text-[14px] leading-[20px] md:px-[14px] md:py-[8px] md:text-[16px] md:leading-[22px]">
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <p><em><strong>Two-name limit per player.</strong> Players found in breach of this limit will be... frowned upon. Maybe banned.</em></p>
          <p>Accounts will always be free.</p>
          <p>In the future, we plan to add more account features like Game History, Stats and Ranked Multiplayer. Have fun, come and say hi on <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="underline">Discord</a>!</p>
        </div>
      </div>
    </section>
  );
}
