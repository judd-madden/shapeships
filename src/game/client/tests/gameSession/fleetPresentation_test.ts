declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  buildExactDestroyTargetPresentationEntries,
  buildExactMembershipSelectedTargetStates,
  buildLocalAncientExactTargetPresentationEntries,
  buildPresentationFleetCountsByLiveRenderKey,
  classifyShipVisibilityToViewer,
  filterFleetSummariesBySuppressedMemberIds,
  getCurrentTurnHiddenShipInstanceIds,
  getCurrentTurnRegisteredSimulacrumInstanceIds,
  getDeferredBugDrawingSpendCountByInstanceId,
  projectExactTargetFleetPresentation,
  projectDeferredBugChargePresentation,
} from '../../gameSession/fleetPresentation';
import { getShipActivationCueBatches, type ResolvedActivationOutcome, type ShipActivationCueBatch } from '../../gameSession/selectors';
import { createShipEffectPresentationState, reconcileShipEffects, settleShipEffect, impactShipEffect,
  expireShipEffects, observeShipEffectSync } from '../../gameSession/clienteffects/useShipEffectPresentation';

interface FleetSummary {
  shipDefId: string;
  stackKey: string;
  renderKey: string;
  count: number;
  memberInstanceIds: string[];
  condition?: 'charges_1' | 'charges_0';
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

function assertSame(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function makeSummary(args: {
  shipDefId: string;
  stackKey?: string;
  renderKey?: string;
  count: number;
  memberInstanceIds: string[];
  condition?: FleetSummary['condition'];
  currentCharges?: number | null;
  caption?: string | null;
}): FleetSummary {
  return {
    shipDefId: args.shipDefId,
    stackKey: args.stackKey ?? args.shipDefId,
    renderKey: args.renderKey ?? `render__${args.stackKey ?? args.shipDefId}`,
    count: args.count,
    memberInstanceIds: args.memberInstanceIds,
    condition: args.condition,
    currentCharges: args.currentCharges ?? null,
    caption: args.caption ?? null,
  };
}

function resolved(kind: ResolvedActivationOutcome['kind'] = 'destroy', ids = ['victim'], sourceId = 'GUA'): ResolvedActivationOutcome {
  return { playerId: 'p1', kind,
    source: kind === 'copy' ? { type: 'solar', solarPowerId: 'SSIM', ledgerEntryId: 'ledger', pendingCopyId: 'copy' }
      : { type: 'ship', instanceId: 'source', shipDefId: sourceId, effectId: sourceId + ids.join(',') },
    targets: ids.map((shipInstanceId) => ({ playerId: 'p2', shipInstanceId,
      ...(kind === 'steal' ? { destinationPlayerId: 'p1' } : {}) })) };
}
function effectBatch(outcomes: ResolvedActivationOutcome[] = [], seq = 1): ShipActivationCueBatch {
  return { key: `batch-${seq}`, seq, turnNumber: 3, phaseKey: 'battle.first_strike', sources: [], resolvedOutcomes: outcomes };
}
function effectInput(batches: ShipActivationCueBatch[] = []): Parameters<typeof reconcileShipEffects>[1] {
  const summary = makeSummary({ shipDefId: 'CUB', count: 3, memberInstanceIds: ['victim', 'other', 'safe'], currentCharges: 2 });
  return { context: 'game:viewer', enabled: true, batches, previous: { my: [], opponent: [summary] },
    fleet: { my: [], opponent: [summary] }, voidFleet: { my: [], opponent: [] }, leftPlayerId: 'p1', rightPlayerId: 'p2' };
}

Deno.test('public outcome-only batches survive normalization without trusting private outcomes', () => {
  const good = resolved();
  const state = { publicState: { presentationEvents: { shipActivationCueBatches: [effectBatch([
    good, good, { ...good, targets: [] }, { ...resolved('steal'), targets: good.targets },
  ])] } }, requester: { presentationEvents: { shipActivationCueBatches: [{ ...effectBatch([good]),
    sources: [{ playerId: 'p1', sourceInstanceId: 'source' }] }] } } };
  const batches = getShipActivationCueBatches(state);
  assertEquals(batches[0].resolvedOutcomes, [good], 'reject malformed outcomes and dedupe identities');
  assertEquals(batches[0].sources, [], 'Solar-only public batch remains valid');
  assertEquals(batches[1].resolvedOutcomes, undefined, 'requester data cannot publish outcomes');
  const cubeCopy = resolved('copy');
  if (cubeCopy.source.type === 'solar' && cubeCopy.source.solarPowerId === 'SSIM') {
    cubeCopy.source.trigger = { kind: 'cube_destruction', sourceShipInstanceId: 'cube', sourceEffectId: 'destroy-cube' };
  }
  assertEquals(getShipActivationCueBatches({ publicState: { shipActivationCueBatches: [effectBatch([cubeCopy])] } })[0].resolvedOutcomes,
    [cubeCopy], 'Cube provenance survives unchanged');
});

Deno.test('private source feedback cannot consume a later public outcome with the same batch key', () => {
  const input = effectInput([effectBatch()]);
  input.batches![0].sources = [{ playerId: 'p1', sourceInstanceId: 'source' }];
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  assertEquals(state.groups.length, 0, 'initial history is a baseline');
  input.batches = [effectBatch([resolved()])];
  state = reconcileShipEffects(state, input, 100);
  assertEquals(state.groups.length, 1, 'new public outcome plays independently');
  const repeated = reconcileShipEffects(state, input, 500);
  assertSame(repeated, state, 'ordinary polls cannot restart the effect or deadline');
  state = impactShipEffect(state, state.groups[0].key);
  assertSame(impactShipEffect(state, state.groups[0].key), state, 'related targets claim sound once');
  state = settleShipEffect(state, state.groups[0].key, null, 2100);
  assertEquals(reconcileShipEffects(state, input, 2500).groups.length, 0, 'completion does not replay retained metadata');
});

Deno.test('rejoin, background and recovery establish a baseline and release pending retention', () => {
  let input = effectInput();
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  input.batches = [effectBatch([resolved()])];
  state = reconcileShipEffects(state, input, 100);
  const oldKey = state.groups[0].key;
  state = reconcileShipEffects(state, { ...input, enabled: false, resetBaseline: true }, 200);
  assertEquals(state.groups, [], 'recovery immediately releases result waiting and retention');
  state = reconcileShipEffects(state, { ...input, context: 'new-session' }, 300);
  assertEquals(state.groups, [], 'historical outcomes do not replay');
  assertSame(settleShipEffect(state, oldKey, null, 400), state, 'old callbacks cannot settle the new session');
  input = { ...input, context: 'new-session', batches: [effectBatch([resolved()], 1), effectBatch([resolved('copy')], 2)] };
  assertEquals(reconcileShipEffects(state, input, 500).groups.map((group) => group.kind), ['copy'], 'new live outcomes resume');
});

for (const validation of ['accepted_full', 'unchanged_head'] as const) {
  for (const outcomeInValidation of [true, false]) {
    Deno.test(`visible refocus preserves unseen outcomes (${validation}, in validating response: ${outcomeInValidation})`, () => {
      let sync = { failures: 0, recovering: false, version: 0, validatedResumeToken: 0 as number | null };
      const input = effectInput([effectBatch([resolved('copy', ['other'])])]);
      input.context = JSON.stringify(['game:viewer', sync.version]);
      let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
      const established = state;
      // Refocus changes the synchronization token, but not presentation identity.
      const resumeToken = 1;
      input.enabled = sync.validatedResumeToken === resumeToken;
      if (outcomeInValidation) input.batches = [effectBatch([resolved('copy', ['other']), resolved()])];
      state = reconcileShipEffects(state, input, 100);
      assertSame(state, established, 'suspension neither consumes outcomes nor replaces the baseline');
      assertSame(reconcileShipEffects(state, input, 200), state, 'repeated suspension preserves all consumption state');
      sync = observeShipEffectSync(sync, validation, resumeToken);
      input.context = JSON.stringify(['game:viewer', sync.version]);
      input.enabled = sync.validatedResumeToken === resumeToken;
      state = reconcileShipEffects(state, input, 300);
      if (!outcomeInValidation) {
        assertEquals(state.groups, [], 'validation alone does not replay established history');
        input.batches = [effectBatch([resolved('copy', ['other']), resolved()])];
        state = reconcileShipEffects(state, input, 400);
      }
      assertEquals(state.groups.map((group) => group.kind), ['destroy'], 'only the unseen outcome plays');
      assertSame(reconcileShipEffects(state, input, 500), state, 'duplicate response preserves the effect and deadline');
      state = settleShipEffect(state, state.groups[0].key, null, 2500);
      assertSame(reconcileShipEffects(state, input, 2600), state, 'settled outcomes cannot replay');
    });
  }
}

Deno.test('visible suspension preserves active effects, impact consumption and the original deadline', () => {
  const input = effectInput();
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  input.batches = [effectBatch([resolved()])];
  state = reconcileShipEffects(state, input, 100);
  const key = state.groups[0].key;
  state = impactShipEffect(state, key);
  const active = state;
  input.enabled = false;
  assertSame(reconcileShipEffects(state, input, 500), active, 'refocus preserves active claims and sound consumption');
  assertSame(impactShipEffect(state, key), active, 'duplicate impacts remain consumed during suspension');
  input.enabled = true;
  assertSame(reconcileShipEffects(state, input, 1000), active, 'validation does not restart a consumed effect');
  input.enabled = false;
  state = expireShipEffects(reconcileShipEffects(state, input, 2000), 2100);
  assertEquals(state.groups, [], 'original deadline releases retention even while suspended');
  input.enabled = true;
  assertSame(reconcileShipEffects(state, input, 2200), state, 'validation cannot restart an expired effect');
});

for (const recovery of ['hidden', 'disconnect', 'game', 'session', 'viewer']) {
  Deno.test(`${recovery} recovery still establishes a silent baseline`, () => {
    const input = effectInput();
    let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
    input.batches = [effectBatch([resolved()])];
    state = reconcileShipEffects(state, input, 100);
    const oldKey = state.groups[0].key;
    state = impactShipEffect(state, oldKey);
    input.enabled = false;
    if (recovery === 'hidden') input.resetBaseline = true;
    else if (recovery === 'disconnect') {
      let sync = { failures: 0, recovering: false, version: 0, validatedResumeToken: 0 as number | null };
      for (let i = 0; i < 3; i++) sync = observeShipEffectSync(sync, 'transport_failure', 0);
      input.context = JSON.stringify(['game:viewer', sync.version]);
      input.resetBaseline = sync.recovering;
    } else input.context = `${recovery}:changed`;
    state = reconcileShipEffects(state, input, 200);
    assertEquals([state.initialized, state.groups, state.seen, state.impactKey], [false, [], [], null],
      'genuine recovery clears baseline, retention and impact');
    assertSame(reconcileShipEffects(state, input, 250), state, 'repeated reset is idempotent');
    input.resetBaseline = false;
    state = reconcileShipEffects(state, input, 300);
    assertEquals(state.initialized, false, 'recovery awaits synchronization');
    input.enabled = true;
    state = reconcileShipEffects(state, input, 400);
    assertEquals([state.initialized, state.groups], [true, []], 'validating history is silent');
    input.batches = [effectBatch([resolved()], 1), effectBatch([resolved('copy')], 2)];
    state = reconcileShipEffects(state, input, 500);
    assertEquals(state.groups.map((group) => group.kind), ['copy'], 'later live outcomes resume');
    assertSame(settleShipEffect(state, oldKey, null, 600), state, 'stale callback cannot settle a new live outcome');
  });
}

Deno.test('initial synchronization defers baseline establishment until playback is eligible', () => {
  const input = effectInput([effectBatch([resolved()])]);
  input.enabled = false;
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  assertEquals([state.initialized, state.seen], [false, []], 'ineligible first response consumes nothing');
  input.enabled = true;
  state = reconcileShipEffects(state, input, 100);
  assertEquals([state.initialized, state.groups], [true, []], 'first eligible history stays silent');
});

Deno.test('consumption retains eight batches and cannot replay evicted historical outcomes', () => {
  const input = effectInput();
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  for (let seq = 1; seq <= 10; seq++) state = reconcileShipEffects(state,
    { ...input, batches: [effectBatch([], seq)] }, seq);
  assertEquals(state.seen.length, 8, 'history remains bounded');
  assertSame(reconcileShipEffects(state, { ...input, enabled: false }, 15), state,
    'suspension preserves bounded history and the eviction watermark');
  const stale = reconcileShipEffects(state, { ...input, batches: [effectBatch([resolved()], 1)] }, 20);
  assertSame(stale, state, 'eviction does not permit stale replay');
});

Deno.test('disconnect recovery requires three response-free failures and validated baseline confirmation', () => {
  let state = { failures: 0, recovering: false, version: 0, validatedResumeToken: 0 as number | null };
  state = observeShipEffectSync(state, 'transport_failure', 0);
  state = observeShipEffectSync(state, 'transport_failure', 0);
  assertEquals(state.recovering, false, 'isolated failed polls leave live effects eligible');
  state = observeShipEffectSync(state, 'http_response', 0);
  assertEquals(state.failures, 0, 'any HTTP response, including HTTP errors, breaks the streak');
  for (let i = 0; i < 3; i++) state = observeShipEffectSync(state, 'transport_failure', 0);
  assertEquals(state.recovering, true, 'third response-free cycle enters recovery');
  state = observeShipEffectSync(state, 'http_response', 0);
  assertEquals(state.recovering, true, 'a changed or malformed head cannot establish a baseline');
  state = observeShipEffectSync(state, 'unchanged_head', 1);
  assertEquals([state.recovering, state.validatedResumeToken], [false, 1], 'validated unchanged head reuses accepted snapshot');
  state = { ...state, recovering: true };
  assertEquals(observeShipEffectSync(state, 'accepted_full', 2).recovering, false, 'accepted full also confirms recovery');
});

Deno.test('EQU and SBLA group related destroys while shared-instance copy/destroy order is preserved', () => {
  const input = effectInput();
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  const own = { ...resolved('destroy', ['other'], 'EQU'), targets: [{ playerId: 'p1', shipInstanceId: 'other' }] };
  input.previous.my = input.previous.opponent;
  input.batches = [effectBatch([resolved('destroy', ['victim'], 'EQU'), own])];
  state = reconcileShipEffects(state, input, 100);
  assertEquals(state.groups.length, 1, 'EQU pair shares a group');
  assertEquals(state.groups[0].targets.map((target) => target.side), ['opponent', 'my'], 'both sides retain their owners');
  const solar = (id: string): ResolvedActivationOutcome => ({ ...resolved('destroy', [id]),
    source: { type: 'solar', solarPowerId: 'SBLA', ledgerEntryId: 'black-hole', effectId: id } });
  state = reconcileShipEffects(createShipEffectPresentationState(), effectInput(), 0);
  state = reconcileShipEffects(state, effectInput([effectBatch([solar('victim'), solar('other')])]), 100);
  assertEquals(state.groups[0].targets.length, 2, 'SBLA ledger groups multiple effects');
  state = reconcileShipEffects(createShipEffectPresentationState(), effectInput(), 0);
  state = reconcileShipEffects(state, effectInput([effectBatch([resolved('copy'), resolved()])]), 100);
  assertEquals(state.groups.map((group) => group.startedAt), [100, null], 'same-instance effects do not overlap');
  assertEquals(state.groups[0].sourceShipDefId, undefined, 'SSIM never receives a source icon');
  state = settleShipEffect(state, state.groups[0].key, 'victim', 2100);
  assertEquals(state.groups.map((group) => [group.kind, group.startedAt]), [['destroy', 2100]], 'destroy follows copy');
});

Deno.test('runtime deadlines release unmounted targets and do not extend on ordinary reconciliation', () => {
  const input = effectInput();
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  input.batches = [effectBatch([resolved('destroy', ['victim', 'other'])])];
  state = reconcileShipEffects(state, input, 100);
  const key = state.groups[0].key;
  state = settleShipEffect(state, key, 'victim', 800);
  assertEquals(state.groups.length, 1, 'one missing completion keeps related targets together');
  state = reconcileShipEffects(state, input, 2000);
  assertSame(expireShipEffects(state, 2000), state, 'deadline has not elapsed');
  assertEquals(expireShipEffects(state, 2100).groups, [], 'deadline settles even if the remaining target never mounted');
  assertEquals(reconcileShipEffects(createShipEffectPresentationState(), { ...input, batches: [] }, 0).groups, [], 'empty baseline');
  const missing = effectInput([effectBatch([resolved('destroy', ['unknown'])])]);
  assertEquals(reconcileShipEffects(reconcileShipEffects(createShipEffectPresentationState(), effectInput(), 0), missing, 100).groups,
    [], 'unreconstructable victims never create a wait');
});

Deno.test('grouping cannot pull EQU destruction ahead of an interleaved Cube copy of its victim', () => {
  const input = effectInput(); input.previous.my = input.previous.opponent;
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  const own = { ...resolved('destroy', ['other'], 'EQU'), targets: [{ playerId: 'p1', shipInstanceId: 'other' }] };
  input.batches = [effectBatch([own, resolved('copy'), resolved('destroy', ['victim'], 'EQU')])];
  state = reconcileShipEffects(state, input, 100);
  assertEquals(state.groups.map((group) => group.kind), ['destroy', 'copy', 'destroy'], 'do not merge across a shared-instance dependency');
  assertEquals(state.groups.map((group) => group.startedAt), [100, 100, null], 'copy precedes the later destruction');
});

Deno.test('whole retained stacks have no empty remainder and new same-bucket members cannot steal a pinned key', () => {
  const input = effectInput();
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  input.batches = [effectBatch([resolved('destroy', ['victim', 'other', 'safe'])])];
  state = reconcileShipEffects(state, input, 100);
  const project = (fleet: Parameters<typeof projectExactTargetFleetPresentation>[0]['fleet']) =>
    projectExactTargetFleetPresentation({ side: 'opponent', fleet, renderOrder: fleet.map((ship) => ship.renderKey),
      exactTargets: [], retainedTargets: state.groups[0].targets, targetStatesByStackKey: {}, previewShipDefIdByStackKey: {} });
  assertEquals(project(input.fleet.opponent).fleet.map((ship) => ship.count), [1, 1, 1], 'all affected members detach without an empty remainder');
  const old = makeSummary({ shipDefId: 'CUB', count: 1, memberInstanceIds: ['victim'] });
  const added = makeSummary({ shipDefId: 'CUB', count: 1, memberInstanceIds: ['new'] });
  input.previous.opponent = [old];
  state = reconcileShipEffects(reconcileShipEffects(createShipEffectPresentationState(), { ...input, batches: [] }, 0),
    { ...input, batches: [effectBatch([resolved()])] }, 100);
  const projection = project([added]);
  assertEquals(new Set(projection.fleet.map((ship) => ship.renderKey)).size, 2, 'render identities remain unique');
  assertEquals(projection.fleet.find((ship) => ship.memberInstanceIds.includes('victim'))?.renderKey, old.renderKey, 'victim keeps its original key');
  assertEquals(added.renderKey, old.renderKey, 'collision resolution never mutates the live summary');
});

Deno.test('retained stack members preserve appearance and position without destination or Void duplicates', () => {
  const before = makeSummary({ shipDefId: 'CUB', count: 3, memberInstanceIds: ['victim', 'other', 'safe'], currentCharges: 2 });
  const neighbour = makeSummary({ shipDefId: 'DEF', count: 1, memberInstanceIds: ['neighbour'] });
  const input = effectInput(); input.previous.opponent = [before, neighbour];
  let state = reconcileShipEffects(createShipEffectPresentationState(), input, 0);
  input.batches = [effectBatch([resolved('steal', ['victim', 'other'], 'DOM')])];
  state = reconcileShipEffects(state, input, 100);
  const targets = state.groups[0].targets;
  const project = (side: 'my' | 'opponent', fleet: FleetSummary[]) => projectExactTargetFleetPresentation({
    side, fleet, renderOrder: fleet.map((ship) => ship.renderKey), exactTargets: [], retainedTargets: targets,
    targetStatesByStackKey: {}, previewShipDefIdByStackKey: {} });
  const source = project('opponent', [before, neighbour]);
  assertEquals(source.fleet.find((ship) => ship.renderKey === before.renderKey)?.memberInstanceIds, ['safe'], 'unaffected remainder retains its real count');
  assertEquals(source.renderOrder, [before.renderKey, ...targets.map((target) => target.summary.renderKey), neighbour.renderKey], 'affected members stay at the previous stack position');
  assertEquals(targets.map((target) => target.summary.currentCharges), [2, 2], 'previous appearance is frozen');
  assertEquals(project('my', [before]).fleet[0].memberInstanceIds, ['safe'], 'destination excludes retained instances');
  assertEquals(filterFleetSummariesBySuppressedMemberIds([before], targets.map((target) => target.instanceId))[0].count, 1, 'Void filtering uses exact IDs');
  assertEquals(before.memberInstanceIds, ['victim', 'other', 'safe'], 'canonical/input summaries are untouched');
  state = settleShipEffect(state, state.groups[0].key, null, 2100);
  assertEquals(state.groups.length, 0, 'completion restores ordinary authoritative grouping');
});

Deno.test('presentation redaction withholds a wholly new current-turn stack', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'ANT',
    count: 1,
    memberInstanceIds: ['ant-new'],
  })];

  assertEquals(
    filterFleetSummariesBySuppressedMemberIds(liveFleet, ['ant-new']),
    [],
    'a wholly suppressed stack should not be presented'
  );
  assertEquals(
    liveFleet[0].memberInstanceIds,
    ['ant-new'],
    'presentation filtering must not mutate the live fleet used by activation lookup'
  );
});

