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
import svgPaths from '../../imports/svg-sgmbdp397k';

interface LoginShellProps {
  onNavigate: (shell: string) => void;
  onNameSubmit: (displayName: string) => void;
  onLogin: (userData: any) => void;
  alphaDisableAuth: boolean;
}

export function LoginShell({ onNavigate, onNameSubmit, onLogin, alphaDisableAuth }: LoginShellProps) {
  // Alpha v3: Full-page layout with header + panel + footer
  if (alphaDisableAuth) {
    return (
      <div className="content-stretch flex flex-col items-center pb-[120px] pt-[60px] px-[240px] relative size-full overflow-y-auto">
        <div className="content-stretch flex flex-col gap-[80px] items-center relative shrink-0 w-full">
          
          {/* Logo + Title + Feature Highlights */}
          <div className="content-stretch flex flex-col gap-[64px] items-center relative shrink-0 w-full">
            
            {/* Logo */}
            <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
              <p className="[grid-area:1_/_1] font-['Inter'] font-bold leading-[normal] ml-[203.9px] mt-[0.49px] not-italic relative text-[105.935px] text-nowrap text-white">
                SHAPESHIPS
              </p>
              <div className="[grid-area:1_/_1] flex h-[136.015px] items-center justify-center ml-0 mt-0 relative w-[159.556px]">
                <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                  <div className="h-[136.015px] relative w-[159.556px]">
                    <div className="absolute inset-[-9.5%_-12.13%_-14.76%_-12.13%]">
                      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 198.271 169.018">
                        <path d={svgPaths.p2f58ad30} fill="black" stroke="#CD8CFF" strokeMiterlimit="10" strokeWidth="13.0784" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Highlights Row */}
            <div className="content-center flex flex-wrap gap-[20px_70px] items-center justify-center relative shrink-0 w-full">
              
              {/* Feature 1: Free space battle game */}
              <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
                <div className="relative shrink-0 size-[48px]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
                    <path d={svgPaths.p35f60d00} fill="white" />
                  </svg>
                </div>
                <p className="font-['Inter'] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-nowrap text-white">
                  A free space
                  <br aria-hidden="true" />
                  battle game
                </p>
              </div>

              {/* Feature 2: 1v1 Online */}
              <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
                <div className="relative shrink-0 size-[48px]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
                    <path d={svgPaths.p79642e0} fill="white" />
                  </svg>
                </div>
                <p className="font-['Inter'] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[127.2px]">
                  1v1 Online
                </p>
              </div>

              {/* Feature 3: Simultaneous turns */}
              <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
                <div className="h-[40.215px] relative shrink-0 w-[42.014px]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42.0144 40.2151">
                    <path d={svgPaths.pf9ce800} fill="white" />
                    <path d={svgPaths.p10b2b780} fill="white" />
                  </svg>
                </div>
                <p className="font-['Inter'] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[146.4px]">
                  Simultaneous
                  <br aria-hidden="true" />
                  turns
                </p>
              </div>

              {/* Feature 4: 10-30 minute games */}
              <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
                <div className="relative shrink-0 size-[48px]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
                    <path d={svgPaths.p32df6780} fill="white" />
                    <path d={svgPaths.p1c23b200} fill="white" />
                  </svg>
                </div>
                <p className="font-['Inter'] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[144px]">
                  10-30 minute games
                </p>
              </div>

            </div>
          </div>

          {/* Alpha Entry Panel (Form Body) */}
          <AlphaEntryPanel onPlay={onNameSubmit} />

          {/* Footer Links */}
          <div className="content-stretch flex font-['Roboto'] font-normal gap-[45px] items-center leading-[normal] relative shrink-0 text-[22px] text-nowrap text-white">
            <a
              href="https://juddmadden.com/shapeships/"
              target="_blank"
              rel="noopener noreferrer"
              className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              How to Play
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
    <div className="container mx-auto p-6 max-w-md">
      <div className="mb-8">
        <h1 className="text-white drop-shadow-lg">Shapeships</h1>
      </div>
      {renderPanel()}
    </div>
  );
}