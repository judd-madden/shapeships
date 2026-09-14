export const SPECIES_SELECTION_SPECIES_IDS = [
  'human',
  'xenite',
  'centaur',
  'ancient',
] as const;

export type SpeciesSelectionSpeciesId =
  typeof SPECIES_SELECTION_SPECIES_IDS[number];

const SPECIES_SELECTION_SPECIES_ID_SET = new Set<unknown>(
  SPECIES_SELECTION_SPECIES_IDS,
);

export type SpeciesSelectionRequesterSummary = {
  selectedSpecies: SpeciesSelectionSpeciesId;
};

export function isSpeciesSelectionSpeciesId(
  value: unknown,
): value is SpeciesSelectionSpeciesId {
  return SPECIES_SELECTION_SPECIES_ID_SET.has(value);
}

export function hasCompletedSpeciesSelection(
  state: Readonly<any> | undefined,
): boolean {
  const activePlayers = Array.isArray(state?.players)
    ? state.players.filter((player: any) => player?.role === 'player')
    : [];

  return activePlayers.length === 2 &&
    activePlayers.every((player: any) => player?.faction != null);
}

export function projectSpeciesSelectionForRequester(
  state: Readonly<any> | undefined,
  requestingParticipantId?: string,
): SpeciesSelectionRequesterSummary | null {
  if (
    typeof requestingParticipantId !== 'string' ||
    requestingParticipantId.length === 0 ||
    hasCompletedSpeciesSelection(state) ||
    !Array.isArray(state?.players)
  ) {
    return null;
  }

  const requester = state.players.find(
    (player: any) => player?.id === requestingParticipantId,
  );
  if (
    requester?.role !== 'player' ||
    !isSpeciesSelectionSpeciesId(requester.faction)
  ) {
    return null;
  }

  return { selectedSpecies: requester.faction };
}

export function projectPlayerSpeciesForClient<T extends Record<string, any>>(
  player: T,
  state: Readonly<any> | undefined,
  requestingParticipantId: string | undefined,
  publicOnly: boolean,
): T {
  if (hasCompletedSpeciesSelection(state)) {
    return { ...player };
  }

  const requester = Array.isArray(state?.players)
    ? state.players.find(
      (candidate: any) => candidate?.id === requestingParticipantId,
    )
    : null;
  const playerId = typeof player.id === 'string' ? player.id : null;
  const maySeeOwnSelection =
    !publicOnly &&
    requester?.role === 'player' &&
    isSpeciesSelectionSpeciesId(requester.faction) &&
    playerId === requestingParticipantId;

  if (maySeeOwnSelection) {
    return { ...player };
  }

  const {
    faction: _privateFaction,
    species: _privateLegacySpecies,
    ...speciesSafePlayer
  } = player;
  return speciesSafePlayer as T;
}
