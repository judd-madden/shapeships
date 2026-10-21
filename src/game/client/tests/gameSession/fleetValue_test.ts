import { afterEach, expect, test, vi } from 'vitest';
import * as definitions from '../../../data/ShipDefinitions.core';
import type { BoardFleetSummary } from '../../gameSession/types';
import { calculatePresentedFleetValue } from '../../gameSession/fleetValue';
import { deriveFleets } from '../../gameSession/fleets';
import {
  filterFleetSummariesBySuppressedMemberIds,
  getCurrentTurnRegisteredSimulacrumInstanceIds,
  projectExactTargetFleetPresentation,
} from '../../gameSession/fleetPresentation';
import { evaluateProvisionalBuild } from '../../gameSession/provisionalBuild';

afterEach(() => vi.restoreAllMocks());

function summary(shipDefId: string, ids: string[], suffix = ''): BoardFleetSummary {
  return {
    shipDefId, count: ids.length, memberInstanceIds: ids,
    stackKey: shipDefId + suffix, renderKey: shipDefId + suffix,
    currentCharges: null, caption: null,
  };
}

test('Fleet Value counts every ship in ordinary stacks and disjoint charge buckets once', () => {
  expect(calculatePresentedFleetValue([
    summary('DEF', ['d1', 'd2', 'd3']),
    summary('FIG', ['f1'], '__charges_1'),
    summary('FIG', ['f2'], '__charges_0'),
  ])).toBe(12);
  expect(calculatePresentedFleetValue([])).toBe(0);
});

test('Fleet Value mirrors integer totalLineCost semantics, including null and unknown costs', () => {
  const lookup = definitions.getShipById;
  vi.spyOn(definitions, 'getShipById').mockImplementation((id) => id === 'FRACTION'
    ? { ...lookup('FIG')!, totalLineCost: 1.5 } : lookup(id));
  expect(calculatePresentedFleetValue([
    summary('UNKNOWN', ['unknown']), summary('SBLA', ['solar']),
    summary('FRACTION', ['fraction']), summary('DEF', ['known']),
  ])).toBe(2);
});

function fleets(majorPhase: string, spectator = false) {
  return deriveFleets({
    rawState: {
      publicState: {
        ships: {
          p1: [{ instanceId: 'own-old', shipDefId: 'DEF', createdTurn: 3 }],
          p2: [
            { instanceId: 'other-old', shipDefId: 'DEF', createdTurn: 3 },
            { instanceId: 'other-build', shipDefId: 'FIG', createdTurn: 4 },
          ],
        },
        voidShipsByPlayerId: { p2: [{ instanceId: 'void', shipDefId: 'FIG', createdTurn: 3 }] },
        ancient: { solarPowerLedgerByPlayerId: { p2: [{ solarPowerId: 'SSIM' }] } },
      },
    },
    me: spectator ? null : { id: 'p1' }, opponent: { id: 'p2' }, turnNumber: 4, majorPhase,
  });
}

test('Fleet Value follows viewer-safe build concealment and reveal for players and spectators', () => {
  for (const spectator of [false, true]) {
    const building = fleets('build', spectator);
    const revealed = fleets('battle', spectator);
    expect(calculatePresentedFleetValue(building.opponentFleet)).toBe(2);
    expect(calculatePresentedFleetValue(revealed.opponentFleet)).toBe(5);
    expect(calculatePresentedFleetValue(building.opponentVoidFleet)).toBe(3);
  }
});

test('Fleet Value follows the requester build preview and removes it when the draft clears', () => {
  const preview = (draftCounts: Record<string, number>) => evaluateProvisionalBuild({
    turnNumber: 4, myShips: [{ instanceId: 'own', shipDefId: 'DEF' }],
    draftCounts, nativeSpecies: 'human',
    buildEconomy: { ordinaryLinesAvailable: 20, joiningLinesAvailable: 20 },
    frigateSelectedTriggers: [], quantumMysticSelectedNumbers: [], evolverChoicesByRowId: {},
  });
  expect(calculatePresentedFleetValue(preview({ FIG: 2 }).myFleetPreview)).toBe(8);
  expect(calculatePresentedFleetValue(preview({}).myFleetPreview)).toBe(2);
});

test('Fleet Value excludes held creations and copies until their presentation release', () => {
  const ships = [
    { shipDefId: 'FIG', instanceId: 'old', createdTurn: 3 },
    { shipDefId: 'FIG', instanceId: 'copy', createdTurn: 4 },
    { shipDefId: 'DEF', instanceId: 'build', createdTurn: 4 },
  ];
  const copies = getCurrentTurnRegisteredSimulacrumInstanceIds({
    ships, ownerPlayerId: 'p1', turnNumber: 4,
    materializedSimulacrumFleetInstanceIdsByPlayerId: { p1: ['copy'] },
  });
  const fleet = [summary('FIG', ['old', 'copy']), summary('DEF', ['build'])];
  const held = filterFleetSummariesBySuppressedMemberIds(fleet, ['build', ...copies]);
  expect(calculatePresentedFleetValue(held)).toBe(3);
  expect(calculatePresentedFleetValue(fleet)).toBe(8);
});

test('Target hover and exact-target splits cannot change the live Fleet Value', () => {
  const fleet = [summary('FIG', ['f1', 'f2', 'f3'])];
  const before = calculatePresentedFleetValue(fleet);
  const projection = projectExactTargetFleetPresentation({
    side: 'opponent', fleet, renderOrder: ['FIG'],
    exactTargets: [{ instanceId: 'f1', side: 'opponent', previewShipDefId: 'SBLA' }],
    targetStatesByStackKey: {}, previewShipDefIdByStackKey: { FIG: 'DOM' },
  });
  expect(projection.fleet).toHaveLength(2);
  expect(Object.values(projection.previewShipDefIdByStackKey)).toContain('SBLA');
  expect(calculatePresentedFleetValue(fleet)).toBe(before);
  expect(calculatePresentedFleetValue(projection.fleet)).toBe(before);
});
