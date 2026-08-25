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

import React, { useEffect, useState } from 'react';
import { MultiplayerPanel } from '../panels/MultiplayerPanel';
import { RulesPanel } from '../panels/RulesPanel';
import { LorePanel } from '../panels/lore/LorePanel';
import { CreatePrivateGamePanel, type CreatePrivateGameSettings } from '../panels/CreatePrivateGamePanel';
import { LogoIcon } from '../ui/primitives/icons/LogoIcon';
import { OnlineStatusIcon } from '../ui/primitives/icons/OnlineStatusIcon';
import { attemptMobileGameFullscreen } from '../../utils/mobileFullscreen';
import {
  clearLoreUnread,
  readLoreUnread,
} from '../../game/client/gameSession/mission/missionChallengeSession';

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

type ActivePanel = 'multiplayer' | 'createPrivateGame' | 'playComputer' | 'rules' | 'lore';

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
  const [isLoreUnread, setIsLoreUnread] = useState(() => readLoreUnread());

  useEffect(() => {
    if (activePanel !== 'lore') return;
    clearLoreUnread();
    setIsLoreUnread(false);
  }, [activePanel]);

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
    attemptMobileGameFullscreen();
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
    attemptMobileGameFullscreen();
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
    <div className="content-stretch relative flex size-full flex-col items-center px-[5%] pb-[120px] pt-[20px] sm:pt-[40px] 2xl:pt-[60px]">
      <div className="content-stretch relative flex w-full max-w-[1430px] shrink-0 flex-col items-center gap-[8px] md:gap-[8px]">
        {/* Menu Header */}
        <div className="content-stretch relative flex w-full shrink-0 flex-col justify-between gap-4 lg:flex-row lg:gap-10 items-center pb-[12px] sm:pb-[32px]">
          {/* Logo */}
          <div className="relative inline-grid shrink-0 grid-cols-[max-content] grid-rows-[max-content] place-items-start leading-[0]">
            <p className="[grid-area:1_/_1] relative ml-[60px] mt-[0.31px] text-[36px] font-bold leading-[normal] not-italic text-nowrap sm:ml-[80px] sm:text-[48px] md:ml-[130.04px] md:text-[67.563px]">
              SHAPESHIPS
            </p>
            <div className="[grid-area:1_/_1] relative ml-0 mt-0 flex h-[45px] w-[52.5px] items-center justify-center sm:h-[60px] sm:w-[70px] md:h-[86.748px] md:w-[101.762px]">
              <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                <LogoIcon className="h-[45px] w-[52.5px] sm:h-[60px] sm:w-[70px] md:h-[86.748px] md:w-[101.762px]" />
              </div>
            </div>
          </div>

          {/* Right Header */}
          <div className="content-stretch relative flex  flex-col items-center gap-5 lg:max-w-[720px] lg:items-end">
            {/* Social Links */}
            <div className="content-stretch relative flex w-full flex-wrap items-center justify-start gap-x-[24px] gap-y-[12px] text-[12px] font-normal leading-[normal] underline sm:text-[18px] lg:justify-end">
              <a
                href="https://juddmadden.com/shapeships/"
                target="_blank"
                rel="noopener noreferrer"
                className="[text-underline-position:from-font] relative shrink-0 cursor-pointer decoration-solid underline hover:opacity-80"
              >
                About
              </a>
              <a 
                href="https://discord.gg/MjPtf4G6Gt" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] relative shrink-0 cursor-pointer decoration-solid hover:opacity-80" 
              >
                Discord
              </a>
              <a 
                href="https://www.youtube.com/@Shapeships" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] relative shrink-0 cursor-pointer decoration-solid hover:opacity-80" 
              >
                YouTube
              </a>
              <a 
                href="https://www.reddit.com/r/shapeships/" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] relative shrink-0 cursor-pointer decoration-solid hover:opacity-80" 
              >
                Reddit
              </a>
            </div>
          </div>
        </div>

        {/* Header Divider */}
        <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] h-px opacity-70 shrink-0 to-[rgba(255,255,255,0)] via-50% via-[var(--shapeships-white)] w-full" />

        {/* Player Identity Row */}
        <div className="content-stretch relative flex w-full items-center py-[20px] 2xl:py-[32px]">
          <div className="content-stretch relative flex w-full sm:flex-col sm:items-start justify-between gap-x-[24px] gap-y-2">
            <div className="flex flex-wrap items-center gap-x-[8px] sm:gap-x-[16px] gap-y-2">
              <OnlineStatusIcon status="online" />
              <p
                className="min-w-0 max-w-full text-[30px] font-normal leading-none [overflow-wrap:anywhere] sm:text-[40px] xl:text-[56px]"
              >
                {displayName}
              </p>
            </div>
            <button
              type="button"
              className="sm:pl-[36px] lg:pl-[40px] text-shapeships-grey-50 cursor-pointer text-[13.5px] leading-[normal] hover:underline sm:text-[18px]"
              onClick={alphaDisableAuth ? onExit : onLogout}
            >
              Change Name
            </button>
          </div>
        </div>

        {/* Main Wrapper */}
        <div className="content-stretch relative flex w-full shrink-0 flex-col items-start gap-[32px] pr-0 min-[1025px]:flex-row min-[1025px]:gap-[28px] xl:gap-[50px]">
          {/* Sidebar */}
          <div className="fixed sm:sticky bottom-0  sm:top-[60px] left-0 bg-black z-10 content-stretch flex w-full shrink-0 flex-col items-start px-[20px] min-[400px]:px-[24px] pt-[20px] pb-[28px] border-t-2 border-[var(--shapeships-grey-70)] sm:border-0
          sm:bg-transparent sm:static sm:p-0 min-[1025px]:w-[250px] min-[1025px]:pb-[24px] xl:w-[340px]">
            {/* Main Nav */}
            <div className="content-stretch relative flex w-full flex-row justify-between sm:items-start sm:gap-x-[28px] gap-y-[24px] py-0 pr-0  min-[641px]:flex-nowrap min-[641px]:gap-y-0 min-[1025px]:flex-col min-[1025px]:gap-x-0 min-[1025px]:gap-y-[36px] min-[1025px]:pl-[20px] xl:gap-y-[50px] xl:pl-[40px]">
              {/* Multiplayer */}
              <div
                className="content-stretch relative flex shrink-0 cursor-pointer items-center justify-center px-0 pb-[0px] sm:pb-[5px] pt-0"
                onClick={() => setActivePanel('multiplayer')}
              >
                {activePanel === 'multiplayer' && (
                  <div aria-hidden="true" className="absolute border-shapeships-pastel-purple border-[0px_0px_3px] border-solid inset-[0_0_-3px_0] sm:border-[0px_0px_7px]  sm:border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p
                  className={`relative shrink-0 text-[16px] min-[400px]:text-[18px] font-black leading-[24px] text-nowrap normal-case sm:text-[24px] sm:leading-[32px] sm:uppercase md:text-[28px] ${
                    activePanel === 'multiplayer' ? 'text-shapeships-pastel-purple' : 'hover:text-shapeships-pastel-purple/80'
                  }`}
                >
                  Multiplayer
                </p>
              </div>

              {/* Single Player */}
              <div 
                className="content-stretch relative flex shrink-0 cursor-pointer items-center justify-center px-0 pb-[0px] sm:pb-[5px] pt-0"
                onClick={() => setActivePanel('playComputer')}
              >
                {activePanel === 'playComputer' && (
                  <div aria-hidden="true" className="absolute border-shapeships-pastel-purple border-[0px_0px_3px] border-solid inset-[0_0_-3px_0] sm:border-[0px_0px_7px]  sm:border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p 
                  className={`relative shrink-0 text-[16px] min-[400px]:text-[18px] font-black leading-[24px] text-nowrap normal-case sm:text-[24px] sm:leading-[32px] sm:uppercase md:text-[28px] ${
                    activePanel === 'playComputer' ? 'text-shapeships-pastel-purple' : 'hover:text-shapeships-pastel-purple/80'
                  }`}
                >
                  Single Player
                </p>
              </div>

              {/* Rules */}
              <div 
                className="content-stretch relative flex shrink-0 cursor-pointer items-center justify-center px-0 pb-[0px] sm:pb-[5px] pt-0"
                onClick={() => setActivePanel('rules')}
              >
                {activePanel === 'rules' && (
                  <div aria-hidden="true" className="absolute border-shapeships-pastel-purple border-[0px_0px_3px] border-solid inset-[0_0_-3px_0] sm:border-[0px_0px_7px]  sm:border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p 
                  className={`block relative shrink-0 text-[16px] min-[400px]:text-[18px] font-black leading-[24px] text-nowrap normal-case sm:text-[24px] sm:leading-[32px] sm:uppercase md:text-[28px] ${
                    activePanel === 'rules' ? 'text-shapeships-pastel-purple' : 'hover:text-shapeships-pastel-purple/80'
                  }`}
                >
                  Rules
                </p>
              </div>

              {/* Lore */}
              <div
                className="content-stretch relative flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0 px-0 pb-[0px] pt-0 sm:flex-row sm:gap-x-[12px] sm:pb-[5px]"
                onClick={() => setActivePanel('lore')}
              >
                {activePanel === 'lore' && (
                  <div aria-hidden="true" className="absolute border-shapeships-pastel-purple border-[0px_0px_3px] border-solid inset-[0_0_-3px_0] sm:border-[0px_0px_7px] sm:border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p
                  className={`relative shrink-0 text-[16px] min-[400px]:text-[18px] font-black leading-[24px] text-nowrap normal-case sm:text-[24px] sm:leading-[32px] sm:uppercase md:text-[28px] ${
                    activePanel === 'lore' ? 'text-shapeships-pastel-purple' : 'hover:text-shapeships-pastel-purple/80'
                  }`}
                >
                  Lore
                </p>
                {isLoreUnread && (
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-full size-[10px] -translate-x-1/2 rounded-full bg-shapeships-pastel-purple sm:static sm:size-[16px] sm:translate-x-0"
                  />
                )}
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
            {activePanel === 'lore' && (
              <LorePanel />
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
                subheading="Start a game against a computer opponent. Includes optional Missions and Challenges."
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
