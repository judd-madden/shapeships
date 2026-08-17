export type MatchupSpeciesId = 'human' | 'xenite' | 'centaur' | 'ancient';

export interface MatchupIntroViewModel {
  presentationKey: string;
  startedAtMs: number;
  endsAtMs: number;
  localPlayer: {
    name: string;
    speciesId: MatchupSpeciesId;
  };
  opponentPlayer: {
    name: string;
    speciesId: MatchupSpeciesId;
  };
}

const SPECIES_IDS = new Set<MatchupSpeciesId>(['human', 'xenite', 'centaur', 'ancient']);

type MatchupPlayerInput = {
  id?: unknown;
  name?: unknown;
  faction?: unknown;
  species?: unknown;
};

function readSpeciesId(player: MatchupPlayerInput | null | undefined): MatchupSpeciesId | null {
  const value = player?.faction ?? player?.species;
  return typeof value === 'string' && SPECIES_IDS.has(value as MatchupSpeciesId)
    ? value as MatchupSpeciesId
    : null;
}

function readName(player: MatchupPlayerInput | null | undefined): string | null {
  return typeof player?.name === 'string' && player.name.trim().length > 0
    ? player.name
    : null;
}

export function deriveMatchupIntroViewModel(args: {
  gameId: string | null;
  isFinished: boolean;
  isPlayerViewer: boolean;
  phaseKey: string;
  phaseHold: unknown;
  localPlayer: MatchupPlayerInput | null | undefined;
  opponentPlayer: MatchupPlayerInput | null | undefined;
}): MatchupIntroViewModel | null {
  const {
    gameId,
    isFinished,
    isPlayerViewer,
    phaseKey,
    phaseHold,
    localPlayer,
    opponentPlayer,
  } = args;

  if (
    !gameId ||
    isFinished ||
    !isPlayerViewer ||
    phaseKey !== 'setup.species_selection' ||
    !phaseHold ||
    typeof phaseHold !== 'object'
  ) {
    return null;
  }

  const hold = phaseHold as Record<string, unknown>;
  const startedAtMs = hold.holdStartedAtMs;
  const endsAtMs = hold.holdUntilMs;
  if (
    hold.phaseKey !== 'setup.species_selection' ||
    hold.holdReason !== 'matchup_intro' ||
    typeof startedAtMs !== 'number' ||
    !Number.isFinite(startedAtMs) ||
    typeof endsAtMs !== 'number' ||
    !Number.isFinite(endsAtMs) ||
    endsAtMs <= startedAtMs
  ) {
    return null;
  }

  const localName = readName(localPlayer);
  const opponentName = readName(opponentPlayer);
  const localSpeciesId = readSpeciesId(localPlayer);
  const opponentSpeciesId = readSpeciesId(opponentPlayer);
  if (!localName || !opponentName || !localSpeciesId || !opponentSpeciesId) {
    return null;
  }

  return {
    presentationKey: JSON.stringify({
      gameId,
      startedAtMs,
      endsAtMs,
      localPlayerId: localPlayer?.id ?? localName,
      opponentPlayerId: opponentPlayer?.id ?? opponentName,
    }),
    startedAtMs,
    endsAtMs,
    localPlayer: { name: localName, speciesId: localSpeciesId },
    opponentPlayer: { name: opponentName, speciesId: opponentSpeciesId },
  };
}

export function getMatchupIntroDurationMs(
  matchupIntro: Pick<MatchupIntroViewModel, 'startedAtMs' | 'endsAtMs'>,
): number {
  return Math.max(0, matchupIntro.endsAtMs - matchupIntro.startedAtMs);
}
