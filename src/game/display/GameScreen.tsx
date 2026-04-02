/**
 * Game Screen
 * Main in-match layout shell for Alpha
 * Composition with light display orchestration for screen-level UI timing.
 * 
 * CHUNK 9.1: BOOT GATING (Loading screen until valid server state)
 * 
 * LAYOUT:
 * - Full viewport (100vw x 100vh, overflow hidden)
 * - Two columns: LeftRail (fixed width) + MainStage (flex)
 * - Loading screen: centered "LOADING GAME" until first valid server state
 * 
 * CONTROLLER:
 * - Uses useGameSession hook for ALL state and actions
 * - Passes view-models down to layout components
 */

import { useEffect, useRef, useState } from 'react';
import { Checkbox } from '../../components/ui/primitives/controls/Checkbox';
import { type GameSessionViewModel, useGameSession } from '../client/useGameSession';
import { LeftRail } from './layout/LeftRail';
import { MainStage } from './layout/MainStage';
import { StarsBackground } from './graphics/StarsBackground';

const TURN_BLUR_STORAGE_KEY = 'shapeships.turnBlurEnabled';
const FIRST_TURN_BUILD_HELPER_FADE_MS = 150;

interface GameScreenProps {
  gameId: string;
  playerName: string;
  onBack: () => void;
}

export default function GameScreen({ gameId, playerName, onBack }: GameScreenProps) {
  const { vm, actions } = useGameSession(gameId, playerName);
  const [turnBlurEnabled, setTurnBlurEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      const storedValue = window.localStorage.getItem(TURN_BLUR_STORAGE_KEY);
      return storedValue === null ? true : storedValue === 'true';
    } catch {
      return true;
    }
  });
  const firstTurnBuildHelper = useFirstTurnBuildHelper(gameId, vm, actions.onReadyToggle);

  useEffect(() => {
    try {
      window.localStorage.setItem(TURN_BLUR_STORAGE_KEY, String(turnBlurEnabled));
    } catch {
      // Keep the preference in memory if browser storage is unavailable.
    }
  }, [turnBlurEnabled]);

  function toggleTurnBlur() {
    setTurnBlurEnabled((current) => !current);
  }

  const mainStageActions = {
    ...actions,
    onReadyToggle: firstTurnBuildHelper.handleReadyToggle,
  };

  const celebrateOnFinish = Boolean(vm.actionPanel.endOfGame);

  // ============================================================================
  // CHUNK 9.1: BOOT GATING — Show loading screen until valid server state
  // ============================================================================
  
  if (vm.isBootstrapping) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-sm font-semibold tracking-wide text-white">
          LOADING GAME
        </div>
      </div>
    );
  }

  // ============================================================================
  // NORMAL GAME UI (After bootstrap complete)
  // ============================================================================

  return (
    <div className="ss-playerRoot relative w-full h-screen min-h-0 overflow-hidden">
      {/* Stars background layer (behind everything in this screen) */}
      <div className="absolute inset-0 z-0">
        <StarsBackground celebrateOnFinish={celebrateOnFinish} />
      </div>

      <div
        aria-hidden="true"
        className={`absolute inset-0 z-[1] pointer-events-none bg-black transition-opacity ease-linear ${
          celebrateOnFinish
            ? 'opacity-65 delay-[1400ms] duration-[2200ms]'
            : 'opacity-0 delay-0 duration-300'
        }`}
      />

      {/* Foreground layout (existing UI) */}
      <div className="relative z-10 w-full h-full min-h-0 flex items-stretch gap-5 px-[30px]">
        <div className="fixed right-[10px] top-[10px] z-50">
          <div className="flex items-center gap-[4px] rounded-[10px] px-[10px] py-[10px]">
            <Checkbox className="w-[22px] h-[22px]" checked={turnBlurEnabled} onChange={setTurnBlurEnabled} />
            <button
              type="button"
              onClick={toggleTurnBlur}
              className="text-white transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ fontSize: '15px', fontWeight: 400, lineHeight: 1.2 }}
            >
              Turn Blur
            </button>
          </div>
        </div>

        {/* Left Rail - fixed width */}
        <LeftRail
          vm={vm.leftRail}
          actions={actions}
          firstTurnBuildHelperEligible={firstTurnBuildHelper.firstTurnBuildHelperEligible}
          firstTurnBuildHelperDismissSignal={firstTurnBuildHelper.firstTurnBuildHelperDismissSignal}
          onFirstTurnBuildHelperDismiss={firstTurnBuildHelper.dismissFirstTurnBuildHelper}
        />

        {/* Main Stage - fills remaining width */}
        <MainStage 
          hudVm={vm.hud}
          boardVm={vm.board}
          bottomActionRailVm={vm.bottomActionRail}
          actionPanelVm={vm.actionPanel}
          actions={mainStageActions}
          turnBlurEnabled={turnBlurEnabled}
          onReturnToMainMenu={onBack}
        />
        
        {/* Global Ship Hover Layer (PASS 2) - Portal target for catalogue hover cards */}
        <div
          id="ship-hover-layer"
          className="fixed inset-0 z-[40] pointer-events-none"
        />
      </div>
    </div>
  );
}

