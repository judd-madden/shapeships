/**
 * LOGIN SHELL
 * 
 * Canonical Shell for entry/authentication flows
 * Delegates to AlphaEntryPanel (Alpha v3) or auth panels (Post-Alpha)
 */

import React, { useState } from 'react';
import { AlphaEntryPanel } from '../panels/AlphaEntryPanel';
import { LoginPanel } from '../panels/LoginPanel';
import { CreateAccountPanel } from '../panels/CreateAccountPanel';
import { ForgotPasswordPanel } from '../panels/ForgotPasswordPanel';
import { PlayersIcon } from '../ui/primitives/icons/PlayersIcon';
import { BuildIcon } from '../ui/primitives/icons/BuildIcon';
import { ClockIcon } from '../ui/primitives/icons/ClockIcon';
import { LogoIcon } from '../ui/primitives/icons/LogoIcon';
import { Dice } from '../ui/primitives/dice/Dice';

interface LoginShellProps {
  onNavigate: (shell: string) => void;
  onNameSubmit: (displayName: string) => void | Promise<void>;
  onLogin: (userData: any) => void;
  alphaDisableAuth: boolean;
  alphaPrimaryCtaLabel?: string;
  isStartingSession: boolean;
}

export function LoginShell({
  onNavigate,
  onNameSubmit,
  onLogin,
  alphaDisableAuth,
  alphaPrimaryCtaLabel = 'PLAY',
  isStartingSession,
}: LoginShellProps) {
  // Alpha v3: Full-page layout with header + panel + footer
  if (alphaDisableAuth) {
    return (
      <div className="ss-playerRoot content-stretch relative flex size-full flex-col items-center overflow-y-auto px-6 pb-[120px] pt-[40px] sm:px-10 md:px-16 md:pt-[60px] lg:px-24 xl:px-[160px] 2xl:px-[240px]">
        <div className="content-stretch relative flex w-full max-w-[1440px] shrink-0 flex-col items-center gap-[56px] md:gap-[80px]">
          
          {/* Logo + Title + Feature Highlights */}
          <div className="content-stretch relative flex w-full shrink-0 flex-col items-center gap-[40px] md:gap-[64px]">
            
            {/* Logo */}
            <div className="relative inline-grid max-w-full shrink-0 grid-cols-[max-content] grid-rows-[max-content] place-items-start leading-[0]">
              <p className="[grid-area:1_/_1] relative ml-[92px] mt-[0.49px] font-['Roboto'] text-[54px] font-bold leading-[normal] not-italic text-nowrap sm:ml-[126px] sm:text-[72px] lg:ml-[160px] lg:text-[88px] xl:ml-[203.9px] xl:text-[105.935px]">
                SHAPESHIPS
              </p>
              <div className="[grid-area:1_/_1] relative ml-0 mt-0 flex h-[70px] w-[82px] items-center justify-center sm:h-[96px] sm:w-[112px] lg:h-[118px] lg:w-[138px] xl:h-[136.015px] xl:w-[159.556px]">
                <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                  <LogoIcon className="h-[70px] w-[82px] sm:h-[96px] sm:w-[112px] lg:h-[118px] lg:w-[138px] xl:h-[136.015px] xl:w-[159.556px]" />
                </div>
              </div>
            </div>

            {/* Feature Highlights Row */}
            <div className="content-center relative flex w-full flex-wrap items-stretch justify-center gap-x-[28px] gap-y-[20px] lg:gap-x-[50px]">
              
              {/* Feature 1: Free space battle game */}
              <div className="content-stretch relative flex min-w-[220px] max-w-[260px] shrink-0 items-center gap-[12px]">
                <BuildIcon className="relative shrink-0 size-[48px]" />
                <p className="relative shrink-0 font-medium text-[21.6px] leading-[24px] not-italic">
                  Free strategy game
                </p>
              </div>

              {/* Feature 2: 1v1 Online */}
              <div className="content-stretch relative flex min-w-[220px] max-w-[260px] shrink-0 items-center gap-[12px]">
                <PlayersIcon className="relative shrink-0 size-[48px]" />
                <p className="relative shrink-0 font-medium text-[21.6px] leading-[24px] not-italic">
                  1v1 Online
                </p>
              </div>

              {/* Feature 3: Simultaneous turns */}
              <div className="content-stretch relative flex min-w-[220px] max-w-[260px] shrink-0 items-center gap-[12px]">
                <Dice value={3} className="w-[52px] h-[50px]" enableRotate={false}/>
                <p className="relative shrink-0 font-medium text-[21.6px] leading-[24px] not-italic">
                  Shared dice each turn
                </p>
              </div>

              {/* Feature 4: 10-30 minute games */}
              <div className="content-stretch relative flex min-w-[220px] max-w-[260px] shrink-0 items-center gap-[12px]">
                <ClockIcon className="relative shrink-0 size-[48px]" />
                <p className="relative shrink-0 font-medium text-[21.6px] leading-[24px] not-italic">
                  10-30 minute games
                </p>
              </div>

            </div>
          </div>

          {/* Alpha Entry Panel (Form Body) */}
          <AlphaEntryPanel
            onPlay={onNameSubmit}
            primaryButtonLabel={alphaPrimaryCtaLabel}
            isStartingSession={isStartingSession}
          />

          {/* Footer Links */}
          <div className="content-stretch relative flex w-full flex-wrap items-center justify-center gap-x-[28px] gap-y-[16px] font-normal text-[18px] leading-[normal] sm:text-[20px] lg:text-[22px]">
            <a
              href="https://juddmadden.com/shapeships/"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Official
            </a>
            <a
              href="https://discord.gg/MjPtf4G6Gt"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Discord
            </a>
            <a
              href="https://www.youtube.com/@Shapeships"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              YouTube
            </a>
            <a
              href="https://www.reddit.com/r/shapeships/"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Reddit
            </a>
          </div>

        </div>
      </div>
    );
  }

  // Post-Alpha: Full auth flow with panels
  const [activePanel, setActivePanel] = useState('login');

  const renderPanel = () => {
    switch (activePanel) {
      case 'login':
        return <LoginPanel 
          onNavigate={setActivePanel} 
          onLogin={onLogin} 
        />;
      case 'createAccount':
        return <CreateAccountPanel 
          onNavigate={setActivePanel} 
          onAccountCreated={() => setActivePanel('login')} 
        />;
      case 'forgotPassword':
        return <ForgotPasswordPanel onNavigate={setActivePanel} />;
      default:
        return <LoginPanel 
          onNavigate={setActivePanel} 
          onLogin={onLogin} 
        />;
    }
  };

  return (
    <div className="ss-playerRoot container mx-auto p-6 max-w-md">
      <div className="mb-8">
        <h1 className="drop-shadow-lg">Shapeships</h1>
      </div>
      {renderPanel()}
    </div>
  );
}
