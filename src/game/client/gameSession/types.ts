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

export type ReadyUxState = {
  clickedThisPhase: boolean; // user explicitly clicked Ready in this phase instance
  sendingNow: boolean;       // client is awaiting server response for the Ready flow
};

export type EvolverChoiceId = 'hold' | 'oxite' | 'asterite';
export type CentaurChargeSubTabId = 'charges' | 'ship_of_equality';

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
  diceValue: 1 | 2 | 3 | 4 | 5 | 6;
  diceAnimateKey: number; // increments on each DICE_ROLLED event (drives animation)

  /**
   * Optional overlay dice + ship icon for dice modifiers.
   *
   * IMPORTANT UX: the BIG dice always shows the shared "normal" roll for the turn.
   * The overlay dice indicates a special rule (e.g. Leviathan reads as 6).
   */
  diceOverlay?: {
    value: 1 | 2 | 3 | 4 | 5 | 6;
    sourceShipDefId: ShipDefId;
    /** Optional animation key for overlay-only rerolls (not used for LEV). */
    animateKey?: number;
  } | null;
  
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

  /**
   * Stable unique key for rendered fleet stack.
   * - default: shipDefId
   * - maxCharges=1 split: `${shipDefId}__charges_1` / `${shipDefId}__charges_0`
   * - maxCharges>1 active: `${shipDefId}__inst_${instanceId}`
   * - maxCharges>1 depleted bucket: `${shipDefId}__charges_0`
   */
  stackKey: string;

  /**
   * Optional condition (used later for graphics selection).
   * Only required for charge-split/bucket stacks.
   */
  condition?: 'charges_1' | 'charges_0';

  /**
   * Current charge count for maxCharges>1 active instance entries.
   * Used to select charges_X graphic variant (e.g. charges_6, charges_4, charges_0).
   * Only populated for active instances with maxCharges > 1.
   */
  currentCharges?: number | null;

  /**
   * Optional small caption rendered under the ship graphic.
   * Purely presentational (client-side).
   */
  caption?: string | null;
}

export interface BoardDestroyTargetState {
  isTargetable: boolean;
  isHovered: boolean;
  isSelected: boolean;
}

export interface BoardDestroyTargetingViewModel {
  activeSourceInstanceId: string | null;
  targetStatesBySide: {
    my: Record<string, BoardDestroyTargetState>;
    opponent: Record<string, BoardDestroyTargetState>;
  };
  previewShipDefIdBySide: {
    my: Partial<Record<string, ShipDefId>>;
    opponent: Partial<Record<string, ShipDefId>>;
  };
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
      myVoidFleet: BoardFleetSummary[];
      opponentVoidFleet: BoardFleetSummary[];
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
      myBonusLinesOnEven: number;
      opponentBonusLinesOnEven: number;
      mySavedJoiningLines: number;
      opponentSavedJoiningLines: number;
      myJoiningBonusLines: number;
      opponentJoiningBonusLines: number;
      
      // Animation stagger plans
      opponentFleetEntryPlan: OpponentFleetEntryPlan;
      activationStaggerPlan: ActivationStaggerPlan;

      // Client-only targeting affordances derived from server-provided validTargets
      destroyTargeting?: BoardDestroyTargetingViewModel;
    };

// Type alias for choose species board mode
export type ChooseSpeciesBoardVm = Extract<BoardViewModel, { mode: 'choose_species' }>;

export interface BottomActionRailViewModel {
  // Subphase info
  subphaseTitle: string; // e.g., "Subphase information"
  subphaseSubheading: string;
  
  // Ready controls
  canUndoActions: boolean;
  /** If false, BottomActionRail must not render the Ready button at all (game finished). */
  readyButtonVisible: boolean;
  readyButtonLabel: string; // e.g., "READY", "WAITING", "GAME OVER"
  readyButtonNote: string | null;
  nextPhaseLabel: string; // e.g., "BATTLE PHASE"
  readyDisabled: boolean;
  readyDisabledReason: string | null;
  
  // NEW: server-authoritative ready indicator for button selected state
  readySelected: boolean;
  
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

    // Turn Flow widget (Menu panel)
    turnNumber: number;
    phaseKey: string;
    hasActionsForMe: boolean;
  };
  endOfGame?: {
    bannerText: string;
    bannerBgCssVar: string; // "var(--shapeships-...)"
    metaLeftText: string;
    metaRightText: string;
  };

  // NEW (UI-derivations for panels)
  frigateDrawing?: { frigateCount: number; selectedTriggers: number[] };
  evolverDrawing?: {
    rows: Array<{
      rowId: string;
      choiceId: EvolverChoiceId;
    }>;
  };

  shipChoices?: {
    groups: ShipChoicesPanelGroup[];
    showOpponentAlsoHasCharges?: boolean;
    opponentEligibleAtDeclarationStart?: boolean;
    opponentAlsoHasChargesHeading?: string;
    opponentAlsoHasChargesLines?: string[];
    selectedChoiceIdBySourceInstanceId?: Record<string, string>;
    centaurChargeTabs?: {
      activeTab: CentaurChargeSubTabId;
      availableTabs: CentaurChargeSubTabId[];
    };
  };

  largeChoicePanel?: {
    instruction?: string;
  };

  // Server-projected actions for this phase (empty array when none)
  availableActions: any[];

  // Selection state for server-choice panels
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
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
  onSelectShipChoiceForInstance: (sourceInstanceId: string, choiceId: string) => void;
  onSelectCentaurChargeSubTab: (tabId: CentaurChargeSubTabId) => void;
  onSelectFrigateTrigger: (frigateIndex: number, triggerNumber: number) => void;
  onSelectEvolverChoice: (rowId: string, choiceId: EvolverChoiceId) => void;
  onBoardBackgroundMouseDown: () => void;
  onDestroyTargetStackHoverChange: (side: 'my' | 'opponent', stackKey: string | null) => void;
  onDestroyTargetStackMouseDown: (side: 'my' | 'opponent', stackKey: string) => void;
}
