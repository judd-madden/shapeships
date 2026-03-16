import type { ShipDefId } from '../../types/ShipTypes.engine';

export interface PublicVisibleShipSnapshot {
  id?: string;
  instanceId?: string;
  shipDefId?: ShipDefId | string;
  createdTurn?: number;
  chargesCurrent?: number;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value;
}

function toOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createPublicVisibleShipSnapshot(ship: any): Readonly<PublicVisibleShipSnapshot> {
  return Object.freeze({
    id: toOptionalString(ship?.id),
    instanceId: toOptionalString(ship?.instanceId),
    shipDefId: toOptionalString(ship?.shipDefId),
    createdTurn: toOptionalNumber(ship?.createdTurn),
    chargesCurrent: toOptionalNumber(ship?.chargesCurrent) ?? 0,
  });
}

export function createPublicVisibleShipSnapshots(
  ships: any[]
): ReadonlyArray<Readonly<PublicVisibleShipSnapshot>> {
  return Object.freeze(ships.map(createPublicVisibleShipSnapshot));
}
