/**
 * Game Screen
 * Main in-match layout shell for Alpha
 * NO LOGIC - composition only (Pass 1.25)
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

import { useEffect, useState } from 'react';
import { Checkbox } from '../../components/ui/primitives/controls/Checkbox';
import { useGameSession } from '../client/useGameSession';
import { LeftRail } from './layout/LeftRail';
import { MainStage } from './layout/MainStage';
import { StarsBackground } from './graphics/StarsBackground';

const TURN_BLUR_STORAGE_KEY = 'shapeships.turnBlurEnabled';

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
        <LeftRail vm={vm.leftRail} actions={actions} />

        {/* Main Stage - fills remaining width */}
        <MainStage 
          hudVm={vm.hud}
          boardVm={vm.board}
          bottomActionRailVm={vm.bottomActionRail}
          actionPanelVm={vm.actionPanel}
          actions={actions}
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
