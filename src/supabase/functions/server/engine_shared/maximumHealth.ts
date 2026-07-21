export const DEFAULT_PLAYER_MAX_HEALTH = 35;
export const SPIRAL_MAX_CONTROLLED_QUANTITY = 3;
export const SPIRAL_MAX_HEALTH_BONUS = 5;

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

export function countControlledSpirals(
  state: MaximumHealthState,
  playerId: string,
): number {
  const fleet = state.gameData?.ships?.[playerId];
  if (!Array.isArray(fleet)) return 0;
  return fleet.filter((ship) => ship.shipDefId === "SPI").length;
}

export function canControlAdditionalSpirals(
  state: MaximumHealthState,
  playerId: string,
  incomingCount: number,
): boolean {
  if (!Number.isInteger(incomingCount) || incomingCount < 0) return false;
  return countControlledSpirals(state, playerId) + incomingCount <=
    SPIRAL_MAX_CONTROLLED_QUANTITY;
}

/**
 * Derive a player's authoritative maximum health from canonical state.
 *
 * Spiral modifies maximum health from current authoritative fleet control.
 */
export function getPlayerMaxHealth(
  state: MaximumHealthState,
  playerId: string,
): number {
  const effectiveSpiralCount = Math.min(
    countControlledSpirals(state, playerId),
    SPIRAL_MAX_CONTROLLED_QUANTITY,
  );
  return DEFAULT_PLAYER_MAX_HEALTH +
    effectiveSpiralCount * SPIRAL_MAX_HEALTH_BONUS;
}
