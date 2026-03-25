import { PHASE_SEQUENCE, type PhaseKey, type MajorPhase, type SubPhase } from '../../engine_shared/phase/PhaseTable.ts';
import { applyIncrementForTurn } from '../clock/clock.ts';

// Minimal server-side GameState interface (derived from actual game state structure)
interface GameState {
  gameId?: string;
  players: Array<{ id: string; faction?: string; [key: string]: any }>;
  turnNumber?: number;
  gameData?: {
    currentPhase?: string;
    currentSubPhase?: string;
    turnNumber?: number;
    phaseReadiness?: Array<{ playerId: string; isReady: boolean; [key: string]: any }>;
    turnData?: {
      currentMajorPhase?: string;
      currentSubPhase?: string;
      turnNumber?: number;
      [key: string]: any;
    };
    phaseStartTime?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

type AdvanceResult =
  | { ok: true; state: GameState; from: PhaseKey; to: PhaseKey; events: any[] }
  | { ok: false; error: string };

/**
 * DEPRECATED: Use advancePhase or advancePhaseCore instead
 * @deprecated
 */
export interface AdvancePhaseOptions {
  /** Skip readiness check (used for server-driven auto-advance) */
  ignoreReadiness?: boolean;
}

function getCurrentPhaseKey(state: GameState): PhaseKey | null {
  const gd: any = state.gameData || {};

  const major = gd.currentPhase as string | undefined;
  const sub = gd.currentSubPhase as string | undefined;
  if (major && sub) {
    const key = `${major}.${sub}` as PhaseKey;
    return PHASE_SEQUENCE.includes(key) ? key : null;
  }

  const td: any = gd.turnData || {};
  const major2 = td.currentMajorPhase as string | undefined;
  const sub2 = td.currentSubPhase as string | undefined;
  if (major2 && sub2) {
    const key = `${major2}.${sub2}` as PhaseKey;
    return PHASE_SEQUENCE.includes(key) ? key : null;
  }

  return null;
}

function setPhase(state: GameState, major: MajorPhase, sub: SubPhase): GameState {
  const now = new Date().toISOString();
  const gd: any = state.gameData || {};
  const td: any = gd.turnData || {};

  return {
    ...state,
    gameData: {
      ...gd,
      currentPhase: major,
      currentSubPhase: sub,
      turnData: {
        ...td,
        currentMajorPhase: major,
        currentSubPhase: sub,
        turnNumber: td.turnNumber ?? gd.turnNumber ?? state.turnNumber ?? 1,
      },
      phaseStartTime: now,
    },
  };
}

function clearReadiness(state: GameState): GameState {
  const gd: any = state.gameData || {};
  return {
    ...state,
    gameData: {
      ...gd,
      phaseReadiness: [],
    },
  };
}

function allPlayersReady(state: GameState): boolean {
  const gd: any = state.gameData || {};
  const readiness = (gd.phaseReadiness || []) as Array<{ playerId: string; isReady: boolean }>;
  const playerIds = (state.players || [])
    .filter((p: any) => p.role === 'player')
    .map((p: any) => p.id);
  return playerIds.every(pid => readiness.some(r => r.playerId === pid && r.isReady));
}

function allPlayersSelectedSpecies(state: GameState): boolean {
  return (state.players || []).every((p: any) => !!p.faction);
}

function getKnoRerollPassIndex(state: GameState): 1 | 2 {
  return state?.gameData?.turnData?.knoRerollPassIndex === 2 ? 2 : 1;
}

function getKnoCountForPlayer(state: GameState, playerId: string): number {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  return Array.isArray(fleet)
    ? fleet.filter((ship: any) => ship?.shipDefId === 'KNO').length
    : 0;
}

function hasAnyKnoSecondPass(state: GameState): boolean {
  return (state.players || [])
    .filter((p: any) => p.role === 'player')
    .some((p: any) => getKnoCountForPlayer(state, p.id) >= 2);
}

/**
 * Core phase advancement logic (no readiness checks).
 * 
 * Used for:
 * - System-driven auto-advance (e.g., species selection exit)
 * - Readiness-gated advancement via advancePhase
 * 
 * Progresses to next phase in PHASE_SEQUENCE.
 * Handles turn bumping at end of sequence.
 * Clears readiness on successful advance.
 * 
 * @param state - Current game state
 * @returns Result with updated state or error
 */
export function advancePhaseCore(state: GameState, nowMs?: number): AdvanceResult {
  const from = getCurrentPhaseKey(state);
  if (!from) return { ok: false, error: 'Missing current phase/subphase in game state.' };

  const idx = PHASE_SEQUENCE.indexOf(from);
  if (idx === -1) return { ok: false, error: `Unknown phase key: ${from}` };

  // Special handling: Setup exit (setup.species_selection → build.dice_roll with turn = 1)
  if (from === 'setup.species_selection') {
    const gd: any = state.gameData || {};
    const currentTurn = gd.turnNumber ?? state.turnNumber ?? 0;
    
    // If still in setup (turn 0 or unset), transition to turn 1
    const turnNumber = currentTurn === 0 ? 1 : currentTurn;
    
    const next = setPhase(state, 'build', 'dice_roll');
    const nextGd: any = next.gameData || {};
    const nextTd: any = nextGd.turnData || {};
    
    const setupExit: GameState = {
      ...next,
      turnNumber,
      gameData: {
        ...nextGd,
        turnNumber,
        diceRoll: null,
        turnData: {
          ...nextTd,
          turnNumber,
          diceRolled: false,
          diceFinalized: false,
          diceRoll: null,
          linesDistributed: false,
          anyChargesDeclared: false,
          anyChargesSpentInDeclaration: false,
          chargeDeclarationEligibleByPlayerId: {},
          chargePowerUsedByInstanceId: {},
          chronoswarmRolls: [],
          chronoswarmCountByPlayerId: {},
          chronoswarmSharedRollCount: 0,
          knoRerollPassIndex: undefined,
          pendingKnoRerollChoiceByPassByPlayerId: {},
          shipsThatBuildPassIndex: undefined,
          shipsThatBuildPassUsageByInstanceId: {},
          shipsMadeThisTurnByPlayerId: {},
          queenCreatedXenitesThisTurnByInstanceId: {},
          buildEndOfBuildAppliedTurnNumber: 0,
        },
      },
    };
    
    const cleared = clearReadiness(setupExit);
    
    console.log(`[advancePhaseCore] Setup exit: ${from} → build.dice_roll (turn set to ${turnNumber})`);
    
    return { ok: true, state: cleared, from, to: 'build.dice_roll', events: [] };
  }

  if (from === 'build.dice_roll') {
    const passIndex = getKnoRerollPassIndex(state);
    if (passIndex === 1 && hasAnyKnoSecondPass(state)) {
      const next = setPhase(state, 'build', 'dice_roll');
      const nextGd: any = next.gameData || {};
      const nextTd: any = nextGd.turnData || {};
      const passAdvanced: GameState = {
        ...next,
        gameData: {
          ...nextGd,
          turnData: {
            ...nextTd,
            knoRerollPassIndex: 2,
          },
        },
      };
      const cleared = clearReadiness(passAdvanced);

      console.log('[advancePhaseCore] KNO second pass: build.dice_roll pass 1 -> pass 2');

      return {
        ok: true,
        state: cleared,
        from,
        to: 'build.dice_roll',
        events: [
          {
            type: 'KNO_REROLL_PASS_ADVANCED',
            fromPassIndex: 1,
            toPassIndex: 2,
            atMs: nowMs ?? Date.now(),
          },
        ],
      };
    }
  }

  if (from === 'build.ships_that_build') {
    const gd: any = state.gameData || {};
    const td: any = gd.turnData || {};
    const passIndex: 1 | 2 = td.shipsThatBuildPassIndex === 2 ? 2 : 1;
    const chronoswarmCountByPlayerId = td.chronoswarmCountByPlayerId || {};
    const hasChronoswarmSecondPass = (state.players || [])
      .filter((p: any) => p.role === 'player')
      .some((p: any) => (chronoswarmCountByPlayerId[p.id] || 0) > 0);

    if (passIndex === 1 && hasChronoswarmSecondPass) {
      const next = setPhase(state, 'build', 'ships_that_build');
      const nextGd: any = next.gameData || {};
      const nextTd: any = nextGd.turnData || {};
      const passAdvanced: GameState = {
        ...next,
        gameData: {
          ...nextGd,
          turnData: {
            ...nextTd,
            shipsThatBuildPassIndex: 2,
          },
        },
      };
      const cleared = clearReadiness(passAdvanced);

      console.log('[advancePhaseCore] Chronoswarm second pass: build.ships_that_build pass 1 → pass 2');

      return {
        ok: true,
        state: cleared,
        from,
        to: 'build.ships_that_build',
        events: [
          {
            type: 'SHIPS_THAT_BUILD_PASS_ADVANCED',
            fromPassIndex: 1,
            toPassIndex: 2,
            atMs: nowMs ?? Date.now(),
          },
        ],
      };
    }
  }

  // End of sequence: new turn -> build.dice_roll
  if (idx === PHASE_SEQUENCE.length - 1) {
    const next = setPhase(state, 'build', 'dice_roll');
    const gd: any = next.gameData || {};
    const td: any = gd.turnData || {};
    const prevTurn = td.turnNumber ?? gd.turnNumber ?? next.turnNumber ?? 1;
    const turnNumber = prevTurn + 1;

    let bumped: GameState = {
      ...next,
      turnNumber,
      gameData: {
        ...gd,
        turnNumber,
        diceRoll: null, // Clear mirrored dice roll
        turnData: {
          ...td,
          turnNumber,
          // Reset turn-scoped flags for new turn
          diceRolled: false,
          diceFinalized: false,
          diceRoll: null,
          linesDistributed: false,
          anyChargesDeclared: false, // Reset charge declaration tracking
          anyChargesSpentInDeclaration: false,
          chargeDeclarationEligibleByPlayerId: {},
          chargePowerUsedByInstanceId: {},
          chronoswarmRolls: [],
          chronoswarmCountByPlayerId: {},
          chronoswarmSharedRollCount: 0,
          knoRerollPassIndex: undefined,
          pendingKnoRerollChoiceByPassByPlayerId: {},
          shipsThatBuildPassIndex: undefined,
          shipsThatBuildPassUsageByInstanceId: {},
          shipsMadeThisTurnByPlayerId: {},
          queenCreatedXenitesThisTurnByInstanceId: {},
          buildEndOfBuildAppliedTurnNumber: 0,
        },
      },
    };

    // Apply clock increment ONCE per player per turn
    bumped = applyIncrementForTurn(bumped, turnNumber);

    const cleared = clearReadiness(bumped);
    
    console.log(`[advancePhaseCore] Turn bump: ${from} → build.dice_roll (turn ${prevTurn} → ${turnNumber})`);
    
    return { ok: true, state: cleared, from, to: 'build.dice_roll', events: [] };
  }

  // Normal phase progression
  const to = PHASE_SEQUENCE[idx + 1];
  const [major, sub] = to.split('.') as [MajorPhase, SubPhase];

  const advanced = clearReadiness(setPhase(state, major, sub));
  
  console.log(`[advancePhaseCore] Phase advance: ${from} → ${to}`);
  
  return { ok: true, state: advanced, from, to, events: [] };
}

/**
 * Readiness-gated phase advancement.
 * 
 * Requires all active players to be ready before advancing.
 * Delegates to advancePhaseCore for actual phase progression.
 * 
 * @param state - Current game state
 * @param options - Options (deprecated, use advancePhaseCore for ignoreReadiness)
 * @returns Result with updated state or error
 */
export function advancePhase(state: GameState, options?: AdvancePhaseOptions, nowMs?: number): AdvanceResult {
  const from = getCurrentPhaseKey(state);
  if (!from) return { ok: false, error: 'Missing current phase/subphase in game state.' };

  // Species selection validation
  if (from === 'setup.species_selection' && !allPlayersSelectedSpecies(state)) {
    return { ok: false, error: 'Cannot advance: not all players selected species.' };
  }

  // Readiness check (can be bypassed with deprecated option)
  if (!options?.ignoreReadiness && !allPlayersReady(state)) {
    return { ok: false, error: 'Cannot advance: not all players are ready.' };
  }

  // Delegate to core advancement logic
  return advancePhaseCore(state, nowMs);
}