Deno.test('presentation redaction subtracts only the new member from an aggregate stack', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'XEN',
    count: 4,
    memberInstanceIds: ['xen-1', 'xen-2', 'xen-3', 'xen-new'],
  })];
  const presentedFleet = filterFleetSummariesBySuppressedMemberIds(
    liveFleet,
    ['xen-new']
  );

  assertEquals(presentedFleet[0].count, 3, 'the presented stack count should exclude the new member');
  assertEquals(
    presentedFleet[0].memberInstanceIds,
    ['xen-1', 'xen-2', 'xen-3'],
    'only the suppressed authoritative member ID should be removed'
  );
  assertEquals(liveFleet[0].count, 4, 'the live count must remain available to runtime consumers');
});

Deno.test('latest charge graphics and semantic buckets pass through during redaction', () => {
  const chargedFleet = [
    makeSummary({
      shipDefId: 'CUB',
      stackKey: 'CUB__inst_cube-old',
      count: 1,
      memberInstanceIds: ['cube-old'],
      currentCharges: 1,
    }),
    makeSummary({
      shipDefId: 'ANT',
      count: 1,
      memberInstanceIds: ['ant-new'],
    }),
  ];
  const chargedPresented = filterFleetSummariesBySuppressedMemberIds(
    chargedFleet,
    ['ant-new']
  );

  assertSame(
    chargedPresented[0],
    chargedFleet[0],
    'an existing charged stack should retain the latest live summary object'
  );
  assertEquals(chargedPresented[0].currentCharges, 1, 'the latest charge count should pass through');

  const depletedFleet = [makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__charges_0',
    count: 1,
    memberInstanceIds: ['cube-old'],
    condition: 'charges_0',
    currentCharges: 0,
  })];
  const depletedPresented = filterFleetSummariesBySuppressedMemberIds(
    depletedFleet,
    ['ant-new']
  );

  assertSame(
    depletedPresented[0],
    depletedFleet[0],
    'a semantic charge-bucket transition should pass through immediately'
  );
});

