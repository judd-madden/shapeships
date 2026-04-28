/**
 * MENU SHELL
 * 
 * Canonical Shell for main menu/lobby
 * Matches "Menu Screen with placeholder lobby text" Figma design
 * 
 * SESSION INVARIANT (Alpha v3):
 * This component assumes a valid session + player identity already exists.
 * If player is missing, it returns null (parent handles state management).
 */

import React, { useState } from 'react';
import { MultiplayerPanel } from '../panels/MultiplayerPanel';
import { RulesPanel } from '../panels/RulesPanel';
import { CreatePrivateGamePanel, type CreatePrivateGameSettings } from '../panels/CreatePrivateGamePanel';
import { LogoIcon } from '../ui/primitives/icons/LogoIcon';
import { OnlineStatusIcon } from '../ui/primitives/icons/OnlineStatusIcon';

interface MenuShellProps {
  onNavigate: (shell: string) => void;
  onExit: () => void;
  onLogout: () => void;
  onGameCreated: (gameId: string) => void;
  onCreatePrivateGame: (settings: CreatePrivateGameSettings) => Promise<string>;
  onCreateComputerGame: (settings: CreatePrivateGameSettings) => Promise<string>;
  user: any;
  player: any;
  alphaDisableAuth: boolean;
}

type ActivePanel = 'multiplayer' | 'createPrivateGame' | 'playComputer' | 'rules';

