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

import { useGameSession } from '../client/useGameSession';
import { LeftRail } from './layout/LeftRail';
import { MainStage } from './layout/MainStage';
import { StarsBackground } from './graphics/StarsBackground';

interface GameScreenProps {
  gameId: string;
  playerName: string;
  onBack: () => void;
}

export default function GameScreen({ gameId, playerName, onBack }: GameScreenProps) {
  const { vm, actions } = useGameSession(gameId, playerName);

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
        <StarsBackground />
      </div>

      {/* Foreground layout (existing UI) */}
      <div className="relative z-10 w-full h-full min-h-0 flex items-stretch gap-5 px-[30px]">
        {/* Left Rail - fixed width */}
        <LeftRail vm={vm.leftRail} actions={actions} onBack={onBack} />

        {/* Main Stage - fills remaining width */}
        <MainStage 
          hudVm={vm.hud}
          boardVm={vm.board}
          bottomActionRailVm={vm.bottomActionRail}
          actionPanelVm={vm.actionPanel}
          actions={actions}
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