Deno.test('existing removals pass through because the filter uses the latest fleet', () => {
  const latestFleet = [makeSummary({
    shipDefId: 'XEN',
    count: 1,
    memberInstanceIds: ['xen-survivor'],
  })];

  assertEquals(
    filterFleetSummariesBySuppressedMemberIds(latestFleet, ['ant-new']),
    latestFleet,
    'a removed existing member must not be restored by presentation filtering'
  );
});

Deno.test('inactive redaction publishes current state immediately', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'ANT',
    count: 2,
    memberInstanceIds: ['ant-new', 'ant-after-settle'],
  })];
  const presentedFleet = filterFleetSummariesBySuppressedMemberIds(liveFleet, []);

  assertSame(
    presentedFleet,
    liveFleet,
    'dice settlement, later Drawing changes, and hydration should use current state directly'
  );
});

Deno.test('unidentified summary members fail open', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'XEN',
    count: 2,
    memberInstanceIds: ['xen-known'],
  })];
  const presentedFleet = filterFleetSummariesBySuppressedMemberIds(
    liveFleet,
    ['missing-instance-id']
  );

  assertSame(presentedFleet[0], liveFleet[0], 'unmatched or unidentified members stay visible');
  assertEquals(presentedFleet[0].count, 2, 'unidentified members must not be guessed at');
});

