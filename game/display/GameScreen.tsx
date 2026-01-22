/**
 * Game Screen
 * Main in-match layout shell for Alpha
 * NO LOGIC - composition only (Pass 1.25)
 * 
 * LAYOUT:
 * - Full viewport (100vw x 100vh, overflow hidden)
 * - Two columns: LeftRail (fixed width) + MainStage (flex)
 * 
 * CONTROLLER:
 * - Uses useGameSession hook for ALL state and actions
 * - Passes view-models down to layout components
 */

import { useGameSession } from '../client/useGameSession';
import { LeftRail } from './layout/LeftRail';
import { MainStage } from './layout/MainStage';

interface GameScreenProps {
  gameId: string;
  playerName: string;
  onBack: () => void;
}

export default function GameScreen({ gameId, playerName, onBack }: GameScreenProps) {
  const { vm, actions } = useGameSession(gameId, playerName);

  return (
    <div className="ss-playerRoot w-full h-screen overflow-hidden flex gap-5 px-[30px]">
      {/* Left Rail - fixed width */}
      <LeftRail vm={vm.leftRail} actions={actions} onBack={onBack} />

      {/* Main Stage - fills remaining width */}
      <MainStage 
        hudVm={vm.hud}
        boardVm={vm.board}
        bottomActionRailVm={vm.bottomActionRail}
        actionPanelVm={vm.actionPanel}
        actions={actions}
      />
      
      {/* Global Ship Hover Layer (PASS 2) - Portal target for catalogue hover cards */}
      <div
        id="ship-hover-layer"
        className="fixed inset-0 z-[40] pointer-events-none"
      />
    </div>
  );
}