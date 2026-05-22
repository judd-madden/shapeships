import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import type { ShipDefinitionUI } from '../../../../../types/ShipTypes.ui';
import { SHIP_DEFINITIONS_MAP } from '../../../../../data/ShipDefinitionsUI';

export type PowerIcon = 'build' | 'battle';

export interface ShipPowerViewModel {
  icon: PowerIcon;
  text: string;
}

export interface ShipCardModel {
  name: string;
  cost: number;
  joiningLines?: number;
  phaseLabel?: string;
  powers: ShipPowerViewModel[];
  italicNotes?: string;
  componentShipIds: readonly string[];
}

export interface GroupedShipToken {
  token: string;
  count: number;
}

function getPhaseIcon(subphase: string): PowerIcon {
  const buildSubphases = [
    'Dice Manipulation',
    'Line Generation',
    'Ships That Build',
    'Drawing',
    'End of Build Phase',
  ];

  const battleSubphases = [
    'First Strike',
    'Charge Declaration',
    'Automatic',
    'Upon Destruction',
    'Energy',
    'Solar',
    'End of Battle Phase',
  ];

  if (buildSubphases.some((label) => subphase.includes(label))) {
    return 'build';
  }

  if (battleSubphases.some((label) => subphase.includes(label))) {
    return 'battle';
  }

  return 'battle';
}

function renderPowerText(text: string): string {
  return text.replace(/\\n/g, '\n');
}

function getSubphaseLabel(ship: ShipDefinitionUI): string {
  const seen = new Set<string>();
  const uniqueSubphases: string[] = [];

  for (const power of ship.powers) {
    const subphase = power.subphase;
    if (!subphase || subphase.trim() === '' || subphase.toUpperCase() === 'N/A') {
      continue;
    }

    const normalized = subphase.toUpperCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueSubphases.push(normalized);
    }
  }

  return uniqueSubphases.join(', ');
}

export function getShipCardModel(shipId: ShipDefId): ShipCardModel | null {
  const ship = SHIP_DEFINITIONS_MAP?.[shipId];

  if (!ship) {
    console.warn(`[ShipCardModel] Ship not found: ${shipId}`);
    if (import.meta.env.DEV) {
      console.log('[ShipCardModel] SHIP_DEFINITIONS_MAP keys sample:', Object.keys(SHIP_DEFINITIONS_MAP || {}).slice(0, 10));
    }
    return null;
  }

  const cost = ship.totalLineCost ?? 0;
  const joiningLines = ship.joiningLineCost && ship.joiningLineCost > 0
    ? ship.joiningLineCost
    : undefined;
  const phaseLabel = getSubphaseLabel(ship);
  const powers: ShipPowerViewModel[] = ship.powers.map((power) => ({
    icon: getPhaseIcon(power.subphase),
    text: renderPowerText(power.text),
  }));
  const italicNotes = ship.extraRules || undefined;
  const componentShipIds = ship.componentShips ?? [];

  return {
    name: ship.name,
    cost,
    joiningLines,
    phaseLabel,
    powers,
    italicNotes,
    componentShipIds,
  };
}

export function groupShipCounts(shipTokens: readonly string[]): GroupedShipToken[] {
  const seen = new Map<string, number>();
  const order: string[] = [];

  for (const token of shipTokens) {
    if (!seen.has(token)) {
      order.push(token);
      seen.set(token, 1);
    } else {
      seen.set(token, seen.get(token)! + 1);
    }
  }

  return order.map((token) => ({ token, count: seen.get(token)! }));
}