Deno.test('fleet derivation suppresses only hidden current-turn local instances', () => {
  const suppressedIds = getCurrentTurnHiddenShipInstanceIds({
    ships: [
      { shipDefId: 'XEN', instanceId: 'xen-old', createdTurn: 2 },
      { shipDefId: 'ANT', instanceId: 'ant-new', createdTurn: 3 },
      { shipDefId: 'XEN', instanceId: 'sim-new', createdTurn: 3 },
      { shipDefId: 'XEN', createdTurn: 3 },
      { shipDefId: 'XEN', instanceId: 'xen-malformed-turn' },
    ],
    ownerPlayerId: 'local',
    turnNumber: 3,
    majorPhase: 'build',
    isInBattlePhase: false,
    materializedSimulacrumFleetInstanceIdsByPlayerId: {
      local: ['sim-new'],
    },
  });

  assertEquals(
    suppressedIds,
    ['ant-new'],
    'older, malformed, unidentified, and registered Simulacrum members must fail open'
  );
});

Deno.test('existing opponent and opponent-VOID visibility keeps Simulacrum materialisations visible', () => {
  const context = {
    ownerPlayerId: 'opponent',
    turnNumber: 3,
    majorPhase: 'build',
    isInBattlePhase: false,
    materializedSimulacrumFleetInstanceIdsByPlayerId: {
      opponent: ['opponent-sim', 'void-sim'],
    },
  };
  const opponentShips = [
    { shipDefId: 'XEN', instanceId: 'opponent-hidden', createdTurn: 3 },
    { shipDefId: 'XEN', instanceId: 'opponent-sim', createdTurn: 3 },
  ];
  const opponentVoidShips = [
    { shipDefId: 'XEN', instanceId: 'void-hidden', createdTurn: 3 },
    { shipDefId: 'XEN', instanceId: 'void-sim', createdTurn: 3 },
  ];

  assertEquals(
    opponentShips
      .filter((ship) => classifyShipVisibilityToViewer({ ...context, ship }))
      .map((ship) => ship.instanceId),
    ['opponent-sim'],
    'the existing opponent fleet visibility classification must be preserved'
  );
  assertEquals(
    opponentVoidShips
      .filter((ship) => classifyShipVisibilityToViewer({ ...context, ship }))
      .map((ship) => ship.instanceId),
    ['void-sim'],
    'the existing opponent VOID visibility classification must be preserved'
  );
});

