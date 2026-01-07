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
import { MenuButton } from '../ui/primitives/buttons/MenuButton';
import { MultiplayerPanel } from '../panels/MultiplayerPanel';
import { RulesPanel } from '../panels/RulesPanel';
import { CreatePrivateGamePanel } from '../panels/CreatePrivateGamePanel';
import svgPaths from '../../imports/svg-zvdkaa3igi';

interface MenuShellProps {
  onNavigate: (shell: string) => void;
  onExit: () => void;
  onLogout: () => void;
  onGameCreated: (gameId: string) => void;
  onCreatePrivateGame: () => Promise<string>;
  user: any;
  player: any;
  alphaDisableAuth: boolean;
}

export function MenuShell({ 
  onNavigate, 
  onExit, 
  onLogout, 
  onGameCreated, 
  onCreatePrivateGame,
  user, 
  player, 
  alphaDisableAuth 
}: MenuShellProps) {
  const [activePanel, setActivePanel] = useState('multiplayer');
  const [isCreating, setIsCreating] = useState(false);

  // SESSION INVARIANT GUARD:
  // MenuShell should only render when a valid player exists
  // If player is missing during render, show nothing (parent handles state management)
  if (!player || !player.name) {
    // DEV-ONLY: Log warning if this happens (shouldn't in normal flow)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [MenuShell] Player not ready, returning null', { player });
    }
    return null;
  }

  const displayName = player.name;

  const handleCreatePrivateGameClick = async () => {
    // Switch to the Create Private Game panel
    setActivePanel('createPrivateGame');
  };

  const handleCreateGameWithSettings = async (settings: any) => {
    // For now, settings are ignored - backend will use them in future
    // This wrapper maintains the callback pattern while preparing for settings integration
    console.log('Game settings (ready for backend):', settings);
    
    setIsCreating(true);
    try {
      const gameId = await onCreatePrivateGame();
      onGameCreated(gameId);
    } catch (error: any) {
      console.error('Failed to create game:', error);
      throw error; // Re-throw so panel can handle it
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="content-stretch flex flex-col items-center pb-[120px] pt-[60px] px-[5%] relative size-full">
      <div className="content-stretch flex flex-col gap-[50px] items-center relative shrink-0 w-full max-w-[1430px]">
        {/* Menu Header */}
        <div className="content-stretch flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-0 relative shrink-0 w-full">
          {/* Logo */}
          <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
            <p className="[grid-area:1_/_1] font-['Inter:Bold',sans-serif] font-bold leading-[normal] ml-[80px] md:ml-[130.04px] mt-[0.31px] not-italic relative text-[48px] md:text-[67.563px] text-nowrap text-white">
              SHAPESHIPS
            </p>
            <div className="[grid-area:1_/_1] flex h-[60px] md:h-[86.748px] items-center justify-center ml-0 mt-0 relative w-[70px] md:w-[101.762px]">
              <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                <div className="h-[60px] md:h-[86.748px] relative w-[70px] md:w-[101.762px]">
                  <div className="absolute inset-[-9.5%_-12.13%_-14.76%_-12.13%]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 126.453 107.796">
                      <path d={svgPaths.p1e5c7100} fill="black" stroke="#CD8CFF" strokeMiterlimit="10" strokeWidth="8.34112" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Header */}
          <div className="content-stretch flex flex-col md:flex-row gap-6 md:gap-[36px] items-center justify-end relative shrink-0">
            {/* Social Links */}
            <div className="content-stretch flex font-['Roboto:Regular',sans-serif] font-normal gap-[34px] items-center leading-[normal] relative shrink-0 text-[18px] text-nowrap text-white underline">
              <a 
                href="https://discord.gg/MjPtf4G6Gt" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] decoration-solid relative shrink-0 cursor-pointer hover:opacity-80" 
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Discord
              </a>
              <a 
                href="https://www.youtube.com/@Shapeships" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] decoration-solid relative shrink-0 cursor-pointer hover:opacity-80" 
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                YouTube
              </a>
              <a 
                href="https://www.reddit.com/r/shapeships/" 
                target="_blank" 
                rel="noreferrer"
                className="[text-underline-position:from-font] decoration-solid relative shrink-0 cursor-pointer hover:opacity-80" 
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Reddit
              </a>
            </div>

            {/* Create Private Game Button */}
            <MenuButton 
              variant="private" 
              onClick={handleCreatePrivateGameClick}
              selected={activePanel === 'createPrivateGame'}
              disabled={isCreating}
              className="w-full md:w-auto"
            >
              CREATE PRIVATE GAME
            </MenuButton>
          </div>
        </div>

        {/* Header Divider */}
        <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] h-px opacity-70 shrink-0 to-[rgba(255,255,255,0)] via-50% via-[#ffffff] w-full" />

        {/* Main Wrapper */}
        <div className="content-stretch flex flex-col lg:flex-row gap-[50px] items-start relative shrink-0 w-full pr-0">
          {/* Sidebar */}
          <div className="content-stretch flex flex-col gap-[50px] lg:gap-[80px] items-start relative shrink-0 w-full lg:w-auto lg:min-w-[340px]">
            {/* Player Name */}
            <div className="content-stretch flex gap-[18px] items-center justify-start lg:justify-end relative shrink-0">
              {/* Online Status Dot */}
              <div className="relative shrink-0 size-[22px]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
                  <circle cx="11" cy="11" fill="#00BD13" r="11" />
                </svg>
              </div>

              {/* Name and Notes */}
              <div className="content-stretch flex flex-col items-start justify-center relative shrink-0">
                <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[32px] md:text-[56px] text-white max-w-[340px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  {displayName}
                </p>
                <div className="content-stretch flex items-center pl-[4px] pr-0 py-0 relative shrink-0">
                  <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#888] text-[16px] max-w-[340px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Testing the alpha!
                  </p>
                </div>
              </div>
            </div>

            {/* Main Nav */}
            <div className="content-stretch flex flex-col gap-[30px] lg:gap-[50px] items-start lg:pl-[40px] pr-0 py-0 relative shrink-0">
              {/* Multiplayer */}
              <div 
                className="content-stretch flex items-center justify-center pb-[5px] pt-0 px-0 relative shrink-0 cursor-pointer"
                onClick={() => setActivePanel('multiplayer')}
              >
                {activePanel === 'multiplayer' && (
                  <div aria-hidden="true" className="absolute border-[#cd8cff] border-[0px_0px_7px] border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p 
                  className={`font-['Roboto:Black',sans-serif] font-black leading-[32px] relative shrink-0 text-[24px] md:text-[28px] text-nowrap uppercase ${
                    activePanel === 'multiplayer' ? 'text-[#cd8cff]' : 'text-white hover:text-[#cd8cff]/80'
                  }`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Multiplayer
                </p>
              </div>

              {/* Rules & Codex */}
              <div 
                className="content-stretch flex items-center justify-center pb-[5px] pt-0 px-0 relative shrink-0 cursor-pointer"
                onClick={() => setActivePanel('rules')}
              >
                {activePanel === 'rules' && (
                  <div aria-hidden="true" className="absolute border-[#cd8cff] border-[0px_0px_7px] border-solid inset-[0_0_-7px_0] pointer-events-none" />
                )}
                <p 
                  className={`font-['Roboto:Black',sans-serif] font-black leading-[32px] relative shrink-0 text-[24px] md:text-[28px] text-nowrap uppercase ${
                    activePanel === 'rules' ? 'text-[#cd8cff]' : 'text-white hover:text-[#cd8cff]/80'
                  }`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {`Rules & Codex`}
                </p>
              </div>

              {/* Back */}
              <p 
                className="font-['Roboto:ExtraBold',sans-serif] font-extrabold leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white uppercase cursor-pointer hover:text-white/80" 
                style={{ fontVariationSettings: "'wdth' 100" }}
                onClick={alphaDisableAuth ? onExit : onLogout}
              >
                BACK
              </p>

              {/* Future Menu */}
              <div className="content-stretch flex flex-col gap-[25px] items-start relative shrink-0 w-full">
                <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[normal] relative shrink-0 text-[#888] text-[18px] uppercase w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                  IN Future:
                </p>
                
                <div className="content-stretch flex items-start pb-[5px] pt-0 px-0 relative shrink-0 w-full">
                  <p className="font-['Roboto:ExtraBold',sans-serif] font-extrabold leading-[22px] relative shrink-0 text-[#888] text-[20px] text-nowrap uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Game History<br />& Stats
                  </p>
                </div>

                <div className="content-stretch flex items-start pb-[5px] pt-0 px-0 relative shrink-0 w-full">
                  <p className="font-['Roboto:ExtraBold',sans-serif] font-extrabold leading-[22px] relative shrink-0 text-[#888] text-[20px] text-nowrap uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Play Computer
                  </p>
                </div>

                <div className="content-stretch flex items-start pb-[5px] pt-0 px-0 relative shrink-0 w-full">
                  <p className="font-['Roboto:ExtraBold',sans-serif] font-extrabold leading-[22px] relative shrink-0 text-[#888] text-[20px] text-nowrap uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Single Player<br />Campaign
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Screen Content */}
          <div className="content-stretch flex flex-col items-start relative shrink-0 w-full lg:w-auto lg:flex-1 max-w-full">
            {/* Render active panel */}
            {activePanel === 'multiplayer' && (
              <MultiplayerPanel
                alphaDisableAuth={alphaDisableAuth}
                onGameCreated={onGameCreated}
                onCreatePrivateGame={onCreatePrivateGame}
                onNavigateToCreateGame={() => setActivePanel('createPrivateGame')}
              />
            )}
            {activePanel === 'rules' && (
              <RulesPanel />
            )}
            {activePanel === 'createPrivateGame' && (
              <CreatePrivateGamePanel
                onCreatePrivateGame={handleCreateGameWithSettings}
                onBack={() => setActivePanel('multiplayer')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}