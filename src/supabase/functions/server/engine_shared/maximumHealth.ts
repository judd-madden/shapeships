export const DEFAULT_PLAYER_MAX_HEALTH = 35;

export type MaximumHealthState = Readonly<{
  gameData?: Readonly<{
    ships?: Readonly<
      Record<
        string,
        readonly Readonly<{ shipDefId?: string }>[]
      >
    >;
  }>;
}>;

/**
 * Derive a player's authoritative maximum health from canonical state.
 *
 * P10A establishes the shared seam; player-specific derivation is added by a
 * later, separately approved pass.
 */
export function getPlayerMaxHealth(
  _state: MaximumHealthState,
  _playerId: string,
): number {
  return DEFAULT_PLAYER_MAX_HEALTH;
}