Deno.test('BUG Drawing cue counts are unique per batch, player, and source instance', () => {
  const passOne = {
    key: 'ship-activation:3:build.drawing:drawing-prelude:local:pass:1',
    turnNumber: 3,
    phaseKey: 'build.drawing',
    sources: [
      { playerId: 'local', sourceInstanceId: 'bug-a' },
      { playerId: 'local', sourceInstanceId: 'bug-a' },
      { playerId: 'local', sourceInstanceId: 'xen-a' },
    ],
  };
  const counts = getDeferredBugDrawingSpendCountByInstanceId({
    activationCueBatches: [
      passOne,
      passOne,
      {
        key: 'ship-activation:3:build.drawing:drawing-prelude:local:pass:2',
        turnNumber: 3,
        phaseKey: 'build.drawing',
        sources: [{ playerId: 'local', sourceInstanceId: 'bug-a' }],
      },
      {
        key: 'wrong-player',
        turnNumber: 3,
        phaseKey: 'build.drawing',
        sources: [{ playerId: 'opponent', sourceInstanceId: 'bug-a' }],
      },
      {
        key: 'wrong-phase',
        turnNumber: 3,
        phaseKey: 'build.dice_roll',
        sources: [{ playerId: 'local', sourceInstanceId: 'bug-a' }],
      },
      {
        key: 'wrong-turn',
        turnNumber: 2,
        phaseKey: 'build.drawing',
        sources: [{ playerId: 'local', sourceInstanceId: 'bug-a' }],
      },
    ],
    localPlayerId: 'local',
    turnNumber: 3,
    ships: [
      { shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 2 },
      { shipDefId: 'XEN', instanceId: 'xen-a' },
    ],
  });

  assertEquals(
    counts,
    { 'bug-a': 2 },
    'separate Chronoswarm pass batches count separately while duplicate observations count once'
  );
});

Deno.test('active BUG presentation restores only its deferred source charges and caps at maximum', () => {
  const bugSummary = makeSummary({
    shipDefId: 'BUG',
    stackKey: 'BUG__inst_bug-a',
    renderKey: 'stable-bug-a',
    count: 1,
    memberInstanceIds: ['bug-a'],
    currentCharges: 3,
  });
  const ordinaryChargeSummary = makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__inst_cube-a',
    renderKey: 'stable-cube-a',
    count: 1,
    memberInstanceIds: ['cube-a'],
    currentCharges: 1,
  });
  const liveFleet = [bugSummary, ordinaryChargeSummary];
  const presentedFleet = projectDeferredBugChargePresentation({
    fleet: liveFleet,
    ships: [
      { shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 3 },
      { shipDefId: 'CUB', instanceId: 'cube-a', chargesCurrent: 1 },
    ],
    deferredSpendCountByInstanceId: {
      'bug-a': 2,
      'cube-a': 1,
    },
    bugMaxCharges: 4,
  });

  assertEquals(presentedFleet[0].currentCharges, 4, 'BUG display restoration is capped at four');
  assertEquals(presentedFleet[0].renderKey, 'stable-bug-a', 'active BUG render identity remains stable');
  assertSame(
    presentedFleet[1],
    ordinaryChargeSummary,
    'ordinary charge summaries remain live and unmodified'
  );
  assertEquals(bugSummary.currentCharges, 3, 'the authoritative/live BUG summary is not mutated');
});

Deno.test('single depleted BUG is temporarily presented as its charged source instance', () => {
  const liveSummary = makeSummary({
    shipDefId: 'BUG',
    stackKey: 'BUG__charges_0',
    renderKey: 'stable-depleted-bug',
    count: 1,
    memberInstanceIds: ['bug-a'],
    condition: 'charges_0',
    currentCharges: 0,
  });
  const presentedFleet = projectDeferredBugChargePresentation({
    fleet: [liveSummary],
    ships: [{ shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 0 }],
    deferredSpendCountByInstanceId: { 'bug-a': 1 },
    bugMaxCharges: 4,
  });

  assertEquals(
    presentedFleet,
    [{
      ...liveSummary,
      stackKey: 'BUG__inst_bug-a',
      memberInstanceIds: ['bug-a'],
      condition: undefined,
      currentCharges: 1,
    }],
    'the source keeps its pre-spend graphic without changing its stable render identity'
  );
  assertEquals(liveSummary.condition, 'charges_0', 'the live depleted condition remains authoritative');
});

Deno.test('deferred BUG sources split individually from a multi-member depleted stack', () => {
  const liveSummary = makeSummary({
    shipDefId: 'BUG',
    stackKey: 'BUG__charges_0',
    renderKey: 'live-depleted-stack',
    count: 3,
    memberInstanceIds: ['bug-old', 'bug-a', 'bug-b'],
    condition: 'charges_0',
    currentCharges: 0,
  });
  const presentedFleet = projectDeferredBugChargePresentation({
    fleet: [liveSummary],
    ships: [
      { shipDefId: 'BUG', instanceId: 'bug-old', chargesCurrent: 0 },
      { shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 0 },
      { shipDefId: 'BUG', instanceId: 'bug-b', chargesCurrent: 0 },
    ],
    deferredSpendCountByInstanceId: { 'bug-a': 1, 'bug-b': 2 },
    bugMaxCharges: 4,
  });

  assertEquals(
    presentedFleet,
    [
      {
        ...liveSummary,
        count: 1,
        memberInstanceIds: ['bug-old'],
      },
      {
        ...liveSummary,
        count: 1,
        stackKey: 'BUG__inst_bug-a',
        renderKey: 'presentation__BUG__inst_bug-a',
        memberInstanceIds: ['bug-a'],
        condition: undefined,
        currentCharges: 1,
      },
      {
        ...liveSummary,
        count: 1,
        stackKey: 'BUG__inst_bug-b',
        renderKey: 'presentation__BUG__inst_bug-b',
        memberInstanceIds: ['bug-b'],
        condition: undefined,
        currentCharges: 2,
      },
    ],
    'only deferred source instances leave the depleted aggregate'
  );
  assertEquals(
    liveSummary.memberInstanceIds,
    ['bug-old', 'bug-a', 'bug-b'],
    'the live aggregate membership remains unchanged for runtime and activation lookup'
  );
});

Deno.test('settled BUG presentation returns the live authoritative fleet unchanged', () => {
  const liveFleet = [makeSummary({
    shipDefId: 'BUG',
    stackKey: 'BUG__charges_0',
    count: 1,
    memberInstanceIds: ['bug-a'],
    condition: 'charges_0',
    currentCharges: 0,
  })];
  const presentedFleet = projectDeferredBugChargePresentation({
    fleet: liveFleet,
    ships: [{ shipDefId: 'BUG', instanceId: 'bug-a', chargesCurrent: 0 }],
    deferredSpendCountByInstanceId: {},
    bugMaxCharges: 4,
  });

  assertSame(presentedFleet, liveFleet, 'release removes the presentation override immediately');
});

