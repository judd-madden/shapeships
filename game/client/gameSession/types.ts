/**
 * gameSession/types
 * -----------------
 * Extracted view-model and action types from useGameSession.ts.
 * Type-only module (no runtime code).
 */

import type { ActionPanelId } from '../../display/actionPanel/ActionPanelRegistry';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import type { ShipChoicesPanelGroup } from '../../types/ShipChoiceTypes';
import type { FleetAnimVM } from '../../display/graphics/animation';
import type { OpponentFleetEntryPlan, ActivationStaggerPlan } from '../../display/graphics/animation-stagger';

export type HudStatusTone = 'ready' | 'neutral' | 'hidden';

export interface HudViewModel {
  // Player 1 (local, always left)
  p1Name: string;
  p1Species: string;
  p1IsOnline: boolean;
  p1Clock: string; // "MM:SS"
  p1IsReady: boolean;
  p1StatusText?: string;       // "Ready" or subphase label; undefined hides pill
  p1StatusTone: HudStatusTone; // ready | neutral | hidden
  
  // Player 2 (opponent, always right)
  p2Name: string;
  p2Species: string;
  p2IsOnline: boolean;
  p2Clock: string; // "MM:SS"
  p2IsReady: boolean;
  p2StatusText?: string;
  p2StatusTone: HudStatusTone;
}

export interface LeftRailViewModel {
  // Dice
  diceValue: number; // 1-6
  
  // Phase card
  turn: number;
  phase: string; // "BUILD PHASE", "BATTLE PHASE"
  phaseIcon: 'build' | 'battle';
  subphase: string;
  
  // Chat
  gameCode: string;
  chatMessages: Array<{
    type: 'player' | 'system';
    playerName?: string;
    text: string;
  }>;
  drawOffer: {
    fromPlayer: string;
  } | null;
  
  // Battle log
  battleLogEntries: Array<{
    type: 'event' | 'turn-marker';
    text?: string;
    turn?: number;
    phase?: string;
  }>;
}

export interface BoardFleetSummary {
  shipDefId: string;
  count: number;
}

export type BoardViewModel =
  | {
      mode: 'choose_species';
      selectedSpecies: SpeciesId;
      gameUrl: string;
      canConfirmSpecies: boolean;
      confirmDisabledReason?: string;
    }
  | {
      mode: 'board';
      mySpeciesId: SpeciesId;
      opponentSpeciesId: SpeciesId;
      
      turnNumber: number;
      myHealth: number;
      opponentHealth: number;
      myFleet: BoardFleetSummary[];
      opponentFleet: BoardFleetSummary[];
      myFleetOrder: ShipDefId[];
      opponentFleetOrder: ShipDefId[];
      fleetAnim: FleetAnimVM; // Animation tokens (DEF/FIG only)
      
      // Last turn deltas (server-authoritative)
      myLastTurnHeal: number;
      myLastTurnDamage: number;
      myLastTurnNet: number;
      opponentLastTurnHeal: number;
      opponentLastTurnDamage: number;
      opponentLastTurnNet: number;
      
      // Bonus lines (server-authoritative)
      myBonusLines: number;
      opponentBonusLines: number;
      
      // Animation stagger plans
      opponentFleetEntryPlan: OpponentFleetEntryPlan;
      activationStaggerPlan: ActivationStaggerPlan;
    };

// Type alias for choose species board mode
export type ChooseSpeciesBoardVm = Extract<BoardViewModel, { mode: 'choose_species' }>;

export interface BottomActionRailViewModel {
  // Subphase info
  subphaseTitle: string; // e.g., "Subphase information"
  subphaseSubheading: string;
  
  // Ready controls
  canUndoActions: boolean;
  readyButtonLabel: string; // e.g., "READY", "WAITING", "GAME OVER"
  readyButtonNote: string | null;
  nextPhaseLabel: string; // e.g., "BATTLE PHASE"
  readyDisabled: boolean;
  readyDisabledReason: string | null;
  
  // NEW: server-authoritative ready indicator for button selected state
  readySelected: boolean;
  
  // Visual-only flash when second to ready
  readyFlashSelected: boolean;
  
  // Misc
  spectatorCount: number;
}

// Action Panel Tab ID (fixed set of reference tabs)
export type ActionPanelTabId =
  | 'tab.catalog.selected'   // choose_species mode only
  | 'tab.catalog.self'       // in-game reference tab
  | 'tab.catalog.opponent'   // in-game reference tab (conditional)
  | 'tab.actions'            // ship choice actions (conditional)
  | 'tab.menu';

export interface ActionPanelTabVm {
  tabId: ActionPanelTabId;
  label: string;              // e.g. "[Species 1]" "[Species 2]" "Menu"
  visible: boolean;           // opponent tab hidden when same species
  targetPanelId: ActionPanelId; // which panel this tab jumps to
}

export interface ActionPanelViewModel {
  activePanelId: ActionPanelId;
  tabs: ActionPanelTabVm[];
  menu: {
    title: string;
    subtitle: string;
  };
  endOfGame?: {
    bannerText: string;
    bannerBgCssVar: string; // "var(--shapeships-...)"
    metaLeftText: string;
    metaRightText: string;
  };

  // NEW (UI-derivations for panels)
  frigateDrawing?: { frigateCount: number };
  evolverDrawing?: { evolverCount: number };

  shipChoices?: {
    groups: ShipChoicesPanelGroup[];
    showOpponentAlsoHasCharges?: boolean;
    opponentAlsoHasChargesHeading?: string;
    opponentAlsoHasChargesLines?: string[];
  };
}

export interface GameSessionViewModel {
  isBootstrapping: boolean; // true until valid server state with valid phaseKey
  hud: HudViewModel;
  leftRail: LeftRailViewModel;
  board: BoardViewModel;
  bottomActionRail: BottomActionRailViewModel;
  actionPanel: ActionPanelViewModel;
}

// ============================================================================
// ACTION CALLBACKS
// ============================================================================

export interface GameSessionActions {
  onReadyToggle: () => void;
  onUndoActions: () => void;
  onOpenMenu: () => void;
  onActionPanelTabClick: (tabId: ActionPanelTabId) => void;
  onShipClick: (shipId: string) => void;
  onSendChat: (text: string) => void;
  onAcceptDraw: () => void;
  onRefuseDraw: () => void;
  onOpenBattleLogFullscreen: () => void;
  onSelectSpecies: (species: SpeciesId) => void;
  onConfirmSpecies: () => void;
  onCopyGameUrl: () => void;
  onBuildShip: (shipDefId: ShipDefId) => void; // Chunk 6: Local build preview
  onOfferDraw: () => void;
  onResignGame: () => void;
  onRematch: () => void;
  onDownloadBattleLog: () => void;
}