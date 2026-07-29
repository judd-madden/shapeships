import assert from 'node:assert/strict';
import { computeLineBonusesForPlayer } from './computeLineBonusForPlayer.ts';

function solarEntry(
  entryId: string,
  solarPowerId: string,
  sourceMode: 'manual' | 'autocast',
) {
  return {
    entryId,
    order: 0,
    solarPowerId,
    sourceMode,
    paidEnergy: { green: 0, red: 0, blue: 1 },
  };
}

function createGameData(): any {
  return {
    turnNumber: 4,
    ships: {
      p1: [],
      p2: [],
    },
    turnData: {
      effectiveDiceRoll: 4,
      effectiveDiceRollByPlayerId: { p1: 4, p2: 4 },
    },
    ancient: {
      solarLedgerByPlayerId: {
        p1: {
          battleTurnNumber: 3,
          entries: [
            solarEntry('manual', 'SCON', 'manual'),
            solarEntry('autocast', 'SCON', 'autocast'),
            solarEntry('other-power', 'SLIF', 'manual'),
          ],
        },
        p2: {
          battleTurnNumber: 3,
          entries: [solarEntry('other-player', 'SCON', 'manual')],
        },
      },
      pendingSimulacrumCopies: [],
    },
  };
}

Deno.test('Convert line bonuses support full-state and inner-game-data invocation shapes', () => {
  const authoritativeGameData = createGameData();
  const fromInner = computeLineBonusesForPlayer(authoritativeGameData, 'p1');
  const fromFull = computeLineBonusesForPlayer(
    { gameData: authoritativeGameData },
    'p1',
  );

  assert.deepEqual(fromFull, fromInner);
  assert.equal(fromInner.bonusLines, 2);
  assert.equal(fromInner.bonusLinesOnEven, 0);
  assert.deepEqual(fromInner.contributingSourceInstanceIds, []);
  assert.deepEqual(fromInner.ordinaryRows, [{
    rowKind: 'solar_power',
    solarPowerId: 'SCON',
    label: 'Convert',
    count: 2,
    amount: 2,
    amountText: '2',
  }]);
});

Deno.test('Convert combines with ordinary, even-only, SCI, and joining-line sources', () => {
  const gameData = createGameData();
  gameData.ships.p1 = [
    { instanceId: 'orb', shipDefId: 'ORB' },
    { instanceId: 'vig', shipDefId: 'VIG' },
    { instanceId: 'pow', shipDefId: 'POW' },
    { instanceId: 'sci-a', shipDefId: 'SCI' },
    { instanceId: 'sci-b', shipDefId: 'SCI' },
    { instanceId: 'red', shipDefId: 'RED' },
    { instanceId: 'dom', shipDefId: 'DOM' },
  ];

  const result = computeLineBonusesForPlayer(gameData, 'p1');

  assert.equal(result.bonusLines, 13);
  assert.equal(result.bonusLinesOnEven, 6);
  assert.equal(result.joiningBonusLines, 4);
  assert.deepEqual(
    result.ordinaryRows.find((row) => row.rowKind === 'solar_power'),
    {
      rowKind: 'solar_power',
      solarPowerId: 'SCON',
      label: 'Convert',
      count: 2,
      amount: 2,
      amountText: '2',
    },
  );
  assert.equal(
    result.ordinaryRows.some(
      (row) => row.rowKind === 'adjustment' && row.label === 'Science Vessel',
    ),
    true,
  );
  assert.equal(result.evenOnlyRows.length, 2);
  assert.equal(result.joiningRows.length, 2);
  assert.equal(result.contributingSourceInstanceIds.includes('orb'), true);
  assert.equal(result.contributingSourceInstanceIds.includes('vig'), true);
  assert.equal(result.contributingSourceInstanceIds.includes('pow'), true);
  assert.equal(result.contributingSourceInstanceIds.includes('sci-a'), true);
  assert.equal(result.contributingSourceInstanceIds.includes('sci-b'), true);
  assert.equal(
    result.contributingSourceInstanceIds.some((id) => id.includes('convert')),
    false,
  );
});

Deno.test('Convert remains fleet-independent and ignores another player ledger', () => {
  const gameData = createGameData();

  const p1 = computeLineBonusesForPlayer(gameData, 'p1');
  const p2 = computeLineBonusesForPlayer(gameData, 'p2');

  assert.equal(p1.bonusLines, 2);
  assert.equal(p2.bonusLines, 1);
  assert.equal(p2.ordinaryRows[0]?.rowKind, 'solar_power');
  if (p2.ordinaryRows[0]?.rowKind === 'solar_power') {
    assert.equal(p2.ordinaryRows[0].count, 1);
  }
});

Deno.test('Convert requires a well-formed ledger from the immediately preceding Battle', () => {
  const cases: Array<{ name: string; mutate: (gameData: any) => void }> = [
    {
      name: 'current Build turn',
      mutate: (gameData) => {
        gameData.ancient.solarLedgerByPlayerId.p1.battleTurnNumber = 4;
      },
    },
    {
      name: 'stale Battle turn',
      mutate: (gameData) => {
        gameData.ancient.solarLedgerByPlayerId.p1.battleTurnNumber = 2;
      },
    },
    {
      name: 'missing ledger',
      mutate: (gameData) => {
        delete gameData.ancient.solarLedgerByPlayerId.p1;
      },
    },
    {
      name: 'malformed ledger',
      mutate: (gameData) => {
        gameData.ancient.solarLedgerByPlayerId.p1 = {
          battleTurnNumber: 3,
          entries: 'not-an-array',
        };
      },
    },
    {
      name: 'malformed current turn',
      mutate: (gameData) => {
        gameData.turnNumber = Number.NaN;
      },
    },
  ];

  for (const scenario of cases) {
    const gameData = createGameData();
    scenario.mutate(gameData);
    const result = computeLineBonusesForPlayer(gameData, 'p1');
    assert.equal(result.bonusLines, 0, scenario.name);
    assert.deepEqual(result.ordinaryRows, [], scenario.name);
  }

  const malformedEntry = createGameData();
  malformedEntry.ancient.solarLedgerByPlayerId.p1.entries.push(null, {
    solarPowerId: 123,
  });
  assert.equal(
    computeLineBonusesForPlayer(malformedEntry, 'p1').bonusLines,
    2,
  );
});
