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
import type { ActivationStaggerPlan } from '../../display/graphics/animation-stagger';
import type { ProvisionalShipEligibility } from './provisionalBuild';

export type ReadyUxState = {
  clickedThisPhase: boolean; // user explicitly clicked Ready in this phase instance
  sendingNow: boolean;       // client is awaiting server response for the Ready flow
};

export type AuthoritativeStateSource = 'game_state' | 'intent_success' | 'intent_failure';

export interface AuthoritativeStateApplyMeta {
  source: AuthoritativeStateSource;
  requestSeq?: number;
  unlockEligible?: boolean;
}

export interface GameStateRequestMeta {
  requestSeq: number;
  unlockEligible: boolean;
  resumeLockActivationRequestSeq: number | null;
}

export interface GameStateClockSnapshot {
  remainingMsByPlayerId: Record<string, number>;
  clocksAreLive: boolean;
  serverNowMs: number;
}

export interface GameStateHeadResponse {
  gameId: string;
  stateRevision: number;
  status: string;
  turnNumber: number;
  phaseKey: string;
  clock: GameStateClockSnapshot | null;
}

export interface AcceptedFullStateFingerprint {
  stateRevision: number;
  status: string;
  turnNumber: number;
  phaseKey: string;
}

export type EvolverChoiceId = 'hold' | 'oxite' | 'asterite';
export type CentaurChargeSubTabId = 'charges' | 'ship_of_equality';
export type BuildDrawingActionFamily = 'evolver' | 'frigate';
export type FirstStrikeActionFamily = 'guardian' | 'sacrificial_pool';

export type HudStatusTone = 'ready' | 'neutral' | 'hidden';

export type LeftRailDiceManipulationShipDefId = 'LEV' | 'KNO' | 'CHR';

export interface BattleLogTurnPlayerSummary {
  playerId: string;
  name: string;
  healthEnd: number;
  healthDelta: number;
}

export interface BattleLogTurnSummary {
  turnNumber: number;
  diceValue: number | null;
  players: BattleLogTurnPlayerSummary[];
  buildLinesByPlayerId: Record<string, string[]>;
  battleLinesByPlayerId: Record<string, string[]>;
}

export interface BattleLogHistoryResponse {
  gameId: string;
  revision: number;
  completedTurnCount: number;
  turns: BattleLogTurnSummary[];
}

export type GameSessionChatEntry =
  | {
      id?: string;
      type: 'message';
      playerId?: string;
      playerName?: string;
      content: string;
      timestamp: number;
    }
  | {
      id?: string;
      type: 'system';
      content: string;
      timestamp: number;
    }
  | {
      id?: string;
      type: 'rematch_invite';
      playerId?: string;
      playerName?: string;
      content: string;
      newGameId: string | null;
      timestamp: number;
    };

export type LeftRailChatMessageVm =
  | {
      type: 'player';
      playerName: string;
      text: string;
    }
  | {
      type: 'system';
      text: string;
    }
  | {
      type: 'rematch_invite';
      text: string;
      targetGameId: string | null;
    };

export type BattleLogTokenVm =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'multiplier';
      text: 'x';
    }
  | {
      kind: 'ship';
      text: string;
      shipDefId: string;
      allowUpgradeColor: boolean;
      upgradeColorName?: string | null;
    };

export interface BattleLogLineVm {
  tokens: BattleLogTokenVm[];
}

export interface BattleLogTurnSideVm {
  healthEnd: number;
  healthDelta: number;
  buildLines: BattleLogLineVm[];
  battleLines: BattleLogLineVm[];
}

export interface BattleLogTurnVm {
  turnNumber: number;
  diceValue: number | null;
  showBuildSection: boolean;
  showBattleSection: boolean;
  me: BattleLogTurnSideVm;
  opponent: BattleLogTurnSideVm;
}

export interface LeftRailDiceManipulationSlotViewModel {
  sourceShipDefId: LeftRailDiceManipulationShipDefId;
  diceValues?: Array<1 | 2 | 3 | 4 | 5 | 6>;
  animateKey?: number;
}

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
  turnTakeoverTurn: number | null;
  turnTakeoverAnimateKey: number;

  diceManipulationSlots: {
    left: LeftRailDiceManipulationSlotViewModel | null;
    right: LeftRailDiceManipulationSlotViewModel | null;
  };
  
  // Phase card
  turn: number;
  phase: string; // "BUILD PHASE", "BATTLE PHASE"
  phaseIcon: 'build' | 'battle';
  subphase: string;
  
  // Chat
  gameCode: string;
  chatMessages: LeftRailChatMessageVm[];
  drawOffer: {
    fromPlayer: string;
    canRespond: boolean;
  } | null;
  
  // Battle log
  battleLogNames: {
    me: string;
    opponent: string;
  };
  battleLogTurns: BattleLogTurnVm[];
  battleLogAutoScrollKey: string;
}

export interface BoardFleetSummary {
  shipDefId: string;
  count: number;

  /**
   * Semantic fleet bucket identity.
   * - default: shipDefId
   * - maxCharges=1 split: `${shipDefId}__charges_1` / `${shipDefId}__charges_0`
   * - maxCharges>1 active: `${shipDefId}__inst_${instanceId}`
   * - maxCharges>1 depleted bucket: `${shipDefId}__charges_0`
   *
   * This remains the semantic key used by targeting and preview lookup paths.
   */
  stackKey: string;

  /**
   * Live board/render identity.
   * Owned by client-runtime reconciliation and used for React keys, FLIP, and
   * animation bookkeeping.
   */
  renderKey: string;