function useFirstTurnBuildHelper(
  gameId: string,
  vm: GameSessionViewModel,
  onReadyToggle: () => void
) {
  const [hasDismissedFirstTurnBuildHelper, setHasDismissedFirstTurnBuildHelper] = useState(false);
  const [firstTurnBuildHelperDismissSignal, setFirstTurnBuildHelperDismissSignal] = useState(0);
  const isFirstTurnBuildHelperReadyPassInFlightRef = useRef(false);
  const firstTurnBuildHelperReadyDelayRef = useRef<number | null>(null);
  const firstTurnBuildHelperInvalidationTokenRef = useRef(0);

  const phaseKey = vm.actionPanel.menu.phaseKey;
  const firstTurnBuildHelperEligible =
    vm.board.mode !== 'choose_species' &&
    vm.leftRail.turn === 1 &&
    typeof phaseKey === 'string' &&
    phaseKey.startsWith('build.') &&
    vm.actionPanel.menu.canResign === true;

  function dismissFirstTurnBuildHelperInternal(): boolean {
    if (!firstTurnBuildHelperEligible || hasDismissedFirstTurnBuildHelper) {
      return false;
    }

    setHasDismissedFirstTurnBuildHelper(true);
    setFirstTurnBuildHelperDismissSignal((current) => current + 1);
    return true;
  }

  useEffect(() => {
    firstTurnBuildHelperInvalidationTokenRef.current += 1;
    isFirstTurnBuildHelperReadyPassInFlightRef.current = false;
    if (firstTurnBuildHelperReadyDelayRef.current !== null) {
      window.clearTimeout(firstTurnBuildHelperReadyDelayRef.current);
      firstTurnBuildHelperReadyDelayRef.current = null;
    }
    setHasDismissedFirstTurnBuildHelper(false);
    setFirstTurnBuildHelperDismissSignal(0);
  }, [gameId]);

  useEffect(() => {
    return () => {
      firstTurnBuildHelperInvalidationTokenRef.current += 1;
      isFirstTurnBuildHelperReadyPassInFlightRef.current = false;
      if (firstTurnBuildHelperReadyDelayRef.current !== null) {
        window.clearTimeout(firstTurnBuildHelperReadyDelayRef.current);
        firstTurnBuildHelperReadyDelayRef.current = null;
      }
    };
  }, []);

  function dismissFirstTurnBuildHelper() {
    dismissFirstTurnBuildHelperInternal();
  }

  async function handleReadyToggle() {
    if (!firstTurnBuildHelperEligible || hasDismissedFirstTurnBuildHelper) {
      await Promise.resolve(onReadyToggle());
      return;
    }

    if (isFirstTurnBuildHelperReadyPassInFlightRef.current) {
      return;
    }

    isFirstTurnBuildHelperReadyPassInFlightRef.current = true;
    const didDismiss = dismissFirstTurnBuildHelperInternal();
    const invalidationToken = firstTurnBuildHelperInvalidationTokenRef.current;

    if (!didDismiss) {
      try {
        await Promise.resolve(onReadyToggle());
      } finally {
        if (firstTurnBuildHelperInvalidationTokenRef.current === invalidationToken) {
          isFirstTurnBuildHelperReadyPassInFlightRef.current = false;
        }
      }
      return;
    }

    await new Promise<void>((resolve) => {
      firstTurnBuildHelperReadyDelayRef.current = window.setTimeout(() => {
        firstTurnBuildHelperReadyDelayRef.current = null;
        resolve();
      }, FIRST_TURN_BUILD_HELPER_FADE_MS);
    });

    try {
      if (firstTurnBuildHelperInvalidationTokenRef.current !== invalidationToken) {
        return;
      }

      await Promise.resolve(onReadyToggle());
    } finally {
      if (firstTurnBuildHelperInvalidationTokenRef.current === invalidationToken) {
        isFirstTurnBuildHelperReadyPassInFlightRef.current = false;
      }
    }
  }

  return {
    firstTurnBuildHelperEligible,
    firstTurnBuildHelperDismissSignal,
    dismissFirstTurnBuildHelper,
    handleReadyToggle,
  };
}