Deno.test('registered Simulacrum presentation IDs require both registry membership and current turn', () => {
  const ships = [
    { shipDefId: 'XEN', instanceId: 'sim-current', createdTurn: 4 },
    { shipDefId: 'XEN', instanceId: 'sim-old', createdTurn: 3 },
    { shipDefId: 'XEN', instanceId: 'ordinary-current', createdTurn: 4 },
  ];
  const ids = getCurrentTurnRegisteredSimulacrumInstanceIds({
    ships,
    ownerPlayerId: 'local',
    turnNumber: 4,
    materializedSimulacrumFleetInstanceIdsByPlayerId: {
      local: ['sim-current', 'sim-old'],
    },
  });

  assertEquals(ids, ['sim-current'], 'createdTurn scopes registry entries but never identifies SSIM alone');
  assertEquals(ships.length, 3, 'authoritative/runtime ship inputs remain intact');
});

Deno.test('presentation animation counts delay SSIM additions and coalesce BUG-only splits', () => {
  const liveFleet = [
    makeSummary({
      shipDefId: 'BUG',
      stackKey: 'BUG__charges_0',
      renderKey: 'live-depleted-stack',
      count: 2,
      memberInstanceIds: ['bug-old', 'bug-a'],
      condition: 'charges_0',
      currentCharges: 0,
    }),
    makeSummary({
      shipDefId: 'XEN',
      renderKey: 'live-xen-stack',
      count: 2,
      memberInstanceIds: ['xen-old', 'sim-current'],
    }),
  ];
  const unsettledFleet = [
    makeSummary({
      shipDefId: 'BUG',
      stackKey: 'BUG__charges_0',
      renderKey: 'live-depleted-stack',
      count: 1,
      memberInstanceIds: ['bug-old'],
      condition: 'charges_0',
      currentCharges: 0,
    }),
    makeSummary({
      shipDefId: 'BUG',
      stackKey: 'BUG__inst_bug-a',
      renderKey: 'presentation__BUG__inst_bug-a',
      count: 1,
      memberInstanceIds: ['bug-a'],
      currentCharges: 1,
    }),
    makeSummary({
      shipDefId: 'XEN',
      renderKey: 'live-xen-stack',
      count: 1,
      memberInstanceIds: ['xen-old'],
    }),
  ];

  assertEquals(
    buildPresentationFleetCountsByLiveRenderKey({
      presentedFleet: unsettledFleet,
      liveFleet,
    }),
    {
      'live-depleted-stack': 2,
      'live-xen-stack': 1,
    },
    'BUG splits map to live identity while the unsettled SSIM member remains uncounted'
  );
  assertEquals(
    buildPresentationFleetCountsByLiveRenderKey({
      presentedFleet: liveFleet,
      liveFleet,
    }),
    {
      'live-depleted-stack': 2,
      'live-xen-stack': 2,
    },
    'settle exposes only the SSIM N-to-N+1 count change'
  );
});

Deno.test('local and opponent registered SSIM additions stay out of presentation counts until release', () => {
  const localShips = [
    { shipDefId: 'XEN', instanceId: 'local-sim', createdTurn: 5 },
  ];
  const opponentShips = [
    { shipDefId: 'XEN', instanceId: 'opponent-xen-old', createdTurn: 4 },
    { shipDefId: 'XEN', instanceId: 'opponent-sim', createdTurn: 5 },
  ];
  const registry = {
    local: ['local-sim'],
    opponent: ['opponent-sim'],
  };
  const localLiveFleet = [makeSummary({
    shipDefId: 'XEN',
    renderKey: 'local-xen',
    count: 1,
    memberInstanceIds: ['local-sim'],
  })];
  const opponentLiveFleet = [makeSummary({
    shipDefId: 'XEN',
    renderKey: 'opponent-xen',
    count: 2,
    memberInstanceIds: ['opponent-xen-old', 'opponent-sim'],
  })];
  const localPresentedFleet = filterFleetSummariesBySuppressedMemberIds(
    localLiveFleet,
    getCurrentTurnRegisteredSimulacrumInstanceIds({
      ships: localShips,
      ownerPlayerId: 'local',
      turnNumber: 5,
      materializedSimulacrumFleetInstanceIdsByPlayerId: registry,
    })
  );
  const opponentPresentedFleet = filterFleetSummariesBySuppressedMemberIds(
    opponentLiveFleet,
    getCurrentTurnRegisteredSimulacrumInstanceIds({
      ships: opponentShips,
      ownerPlayerId: 'opponent',
      turnNumber: 5,
      materializedSimulacrumFleetInstanceIdsByPlayerId: registry,
    })
  );

  assertEquals(localPresentedFleet, [], 'local SSIM 0-to-1 is withheld before release');
  assertEquals(opponentPresentedFleet[0].count, 1, 'opponent SSIM N-to-N+1 is withheld before release');
  assertEquals(
    buildPresentationFleetCountsByLiveRenderKey({
      presentedFleet: localPresentedFleet,
      liveFleet: localLiveFleet,
    }),
    {},
    'local entry count is not consumed early'
  );
  assertEquals(
    buildPresentationFleetCountsByLiveRenderKey({
      presentedFleet: opponentPresentedFleet,
      liveFleet: opponentLiveFleet,
    }),
    { 'opponent-xen': 1 },
    'opponent stack-add count is not consumed early'
  );
  assertEquals(localLiveFleet[0].count, 1, 'local runtime fleet remains authoritative and present');
  assertEquals(opponentLiveFleet[0].count, 2, 'opponent runtime fleet remains authoritative and present');
});

Deno.test('ordinary non-BUG charge presentation remains live across charge and bucket changes', () => {
  const charged = makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__inst_cube-a',
    count: 1,
    memberInstanceIds: ['cube-a'],
    currentCharges: 1,
  });
  const depleted = makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__charges_0',
    count: 1,
    memberInstanceIds: ['cube-a'],
    condition: 'charges_0',
    currentCharges: 0,
  });

  assertSame(
    projectDeferredBugChargePresentation({
      fleet: [charged],
      ships: [{ shipDefId: 'CUB', instanceId: 'cube-a', chargesCurrent: 1 }],
      deferredSpendCountByInstanceId: { 'cube-a': 1 },
      bugMaxCharges: 4,
    })[0],
    charged,
    'ordinary 2-to-1 charge display remains live'
  );
  assertSame(
    projectDeferredBugChargePresentation({
      fleet: [depleted],
      ships: [{ shipDefId: 'CUB', instanceId: 'cube-a', chargesCurrent: 0 }],
      deferredSpendCountByInstanceId: { 'cube-a': 1 },
      bugMaxCharges: 4,
    })[0],
    depleted,
    'ordinary 1-to-0 semantic bucket display remains live'
  );
});

