/**
 * VIEW-MODEL CONSTRUCTION
 * 
 * Maps game state and derived values into the GameSessionViewModel.
 */

import type {
  GameSessionViewModel,
  BoardViewModel,
  ActionPanelTabVm,
  ActionPanelId,
  HudStatusTone,
} from '../useGameSession';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { ShipChoicesPanelGroup } from '../../types/ShipChoiceTypes';
import { getShipChoicePanelSpec } from '../../display/actionPanel/panels/ShipChoiceRegistry';

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

  effectiveGameId: string;
  allPlayers: any[];

  activePanelId: ActionPanelId;
  tabs: ActionPanelTabVm[];

  board: BoardViewModel;

  readyEnabled: boolean;
  readyDisabledReason: string | null;

  eventTape: any[];
  formatTapeEntry: (entry: any) => string;

  getMajorPhaseLabel: (phaseKey: string) => string;
  getSubphaseLabelFromPhaseKey: (phaseKey: string) => string;
  
  chatEntries: Array<{
    type: 'message';
    playerId: string;
    playerName: string;
    content: string;
    timestamp: number;
  }>;

  // New params for menu/end-of-game panels
  isFinished: boolean;
  mySpeciesId: SpeciesId | null;
  opponentSpeciesId: SpeciesId | null;
  
  // Ready flash state (visual-only)
  readyFlashSelected: boolean;
  
  // Ready UX state (SENDING/WAITING labels)
  readyUx: { clickedThisPhase: boolean; sendingNow: boolean };

  // Server availableActions for charge panels
  availableActions: any[] | null;

  // Selection state for ship choice panels
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
  
  // Raw gameData for server truth
  gameData: any;
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
    readyFlashSelected,
    readyUx,
    availableActions,
    selectedChoiceIdBySourceInstanceId,
    gameData,
  } = args;
  
  // Map chat entries to LeftRail VM format
  const chatMessages = chatEntries.map(entry => ({
    type: 'player' as const,
    playerName: entry.playerName ?? 'Unknown',
    text: entry.content ?? '',
  }));

  // ============================================================================
  // E2) DERIVE DISPLAY NAMES (MY NAME FIRST)
  // ============================================================================
  
  const myName = me?.name || 'Player 1';
  const opponentName = opponent?.name || 'Player 2';
  
  // Compose title: always myName first
  const title = `Shapeships Game: ${myName} v ${opponentName}`;
  
  // Compose in-progress subtitle
  const inProgressSubtitle = `In Progress. Turn ${turnNumber}.`;
  
  // ============================================================================
  // E4) SWITCH PANEL ID WHEN FINISHED
  // ============================================================================
  
  let finalActivePanelId = activePanelId;
  let finalTabs = tabs;
  
  if (isFinished) {
    // Force activePanelId to end-of-game result panel
    finalActivePanelId = 'ap.end_of_game.result';
    
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
  
  // ============================================================================
  // E6) RESULT HEADLINE TEXT RULES
  // ============================================================================
  
  // Stub: default to 'win' for testing (engine will wire later)
  const resultKind: 'win' | 'draw_agreement' | 'draw_mutual_destruction' = 'win';
  
  let bannerText: string;
  let bannerBgCssVar: string;
  
  if (resultKind === 'win') {
    // Default to "me" winning for testing
    bannerText = `Decisive Victory! ${myName} wins!`;
    bannerBgCssVar = speciesToBannerBgCssVar(mySpeciesId);
  } else if (resultKind === 'draw_agreement') {
    bannerText = 'Draw by agreement! Live long and prosper.';
    bannerBgCssVar = 'var(--shapeships-grey-50)';
  } else {
    // draw_mutual_destruction
    bannerText = 'Draw! You both blew up.';
    bannerBgCssVar = 'var(--shapeships-grey-50)';
  }
  
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
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  const myFleet = board.mode === 'board' ? board.myFleet : undefined;

  // Frigate drawing
  const frigateCount = getFleetCount(myFleet, 'FRI');
  const frigateDrawing = frigateCount > 0 ? { frigateCount } : undefined;

  // Evolver drawing
  const evolverCount = getFleetCount(myFleet, 'EVO');
  const evolverDrawing = evolverCount > 0 ? { evolverCount } : undefined;

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
  let finalReadyDisabled = !readyEnabled;
  let finalReadyDisabledReason = readyDisabledReason;
  let finalReadySelected = p1IsReady;
  
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
    const autoReadyWaiting =
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
  
  // Ship choices (derive groups from registry spec)
  let shipChoices:
    | {
        groups: ShipChoicesPanelGroup[];
        showOpponentAlsoHasCharges?: boolean;
        opponentEligibleAtDeclarationStart?: boolean;
        opponentAlsoHasChargesHeading?: string;
        opponentAlsoHasChargesLines?: string[];
        selectedChoiceIdBySourceInstanceId?: Record<string, string>;
      }
    | undefined;

  const shipChoiceSpec = getShipChoicePanelSpec(finalActivePanelId);

  if (shipChoiceSpec && shipChoiceSpec.kind === 'buttons') {
    // Check if this is a charge phase (use server availableActions)
    const isChargePhase = 
      phaseKey === 'battle.charge_declaration' || 
      phaseKey === 'battle.charge_response';

    const derivedGroups: ShipChoicesPanelGroup[] = [];

    if (isChargePhase && Array.isArray(availableActions)) {
      // CHARGE PHASES: Derive from server availableActions
      // Filter to choice actions with required fields
      const choiceActions = availableActions.filter(
        (a: any) =>
          a?.kind === 'choice' &&
          typeof a?.sourceInstanceId === 'string' &&
          typeof a?.actionId === 'string' &&
          typeof a?.shipDefId === 'string' &&
          Array.isArray(a?.choices)
      );

      for (const groupSpec of shipChoiceSpec.groups) {
        if (groupSpec.kind === 'counted') {
          // Find all matching server actions for this shipDefId
          const matches = choiceActions.filter(
            (a: any) => a.shipDefId === groupSpec.shipDefId
          );

          if (matches.length === 0) continue;

          const count = matches.length;
          const heading = groupSpec.headingTemplate.replace('{count}', String(count));
          const ships = matches.map((m: any) => ({
            shipDefId: groupSpec.shipDefId,
            buttons: groupSpec.buttons,
            sourceInstanceId: m.sourceInstanceId,
            actionId: m.actionId,
            availableChoiceIds: m.choices.map((c: any) => c.choiceId),
          }));

          derivedGroups.push({
            heading,
            ships,
            groupHelpText: groupSpec.groupHelpText,
          });
        } else if (groupSpec.kind === 'named') {
          // Named group: expand each ship per server action instance
          const expandedShips: Array<{
            shipDefId: string;
            buttons: typeof groupSpec.ships[number]['buttons'];
            sourceInstanceId: string;
            actionId: string;
            availableChoiceIds: string[];
          }> = [];

          for (const ship of groupSpec.ships) {
            const matches = choiceActions.filter(
              (a: any) => a.shipDefId === ship.shipDefId
            );

            for (const m of matches) {
              expandedShips.push({
                shipDefId: ship.shipDefId,
                buttons: ship.buttons,
                sourceInstanceId: m.sourceInstanceId,
                actionId: m.actionId,
                availableChoiceIds: m.choices.map((c: any) => c.choiceId),
              });
            }
          }

          if (expandedShips.length > 0) {
            derivedGroups.push({
              heading: groupSpec.heading,
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

          const heading = groupSpec.headingTemplate.replace('{count}', String(count));
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
            shipDefId: string;
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
              heading: groupSpec.heading,
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
      };
    }
  }
  
  const vm: GameSessionViewModel = {
    isBootstrapping,
    
    hud: {
      p1Name: me?.name || 'Player 1',
      p1Species: mySpeciesLabel, // STEP E: Use leftSpecies from server mapping
      p1IsOnline: true,
      p1Clock: p1ClockFormatted, // Placeholder clock
      p1IsReady,
      p1StatusText,
      p1StatusTone,
      
      p2Name: p2HasJoined ? (opponent?.name || 'Player 2') : 'Waiting...',
      p2Species: opponentSpeciesLabel, // STEP E: Use rightSpecies from server mapping
      p2IsOnline: true,
      p2Clock: p2ClockFormatted, // Placeholder clock
      p2IsReady,
      p2StatusText,
      p2StatusTone,
    },
    
    leftRail: {
      diceValue: 1,
      turn: turnNumber,
      phase: getMajorPhaseLabel(phaseKey),
      phaseIcon,
      subphase: getSubphaseLabelFromPhaseKey(phaseKey),
      gameCode: effectiveGameId ? effectiveGameId.substring(0, 6).toUpperCase() : 'NOGAME',
      chatMessages,
      drawOffer: null,
      battleLogEntries: eventTape.map(entry => ({
        type: 'event' as const,
        text: formatTapeEntry(entry),
      })),
    },
    
    board,
    
    bottomActionRail: {
      // Future: build.drawing custom heading "X/Y lines available" + breakdown "Saved + Bonus + Dice" must come from server-authoritative fields (do not compute client-side).
      // Future: charge declaration/response subtexts should be gated by server-projected availability (e.g. availableActions / boolean), not guessed client-side.
      subphaseTitle: isFinished ? 'Game Over' : getSubphaseLabelFromPhaseKey(phaseKey),
      subphaseSubheading: isFinished ? '' : getMajorPhaseLabel(phaseKey),
      canUndoActions: false,
      readyButtonVisible: !isFinished,
      readyButtonLabel,
      readyButtonNote: null,
      nextPhaseLabel: 'NEXT PHASE',
      readyDisabled: finalReadyDisabled,
      readyDisabledReason: finalReadyDisabledReason,
      readySelected: finalReadySelected || readyFlashSelected, // Combine server ready + visual flash
      readyFlashSelected, // Pass through for debugging/future use
      spectatorCount: allPlayers.filter((p: any) => p?.role === 'spectator').length,
    },
    
    actionPanel: {
      activePanelId: finalActivePanelId,
      tabs: finalTabs,
      menu: {
        title,
        subtitle: inProgressSubtitle,
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
      availableActions,
      selectedChoiceIdBySourceInstanceId,
    },
  };

  return vm;
}