export const ANCIENT_SIPHON_MINIMUM_SPEND = 4;
export const ANCIENT_SIPHON_SCALING_BREAKPOINT = 8;
export const ANCIENT_SIPHON_DEFAULT_SELECTOR_MAX_SPEND = 14;
export const ANCIENT_SIPHON_RULES_TABLE_MIN_SPEND = 4;
export const ANCIENT_SIPHON_RULES_TABLE_MAX_SPEND = 12;
export const ANCIENT_SIPHON_HIGH_BAND_INCREMENT = 5;

export function calculateAncientSiphonEffect(value: unknown): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value) ||
    value < ANCIENT_SIPHON_MINIMUM_SPEND
  ) {
    return null;
  }

  let effectAmount: number;
  if (value < ANCIENT_SIPHON_SCALING_BREAKPOINT) {
    effectAmount = 3 * value - 4;
  } else {
    const acceleratedFactor = value - 4;
    if (
      !Number.isSafeInteger(acceleratedFactor) ||
      acceleratedFactor <= 0 ||
      acceleratedFactor >
        Math.floor(Number.MAX_SAFE_INTEGER / ANCIENT_SIPHON_HIGH_BAND_INCREMENT)
    ) {
      return null;
    }
    effectAmount = acceleratedFactor * ANCIENT_SIPHON_HIGH_BAND_INCREMENT;
  }

  return Number.isSafeInteger(effectAmount) && effectAmount > 0
    ? effectAmount
    : null;
}

export function isValidAncientSiphonSpend(value: unknown): value is number {
  return calculateAncientSiphonEffect(value) !== null;
}

export const ANCIENT_SIPHON_RULES_TABLE_ROWS = Object.freeze(
  Array.from(
    {
      length:
        ANCIENT_SIPHON_RULES_TABLE_MAX_SPEND -
        ANCIENT_SIPHON_RULES_TABLE_MIN_SPEND +
        1,
    },
    (_, index) => {
      const spend = ANCIENT_SIPHON_RULES_TABLE_MIN_SPEND + index;
      const effect = calculateAncientSiphonEffect(spend);
      if (effect === null) {
        throw new Error(`Invalid Siphon rules-table spend: ${spend}`);
      }
      return Object.freeze({ spend, effect });
    },
  ),
);
