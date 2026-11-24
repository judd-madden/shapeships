/**
 * LOGIN SHELL
 * 
 * Canonical Shell for entry/authentication flows
 * Shared chrome for Entry and forced password change.
 */

import { useEffect, useState } from 'react';
import { AlphaEntryPanel } from '../panels/AlphaEntryPanel';
import { ChangePasswordPanel } from '../panels/ChangePasswordPanel';
import type { EntryAccountActions, EntryNotice, EntryResult, PasswordChangeContext } from '../../game/client/account/entryForm';
import { PlayersIcon } from '../ui/primitives/icons/PlayersIcon';
import { ClockIcon } from '../ui/primitives/icons/ClockIcon';
import { LogoIcon } from '../ui/primitives/icons/LogoIcon';
import { Dice } from '../ui/primitives/dice/Dice';

interface LoginShellProps {
  actions: EntryAccountActions;
  notice: EntryNotice | null;
  rememberedUnavailable: boolean;
  onNoticeConsumed(): void;
  onNameSubmit(name: string): Promise<EntryResult>;
  onEntered(): void;
  onBusyChange(busy: boolean): void;
  onAttempt(): void;
  primaryCtaLabel?: string;
}

export function LoginShell({ actions, notice, rememberedUnavailable, onNoticeConsumed, onNameSubmit,
  onEntered, onBusyChange, onAttempt, primaryCtaLabel = 'PLAY' }: LoginShellProps) {
  const [passwordChange, setPasswordChange] = useState<PasswordChangeContext | null>(null);
  const [entry, setEntry] = useState({ notice, captchaRequired: false });
  useEffect(() => () => actions.leaveSignIn(), [actions]);
  const entered = () => { setPasswordChange(null); onEntered(); };
  return (
      <div className="content-stretch relative flex size-full flex-col items-center overflow-y-auto px-6 pb-[120px] pt-[40px] sm:px-10 md:px-16 md:pt-[60px] lg:px-24 xl:px-[160px] 2xl:px-[240px]">
        <div className="content-stretch relative flex w-full max-w-[1440px] shrink-0 flex-col items-center gap-[40px] sm:gap-[56px] md:gap-[80px]">
          
          {/* Logo + Title + Feature Highlights */}
          <div className="content-stretch relative flex w-full shrink-0 flex-col items-center gap-[20px] sm:gap-[40px] md:gap-[64px]">
            
            {/* Logo */}
            <div className="relative inline-grid max-w-full shrink-0 grid-cols-[max-content] grid-rows-[max-content] place-items-start leading-[0]">
              <h1 className="[grid-area:1_/_1] relative ml-[69px] mt-[0.49px] text-[30px] font-bold leading-[normal] not-italic text-nowrap sm:ml-[126px] sm:text-[72px] lg:ml-[160px] lg:text-[88px] xl:ml-[203.9px] xl:text-[105.935px]">
                SHAPESHIPS
              </h1>
              <div className="[grid-area:1_/_1] relative ml-0 mt-0 flex h-[45px] w-[53.25px] items-center justify-center sm:h-[96px] sm:w-[112px] lg:h-[118px] lg:w-[138px] xl:h-[136.015px] xl:w-[159.556px]">
                <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                  <LogoIcon className="h-[45px] w-[53.25px] sm:h-[96px] sm:w-[112px] lg:h-[118px] lg:w-[138px] xl:h-[136.015px] xl:w-[159.556px]" />
                </div>
              </div>
            </div>

            {/* Feature Highlights Row */}
            <div className="content-center relative flex w-full flex-wrap items-stretch justify-center gap-x-[28px] gap-y-[10px] sm:gap-y-[20px] lg:gap-x-[50px]">

              {/* Feature 3: Space autobattler */}
              <div className="flex relative max-w-[260px] shrink-0 items-center gap-[6px] sm:gap-[12px]">
                <Dice value={3} className="w-[32px] h-[30px] sm:w-[48px] sm:h-[45px] shrink-0" enableRotate={false}/>
                <h2 className="relative shrink-0 font-medium text-[16px] leading-[18px] not-italic sm:text-[21px] sm:leading-[24px]">
                  Free Space Autobattler
                </h2>
              </div>

              {/* Feature 2: Multiplayer & Single Player */}
              <div className="flex relative  max-w-[300px] shrink-0 items-center gap-[6px] sm:gap-[12px]">
                <PlayersIcon className="relative shrink-0 size-[32px] sm:size-[48px]" />
                <p className="relative shrink-0 font-medium text-[16px] leading-[18px] not-italic sm:text-[21px] sm:leading-[24px]">
                  Single Player &amp; Multiplayer
                </p>
              </div>

              {/* Feature 4: 5-30 minute games */}
              <div className="flex relative  max-w-[260px] shrink-0 items-center gap-[6px] sm:gap-[12px]">
                <ClockIcon className="relative shrink-0 size-[32px] sm:size-[48px]" />
                <p className="relative shrink-0 font-medium text-[16px] leading-[18px] not-italic sm:text-[21px] sm:leading-[24px]">
                  5-30 minute games
                </p>
              </div>

            </div>
          </div>

          {passwordChange ? (
            <ChangePasswordPanel context={passwordChange} actions={actions} onEntered={entered}
              onBusyChange={onBusyChange} onAttempt={onAttempt}
              onCancel={() => {
                actions.leaveSignIn();
                setPasswordChange(null);
                setEntry({ notice: null, captchaRequired: false });
              }}
              onEntryError={(code, captchaRequired) => {
                actions.leaveSignIn();
                setEntry({ notice: { name: passwordChange.name, code }, captchaRequired });
                setPasswordChange(null);
              }} />
          ) : (
            <AlphaEntryPanel actions={actions} notice={entry.notice} initialCaptchaRequired={entry.captchaRequired}
              rememberedUnavailable={rememberedUnavailable} onNoticeConsumed={onNoticeConsumed}
              onPlay={onNameSubmit} onEntered={entered} onPasswordChange={setPasswordChange}
              onBusyChange={onBusyChange} onAttempt={onAttempt} primaryButtonLabel={primaryCtaLabel} />
          )}

          {/* Footer Links */}
          <div className="content-stretch relative flex w-full flex-wrap items-center justify-center gap-x-[28px] gap-y-[16px] font-normal text-[13.5px] leading-[normal] sm:text-[20px] lg:text-[22px]">
            <a
              href="https://discord.gg/MjPtf4G6Gt"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
            >
              Discord
            </a>
            <a
              href="https://www.youtube.com/@Shapeships"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
            >
              YouTube
            </a>
            <a
              href="https://www.reddit.com/r/shapeships/"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
            >
              Reddit
            </a>
            <a
              href="https://juddmadden.com/shapeships/"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
            >
              Pen &amp; Paper
            </a>
          </div>

        </div>
      </div>
    );
}
