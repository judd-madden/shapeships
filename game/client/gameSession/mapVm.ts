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
  // READY BUTTON LABEL DERIVATION
  // ============================================================================
  
  let readyButtonLabel = 'READY';
  let finalReadyDisabled = !readyEnabled;
  let finalReadyDisabledReason = readyDisabledReason;
  let finalReadySelected = p1IsReady;
  
  if (isFinished) {
    // Game over: button shows "GAME OVER" and is disabled
    readyButtonLabel = 'GAME OVER';
    finalReadyDisabled = true;
    finalReadySelected = false;
    finalReadyDisabledReason = 'Game over.';
  }
  // TODO: "WAITING" label when player has no required action this phase
  // Requires server to expose a per-player "needsInputThisPhase" flag.
  // If server adds this flag, derive here:
  // else if (!playerNeedsInputThisPhase && !p2IsReady) {
  //   readyButtonLabel = 'WAITING';
  //   finalReadyDisabled = true;
  //   finalReadySelected = false;
  // }
  
  // Ship choices (derive groups from registry spec)
  let shipChoices:
    | {
        groups: ShipChoicesPanelGroup[];
        showOpponentAlsoHasCharges?: boolean;
        opponentAlsoHasChargesHeading?: string;
        opponentAlsoHasChargesLines?: string[];
      }
    | undefined;

  const shipChoiceSpec = getShipChoicePanelSpec(finalActivePanelId);

  if (shipChoiceSpec && shipChoiceSpec.kind === 'buttons') {
    const derivedGroups: ShipChoicesPanelGroup[] = [];

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

    // Only set shipChoices if we have groups
    if (derivedGroups.length > 0) {
      shipChoices = {
        groups: derivedGroups,
        showOpponentAlsoHasCharges: shipChoiceSpec.showOpponentAlsoHasCharges ?? false,
        // Leave heading/lines undefined for now (no opponent callout copy yet)
        opponentAlsoHasChargesHeading: undefined,
        opponentAlsoHasChargesLines: undefined,
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
      subphaseTitle: 'Subphase information',
      subphaseSubheading: phaseKey,
      canUndoActions: false,
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
    },
  };

  return vm;
}