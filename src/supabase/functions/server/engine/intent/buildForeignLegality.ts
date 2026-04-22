const BLOCKED_FOREIGN_INTERACTIVE_UPGRADE_IDS = new Set([
  'FRI',
  'GUA',
  'SAC',
  'KNO',
  'DOM',
]);

export type BuildLegalityRestrictionCode =
  | 'foreign_basic'
  | 'foreign_interactive_upgrade';

type NormalizedSpeciesId = 'human' | 'xenite' | 'centaur' | 'ancient';

function normalizeSpeciesId(value: unknown): NormalizedSpeciesId | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  switch (normalized) {
    case 'human':
    case 'xenite':
    case 'centaur':
    case 'ancient':
      return normalized;
    default:
      return null;
  }
}

function isBasicShipType(shipType: unknown): boolean {
  return String(shipType ?? '').trim().toLowerCase().startsWith('basic');
}

export function getPlayerNativeSpeciesId(player: { faction?: unknown; species?: unknown } | null | undefined): NormalizedSpeciesId | null {
  return normalizeSpeciesId(player?.faction ?? player?.species);
}

export function evaluateForeignBuildLegality(args: {
  nativeSpecies: unknown;
  shipDefId: string;
  shipSpecies: unknown;
  shipType: unknown;
}): {
  allowed: boolean;
  restrictionCode?: BuildLegalityRestrictionCode;
} {
  const nativeSpecies = normalizeSpeciesId(args.nativeSpecies);
  const shipSpecies = normalizeSpeciesId(args.shipSpecies);

  if (!nativeSpecies || !shipSpecies || nativeSpecies === shipSpecies) {
    return { allowed: true };
  }

  if (isBasicShipType(args.shipType)) {
    return {
      allowed: false,
      restrictionCode: 'foreign_basic',
    };
  }

  if (BLOCKED_FOREIGN_INTERACTIVE_UPGRADE_IDS.has(args.shipDefId)) {
    return {
      allowed: false,
      restrictionCode: 'foreign_interactive_upgrade',
    };
  }

  return { allowed: true };
}
