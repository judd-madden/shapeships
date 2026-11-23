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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RulesPanel } from '../panels/RulesPanel';
import { LorePanel } from '../panels/lore/LorePanel';
import { CreatePrivateGamePanel, type CreatePrivateGameSettings } from '../panels/CreatePrivateGamePanel';
import { SinglePlayerFeatures } from '../panels/SinglePlayerFeatures';
import { WelcomePanel } from '../panels/WelcomePanel';
import { ClaimNamePanel } from '../panels/ClaimNamePanel';
import type { ClaimNameActions } from '../../game/client/account/claimNameForm';
import { MenuHeader } from './menu/MenuHeader';
import { MenuProfileRail } from './menu/MenuProfileRail';
import { MenuNavigation, type MenuPageId } from './menu/MenuNavigation';
import { MenuBottomNav } from './menu/MenuBottomNav';
import { getMenuIdentity } from './menu/menuIdentity';
import type { AccountIdentity } from '../../game/client/account/types';
import { attemptMobileGameFullscreen } from '../../utils/mobileFullscreen';
import { readMenuSetupMemory, writeMenuSetupMemory } from '../../game/client/preferences/menuSetupMemory';
import {
  clearLoreUnread,
  readLoreUnread,
} from '../../game/client/gameSession/mission/missionChallengeSession';
import type { WinStreakMenuActions, WinStreakMenuViewModel } from '../../game/client/winStreak/types';
import { GameMenuButton } from '../ui/primitives/buttons/GameMenuButton';
import { MenuButton } from '../ui/primitives/buttons/MenuButton';
import { DiscordIcon } from '../ui/primitives/icons/DiscordIcon';
import { WinStreakBadge } from '../../game/display/winStreak/WinStreakContent';
import { getMenuWinStreakResetAction, shouldShowWinStreakContent } from '../../game/display/winStreak/winStreakPresentation';

interface MenuShellProps {
  onNavigate: (shell: string) => void;
  onExit: () => void;
  onLogout: () => void;
  onGameCreated: (gameId: string) => void;
  onCreatePrivateGame: (settings: CreatePrivateGameSettings) => Promise<string>;
  onCreateComputerGame: (settings: CreatePrivateGameSettings) => Promise<string>;
  user: any;
  player: any;
  accountIdentity: AccountIdentity | null;
  claimNameActions: ClaimNameActions;
  alphaDisableAuth: boolean;
  winStreakViewModel: WinStreakMenuViewModel;
  winStreakActions: WinStreakMenuActions;
}