export function MenuShell({ 
  onNavigate, 
  onExit, 
  onLogout, 
  onGameCreated, 
  onCreatePrivateGame,
  onCreateComputerGame,
  user, 
  player, 
  alphaDisableAuth 
}: MenuShellProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>('multiplayer');
  const [, setIsCreating] = useState(false);

  // SESSION INVARIANT GUARD:
  // MenuShell should only render when a valid player exists
  // If player is missing during render, show nothing (parent handles state management)
  if (!player || !player.name) {
    // DEV-ONLY: Log warning if this happens (shouldn't in normal flow)
     if (import.meta.env.DEV) {
      console.warn('⚠️ [MenuShell] Player not ready, returning null', { player });
    }
    return null;
  }

  const displayName = player.name;

  const handleCreateGameWithSettings = async (settings: CreatePrivateGameSettings) => {
    setIsCreating(true);
    try {
      const gameId = await onCreatePrivateGame(settings);
      onGameCreated(gameId);
    } catch (error: any) {
      console.error('Failed to create game:', error);
      throw error; // Re-throw so panel can handle it
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateComputerGameWithSettings = async (settings: CreatePrivateGameSettings) => {
    setIsCreating(true);
    try {
      const gameId = await onCreateComputerGame(settings);
      onGameCreated(gameId);
    } catch (error: any) {
      console.error('Failed to create computer game:', error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="content-stretch relative flex size-full flex-col items-center px-[5%] pb-[120px] pt-[40px] md:pt-[60px]">
      <div className="content-stretch relative flex w-full max-w-[1430px] shrink-0 flex-col items-center gap-[12px] md:gap-[8px]">
        {/* Menu Header */}
        <div className="content-stretch relative flex w-full shrink-0 flex-col justify-between gap-8 lg:flex-row lg:gap-10 items-center pb-[32px]">
          {/* Logo */}
          <div className="relative inline-grid shrink-0 grid-cols-[max-content] grid-rows-[max-content] place-items-start leading-[0]">
            <p className="[grid-area:1_/_1] relative ml-[80px] mt-[0.31px] font-['Roboto',sans-serif] text-[48px] font-bold leading-[normal] not-italic text-nowrap md:ml-[130.04px] md:text-[67.563px]">
              SHAPESHIPS
            </p>
            <div className="[grid-area:1_/_1] relative ml-0 mt-0 flex h-[60px] w-[70px] items-center justify-center md:h-[86.748px] md:w-[101.762px]">
              <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                <LogoIcon className="h-[60px] md:h-[86.748px] w-[70px] md:w-[101.762px]" />
              </div>
            </div>
          </div>

          {/* Right Header */}
          <div className="content-stretch relative flex  flex-col items-center gap-5 lg:max-w-[720px] lg:items-end">
            {/* Social Links */}
            <div className="content-stretch relative flex w-full flex-wrap items-center justify-start gap-x-[24px] gap-y-[12px] font-['Roboto',sans-serif] text-[16px] font-normal leading-[normal] underline sm:text-[18px] lg:justify-end">
              <a
                href="https://juddmadden.com/shapeships/"
                target="_blank"
                rel="noopener noreferrer"
                className="[text-underline-position:from-font] relative shrink-0 cursor-pointer decoration-solid underline hover:opacity-80"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Official
              </a>
              <a 
                href="https://discord.gg/MjPtf4G6Gt" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] relative shrink-0 cursor-pointer decoration-solid hover:opacity-80" 
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Discord
              </a>
              <a 
                href="https://www.youtube.com/@Shapeships" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] relative shrink-0 cursor-pointer decoration-solid hover:opacity-80" 
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                YouTube
              </a>
              <a 
                href="https://www.reddit.com/r/shapeships/" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] relative shrink-0 cursor-pointer decoration-solid hover:opacity-80" 
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Reddit
              </a>
            </div>
          </div>
        </div>

        {/* Header Divider */}
        <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] h-px opacity-70 shrink-0 to-[rgba(255,255,255,0)] via-50% via-[#ffffff] w-full" />

        {/* Player Identity Row */}
        <div className="content-stretch relative flex w-full items-center py-[32px]">
          <div className="content-stretch relative flex w-full flex-col items-start gap-x-[24px] gap-y-2">
            <div className="flex flex-wrap items-center gap-x-[24px] gap-y-2">
              <OnlineStatusIcon status="online" />
              <p
                className="min-w-0 max-w-full font-['Roboto',sans-serif] text-[40px] font-normal leading-none [overflow-wrap:anywhere]  xl:text-[56px]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {displayName}
              </p>
            </div>
            <button
              type="button"
              className="pl-[44px] text-shapeships-grey-50 cursor-pointer font-['Roboto',sans-serif] text-[18px]  leading-[normal]  hover:underline"
              style={{ fontVariationSettings: "'wdth' 100" }}
              onClick={alphaDisableAuth ? onExit : onLogout}
            >
              Change Name
            </button>
          </div>
        </div>

        {/* Main Wrapper */}
        <div className="content-stretch relative flex w-full shrink-0 flex-col items-start gap-[32px] pr-0 lg:flex-row lg:gap-[28px] xl:gap-[50px]">
          {/* Sidebar */}
          <div className="content-stretch relative flex w-full shrink-0 flex-col items-start lg:w-[250px] xl:w-[340px] pb-[24px]">
            {/* Main Nav */}
            <div className="content-stretch relative flex w-full flex-wrap items-start gap-x-[28px] gap-y-[24px] pr-0 py-0 md:gap-x-[36px] lg:flex-col lg:gap-[36px] lg:pl-[20px] xl:gap-[50px] xl:pl-[40px]">
              {/* Multiplayer */}
              <div 
                className="content-stretch relative flex shrink-0 cursor-pointer items-center justify-center px-0 pb-[5px] pt-0"
                onClick={() => setActivePanel('multiplayer')}
              >
                {activePanel === 'multiplayer' && (
                  <div aria-hidden="true" className="absolute border-[#cd8cff] border-[0px_0px_7px] border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p 
                  className={`relative shrink-0 font-['Roboto',sans-serif] text-[24px] font-black leading-[32px] text-nowrap uppercase md:text-[28px] ${
                    activePanel === 'multiplayer' ? 'text-[#cd8cff]' : 'hover:text-[#cd8cff]/80'
                  }`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Multiplayer
                </p>
              </div>

              {/* Play Computer */}
              <div 
                className="content-stretch relative flex shrink-0 cursor-pointer items-center justify-center px-0 pb-[5px] pt-0"
                onClick={() => setActivePanel('playComputer')}
              >
                {activePanel === 'playComputer' && (
                  <div aria-hidden="true" className="absolute border-[#cd8cff] border-[0px_0px_7px] border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p 
                  className={`relative shrink-0 font-['Roboto',sans-serif] text-[24px] font-black leading-[32px] text-nowrap uppercase md:text-[28px] ${
                    activePanel === 'playComputer' ? 'text-[#cd8cff]' : 'hover:text-[#cd8cff]/80'
                  }`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Play Computer
                </p>
              </div>

              {/* Rules & Codex */}
              <div 
                className="content-stretch relative flex shrink-0 cursor-pointer items-center justify-center px-0 pb-[5px] pt-0"
                onClick={() => setActivePanel('rules')}
              >
                {activePanel === 'rules' && (
                  <div aria-hidden="true" className="absolute border-[#cd8cff] border-[0px_0px_7px] border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p 
                  className={`relative shrink-0 font-['Roboto',sans-serif] text-[24px] font-black leading-[32px] text-nowrap uppercase md:text-[28px] ${
                    activePanel === 'rules' ? 'text-[#cd8cff]' : 'hover:text-[#cd8cff]/80'
                  }`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  How to Play
                </p>
              </div>
            </div>
          </div>

          {/* Menu Screen Content */}
          <div className="content-stretch relative flex w-full min-w-0 max-w-full flex-1 shrink-0 flex-col items-start">
            {/* Render active panel */}
            {activePanel === 'multiplayer' && (
              <MultiplayerPanel
                onNavigateToCreateGame={() => setActivePanel('createPrivateGame')}
              />
            )}
            {activePanel === 'rules' && (
              <RulesPanel />
            )}
            {activePanel === 'createPrivateGame' && (
              <CreatePrivateGamePanel
                onSubmit={handleCreateGameWithSettings}
                onBack={() => setActivePanel('multiplayer')}
              />
            )}
            {activePanel === 'playComputer' && (
              <CreatePrivateGamePanel
                onSubmit={handleCreateComputerGameWithSettings}
                heading="PLAY COMPUTER"
                subheading="Start a game against a computer opponent (Human species)."
                primaryActionLabel="PLAY COMPUTER"
                primaryActionStyle="emphasisWhite"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
