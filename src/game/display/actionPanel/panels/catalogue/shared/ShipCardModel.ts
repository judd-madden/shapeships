import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import { SHIP_DEFINITIONS_MAP } from '../../../../../data/ShipDefinitionsUI';
import {
  getShipPhaseLabel,
  getShipPowerPresentation,
  type ShipPowerPresentation,
} from '../../../../../data/ShipPowerPresentation';
import {
  getShipPowerTagLabels,
  type ShipPowerTagLabel,
} from '../../../../../data/ShipPowerTags';

export interface ShipCardModel {
  name: string;
  cost: number;
  joiningLines?: number;
  phaseLabel?: string;
  powerTagLabels: readonly ShipPowerTagLabel[];
  powers: ShipPowerPresentation[];
  italicNotes?: string;
  componentShipIds: readonly string[];
}

export interface GroupedShipToken {
  token: string;
  count: number;
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
  const phaseLabel = getShipPhaseLabel(ship.powers);
  const powerTagLabels = getShipPowerTagLabels(ship.powers);
  const powers = ship.powers.map(getShipPowerPresentation);
  const italicNotes = ship.extraRules || undefined;
  const componentShipIds = ship.componentShips ?? [];

  return {
    name: ship.name,
    cost,
    joiningLines,
    phaseLabel,
    powerTagLabels,
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
