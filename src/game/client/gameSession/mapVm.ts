/**
 * VIEW-MODEL CONSTRUCTION
 * 
 * Maps game state and derived values into the GameSessionViewModel.
 */

import type {
    GameSessionViewModel,
    BoardViewModel,
    ActionPanelTabVm,
    HudStatusTone,
} from '../useGameSession';

import type { ActionPanelId } from '../../display/actionPanel/ActionPanelRegistry';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import type { ShipChoiceGroupSpec, ShipChoicesPanelGroup } from '../../types/ShipChoiceTypes';
import type { EvolverChoiceId } from './types';
import { getShipChoicePanelSpec } from '../../display/actionPanel/panels/ShipChoiceRegistry';
import {
  getAllocatedTargetIdsForRenderableAction,
  getRenderableActionChoiceIds,
  getRenderableActionRequiredTargetCount,
  getRenderableServerChoiceActions,
  isRenderableTargetedAction,
  isRenderableTargetedActionComplete,
} from './availableActions';
import type { CentaurChargeSubTabId } from './types';

function getCountedGroupHeading(groupSpec: {
  headingTemplate: string;
  singularHeadingTemplate?: string;
}, count: number): string {
  const template =
    count === 1 && groupSpec.singularHeadingTemplate
      ? groupSpec.singularHeadingTemplate
      : groupSpec.headingTemplate;

  return template.replace('{count}', String(count));
}

function getNamedGroupHeading(
  phaseKey: string,
  heading: string,
  gameData: any
): string {
  const knoRerollPassIndex = gameData?.turnData?.knoRerollPassIndex;
  if (
    phaseKey === 'build.dice_roll' &&
    heading === 'Ark of Knowledge' &&
    (knoRerollPassIndex === 1 || knoRerollPassIndex === 2)
  ) {
    return `Ark of Knowledge ${knoRerollPassIndex}`;
  }

  return heading;
}

function getTargetedActionButtons(args: {
  buttons: ShipChoiceGroupSpec['buttons'];
  action: any;
  sourceInstanceId: string;
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
  allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]>;
  allocatedDestroyTargetIdBySourceInstanceId: Record<string, string>;
}) {
  const {
    buttons,
    action,
    sourceInstanceId,
    selectedChoiceIdBySourceInstanceId,
    allocatedDestroyTargetIdsBySourceInstanceId,
    allocatedDestroyTargetIdBySourceInstanceId,
  } = args;

  if (!isRenderableTargetedAction(action)) {
    return buttons;
  }

  const selectedChoiceId = selectedChoiceIdBySourceInstanceId[sourceInstanceId];
  const hasAllocatedTarget =
    getAllocatedTargetIdsForRenderableAction(
      action,
      allocatedDestroyTargetIdsBySourceInstanceId,
      allocatedDestroyTargetIdBySourceInstanceId
    ).length === getRenderableActionRequiredTargetCount(action);

  return buttons.map((button) => {
    if (button.choiceId == null || button.choiceId !== selectedChoiceId) {
      return button;
    }

    if (button.requiresTargeting !== true) {
      return button;
    }

    return {
      ...button,
      instructionText: hasAllocatedTarget
        ? action.kind === 'paired_destroy_target'
          ? 'Will destroy both selected ships.'
          : 'Will destroy selected ship.'
        : button.instructionText,
    };
  });
}

function getProjectedChoiceAmount(
  action: { choices?: Array<{ choiceId?: string; projectedAmount?: number }> },
  choiceId: string
): number | null {
  if (!Array.isArray(action?.choices)) return null;

  const match = action.choices.find((choice) => choice?.choiceId === choiceId);
  const projectedAmount = match?.projectedAmount;

  if (typeof projectedAmount !== 'number' || !Number.isInteger(projectedAmount)) {
    return null;
  }

  return projectedAmount;
}

function getProjectedActionButtons(args: {
  buttons: ShipChoiceGroupSpec['buttons'];
  action: any;
  shipDefId: ShipDefId;
}) {
  const { buttons, action, shipDefId } = args;

  if (shipDefId !== 'FAM') {
    return buttons;
  }

  return buttons.map((button) => {
    if (button.choiceId !== 'damage' && button.choiceId !== 'heal') {
      return button;
    }

    const projectedAmount = getProjectedChoiceAmount(action, button.choiceId);
    if (projectedAmount == null) {
      return button;
    }

    return {
      ...button,
      label: button.choiceId === 'damage'
        ? `Deal ${projectedAmount} Damage`
        : `Heal ${projectedAmount}`,
    };
  });
}