export function MenuShell({ 
  onNavigate, 
  onExit, 
  onLogout, 
  onGameCreated, 
  onCreatePrivateGame,
  onCreateComputerGame,
  user, 
  player, 
  accountIdentity,
  claimNameActions,
  alphaDisableAuth,
  winStreakViewModel,
  winStreakActions,
}: MenuShellProps) {
  const [activePanel, setActivePanel] = useState<MenuPageId>('welcome');
  // Read afresh when entering either setup page; the distinct panel slots own local state.
  const rememberedSetup = useMemo(() => (
    activePanel === 'playComputer' || activePanel === 'multiplayer'
      ? readMenuSetupMemory(activePanel)
      : null
  ), [activePanel]);
  const [, setIsCreating] = useState(false);
  const [isLoreUnread, setIsLoreUnread] = useState(() => readLoreUnread());
  const onEnterPlayComputerRef = useRef(winStreakActions.onEnterPlayComputer);
  onEnterPlayComputerRef.current = winStreakActions.onEnterPlayComputer;

  useEffect(() => {
    if (activePanel !== 'lore') return;
    clearLoreUnread();
    setIsLoreUnread(false);
  }, [activePanel]);

  useEffect(() => {
    if (activePanel === 'playComputer') {
      onEnterPlayComputerRef.current();
    }
  }, [activePanel]);

  useEffect(() => {
    if (activePanel === 'claimName' && accountIdentity) setActivePanel('welcome');
  }, [activePanel, accountIdentity]);

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

  const identity = getMenuIdentity(player.name, accountIdentity);

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
    <div className="content-stretch relative flex size-full flex-col items-center px-[5%] pb-[calc(120px_+_env(safe-area-inset-bottom))] pt-[20px] md:pt-[40px] 2xl:pt-[60px]">
      {/* End Welcome's mobile centring space at the nav, before the outer scroll clearance. */}
      <div className={`relative flex w-full max-w-[1430px] shrink-0 flex-col items-center ${activePanel === 'welcome' ? 'max-md:min-h-[calc(100vh_-_20px_-_86px_-_env(safe-area-inset-bottom))] max-md:supports-[height:100svh]:min-h-[calc(100svh_-_20px_-_86px_-_env(safe-area-inset-bottom))]' : ''}`}>
        <MenuHeader />
        <MenuProfileRail identity={identity} onChangeName={onExit} onLogout={onLogout} onClaimName={() => setActivePanel('claimName')} />
        <MenuBottomNav activePanel={activePanel} isLoreUnread={isLoreUnread} onSelect={setActivePanel} />

        {/* Main Wrapper */}
        <div className={`content-stretch relative mt-[20px] flex w-full shrink-0 flex-col items-start gap-[32px] pr-0 md:mt-[32px] min-[1025px]:flex-row min-[1025px]:gap-[28px] xl:mt-[64px] xl:gap-[50px] ${activePanel === 'welcome' ? 'max-md:flex-1 max-md:pb-[20px]' : ''}`}>
          <MenuNavigation activePanel={activePanel} isLoreUnread={isLoreUnread} onSelect={setActivePanel} />

          {/* Menu Screen Content */}
          <div className="content-stretch relative flex w-full min-w-0 max-w-full flex-1 shrink-0 flex-col items-start">
            {/* Render active panel */}
            {activePanel === 'welcome' && <WelcomePanel />}
            {activePanel === 'claimName' && !accountIdentity && (
              <ClaimNamePanel currentName={player.name} actions={claimNameActions} onClaimed={() => setActivePanel('welcome')} />
            )}
            {activePanel === 'multiplayer' && (
              <CreatePrivateGamePanel
                onSubmit={handleCreateGameWithSettings}
                initialTimed={rememberedSetup?.timed ?? true}
                initialPresetKey={rememberedSetup?.presetKey ?? '15_10'}
                onSetupChange={(setup) => writeMenuSetupMemory('multiplayer', setup)}
                secondaryAction={(
                  <MenuButton
                    variant="communityOutline"
                    outlineSize="responsive"
                    leadingIcon={<DiscordIcon />}
                    onClick={() => window.open('https://discord.gg/MjPtf4G6Gt', '_blank', 'noopener,noreferrer')}
                  >
                    FIND OPPONENTS ON DISCORD
                  </MenuButton>
                )}
              />
            )}
            {activePanel === 'rules' && (
              <RulesPanel />
            )}
            {activePanel === 'lore' && (
              <LorePanel />
            )}
            {activePanel === 'playComputer' && (
              <CreatePrivateGamePanel
                onSubmit={handleCreateComputerGameWithSettings}
                initialTimed={rememberedSetup?.timed ?? false}
                initialPresetKey={rememberedSetup?.presetKey ?? '15_10'}
                onSetupChange={(setup) => writeMenuSetupMemory('playComputer', setup)}
                heading="Play Computer"
                subheading="Start a game against a computer opponent."
                primaryActionLabel="PLAY COMPUTER"
                primaryActionStyle="emphasisWhite"
                footer={<SinglePlayerFeatures />}
                headingAccessory={shouldShowWinStreakContent(winStreakViewModel) ? (
                  <div className="flex min-w-0 max-w-full shrink-0 flex-row flex-nowrap items-center gap-[24px] whitespace-nowrap md:justify-end">
                    <WinStreakBadge vm={winStreakViewModel} />
                    {winStreakViewModel.streakState === 'active' ? (
                      <GameMenuButton
                        size="compact"
                        disabled={winStreakViewModel.reset.busy}
                        requiresConfirm
                        confirmLabel="Reset Win Streak (Confirm)"
                        pendingLabel="RESETTING..."
                        onClick={getMenuWinStreakResetAction(winStreakActions)}
                      >
                        Reset Win Streak
                      </GameMenuButton>
                    ) : null}
                  </div>
                ) : undefined}
                primaryActionNotice={winStreakViewModel.rejoinCandidate ? (
                  <p className="max-w-full text-[15px] font-medium text-[var(--shapeships-pastel-red)] sm:text-[20px]">
                    <button
                      type="button"
                      className="underline hover:opacity-80"
                      onClick={winStreakActions.onRejoinTrackedGame}
                    >
                      REJOIN CURRENT GAME: {winStreakViewModel.rejoinCandidate.gameId}.
                    </button>{' '}
                    Starting a new game now will reset your Win Streak.
                  </p>
                ) : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
