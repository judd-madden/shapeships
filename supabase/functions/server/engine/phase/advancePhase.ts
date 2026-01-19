import { PHASE_SEQUENCE, type PhaseKey, type MajorPhase, type SubPhase } from '../../engine_shared/phase/PhaseTable.ts';

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
  | { ok: true; state: GameState; from: PhaseKey; to: PhaseKey }
  | { ok: false; error: string };

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

export function advancePhase(state: GameState): AdvanceResult {
  const from = getCurrentPhaseKey(state);
  if (!from) return { ok: false, error: 'Missing current phase/subphase in game state.' };

  if (from === 'setup.species_selection' && !allPlayersSelectedSpecies(state)) {
    return { ok: false, error: 'Cannot advance: not all players selected species.' };
  }

  // Strict gating for now (no auto steps yet)
  if (!allPlayersReady(state)) {
    return { ok: false, error: 'Cannot advance: not all players are ready.' };
  }

  const idx = PHASE_SEQUENCE.indexOf(from);
  if (idx === -1) return { ok: false, error: `Unknown phase key: ${from}` };

  // End of sequence: new turn -> build.dice_roll
  if (idx === PHASE_SEQUENCE.length - 1) {
    const next = setPhase(state, 'build', 'dice_roll');
    const gd: any = next.gameData || {};
    const td: any = gd.turnData || {};
    const prevTurn = td.turnNumber ?? gd.turnNumber ?? next.turnNumber ?? 1;
    const turnNumber = prevTurn + 1;

    const bumped: GameState = {
      ...next,
      turnNumber,
      gameData: {
        ...gd,
        turnNumber,
        turnData: { ...td, turnNumber },
      },
    };

    const cleared = clearReadiness(bumped);
    return { ok: true, state: cleared, from, to: 'build.dice_roll' };
  }

  const to = PHASE_SEQUENCE[idx + 1];
  const [major, sub] = to.split('.') as [MajorPhase, SubPhase];

  const advanced = clearReadiness(setPhase(state, major, sub));
  return { ok: true, state: advanced, from, to };
}