export function mapGameSessionVm(args: {
  isBootstrapping: boolean;

  me: any;
  opponent: any;
  mySpeciesLabel: string;
  opponentSpeciesLabel: string;

  p1HasJoined: boolean;
  p2HasJoined: boolean;

  p1IsReady: boolean;
  p2IsReady: boolean;
  
  p1ClockFormatted: string;
  p2ClockFormatted: string;

  p1StatusText?: string;
  p2StatusText?: string;

  p1StatusTone: HudStatusTone;
  p2StatusTone: HudStatusTone;

  turnNumber: number;
  phaseKey: string;
  phaseIcon: 'build' | 'battle';

  effectiveGameId: string | null;
  allPlayers: any[];

  activePanelId: ActionPanelId;
  tabs: ActionPanelTabVm[];
  buildCatalogue: GameSessionViewModel['actionPanel']['buildCatalogue'];

  board: BoardViewModel;

  readyEnabled: boolean;
  readyDisabledReason: string | null;

  eventTape: any[];
  formatTapeEntry: (entry: any) => string;

  getMajorPhaseLabel: (phaseKey: string) => string;
  getSubphaseLabelFromPhaseKey: (phaseKey: string) => string;
  
  chatEntries: Array<{
    type: 'message' | 'system';
    playerId?: string;
    playerName?: string;
    content: string;
    timestamp: number;
  }>;

  // New params for menu/end-of-game panels
  isFinished: boolean;
  mySpeciesId: SpeciesId | null;
  opponentSpeciesId: SpeciesId | null;
  winnerPlayerId: string | null;
  resultReason:
    | 'decisive'
    | 'narrow'
    | 'mutual_destruction'
    | 'resignation'
    | 'timeout'
    | 'timeout_draw'
    | 'agreement'
    | null;
  
  // Ready UX state (SENDING/WAITING labels)
  readyUx: { clickedThisPhase: boolean; sendingNow: boolean };
  
  // Server availableActions for charge panels
  availableActions: any[] | null;

  // Selection state for ship choice panels
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
  allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]>;
  allocatedDestroyTargetIdBySourceInstanceId: Record<string, string>;
  
  // Raw gameData for server truth
  gameData: any;
  
  // Client-only dice roll sequence (for animation)
  diceRollSeq: number;

  // Client-only build preview counts (used for special panels like Frigate trigger selection)
  buildPreviewCounts: Record<string, number>;

  // Client-only Frigate trigger selections (ordered list, length = buildPreviewCounts.FRI)
  frigateSelectedTriggers: number[];

  // Client-only Evolver selections (existing EVO instances + preview EVO rows)
  evolverRowIds: string[];
  evolverChoicesByRowId: Record<string, EvolverChoiceId>;
  centaurChargeSubTab?: CentaurChargeSubTabId;
  centaurChargeAvailableTabs?: CentaurChargeSubTabId[];
  buildDrawingEconomyDisplay?: {
    ordinaryAvailable: number;
    joiningAvailable: number;
    projectedSavedCombined: number;
  } | null;
}): GameSessionViewModel {
  const {
    isBootstrapping,
    me,
    opponent,
    mySpeciesLabel,
    opponentSpeciesLabel,
    p1HasJoined,
    p2HasJoined,
    p1IsReady,
    p2IsReady,
    p1ClockFormatted,
    p2ClockFormatted,
    p1StatusText,
    p2StatusText,
    p1StatusTone,
    p2StatusTone,
    turnNumber,
    phaseKey,
    phaseIcon,
    effectiveGameId,
    allPlayers,
    activePanelId,
    tabs,
    buildCatalogue,
    board,
    readyEnabled,
    readyDisabledReason,
    eventTape,
    formatTapeEntry,
    getMajorPhaseLabel,
    getSubphaseLabelFromPhaseKey,
    chatEntries,
    isFinished,
    mySpeciesId,
    opponentSpeciesId,
    winnerPlayerId,
    resultReason,
    readyUx,
    availableActions,
    selectedChoiceIdBySourceInstanceId,
    allocatedDestroyTargetIdsBySourceInstanceId,
    allocatedDestroyTargetIdBySourceInstanceId,
    gameData,
    diceRollSeq,
    buildPreviewCounts,
    frigateSelectedTriggers,
    evolverRowIds,
    evolverChoicesByRowId,
    centaurChargeSubTab,
    centaurChargeAvailableTabs,
    buildDrawingEconomyDisplay,
  } = args;
  
  // Map chat entries to LeftRail VM format
  const chatMessages = chatEntries.map(entry =>
    entry.type === 'system'
      ? {
          type: 'system' as const,
          text: entry.content ?? '',
        }
      : {
          type: 'player' as const,
          playerName: entry.playerName ?? 'Unknown',
          text: entry.content ?? '',
        }
  );

  // ============================================================================
  // E2) DERIVE DISPLAY NAMES (MY NAME FIRST)
  // ============================================================================
  
    const myName = me?.name || 'Player 1';
    const opponentName = opponent?.name || 'Player 2';

    // Use the same derivation as vm.gameCode (mapVm does not have `gameId`)
    const gameCode = effectiveGameId
        ? effectiveGameId.substring(0, 6).toUpperCase()
        : 'NOGAME';

    // Big heading
    const title = `${myName} vs ${opponentName}`;

    // Small line under it
    const inProgressSubtitle = `Shapeships Game #${gameCode} - Turn ${turnNumber}`;
  
  // ============================================================================
  // E4) SWITCH PANEL ID WHEN FINISHED
  // ============================================================================
  
  let finalActivePanelId = activePanelId;
  let finalTabs = tabs;
  
  if (isFinished) {
    if (finalActivePanelId === 'ap.menu.root') {
      finalActivePanelId = 'ap.end_of_game.result';
    }

    // Update Menu tab to point to end-of-game panel
    finalTabs = tabs.map(tab => {
      if (tab.tabId === 'tab.menu') {
        return {
          ...tab,
          targetPanelId: 'ap.end_of_game.result' as ActionPanelId,
        };
      }
      return tab;
    });
  }
  
  // ============================================================================
  // E5) RESULT BANNER BACKGROUND: WINNING SPECIES
  // ============================================================================
  
  // Map species to CSS var
  function speciesToBannerBgCssVar(species: SpeciesId | null): string {
    switch (species) {
      case 'human':
        return 'var(--shapeships-pastel-blue)';
      case 'xenite':
        return 'var(--shapeships-pastel-green)';
      case 'centaur':
        return 'var(--shapeships-pastel-red)';
      case 'ancient':
        return 'var(--shapeships-pastel-purple)';
      default:
        // Default to Human blue if species unknown
        return 'var(--shapeships-pastel-blue)';
    }
  }

  function normalizeSpecies(species: unknown): SpeciesId | null {
    switch (typeof species === 'string' ? species.toLowerCase() : null) {
      case 'human':
        return 'human';
      case 'xenite':
        return 'xenite';
      case 'centaur':
        return 'centaur';
      case 'ancient':
        return 'ancient';
      default:
        return null;
    }
  }
  
  // ============================================================================
  // E6) RESULT HEADLINE TEXT RULES
  // ============================================================================

  const winnerPlayer = winnerPlayerId
    ? allPlayers.find((player: any) =>
        player?.id === winnerPlayerId ||
        player?.playerId === winnerPlayerId ||
        player?.sessionId === winnerPlayerId
      ) ?? null
    : null;
  const meIdentityKey = me?.playerId ?? me?.id ?? me?.sessionId ?? null;
  const opponentIdentityKey = opponent?.playerId ?? opponent?.id ?? opponent?.sessionId ?? null;
  const winnerName = winnerPlayer?.name
    ?? (winnerPlayerId && winnerPlayerId === meIdentityKey ? me?.name : undefined)
    ?? (winnerPlayerId && winnerPlayerId === opponentIdentityKey ? opponent?.name : undefined)
    ?? 'Unknown player';
  const winnerSpeciesId =
    winnerPlayerId && winnerPlayerId === meIdentityKey
      ? mySpeciesId
      : winnerPlayerId && winnerPlayerId === opponentIdentityKey
        ? opponentSpeciesId
        : normalizeSpecies(winnerPlayer?.faction ?? winnerPlayer?.species);

  let bannerText: string;
  let bannerBgCssVar: string;

  switch (resultReason) {
    case 'decisive':
      bannerText = `Decisive Victory! ${winnerName} wins!`;
      bannerBgCssVar = speciesToBannerBgCssVar(winnerSpeciesId);
      break;
    case 'narrow':
      bannerText = `Narrow Victory! ${winnerName} wins!`;
      bannerBgCssVar = speciesToBannerBgCssVar(winnerSpeciesId);
      break;
    case 'timeout':
      bannerText = `Time Victory! ${winnerName} wins!`;
      bannerBgCssVar = speciesToBannerBgCssVar(winnerSpeciesId);
      break;
    case 'resignation':
      bannerText = `Victory! ${winnerName} wins!`;
      bannerBgCssVar = speciesToBannerBgCssVar(winnerSpeciesId);
      break;
    case 'agreement':
      bannerText = 'Draw by agreement! Live long and prosper.';
      bannerBgCssVar = 'var(--shapeships-grey-50)';
      break;
    case 'mutual_destruction':
      bannerText = 'Draw! You both blew up.';
      bannerBgCssVar = 'var(--shapeships-grey-50)';
      break;
    case 'timeout_draw':
      bannerText = 'Draw! Time expired.';
      bannerBgCssVar = 'var(--shapeships-grey-50)';
      break;
    default:
      if (winnerPlayerId) {
        bannerText = `Victory! ${winnerName} wins!`;
        bannerBgCssVar = speciesToBannerBgCssVar(winnerSpeciesId);
      } else {
        bannerText = 'Draw!';
        bannerBgCssVar = 'var(--shapeships-grey-50)';
      }
      break;
  }

  const isDrawResult =
    resultReason === 'mutual_destruction' ||
    resultReason === 'agreement' ||
    resultReason === 'timeout_draw';

  const p1Won = Boolean(
    winnerPlayerId &&
    (
      winnerPlayerId === me?.playerId ||
      winnerPlayerId === me?.id ||
      winnerPlayerId === me?.sessionId
    )
  );

  const p2Won = Boolean(
    winnerPlayerId &&
    (
      winnerPlayerId === opponent?.playerId ||
      winnerPlayerId === opponent?.id ||
      winnerPlayerId === opponent?.sessionId
    )
  );

  const finalP1StatusText =
    !p1HasJoined
      ? undefined
      : !isFinished
        ? p1StatusText
        : !winnerPlayerId || isDrawResult
          ? 'Draw'
          : p1Won
            ? 'Won'
            : 'Lost';

  const finalP2StatusText =
    !p2HasJoined
      ? undefined
      : !isFinished
        ? p2StatusText
        : !winnerPlayerId || isDrawResult
          ? 'Draw'
          : p2Won
            ? 'Won'
            : 'Lost';

  const finalP1StatusTone: HudStatusTone =
    !finalP1StatusText ? 'hidden' : (!isFinished && finalP1StatusText === 'Ready' ? 'ready' : 'neutral');

  const finalP2StatusTone: HudStatusTone =
    !finalP2StatusText ? 'hidden' : (!isFinished && finalP2StatusText === 'Ready' ? 'ready' : 'neutral');
  
  // ============================================================================
  // E7) RESULT META LINE STRINGS
  // ============================================================================
  
  const metaLeftText = `Game Over. ${turnNumber} turns.`;
  const metaRightText = title; // Same title string as in-progress
  
  // ============================================================================
  // DERIVE ACTION PANEL UI DATA (frigateDrawing, evolverDrawing, shipChoices)
  // ============================================================================

  // Helper: Get fleet count
  function getFleetCount(
    myFleet: Array<{ shipDefId: string; count: number }> | undefined,
    shipDefId: string
  ): number {
    if (!myFleet) return 0;
    const found = myFleet.find(e => e?.shipDefId === shipDefId);
    const n = found?.count;
    return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0;
  }

  const myFleet = board.mode === 'board' ? board.myFleet : undefined;

  // Frigate drawing (build preview count, not fleet count)
  const frigateCount = Number.isInteger(buildPreviewCounts?.FRI) ? Math.max(0, buildPreviewCounts.FRI) : 0;
  const frigateDrawing = frigateCount > 0 ? { frigateCount, selectedTriggers: frigateSelectedTriggers } : undefined;

  const evolverDrawing = evolverRowIds.length > 0
    ? {
        rows: evolverRowIds.map((rowId) => ({
          rowId,
          choiceId: evolverChoicesByRowId[rowId] ?? 'hold',
        })),
      }
    : undefined;

  // ============================================================================
  // READY BUTTON LABEL DERIVATION (CLIENT UX LAYER)
  // ============================================================================
  //
  // Goals:
  // - Server remains authority on readiness (p1IsReady/p2IsReady)
  // - Client can show "SENDING..." while awaiting the ready intent flow
  // - Client can show "WAITING..." when player was auto-readied because they have no actions
  //
  // IMPORTANT: ReadyButton primitive shows grey background only when selected=false and disabled=true.
  // Selected branch is always green in ReadyButton.tsx.
  // So for SENDING/WAITING we force selected=false.
  //
  // ============================================================================
  
  let readyButtonLabel = 'READY';
  let readyButtonNote: string | null = null;
  let finalReadyDisabled = !readyEnabled;
  let finalReadyDisabledReason = readyDisabledReason;
  let finalReadySelected = p1IsReady;
  let autoReadyWaiting = false;
  
  // Helper: detect whether I have any actionable input this phase
  // Conservative rule: any availableActions means "I have something".
  // In your current code, availableActions is authoritative for charge phases and null otherwise.
  // This is enough for the WAITING heuristic without server changes.
  const iHaveActionsThisPhase =
    Array.isArray(availableActions) && availableActions.length > 0;
  
  if (isFinished) {
    // Game over: button shows "GAME OVER" and is disabled
    readyButtonLabel = 'GAME OVER';
    finalReadyDisabled = true;
    finalReadySelected = false;
    finalReadyDisabledReason = 'Game over.';
  } else if (readyUx?.sendingNow) {
    // Case 1: user clicked Ready and we are awaiting server validation/refresh
    readyButtonLabel = 'SENDING...';
    finalReadyDisabled = true;
    finalReadySelected = false;
    finalReadyDisabledReason = null;
  } else {
    // Case 2: auto-ready because I have no actions; show WAITING if opponent not ready yet.
    //
    // Condition:
    // - server says I'm ready (p1IsReady)
    // - I did NOT explicitly click ready this phase (clickedThisPhase false)
    // - I have no actions this phase (no availableActions)
    // - opponent not ready (still waiting on them)
    autoReadyWaiting =
      p1IsReady &&
      !readyUx?.clickedThisPhase &&
      !iHaveActionsThisPhase &&
      !p2IsReady;
    
    if (autoReadyWaiting) {
      readyButtonLabel = 'WAITING...';
      finalReadyDisabled = true;
      finalReadySelected = false;
      finalReadyDisabledReason = null;
    }
  }

  let subphaseTitle = isFinished ? 'Game Over' : getSubphaseLabelFromPhaseKey(phaseKey);
  let subphaseTitleSuffix: string | null = null;
  let subphaseSubheading = isFinished ? '' : getMajorPhaseLabel(phaseKey);

  if (!isFinished && buildDrawingEconomyDisplay != null) {
    subphaseTitle = String(buildDrawingEconomyDisplay.ordinaryAvailable);
    subphaseTitleSuffix = 'lines available';
    subphaseSubheading = buildDrawingEconomyDisplay.joiningAvailable > 0
      ? `${buildDrawingEconomyDisplay.joiningAvailable} joining lines available`
      : 'Spend lines to build ships';

    if (!readyUx?.sendingNow && !autoReadyWaiting && !p1IsReady) {
      readyButtonLabel = 'READY';
      readyButtonNote = `Save ${buildDrawingEconomyDisplay.projectedSavedCombined} Lines`;
    }
  }

  if (
    phaseKey === 'build.ships_that_build' &&
    !isFinished &&
    !readyUx?.sendingNow &&
    !autoReadyWaiting &&
    !p1IsReady &&
    readyEnabled
  ) {
    readyButtonLabel = 'READY';
    readyButtonNote = 'Proceed to Drawing';
  }
  
  // Ship choices (derive groups from registry spec)
  let shipChoices:
    | {
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
      }
    | undefined;

  const shipChoiceSpec = getShipChoicePanelSpec(finalActivePanelId);

  if (shipChoiceSpec && shipChoiceSpec.kind === 'buttons') {
    // Check if this is a server-choice phase (use server availableActions)
    const isServerChoicePhase = 
      phaseKey === 'build.dice_roll' ||
      phaseKey === 'build.ships_that_build' ||
      phaseKey === 'battle.first_strike' ||
      phaseKey === 'battle.charge_declaration' || 
      phaseKey === 'battle.charge_response';

    const derivedGroups: ShipChoicesPanelGroup[] = [];

    if (isServerChoicePhase && Array.isArray(availableActions)) {
      // Server-choice phases: derive from authoritative availableActions
      const choiceActions = getRenderableServerChoiceActions(phaseKey, availableActions);

      // Build map of instanceId -> currentCharges for phase-start snapshot
      const chargesByInstanceId = new Map<string, number>();
      const myShips = gameData?.ships?.[me?.id] ?? [];
      for (const ship of myShips) {
        const instanceId = ship?.instanceId ?? ship?.id;
        if (instanceId) {
          chargesByInstanceId.set(instanceId, Number(ship?.chargesCurrent ?? 0));
        }
      }

      for (const groupSpec of shipChoiceSpec.groups) {
        if (
          finalActivePanelId === 'ap.battle.charges.centaur' &&
          groupSpec.internalTab &&
          centaurChargeSubTab &&
          groupSpec.internalTab !== centaurChargeSubTab
        ) {
          continue;
        }

        if (groupSpec.kind === 'counted') {
          // Find all matching server actions for this shipDefId
          const matches = choiceActions.filter(
            (a: any) => a.shipDefId === groupSpec.shipDefId
          );

          if (matches.length === 0) continue;

          const count = matches.length;
          const heading = getCountedGroupHeading(groupSpec, count);
          const ships = matches.map((m: any) => ({
            shipDefId: groupSpec.shipDefId,
                buttons: getProjectedActionButtons({
                  buttons: getTargetedActionButtons({
                    buttons: groupSpec.buttons,
                    action: m,
                    sourceInstanceId: m.sourceInstanceId,
                    selectedChoiceIdBySourceInstanceId,
                    allocatedDestroyTargetIdsBySourceInstanceId,
                    allocatedDestroyTargetIdBySourceInstanceId,
                  }),
                  action: m,
              shipDefId: groupSpec.shipDefId,
            }),
            sourceInstanceId: m.sourceInstanceId,
            actionId: m.actionId,
            availableChoiceIds: getRenderableActionChoiceIds(m),
            currentCharges: chargesByInstanceId.get(m.sourceInstanceId) ?? null,
          }));

          derivedGroups.push({
            heading,
            ships,
            groupHelpText: groupSpec.groupHelpText,
          });
        } else if (groupSpec.kind === 'named') {
          // Named group: expand each ship per server action instance
          const expandedShips: Array<{
            shipDefId: ShipDefId;
            buttons: typeof groupSpec.ships[number]['buttons'];
            sourceInstanceId: string;
            actionId: string;
            availableChoiceIds: string[];
            currentCharges: number | null;
          }> = [];

          for (const ship of groupSpec.ships) {
            const matches = choiceActions.filter(
              (a: any) => a.shipDefId === ship.shipDefId
            );

            for (const m of matches) {
              expandedShips.push({
                shipDefId: ship.shipDefId,
                buttons: getProjectedActionButtons({
                  buttons: getTargetedActionButtons({
                    buttons: ship.buttons,
                    action: m,
                    sourceInstanceId: m.sourceInstanceId,
                    selectedChoiceIdBySourceInstanceId,
                    allocatedDestroyTargetIdsBySourceInstanceId,
                    allocatedDestroyTargetIdBySourceInstanceId,
                  }),
                  action: m,
                  shipDefId: ship.shipDefId,
                }),
                sourceInstanceId: m.sourceInstanceId,
                actionId: m.actionId,
                availableChoiceIds: getRenderableActionChoiceIds(m),
                currentCharges: chargesByInstanceId.get(m.sourceInstanceId) ?? null,
              });
            }
          }

          if (expandedShips.length > 0) {
            derivedGroups.push({
              heading: getNamedGroupHeading(phaseKey, groupSpec.heading, gameData),
              ships: expandedShips,
              groupHelpText: groupSpec.groupHelpText,
            });
          }
        }
      }
    } else {
      // NON-CHARGE PHASES: Derive from fleet counts (existing behavior)
      for (const groupSpec of shipChoiceSpec.groups) {
        if (groupSpec.kind === 'counted') {
          // Counted group: derive count from fleet
          const count = getFleetCount(myFleet, groupSpec.shipDefId);
          if (count === 0) continue; // skip if player has none

          const heading = getCountedGroupHeading(groupSpec, count);
          const ships = Array.from({ length: count }, () => ({
            shipDefId: groupSpec.shipDefId,
            buttons: groupSpec.buttons,
          }));

          derivedGroups.push({
            heading,
            ships,
            groupHelpText: groupSpec.groupHelpText,
          });
        } else if (groupSpec.kind === 'named') {
          // Named group: expand each ship by its fleet count
          const expandedShips: Array<{
            shipDefId: ShipDefId;
            buttons: typeof groupSpec.ships[number]['buttons'];
          }> = [];

          for (const ship of groupSpec.ships) {
            const count = getFleetCount(myFleet, ship.shipDefId);
            if (count === 0) continue; // skip if player has none

            // Expand to count instances
            for (let i = 0; i < count; i++) {
              expandedShips.push({
                shipDefId: ship.shipDefId,
                buttons: ship.buttons,
              });
            }
          }

          // Only include group if at least one ship present
          if (expandedShips.length > 0) {
            derivedGroups.push({
              heading: getNamedGroupHeading(phaseKey, groupSpec.heading, gameData),
              ships: expandedShips,
              groupHelpText: groupSpec.groupHelpText,
            });
          }
        }
      }
    }

    // Only set shipChoices if we have groups
    if (derivedGroups.length > 0) {
      const eligibleSnapshot =
        gameData?.turnData?.chargeDeclarationEligibleByPlayerId as Record<string, boolean> | undefined;

      const opponentEligibleAtDeclarationStart =
        phaseKey === 'battle.charge_declaration' &&
        !!(opponent?.id && eligibleSnapshot && eligibleSnapshot[opponent.id] === true);

      shipChoices = {
        groups: derivedGroups,
        showOpponentAlsoHasCharges: shipChoiceSpec.showOpponentAlsoHasCharges ?? false,
        opponentEligibleAtDeclarationStart,
        opponentAlsoHasChargesHeading: undefined,
        opponentAlsoHasChargesLines: undefined,
        selectedChoiceIdBySourceInstanceId,
        centaurChargeTabs:
          finalActivePanelId === 'ap.battle.charges.centaur' &&
          centaurChargeSubTab &&
          Array.isArray(centaurChargeAvailableTabs) &&
          centaurChargeAvailableTabs.length > 0
            ? {
                activeTab: centaurChargeSubTab,
                availableTabs: centaurChargeAvailableTabs,
              }
            : undefined,
      };
    }
  }

  // Server-projected actions for the CURRENT phase (safe default)
  const availableActionsSafe = availableActions ?? [];
  const hasActionsForMe = Array.isArray(availableActionsSafe) && availableActionsSafe.length > 0;
  const currentPlayerId = me?.id ?? null;
  const activePlayers = Array.isArray(allPlayers)
    ? allPlayers.filter((player: any) => player?.role === 'player')
    : [];
  const authoritativePendingDrawOffer = (() => {
    const pendingDrawOffer = gameData?.pendingDrawOffer;
    if (
      pendingDrawOffer &&
      typeof pendingDrawOffer.offererPlayerId === 'string' &&
      typeof pendingDrawOffer.offereePlayerId === 'string'
    ) {
      return pendingDrawOffer;
    }

    const legacyOfferedBy = gameData?.drawAgreement?.offeredBy;
    if (typeof legacyOfferedBy !== 'string' || legacyOfferedBy.length === 0) {
      return null;
    }

    const inferredOfferee = activePlayers.find((player: any) => player?.id !== legacyOfferedBy);
    if (!inferredOfferee?.id) {
      return null;
    }

    return {
      offererPlayerId: legacyOfferedBy,
      offereePlayerId: inferredOfferee.id,
      offeredTurnNumber: turnNumber,
    };
  })();
  const drawOffererName = (() => {
    if (!authoritativePendingDrawOffer) {
      return null;
    }

    const offererId = authoritativePendingDrawOffer.offererPlayerId;
    if (offererId === me?.id) {
      return me?.name ?? 'Player 1';
    }
    if (offererId === opponent?.id) {
      return opponent?.name ?? 'Player 2';
    }

    const matchingPlayer = activePlayers.find((player: any) => player?.id === offererId);
    return matchingPlayer?.name ?? 'Unknown player';
  })();
  const canRespondToDrawOffer =
    !isFinished &&
    currentPlayerId != null &&
    authoritativePendingDrawOffer?.offereePlayerId === currentPlayerId;
  const currentTurnLastDrawOffer =
    currentPlayerId != null
      ? gameData?.lastDrawOfferTurnByPlayerId?.[currentPlayerId]
      : null;
  const canOfferDraw =
    !isFinished &&
    me?.role === 'player' &&
    Boolean(opponent?.id) &&
    authoritativePendingDrawOffer == null &&
    currentTurnLastDrawOffer !== turnNumber;
  const canResign = !isFinished && me?.role === 'player';
  const domLargeChoiceInstruction = (() => {
    if (finalActivePanelId !== 'ap.battle.first_strike.centaur') {
      return undefined;
    }

    const domActions = getRenderableServerChoiceActions(phaseKey, availableActions).filter(
      (action) => action.kind === 'destroy_target' && action.shipDefId === 'DOM'
    );

    if (domActions.length === 0) {
      return undefined;
    }

    const domAction =
      domActions.find((action) =>
        !isRenderableTargetedActionComplete({
          action,
          selectedChoiceIdBySourceInstanceId,
          allocatedDestroyTargetIdsBySourceInstanceId,
          allocatedDestroyTargetIdBySourceInstanceId,
        })
      ) ?? domActions[0];

    const requiredTargetCount = getRenderableActionRequiredTargetCount(domAction);
    const isComplete = isRenderableTargetedActionComplete({
      action: domAction,
      selectedChoiceIdBySourceInstanceId,
      allocatedDestroyTargetIdsBySourceInstanceId,
      allocatedDestroyTargetIdBySourceInstanceId,
    });

    if (!isComplete && requiredTargetCount === 2) {
      return 'You must select two basic enemy ships on the battlefield to steal!';
    }

    if (!isComplete) {
      return 'You must select one basic enemy ship on the battlefield to steal!';
    }

    return requiredTargetCount === 2
      ? 'Steal opponent ships'
      : 'Steal opponent ship';
  })();

  
  const vm: GameSessionViewModel = {
    isBootstrapping,
    
    hud: {
      p1Name: me?.name || 'Player 1',
      p1Species: mySpeciesLabel, // STEP E: Use leftSpecies from server mapping
      p1IsOnline: true,
      p1Clock: p1ClockFormatted, // Placeholder clock
      p1IsReady,
      p1StatusText: finalP1StatusText,
      p1StatusTone: finalP1StatusTone,
      
      p2Name: p2HasJoined ? (opponent?.name || 'Player 2') : 'Waiting...',
      p2Species: opponentSpeciesLabel, // STEP E: Use rightSpecies from server mapping
      p2IsOnline: true,
      p2Clock: p2ClockFormatted, // Placeholder clock
      p2IsReady,
      p2StatusText: finalP2StatusText,
      p2StatusTone: finalP2StatusTone,
    },
    
    leftRail: {
      diceValue: (() => {
        // Read server-derived dice value with priority cascade
        const raw = 
          gameData?.turnData?.effectiveDiceRoll ??
          gameData?.turnData?.baseDiceRoll ??
          gameData?.turnData?.diceRoll ??
          gameData?.diceRoll ??
          1;
        
        // Clamp to 1-6, non-number -> 1
        const num = Number(raw);
        if (!Number.isInteger(num) || num < 1 || num > 6) return 1;
        return num as 1 | 2 | 3 | 4 | 5 | 6;
      })(),
      diceAnimateKey: diceRollSeq,
      diceManipulationSlots: (() => {
        const authoritativeShipsByPlayerId =
          gameData?.ships ??
          gameData?.gameData?.ships ??
          {};

        const liveShips = Object.values(authoritativeShipsByPlayerId).flatMap((ships) =>
          Array.isArray(ships) ? ships : []
        );

        const presentShipDefIds = new Set(
          liveShips
            .map((ship) => String(ship?.shipDefId ?? ''))
            .filter((shipDefId): shipDefId is 'LEV' | 'KNO' | 'CHR' =>
              shipDefId === 'LEV' || shipDefId === 'KNO' || shipDefId === 'CHR'
            )
        );

        const chronoswarmRolls = Array.isArray(gameData?.turnData?.chronoswarmRolls)
          ? gameData.turnData.chronoswarmRolls.filter(
              (roll: unknown): roll is 1 | 2 | 3 | 4 | 5 | 6 =>
                typeof roll === 'number' && Number.isInteger(roll) && roll >= 1 && roll <= 6
            )
          : [];
        const chronoswarmSharedRollCountRaw = gameData?.turnData?.chronoswarmSharedRollCount;
        const chronoswarmSharedRollCount =
          typeof chronoswarmSharedRollCountRaw === 'number' &&
          Number.isInteger(chronoswarmSharedRollCountRaw)
            ? chronoswarmSharedRollCountRaw
            : 0;
        const chronoswarmRollSignature = chronoswarmRolls.reduce(
          (acc: number, roll: 1 | 2 | 3 | 4 | 5 | 6) => acc * 7 + roll,
          chronoswarmRolls.length
        );
        const chronoswarmAnimateKey =
          turnNumber * 1_000_000_000 +
          chronoswarmSharedRollCount * 1_000_000 +
          chronoswarmRollSignature;

        const levSlot = presentShipDefIds.has('LEV')
          ? {
              sourceShipDefId: 'LEV' as const,
              diceValues: [6 as const],
            }
          : null;

        const knoSlot = presentShipDefIds.has('KNO')
          ? {
              sourceShipDefId: 'KNO' as const,
            }
          : null;

        const chrSlot = presentShipDefIds.has('CHR')
          ? {
              sourceShipDefId: 'CHR' as const,
              diceValues: chronoswarmRolls,
              animateKey: chronoswarmAnimateKey,
            }
          : null;

        if (chrSlot) {
          return {
            left: knoSlot ?? levSlot,
            right: chrSlot,
          };
        }

        if (knoSlot && levSlot) {
          return {
            left: knoSlot,
            right: levSlot,
          };
        }

        return {
          left: knoSlot ?? levSlot,
          right: null,
        };
      })(),
      turn: turnNumber,
      phase: getMajorPhaseLabel(phaseKey),
      phaseIcon,
      subphase: getSubphaseLabelFromPhaseKey(phaseKey),
      gameCode: effectiveGameId ? effectiveGameId.substring(0, 6).toUpperCase() : 'NOGAME',
      chatMessages,
      drawOffer:
        authoritativePendingDrawOffer && drawOffererName
          ? {
              fromPlayer: drawOffererName,
              canRespond: canRespondToDrawOffer,
            }
          : null,
      battleLogEntries: eventTape.map(entry => ({
        type: 'event' as const,
        text: formatTapeEntry(entry),
      })),
    },
    
    board,
    
    bottomActionRail: {
      // Future: build.drawing custom heading "X/Y lines available" + breakdown "Saved + Bonus + Dice" must come from server-authoritative fields (do not compute client-side).
      // Future: charge declaration/response subtexts should be gated by server-projected availability (e.g. availableActions / boolean), not guessed client-side.
      subphaseTitle,
      subphaseTitleSuffix,
      subphaseSubheading,
      canUndoActions: false,
      readyButtonVisible: !isFinished,
      readyButtonLabel,
      readyButtonNote,
      nextPhaseLabel: 'NEXT PHASE',
      readyDisabled: finalReadyDisabled,
      readyDisabledReason: finalReadyDisabledReason,
      readySelected: finalReadySelected,
      spectatorCount: allPlayers.filter((p: any) => p?.role === 'spectator').length,
    },
    
    actionPanel: {
      activePanelId: finalActivePanelId,
      tabs: finalTabs,
      buildCatalogue,
      menu: {
        title,
        subtitle: inProgressSubtitle,
        turnNumber,
        phaseKey,
        hasActionsForMe,
        canOfferDraw,
        canResign,
      },
      endOfGame: isFinished ? {
        bannerText,
        bannerBgCssVar,
        metaLeftText,
        metaRightText,
      } : undefined,
      frigateDrawing,
      evolverDrawing,
      shipChoices,
      largeChoicePanel: domLargeChoiceInstruction
        ? {
            instruction: domLargeChoiceInstruction,
          }
        : undefined,
      availableActions: availableActionsSafe,
      selectedChoiceIdBySourceInstanceId,
    },
  };

  return vm;
}