Deno.test('exact target projection detaches one member and preserves current remainder interaction', () => {
  const def = makeSummary({
    shipDefId: 'DEF',
    count: 10,
    memberInstanceIds: Array.from({ length: 10 }, (_, index) => `def-${index + 1}`),
  });
  const projection = projectExactTargetFleetPresentation({
    side: 'opponent',
    fleet: [def],
    renderOrder: [def.renderKey],
    exactTargets: [{
      instanceId: 'def-1',
      side: 'opponent',
      selectedTone: 'red',
      previewShipDefId: 'GUA',
    }],
    targetStatesByStackKey: {
      DEF: {
        isTargetable: true,
        isHovered: true,
        isSelected: true,
        selectedTone: 'red',
      },
    },
    previewShipDefIdByStackKey: { DEF: 'GUA' },
  });

  assertEquals(
    projection.fleet.map((summary) => ({
      count: summary.count,
      stackKey: summary.stackKey,
      memberInstanceIds: summary.memberInstanceIds,
    })),
    [
      {
        count: 9,
        stackKey: 'DEF',
        memberInstanceIds: Array.from({ length: 9 }, (_, index) => `def-${index + 2}`),
      },
      {
        count: 1,
        stackKey: 'presentation__target__inst_def-1',
        memberInstanceIds: ['def-1'],
      },
    ],
    'the exact member should detach from the source stack'
  );
  assertEquals(
    projection.targetStatesByStackKey.DEF,
    { isTargetable: true, isHovered: true, isSelected: false },
    'the remainder should consume post-selection availability without inherited selection'
  );
  assertEquals(
    projection.targetStatesByStackKey['presentation__target__inst_def-1'],
    {
      isTargetable: false,
      isHovered: false,
      isSelected: true,
      selectedTone: 'red',
    },
    'the synthetic singleton should be selected and non-actionable'
  );
  assertEquals(
    projection.previewShipDefIdByStackKey,
    {
      DEF: 'GUA',
      'presentation__target__inst_def-1': 'GUA',
    },
    'current hover preview and exact selected preview should be retained independently'
  );
});

Deno.test('exact target projection clears stale remainder hover preview', () => {
  const def = makeSummary({
    shipDefId: 'DEF',
    count: 2,
    memberInstanceIds: ['def-1', 'def-2'],
  });
  const projection = projectExactTargetFleetPresentation({
    side: 'opponent',
    fleet: [def],
    renderOrder: [def.renderKey],
    exactTargets: [{ instanceId: 'def-1', side: 'opponent', selectedTone: 'red' }],
    targetStatesByStackKey: {
      DEF: {
        isTargetable: true,
        isHovered: false,
        isSelected: true,
        selectedTone: 'red',
      },
    },
    previewShipDefIdByStackKey: { DEF: 'GUA' },
  });

  assertEquals(
    projection.targetStatesByStackKey.DEF,
    { isTargetable: true, isHovered: false, isSelected: false },
    'the helper should not invent hover state'
  );
  assertEquals(
    projection.previewShipDefIdByStackKey.DEF,
    undefined,
    'a source preview without current hover should not remain on the remainder'
  );
});

Deno.test('multiple exact targets expand in place without contaminating base order', () => {
  const fig = makeSummary({ shipDefId: 'FIG', count: 1, memberInstanceIds: ['fig-1'] });
  const def = makeSummary({
    shipDefId: 'DEF',
    count: 4,
    memberInstanceIds: ['def-1', 'def-2', 'def-3', 'def-4'],
  });
  const car = makeSummary({ shipDefId: 'CAR', count: 1, memberInstanceIds: ['car-1'] });
  const baseOrder = [fig.renderKey, def.renderKey, car.renderKey];
  const projection = projectExactTargetFleetPresentation({
    side: 'opponent',
    fleet: [fig, def, car],
    renderOrder: baseOrder,
    exactTargets: [
      { instanceId: 'def-1', side: 'opponent', selectedTone: 'red' },
      { instanceId: 'def-2', side: 'opponent', selectedTone: 'purple' },
    ],
    targetStatesByStackKey: {
      DEF: { isTargetable: true, isHovered: false, isSelected: true },
    },
    previewShipDefIdByStackKey: {},
  });

  assertEquals(
    projection.fleet.map((summary) => summary.shipDefId),
    ['FIG', 'DEF', 'DEF', 'DEF', 'CAR'],
    'detached targets should remain adjacent to DEF before CAR'
  );
  assertEquals(
    projection.renderOrder,
    [
      fig.renderKey,
      def.renderKey,
      'presentation__target__render_def-1',
      'presentation__target__render_def-2',
      car.renderKey,
    ],
    'the projected order should expand only the source position'
  );
  assertEquals(baseOrder, [fig.renderKey, def.renderKey, car.renderKey], 'base order is untouched');
  assertEquals(
    projection.targetStatesByStackKey['presentation__target__inst_def-2']?.selectedTone,
    'purple',
    'exact targets may retain distinct existing tones'
  );
});

Deno.test('all exact members detach while preserving source order position', () => {
  const fig = makeSummary({ shipDefId: 'FIG', count: 1, memberInstanceIds: ['fig-1'] });
  const def = makeSummary({
    shipDefId: 'DEF',
    count: 2,
    memberInstanceIds: ['def-1', 'def-2'],
  });
  const car = makeSummary({ shipDefId: 'CAR', count: 1, memberInstanceIds: ['car-1'] });
  const projection = projectExactTargetFleetPresentation({
    side: 'opponent',
    fleet: [fig, def, car],
    renderOrder: [fig.renderKey, def.renderKey, car.renderKey],
    exactTargets: [
      { instanceId: 'def-1', side: 'opponent' },
      { instanceId: 'def-2', side: 'opponent' },
    ],
    targetStatesByStackKey: { DEF: { isTargetable: false, isHovered: false, isSelected: true } },
    previewShipDefIdByStackKey: {},
  });

  assertEquals(
    projection.fleet.map((summary) => summary.renderKey),
    [
      fig.renderKey,
      'presentation__target__render_def-1',
      'presentation__target__render_def-2',
      car.renderKey,
    ],
    'no zero-count remainder should be emitted'
  );
  assertEquals(
    projection.renderOrder,
    projection.fleet.map((summary) => summary.renderKey),
    'the singleton sequence should replace the source order slot'
  );
});

Deno.test('base singleton and empty exact input preserve existing identity and structure', () => {
  const singleton = makeSummary({
    shipDefId: 'DEF',
    count: 1,
    memberInstanceIds: ['def-1'],
  });
  const selectedState = {
    DEF: { isTargetable: false, isHovered: false, isSelected: true },
  };
  const singletonProjection = projectExactTargetFleetPresentation({
    side: 'opponent',
    fleet: [singleton],
    renderOrder: [singleton.renderKey],
    exactTargets: [{ instanceId: 'def-1', side: 'opponent' }],
    targetStatesByStackKey: selectedState,
    previewShipDefIdByStackKey: {},
  });
  const publicMarkerOnlyProjection = projectExactTargetFleetPresentation({
    side: 'opponent',
    fleet: [makeSummary({
      shipDefId: 'DEF',
      count: 3,
      memberInstanceIds: ['def-1', 'def-2', 'def-3'],
    })],
    renderOrder: ['render__DEF'],
    exactTargets: [],
    targetStatesByStackKey: selectedState,
    previewShipDefIdByStackKey: {},
  });

  assertSame(singletonProjection.fleet[0], singleton, 'base singleton should not be synthesized');
  assertEquals(singletonProjection.renderOrder, [singleton.renderKey], 'singleton order is unchanged');
  assertEquals(publicMarkerOnlyProjection.fleet[0].count, 3, 'stack marker alone cannot split');
  assertEquals(
    publicMarkerOnlyProjection.fleet[0].stackKey,
    'DEF',
    'public marker projection retains the real stack'
  );
});

