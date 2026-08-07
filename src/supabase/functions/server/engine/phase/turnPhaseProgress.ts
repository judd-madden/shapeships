import type { TurnPhaseProgressState } from '../state/GameStateTypes.ts';
import { playerHasExpectedAncientRevealEnergy } from '../state/ancientState.ts';
import {
  getEligibleOrdinaryChargeSourceIdsAtDeclarationStart,
  playerRequiresChargeDeclarationInput,
} from '../intent/chargeDeclarationEligibility.ts';
import { fleetHasAvailablePowers } from './fleetHasAvailablePowers.ts';

const TURN_PHASE_KEYS = new Set([
  'build.dice_roll',
  'build.line_generation',
  'build.drawing',
  'battle.reveal',
  'battle.first_strike',
  'battle.charge_declaration',
  'battle.end_of_turn_resolution',
]);

function getTurnNumber(state: any): number {
  const value =
    state?.gameData?.turnData?.turnNumber ??
    state?.gameData?.turnNumber ??
    state?.turnNumber ??
    0;
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function getActivePlayerIds(state: any): string[] {
  return Array.isArray(state?.players)
    ? state.players
      .filter((player: any) => player?.role === 'player' && typeof player?.id === 'string')
      .map((player: any) => player.id)
    : [];
}

export function gameHasFirstStrikeWork(state: any): boolean {
  return getActivePlayerIds(state).some((playerId) =>
    fleetHasAvailablePowers(
      state,
      'battle.first_strike',
      playerId,
      ['First Strike'],
    )
  );
}

export function gameRequiresChargeDeclarationInput(state: any): boolean {
  return getActivePlayerIds(state).some((playerId) =>
    playerRequiresChargeDeclarationInput(state, playerId)
  );
}

function gameHasExpectedPreRevealChargeWork(
  state: any,
  includeQuantumMystic: boolean,
): boolean {
  return getActivePlayerIds(state).some((playerId) =>
    getEligibleOrdinaryChargeSourceIdsAtDeclarationStart(state, playerId).length > 0 ||
    playerHasExpectedAncientRevealEnergy(state, playerId, { includeQuantumMystic })
  );
}

function getCurrentProgress(state: any, turnNumber: number): TurnPhaseProgressState | null {
  const value = state?.gameData?.turnData?.turnPhaseProgress;
  if (!value || value.turnNumber !== turnNumber) return null;
  if (
    typeof value.firstStrike?.expected !== 'boolean' ||
    typeof value.firstStrike?.occurred !== 'boolean' ||
    typeof value.charges?.expected !== 'boolean' ||
    typeof value.charges?.occurred !== 'boolean'
  ) {
    return null;
  }
  return value as TurnPhaseProgressState;
}

function writeProgress(
  state: any,
  expected: { firstStrike: boolean; charges: boolean },
): any {
  const turnNumber = getTurnNumber(state);
  if (turnNumber === 0) return state;
  const current = getCurrentProgress(state, turnNumber);
  const nextState = structuredClone(state);
  nextState.gameData ??= {};
  nextState.gameData.turnData ??= {};
  nextState.gameData.turnData.turnPhaseProgress = {
    turnNumber,
    firstStrike: {
      expected: expected.firstStrike,
      occurred: current?.firstStrike.occurred ?? false,
    },
    charges: {
      expected: expected.charges,
      occurred: current?.charges.occurred ?? false,
    },
  } satisfies TurnPhaseProgressState;
  return nextState;
}

export function initializeDiceRollTurnPhaseProgress(state: any): any {
  return writeProgress(state, {
    firstStrike: gameHasFirstStrikeWork(state),
    charges: gameHasExpectedPreRevealChargeWork(state, false),
  });
}

export function refreshFinalizedDiceTurnPhaseProgress(state: any): any {
  return writeProgress(state, {
    firstStrike: gameHasFirstStrikeWork(state),
    charges: gameHasExpectedPreRevealChargeWork(state, true),
  });
}

export function ensureFinalizedDiceTurnPhaseProgress(state: any): any {
  const turnNumber = getTurnNumber(state);
  return getCurrentProgress(state, turnNumber)
    ? state
    : refreshFinalizedDiceTurnPhaseProgress(state);
}

export function refreshRevealedTurnPhaseProgress(state: any): any {
  return writeProgress(state, {
    firstStrike: gameHasFirstStrikeWork(state),
    charges: gameRequiresChargeDeclarationInput(state),
  });
}

export function refreshPostFirstStrikeChargesProgress(state: any): any {
  const turnNumber = getTurnNumber(state);
  const current = getCurrentProgress(state, turnNumber);
  return writeProgress(state, {
    firstStrike: current?.firstStrike.expected ?? gameHasFirstStrikeWork(state),
    charges: gameRequiresChargeDeclarationInput(state),
  });
}

export function markOptionalTurnPhaseOccurred(
  state: any,
  milestone: 'firstStrike' | 'charges',
): any {
  const turnNumber = getTurnNumber(state);
  const current = getCurrentProgress(state, turnNumber);
  if (!current || current[milestone].occurred) return state;
  const nextState = structuredClone(state);
  nextState.gameData.turnData.turnPhaseProgress[milestone].occurred = true;
  return nextState;
}

export function projectPublicTurnPhaseProgress(
  state: any,
): TurnPhaseProgressState | undefined {
  const phaseKey = `${state?.gameData?.currentPhase ?? state?.currentPhase ?? ''}.${
    state?.gameData?.currentSubPhase ?? state?.currentSubPhase ?? ''
  }`;
  if (!TURN_PHASE_KEYS.has(phaseKey)) return undefined;
  const turnNumber = getTurnNumber(state);
  const current = getCurrentProgress(state, turnNumber);
  if (!current) return undefined;
  return structuredClone(current);
}