  /**
   * Lightweight runtime metadata used to reconcile render identity across
   * semantic stack changes.
   */
  memberInstanceIds: string[];

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

export interface BoardStatBreakdownRowVm {
  rowKind: 'ship' | 'adjustment';
  label: string;
  count?: number;
  amount: number;
  amountText: string;
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
      myFleetRenderOrder: string[];
      opponentFleetRenderOrder: string[];
      fleetAnim: FleetAnimVM; // Animation tokens (DEF/FIG only)
      
      // Last turn deltas (server-authoritative)
      myLastTurnHeal: number;
      myLastTurnDamage: number;
      myLastTurnNet: number;
      opponentLastTurnHeal: number;
      opponentLastTurnDamage: number;
      opponentLastTurnNet: number;
      myLastDamageBreakdownRows: BoardStatBreakdownRowVm[];
      opponentLastDamageBreakdownRows: BoardStatBreakdownRowVm[];
      myLastHealingBreakdownRows: BoardStatBreakdownRowVm[];
      opponentLastHealingBreakdownRows: BoardStatBreakdownRowVm[];
      
      // Bonus lines (server-authoritative)
      myBonusLines: number;
      opponentBonusLines: number;
      myBonusLinesOnEven: number;
      opponentBonusLinesOnEven: number;
      myDisplayedSavedLines: number;
      opponentDisplayedSavedLines: number;
      myDisplayedSavedJoiningLines: number;
      opponentDisplayedSavedJoiningLines: number;
      mySavedJoiningLines: number;
      opponentSavedJoiningLines: number;
      myJoiningBonusLines: number;
      opponentJoiningBonusLines: number;
      myBonusBreakdownRows: BoardStatBreakdownRowVm[];
      opponentBonusBreakdownRows: BoardStatBreakdownRowVm[];
      
      // Animation stagger plan
      activationStaggerPlan: ActivationStaggerPlan;

      // Client-only one-shot presentation trigger for opponent reveal blur
      presentedOpponentRevealBlurSeq: number;

      // Client-only targeting affordances derived from server-provided validTargets
      destroyTargeting?: BoardDestroyTargetingViewModel;
    };

// Type alias for choose species board mode
export type ChooseSpeciesBoardVm = Extract<BoardViewModel, { mode: 'choose_species' }>;

export interface BottomActionRailViewModel {
  // Subphase info
  subphaseTitle: string; // e.g., "Subphase information"
  subphaseTitleSuffix?: string | null;
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

export type HealthResolutionValueTone = 'damage' | 'heal' | 'neutral';

export interface HealthResolutionSideVm {
  prefixText: string;
  valueText: string;
  suffixText: string;
  valueTone: HealthResolutionValueTone;
  valueWeight: 'regular' | 'black';
}

export interface HealthResolutionPresentationVm {
  presentationKey: string;
  left: HealthResolutionSideVm;
  right: HealthResolutionSideVm;
}

export interface ActionPanelBuildCatalogueViewModel {
  context: 'buildable' | 'reference_only' | 'unavailable';
  canAddShipById: Partial<Record<ShipDefId, boolean>>;
  displayCostByShipId: Partial<Record<ShipDefId, number>>;
  eligibilityByShipId: Partial<Record<ShipDefId, ProvisionalShipEligibility>>;
}

export interface ActionPanelViewModel {
  activePanelId: ActionPanelId;
  tabs: ActionPanelTabVm[];
  buildCatalogue: ActionPanelBuildCatalogueViewModel;
  menu: {
    title: string;
    subtitle: string;

    // Turn Flow widget (Menu panel)
    turnNumber: number;
    phaseKey: string;
    hasActionsForMe: boolean;
    canOfferDraw: boolean;
    canResign: boolean;
  };
  endOfGame?: {
    bannerText: string;
    bannerBgCssVar: string; // "var(--shapeships-...)"
    metaLeftText: string;
    metaRightText: string;
    rematchHelperText: string;
  };
  healthResolutionOverlay?: HealthResolutionPresentationVm;
  tabInteractionLocked?: boolean;

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

  phaseLocalFamilySwitch?:
    | {
        phase: 'build.drawing';
        activeFamily: BuildDrawingActionFamily;
        availableFamilies: BuildDrawingActionFamily[];
      }
    | {
        phase: 'battle.first_strike';
        activeFamily: FirstStrikeActionFamily;
        availableFamilies: FirstStrikeActionFamily[];
      };

  largeChoicePanel?: {
    title?: string;
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
  onJoinRematchInvite?: (gameId: string) => void;
  onDownloadBattleLog: () => void;
  onSelectShipChoiceForInstance: (sourceInstanceId: string, choiceId: string) => void;
  onSelectCentaurChargeSubTab: (tabId: CentaurChargeSubTabId) => void;
  onSelectFrigateTrigger: (frigateIndex: number, triggerNumber: number) => void;
  onSelectEvolverChoice: (rowId: string, choiceId: EvolverChoiceId) => void;
  onSelectBuildDrawingFamily?: (family: BuildDrawingActionFamily) => void;
  onSelectFirstStrikeFamily?: (family: FirstStrikeActionFamily) => void;
  onBoardBackgroundMouseDown: () => void;
  onDestroyTargetStackHoverChange: (side: 'my' | 'opponent', stackKey: string | null) => void;
  onDestroyTargetStackMouseDown: (side: 'my' | 'opponent', stackKey: string) => void;
}
