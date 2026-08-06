export type ShipPowerTimingIconKind =
  | 'dice-roll'
  | 'drawing'
  | 'first-strike'
  | 'charges'
  | 'fallback';

export interface ShipPowerPresentation {
  iconKind: ShipPowerTimingIconKind;
  text: string;
}

interface ShipPowerPresentationInput {
  readonly subphase: string | null | undefined;
  readonly text: string;
}

export function getShipPowerTimingIconKind(
  subphase: string | null | undefined,
): ShipPowerTimingIconKind {
  switch (subphase?.trim()) {
    case 'Dice Roll':
      return 'dice-roll';
    case 'Drawing':
      return 'drawing';
    case 'First Strike':
      return 'first-strike';
    case 'Charges':
      return 'charges';
    default:
      return 'fallback';
  }
}

export function getShipPowerPresentation(
  power: ShipPowerPresentationInput,
): ShipPowerPresentation {
  return {
    iconKind: getShipPowerTimingIconKind(power.subphase),
    text: power.text.replace(/\\n/g, '\n'),
  };
}

export function getShipPhaseLabel(
  powers: readonly Pick<ShipPowerPresentationInput, 'subphase'>[],
): string {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const power of powers) {
    const subphase = power.subphase?.trim() ?? '';
    if (!subphase || subphase.toUpperCase() === 'N/A') {
      continue;
    }

    const normalized = subphase.toUpperCase();
    if (normalized === 'PASSIVE' || normalized === 'UPON DESTRUCTION') {
      continue;
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      labels.push(normalized);
    }
  }

  return labels.join(', ');
}