Deno.test('detached singleton copies exact source presentation metadata', () => {
  const qua = makeSummary({
    shipDefId: 'QUA',
    stackKey: 'QUA__cap_5',
    count: 3,
    memberInstanceIds: ['qua-1', 'qua-2', 'qua-3'],
    caption: '5',
  });
  const charged = makeSummary({
    shipDefId: 'CUB',
    stackKey: 'CUB__charges_0',
    count: 2,
    memberInstanceIds: ['cub-1', 'cub-2'],
    condition: 'charges_0',
    currentCharges: 0,
  });
  const projection = projectExactTargetFleetPresentation({
    side: 'opponent',
    fleet: [qua, charged],
    renderOrder: [qua.renderKey, charged.renderKey],
    exactTargets: [
      { instanceId: 'qua-1', side: 'opponent' },
      { instanceId: 'cub-1', side: 'opponent' },
    ],
    targetStatesByStackKey: {},
    previewShipDefIdByStackKey: {},
  });
  const quaSingleton = projection.fleet.find((summary) =>
    summary.memberInstanceIds.includes('qua-1')
  )!;
  const chargedSingleton = projection.fleet.find((summary) =>
    summary.memberInstanceIds.includes('cub-1')
  )!;

  assertEquals(quaSingleton.caption, '5', 'configured QUA caption should be copied from its bucket');
  assertEquals(chargedSingleton.condition, 'charges_0', 'condition should be copied');
  assertEquals(chargedSingleton.currentCharges, 0, 'charge presentation should be copied');
});

Deno.test('removing exact targets derives recombination from the unchanged base fleet', () => {
  const def = makeSummary({
    shipDefId: 'DEF',
    count: 3,
    memberInstanceIds: ['def-1', 'def-2', 'def-3'],
  });
  const project = (instanceIds: string[]) => projectExactTargetFleetPresentation({
    side: 'opponent' as const,
    fleet: [def],
    renderOrder: [def.renderKey],
    exactTargets: instanceIds.map((instanceId) => ({
      instanceId,
      side: 'opponent' as const,
    })),
    targetStatesByStackKey: {},
    previewShipDefIdByStackKey: {},
  });

  assertEquals(project(['def-1', 'def-2']).fleet[0].count, 1, 'two targets leave one remainder');
  assertEquals(project(['def-1']).fleet[0].count, 2, 'undoing one recombines only that member');
  assertSame(project([]).fleet[0], def, 'clearing local IDs restores the original base summary');
});

Deno.test('persistent marker membership resolves projected exact members only', () => {
  const def = makeSummary({
    shipDefId: 'DEF',
    count: 4,
    memberInstanceIds: ['def-1', 'def-2', 'def-3', 'def-4'],
  });
  const projection = projectExactTargetFleetPresentation({
    side: 'opponent',
    fleet: [def],
    renderOrder: [def.renderKey],
    exactTargets: [
      { instanceId: 'def-1', side: 'opponent' },
      { instanceId: 'def-2', side: 'opponent' },
    ],
    targetStatesByStackKey: {
      DEF: { isTargetable: true, isHovered: false, isSelected: true },
    },
    previewShipDefIdByStackKey: {},
  });
  const markers = buildExactMembershipSelectedTargetStates({
    fleet: projection.fleet,
    toneByInstanceId: new Map([
      ['def-1', 'red' as const],
      ['def-2', 'red' as const],
    ]),
  });

  assertEquals(markers.DEF, undefined, 'remainder is not reselected');
  assertEquals(
    projection.targetStatesByStackKey.DEF,
    { isTargetable: true, isHovered: false, isSelected: false },
    'the active projection preserves an unselected targetable remainder'
  );
  assertEquals(
    markers['presentation__target__inst_def-1']?.isSelected,
    true,
    'marker follows def-1 membership to its singleton'
  );
  assertEquals(
    markers['presentation__target__inst_def-2']?.isSelected,
    true,
    'marker follows def-2 membership to its singleton'
  );
});

Deno.test('ordinary exact presentation reuses existing DOM and destroy aggregation', () => {
  const previews = { dom: 'DOM', gua: 'GUA' } as const;
  const purple = buildExactDestroyTargetPresentationEntries({
    selections: [{
      targetInstanceId: 'def-1',
      locatorKey: 'opponent::DEF',
      sourceInstanceId: 'dom',
    }],
    getPreviewShipDefIdForSource: (sourceId) => previews[sourceId as keyof typeof previews] ?? null,
  });
  const mixed = buildExactDestroyTargetPresentationEntries({
    selections: [
      { targetInstanceId: 'def-1', locatorKey: 'opponent::DEF', sourceInstanceId: 'dom' },
      { targetInstanceId: 'def-1', locatorKey: 'opponent::DEF', sourceInstanceId: 'gua' },
    ],
    getPreviewShipDefIdForSource: (sourceId) => previews[sourceId as keyof typeof previews] ?? null,
  });

  assertEquals(purple, [{
    instanceId: 'def-1',
    side: 'opponent',
    selectedTone: 'purple',
    previewShipDefId: 'DOM',
  }], 'DOM-only allocation remains purple with its preview');
  assertEquals(mixed[0].selectedTone, 'red', 'mixed sources retain existing red aggregation');
  assertEquals(mixed[0].previewShipDefId, undefined, 'ambiguous source preview remains omitted');
});

Deno.test('Ancient structural entries accept only local draft and frozen-cast shapes', () => {
  const entries = buildLocalAncientExactTargetPresentationEntries({
    blackHoleSelectedTargetInstanceIds: ['black-hole-in-progress'],
    localPresentationCasts: [
      { solarPowerId: 'SBLA', targetInstanceIds: ['black-hole-draft'] },
      {
        solarPowerId: 'SSIM',
        targetInstanceId: 'simulacrum-draft',
      },
    ],
  });

  assertEquals(
    entries.map((entry) => entry.instanceId).sort(),
    ['black-hole-draft', 'black-hole-in-progress', 'simulacrum-draft'],
    'local current and snapshot-compatible cast targets become structural inputs'
  );
  assertEquals(
    entries.find((entry) => entry.instanceId === 'black-hole-in-progress'),
    {
      instanceId: 'black-hole-in-progress',
      side: 'opponent',
      selectedTone: 'red',
      previewShipDefId: 'SBLA',
    },
    'in-progress Black Hole keeps its active selector presentation'
  );
  assertEquals(
    buildLocalAncientExactTargetPresentationEntries({
      blackHoleSelectedTargetInstanceIds: [],
      localPresentationCasts: [],
    }),
    [],
    'public ledger markers have no input seam into structural derivation'
  );
});
