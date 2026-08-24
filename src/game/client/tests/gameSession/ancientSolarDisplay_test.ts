declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { deriveAncientSolarDisplayEntries } from '../../gameSession/ancient/ancientSolarDisplay';
import {
  buildPresentationFleetCountsByLiveRenderKey,
  filterFleetSummariesBySuppressedMemberIds,
  getCurrentTurnRegisteredSimulacrumInstanceIds,
} from '../../gameSession/fleetPresentation';

interface FleetSummary {
  shipDefId: string;
  stackKey: string;
  renderKey: string;
  count: number;
  memberInstanceIds: string[];
  currentCharges: number | null;
  caption: string | null;
}

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
    );
  }
}

function makeLedger(playerId: string) {
  return {
    battleTurnNumber: 4,
    entries: [
      {
        entryId: `${playerId}-current-ssim`,
        order: 0,
        solarPowerId: 'SSIM',
        sourceMode: 'manual',
        simulacrum: {
          sourceTargetInstanceId: `${playerId}-source-current`,
          copiedShipDefId: 'XEN',
        },
      },
      {
        entryId: `${playerId}-older-ssim`,
        order: 1,
        solarPowerId: 'SSIM',
        sourceMode: 'manual',
        simulacrum: {
          sourceTargetInstanceId: `${playerId}-source-older`,
          copiedShipDefId: 'ANT',
        },
      },
      {
        entryId: `${playerId}-ordinary`,
        order: 2,
        solarPowerId: 'SLIF',
        sourceMode: 'manual',
      },
    ],
  };
}

function deriveSolarEntries(
  playerId: string,
  suppressedAuthoritativeLedgerEntryIds?: ReadonlySet<string>
) {
  return deriveAncientSolarDisplayEntries({
    playerId,
    ledger: makeLedger(playerId),
    allowLocalPreview: false,
    currentBattleTurnNumber: 5,
    localPreviewCasts: [],
    isAuthoritativelyReady: false,
    suppressedAuthoritativeLedgerEntryIds,
  });
}

function makeFleetSummary(args: {
  playerId: string;
  count: number;
  memberInstanceIds: string[];
}): FleetSummary {
  return {
    shipDefId: 'XEN',
    stackKey: `${args.playerId}-xen`,
    renderKey: `${args.playerId}-xen`,
    count: args.count,
    memberInstanceIds: args.memberInstanceIds,
    currentCharges: null,
    caption: null,
  };
}

Deno.test('SSIM register and fleet switch together at the shared materialisation hold', () => {
  const turnNumber = 5;
  const registry = {
    local: ['local-current-ship'],
    opponent: ['opponent-current-ship'],
  };
  const shipsByPlayerId = {
    local: [
      { shipDefId: 'XEN', instanceId: 'local-current-ship', createdTurn: turnNumber },
    ],
    opponent: [
      { shipDefId: 'XEN', instanceId: 'opponent-older-ship', createdTurn: 4 },
      { shipDefId: 'XEN', instanceId: 'opponent-current-ship', createdTurn: turnNumber },
    ],
  };
  const liveFleetByPlayerId = {
    local: [makeFleetSummary({
      playerId: 'local',
      count: 1,
      memberInstanceIds: ['local-current-ship'],
    })],
    opponent: [makeFleetSummary({
      playerId: 'opponent',
      count: 2,
      memberInstanceIds: ['opponent-older-ship', 'opponent-current-ship'],
    })],
  };

  for (const playerId of ['local', 'opponent'] as const) {
    const currentTurnFleetIds = getCurrentTurnRegisteredSimulacrumInstanceIds({
      ships: shipsByPlayerId[playerId],
      ownerPlayerId: playerId,
      turnNumber,
      materializedSimulacrumFleetInstanceIdsByPlayerId: registry,
    });
    const unsuppressedSolarEntries = deriveSolarEntries(playerId);
    const normallySuppressedSolarEntries = deriveSolarEntries(
      playerId,
      new Set([`${playerId}-current-ssim`])
    );

    const fleetDuringHold = filterFleetSummariesBySuppressedMemberIds(
      liveFleetByPlayerId[playerId],
      currentTurnFleetIds
    );
    const solarDuringHold = unsuppressedSolarEntries;
    const fleetAfterRelease = liveFleetByPlayerId[playerId];
    const solarAfterRelease = normallySuppressedSolarEntries;

    assertEquals(
      fleetDuringHold.some((stack) =>
        stack.memberInstanceIds.includes(`${playerId}-current-ship`)
      ),
      false,
      `${playerId} current-turn SSIM fleet member should remain withheld during the hold`
    );
    assertEquals(
      solarDuringHold.map((entry) => entry.authoritativeLedgerEntryId),
      [
        `${playerId}-current-ssim`,
        `${playerId}-older-ssim`,
        `${playerId}-ordinary`,
      ],
      `${playerId} registered SSIM should remain in the Solar register during the hold`
    );
    assertEquals(
      fleetAfterRelease.some((stack) =>
        stack.memberInstanceIds.includes(`${playerId}-current-ship`)
      ),
      true,
      `${playerId} current-turn SSIM fleet member should appear after release`
    );
    assertEquals(
      solarAfterRelease.map((entry) => entry.authoritativeLedgerEntryId),
      [`${playerId}-older-ssim`, `${playerId}-ordinary`],
      `${playerId} registered SSIM should use existing suppression after release`
    );

    const expectedHeldCount = playerId === 'local' ? {} : { 'opponent-xen': 1 };
    const expectedReleasedCount = {
      [`${playerId}-xen`]: playerId === 'local' ? 1 : 2,
    };
    assertEquals(
      buildPresentationFleetCountsByLiveRenderKey({
        presentedFleet: fleetDuringHold,
        liveFleet: liveFleetByPlayerId[playerId],
      }),
      expectedHeldCount,
      `${playerId} presentation count should not consume the SSIM addition early`
    );
    assertEquals(
      buildPresentationFleetCountsByLiveRenderKey({
        presentedFleet: fleetAfterRelease,
        liveFleet: liveFleetByPlayerId[playerId],
      }),
      expectedReleasedCount,
      `${playerId} presentation count should expose the SSIM addition after release`
    );
  }
});

Deno.test('existing Solar filtering remains opt-in to the Build suppression context', () => {
  const outsideBuildEntries = deriveSolarEntries('local');
  const buildSuppressedEntries = deriveSolarEntries(
    'local',
    new Set(['local-current-ssim'])
  );

  assertEquals(
    outsideBuildEntries.map((entry) => entry.authoritativeLedgerEntryId),
    ['local-current-ssim', 'local-older-ssim', 'local-ordinary'],
    'without the existing Build suppression input every valid entry remains presented'
  );
  assertEquals(
    buildSuppressedEntries.map((entry) => entry.authoritativeLedgerEntryId),
    ['local-older-ssim', 'local-ordinary'],
    'Build suppression removes only the registered SSIM and preserves existing filtering semantics'
  );
});
