import type {
  AncientSolarPowerId,
} from '../state/GameStateTypes.ts';

const ANCIENT_SOLAR_POWER_DISPLAY_NAMES = {
  SLIF: 'Life',
  SSTA: 'Star Birth',
  SAST: 'Asteroid',
  SSUP: 'Supernova',
  SCON: 'Convert',
  SSIP: 'Siphon',
  SVOR: 'Vortex',
  SBLA: 'Black Hole',
  SSIM: 'Simulacrum',
} satisfies Record<AncientSolarPowerId, string>;

export function isAncientSolarPowerId(
  value: unknown,
): value is AncientSolarPowerId {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(
      ANCIENT_SOLAR_POWER_DISPLAY_NAMES,
      value,
    );
}

export function getAncientSolarPowerDisplayName(
  powerId: AncientSolarPowerId,
): string {
  return ANCIENT_SOLAR_POWER_DISPLAY_NAMES[powerId];
}

export function parseAncientSolarSourceReason(
  reason: unknown,
): AncientSolarPowerId | null {
  if (typeof reason !== 'string') return null;

  const prefix = 'ancient-solar:';
  if (!reason.startsWith(prefix)) return null;

  const powerId = reason.slice(prefix.length);
  return isAncientSolarPowerId(powerId) ? powerId : null;
}
