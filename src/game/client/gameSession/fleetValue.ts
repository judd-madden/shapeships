import { getShipById } from '../../data/ShipDefinitions.core';
import type { BoardFleetSummary } from './types';

/** Value only viewer-safe, materialised fleet summaries, before targeting projections. */
export function calculatePresentedFleetValue(
  fleet: readonly Pick<BoardFleetSummary, 'shipDefId' | 'count'>[],
): number {
  return fleet.reduce((total, summary) => {
    const cost = getShipById(summary.shipDefId)?.totalLineCost;
    return total + (Number.isInteger(cost) ? Number(cost) * summary.count : 0);
  }, 0);
}
