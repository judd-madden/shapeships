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
  } = args;

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
      chatMessages: [],
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
      readyButtonNote: null,
      nextPhaseLabel: 'NEXT PHASE',
      readyDisabled: !readyEnabled,
      readyDisabledReason,
      readySelected: p1IsReady,
      spectatorCount: allPlayers.filter((p: any) => p?.role === 'spectator').length,
    },
    
    actionPanel: {
      activePanelId,
      tabs,
    },
  };

  return vm;
}