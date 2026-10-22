declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import type {
  ResolvedHealthIdentity, ResolvedHealthPresentation, ResolvedHealthSide,
} from '../../client/gameSession/types';
import { buildSettledHealthPresentation, captureResolvedHealthSnapshot } from '../../client/gameSession/resolvedHealth';
import {
  HEALTH_BAR_SCALE_CONFIG, calculateHealthBarLegend, mapHealthBarValue,
  prepareHealthBarScale, retainPreparedHealthBarScale,
  type HealthBarOrientation, type PreparedHealthBarScale,
} from '../healthBars/healthBarScale';

function assert(value: unknown, message = 'assertion failed'): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
function near(actual: number | null, expected: number, tolerance = 1e-12): void {
  assert(actual !== null && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const identity: ResolvedHealthIdentity = {
  gameId: 'game', viewerId: 'p1', viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
};
const context = { identity, continuityKey: 'game/viewer/recovery-0' };

function side(playerId: string, start = 25, damage = 0, healing = 0, cap = 35): ResolvedHealthSide {
  const damageStageHealth = start - damage;
  const finalHealth = Math.min(damageStageHealth + healing, cap);
  return { playerId, startHealth: start, damageTaken: damage, grossHealingReceived: healing,
    damageStageHealth, finalHealth, actualNetDelta: finalHealth - start, maxHealth: cap };
}
function live(left = side('p1'), right = side('p2'), turn = 4, terminal = false): ResolvedHealthPresentation {
  return { mode: 'live', snapshot: {
    identity, continuityKey: context.continuityKey, presentationKey: `game::health::${turn}`,
    resolvedTurnNumber: turn, source: 'poll', eligibility: 'live', left, right,
    outcome: { isTerminal: terminal, winnerPlayerId: null, resultReason: terminal ? 'mutual_destruction' : null },
  } };
}
function settled(health = 25, cap: number | null = null, rightHealth = 25, rightCap: number | null = null): ResolvedHealthPresentation {
  return { mode: 'settled', identity, left: { playerId: 'p1', health, maxHealth: cap },
    right: { playerId: 'p2', health: rightHealth, maxHealth: rightCap },
    outcome: { isTerminal: false, winnerPlayerId: null, resultReason: null } };
}
function prepare(presentation = live(), orientation: HealthBarOrientation = 'desktop', minimumPositiveFraction?: number): Readonly<PreparedHealthBarScale> {
  const scale = prepareHealthBarScale(presentation, context, { orientation, minimumPositiveFraction });
  assert(scale, 'expected a prepared scale');
  return scale;
}

Deno.test('health scale: default domain has exact zero and endpoints with no negative zero', () => {
  const scale = prepare();
  equal([scale.domainMin, scale.domainMax, scale.zeroPosition, scale.positiveFraction, scale.negativeCompression],
    [0, 35, 0, 1, false]);
  equal([mapHealthBarValue(scale, 0), mapHealthBarValue(scale, 35)], [0, 1]);
  assert(!Object.is(scale.domainMin, -0) && !Object.is(scale.zeroPosition, -0));
  near(mapHealthBarValue(scale, 17.5), 0.5);
});

for (const orientation of ['desktop', 'mobile'] as const) {
  for (const mode of ['live', 'settled'] as const) {
    Deno.test(`health scale: ${orientation} ${mode} rounds either player's negative bounds outward`, () => {
      for (const [minimum, expectedMin] of [
        [0, 0], [-0, 0], [-1, -5], [-2, -5], [-5, -5], [-6, -10], [-7, -10], [-11, -15],
        [-Number.MIN_VALUE, -5],
      ]) {
        const presentations = mode === 'live'
          ? [live(side('p1', minimum)), live(side('p1'), side('p2', minimum))]
          : [settled(minimum), settled(25, null, minimum)];
        for (const presentation of presentations) {
          const scale = prepare(presentation, orientation);
          equal([scale.domainMin, scale.domainMax], [expectedMin, 35]);
          assert(!Object.is(scale.domainMin, -0));
          equal(mapHealthBarValue(scale, scale.domainMin), 0);
          near(mapHealthBarValue(scale, minimum), (minimum - expectedMin) / (35 - expectedMin));
        }
      }
    });

    Deno.test(`health scale: ${orientation} ${mode} rounds health- and cap-driven positive bounds outward`, () => {
      for (const [maximum, expectedMax] of [[25, 35], [35, 35], [36, 40], [43, 45], [45, 45]]) {
        const presentations = mode === 'live'
          ? [live(side('p1', maximum)), live(side('p1'), side('p2', maximum)),
            live(side('p1', 25, 0, 0, maximum)), live(side('p1'), side('p2', 25, 0, 0, maximum))]
          : [settled(maximum, 35), settled(25, 35, maximum),
            settled(25, maximum), settled(25, null, 25, maximum)];
        for (const presentation of presentations) {
          const scale = prepare(presentation, orientation);
          equal([scale.domainMin, scale.domainMax], [0, expectedMax]);
          near(mapHealthBarValue(scale, maximum), maximum / expectedMax);
          equal(mapHealthBarValue(scale, expectedMax), 1);
          const source = presentation.mode === 'live' ? presentation.snapshot : presentation;
          equal([scale.leftCap.value, scale.rightCap.value], [source.left.maxHealth, source.right.maxHealth]);
          for (const cap of [scale.leftCap, scale.rightCap]) {
            if (cap.value !== null) near(cap.position, cap.value / expectedMax);
          }
        }
      }
    });

    Deno.test(`health scale: ${orientation} ${mode} rounded legend labels share exact value mappings`, () => {
      for (const minimum of [-2, -7, -11, -300]) {
        const presentation = mode === 'live'
          ? live(side('p1', minimum), side('p2', 25, 0, 0, 43))
          : settled(minimum, null, 25, 43);
        const scale = prepare(presentation, orientation);
        const before = JSON.stringify(scale);
        for (const axisLength of [0, 120, 400, 1600]) {
          for (const minimumLabelSpacing of [undefined, 10, 80]) {
            const labels = calculateHealthBarLegend(scale, { axisLength, minimumLabelSpacing });
            assert(labels.some((label) => label.value === 0));
            assert(labels.some((label) => label.value === 45));
            if (axisLength === 1600) assert(labels.some((label) => label.value === scale.domainMin));
            for (const label of labels) {
              assert(label.value % 5 === 0 && Number(label.label) % 5 === 0);
              equal(label.position, mapHealthBarValue(scale, label.value));
            }
          }
        }
        equal(JSON.stringify(scale), before);
      }
    });
  }

  Deno.test(`health scale: ${orientation} preserves exact health, contribution endpoints and cap 43`, () => {
    const presentation = live(side('p1', 43, 50, 8, 43));
    const before = JSON.stringify(presentation);
    const scale = prepare(presentation, orientation);
    equal([scale.domainMin, scale.domainMax, scale.leftCap.value], [-10, 45, 43]);
    near(scale.leftCap.position, 53 / 55);
    for (const value of [43, -7, 1]) near(mapHealthBarValue(scale, value), (value + 10) / 55);
    equal(JSON.stringify(presentation), before);
    assert(retainPreparedHealthBarScale(scale, context) === scale);
  });
}

Deno.test('health scale: unequal increased caps and non-tick caps have separate exact positions', () => {
  const scale = prepare(live(side('p1', 25, 0, 0, 43), side('p2', 25, 0, 0, 70)));
  equal([scale.domainMax, scale.leftCap.value, scale.rightCap.value], [70, 43, 70]);
  near(scale.leftCap.position, 43 / 70);
  equal(scale.rightCap.position, 1);
  const labels = calculateHealthBarLegend(scale, { axisLength: 500 });
  assert(!labels.some((label) => label.value === 43));
  equal(scale.leftCap.position, mapHealthBarValue(scale, 43));
});

Deno.test('health scale: positive starting health above the current cap remains represented', () => {
  const scale = prepare(live(side('p1', 80, 60, 0, 35)));
  equal([scale.domainMin, scale.domainMax, scale.leftCap.value], [0, 80, 35]);
  equal(mapHealthBarValue(scale, 80), 1);
  near(scale.leftCap.position, 35 / 80);
});

Deno.test('health scale: positive settled final health can expand beyond available caps', () => {
  const scale = prepare(settled(90, 35, 25, 50));
  equal([scale.domainMin, scale.domainMax], [0, 90]);
  near(scale.rightCap.position, 50 / 90);
});

for (const [name, start, damage, healing, expectedMin] of [
  ['already full overheal', 35, 0, 1000, 0],
  ['extreme damage plus unused healing', 35, 200, 299, -165],
  ['negative damage stage then positive recovery', 25, 85, 83, -60],
  ['negative final', 12, 30, 5, -20],
  ['negative starting health', -25, 0, 40, -25],
] as const) {
  Deno.test(`health scale: ${name}`, () => {
    const scale = prepare(live(side('p1', start, damage, healing)));
    equal([scale.domainMin, scale.domainMax], [expectedMin, 35]);
    for (const value of [start, start - damage, Math.min(start - damage + healing, 35)]) {
      const position = mapHealthBarValue(scale, value);
      assert(position !== null && position >= 0 && position <= 1);
    }
  });
}

Deno.test('health scale: both players determine one shared negative range', () => {
  const scale = prepare(live(side('p1', 25, 85, 83), side('p2', 30, 330, 320)));
  equal([scale.domainMin, scale.domainMax], [-300, 35]);
  equal(scale.negativeCompression, true);
  near(scale.positiveFraction, 0.35);
  near(scale.zeroPosition, 0.65);
  near(mapHealthBarValue(scale, -150), 0.325);
});

Deno.test('health scale: -60 to 35 remains linear with equal units above and below zero', () => {
  const scale = prepare(live(side('p1', 25, 85, 83)));
  equal(scale.negativeCompression, false);
  near(scale.positiveFraction, 35 / 95);
  near(scale.zeroPosition, 60 / 95);
  near(mapHealthBarValue(scale, 10)! - mapHealthBarValue(scale, 0)!, 10 / 95);
  near(mapHealthBarValue(scale, 0)! - mapHealthBarValue(scale, -10)!, 10 / 95);
});

Deno.test('health scale: compression uses rounded bounds and mapping stays continuous around zero', () => {
  for (const orientation of ['desktop', 'mobile'] as const) {
    const linear = prepare(settled(-64), orientation);
    const compressed = prepare(settled(-66), orientation);
    equal([linear.domainMin, linear.negativeCompression], [-65, false]);
    near(linear.positiveFraction, 35 / 100);
    equal([compressed.domainMin, compressed.negativeCompression], [-70, true]);
    near(compressed.positiveFraction, 0.35);

    const below = prepare(settled(-35 + 1e-7), orientation, 0.5);
    const at = prepare(settled(-35), orientation, 0.5);
    const above = prepare(settled(-35 - 1e-7), orientation, 0.5);
    equal([below.domainMin, at.domainMin, above.domainMin], [-35, -35, -40]);
    equal([below.negativeCompression, at.negativeCompression, above.negativeCompression], [false, false, true]);
    near(at.positiveFraction, 0.5);
    near(below.zeroPosition, above.zeroPosition);
    for (const scale of [linear, compressed, below, at, above]) {
      near(mapHealthBarValue(scale, -1e-8), scale.zeroPosition, 1e-8);
      near(mapHealthBarValue(scale, 1e-8), scale.zeroPosition, 1e-8);
      equal(mapHealthBarValue(scale, 0), scale.zeroPosition);
    }
  }
});

Deno.test('health scale: independent orientation settings default to equivalent normalized geometry', () => {
  const presentation = live(side('p1', 25, 325, 310));
  const desktop = prepare(presentation, 'desktop');
  const mobile = prepare(presentation, 'mobile');
  equal(HEALTH_BAR_SCALE_CONFIG.desktop.minimumPositiveFraction, 0.35);
  equal(HEALTH_BAR_SCALE_CONFIG.mobile.minimumPositiveFraction, 0.35);
  for (const value of [-300, -150, -60, 0, 10, 35]) {
    equal(mapHealthBarValue(desktop, value), mapHealthBarValue(mobile, value));
  }
  const adjusted = prepare(presentation, 'mobile', 0.5);
  near(adjusted.zeroPosition, 0.5);
  near(desktop.zeroPosition, 0.65);
});

Deno.test('health scale: mapping is monotonic, finite and shared at both player caps', () => {
  for (const minimum of [0, -60, -300, -1e12, -Number.MAX_VALUE]) {
    const scale = prepare(settled(minimum, 43, 25, 70));
    const values = [minimum, minimum * 0.75, minimum * 0.5, minimum * 0.25, 0, 10, 35, 43, 70];
    let previous = -1;
    for (const value of values) {
      const position = mapHealthBarValue(scale, value);
      assert(position !== null && Number.isFinite(position) && position >= previous && position <= 1);
      previous = position;
    }
    equal(mapHealthBarValue(scale, minimum), 0);
    equal(mapHealthBarValue(scale, 70), 1);
    equal(mapHealthBarValue(scale, 43), scale.leftCap.position);
    equal(mapHealthBarValue(scale, 70), scale.rightCap.position);
  }
});

Deno.test('health scale: finite endpoints whose sum overflows still have correct geometry', () => {
  const scale = prepare(settled(-Number.MAX_VALUE, null, Number.MAX_VALUE));
  equal(scale.negativeCompression, false);
  near(scale.zeroPosition, 0.5);
  near(mapHealthBarValue(scale, Number.MAX_VALUE / 2), 0.75);
  near(mapHealthBarValue(scale, -Number.MAX_VALUE / 2), 0.25);
});

Deno.test('health scale: very small negative values remain exact within the rounded negative range', () => {
  const scale = prepare(settled(-1e-14));
  equal(scale.domainMin, -5);
  near(scale.zeroPosition, 5 / 40);
  near(mapHealthBarValue(scale, -1e-14), (5 - 1e-14) / 40);
  near(mapHealthBarValue(scale, -5e-15), (5 - 5e-15) / 40);
});

Deno.test('health scale: mapping rejects invalid or out-of-domain values without clipping', () => {
  const scale = prepare(settled(-60));
  for (const value of [NaN, Infinity, -Infinity, -61, 36]) equal(mapHealthBarValue(scale, value), null);
});

Deno.test('health scale: malformed numerical inputs and settings do not produce a prepared scale', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    equal(prepareHealthBarScale(settled(value), context, { orientation: 'desktop' }), null);
    equal(prepareHealthBarScale(settled(20, value), context, { orientation: 'desktop' }), null);
    equal(prepareHealthBarScale(live({ ...side('p1'), grossHealingReceived: value }), context, { orientation: 'desktop' }), null);
    equal(prepareHealthBarScale(live({ ...side('p1'), startHealth: value }), context, { orientation: 'desktop' }), null);
  }
  for (const cap of [0, -1]) equal(prepareHealthBarScale(settled(20, cap), context, { orientation: 'desktop' }), null);
  for (const fraction of [0, -0.5, 1, 2, NaN, Infinity]) {
    equal(prepareHealthBarScale(live(), context, { orientation: 'desktop', minimumPositiveFraction: fraction }), null);
  }
});

Deno.test('health scale: label thinning and orientation spacing do not change geometry', () => {
  const scale = prepare(live(side('p1', 25, 325, 310)));
  const before = JSON.stringify(scale);
  const dense = calculateHealthBarLegend(scale, { axisLength: 600, minimumLabelSpacing: 10 });
  const sparse = calculateHealthBarLegend(scale, { axisLength: 600, minimumLabelSpacing: 80 });
  const desktop = calculateHealthBarLegend(scale, { axisLength: 600 });
  const mobile = calculateHealthBarLegend(scale, { axisLength: 600, orientation: 'mobile' });
  assert(dense.length > sparse.length && desktop.length > mobile.length);
  equal(JSON.stringify(scale), before);
  for (const labels of [dense, sparse, desktop, mobile]) {
    for (const label of labels) equal(label.position, mapHealthBarValue(scale, label.value));
    assert(labels.some((label) => label.value === 0));
    assert(labels.some((label) => label.value === 35));
    assert(labels.some((label) => label.value === -300));
  }
});

Deno.test('health scale: ordinary labels use readable dynamic intervals', () => {
  equal(calculateHealthBarLegend(prepare(), { axisLength: 400 }).map((label) => label.value), [0, 5, 10, 15, 20, 25, 30, 35]);
  equal(calculateHealthBarLegend(prepare(), { axisLength: 120 }).map((label) => label.value), [0, 10, 20, 35]);
  const large = calculateHealthBarLegend(prepare(settled(-1000, 1000)), { axisLength: 400 });
  assert(large.some((label) => label.value === 200));
});

Deno.test('health scale: mobile default labels stay unchanged on normal and wider axes', () => {
  const scale = prepare(live(), 'mobile');
  for (const axisLength of [196, 256, 400, 1600]) {
    equal(calculateHealthBarLegend(scale, { axisLength }).map((label) => label.value),
      [0, 5, 10, 15, 20, 25, 30, 35]);
  }
  equal(calculateHealthBarLegend(scale, { axisLength: 120 }).map((label) => label.value), [0, 10, 20, 30, 35]);
  equal(calculateHealthBarLegend(prepare(settled(25, 100), 'mobile'), { axisLength: 256 })
    .map((label) => label.value), [0, 20, 40, 60, 80, 100]);
});

Deno.test('health scale: mobile retains useful negative context across ranges and widths', () => {
  for (const minimum of [-Number.MIN_VALUE, -2, -5, -7, -11, -60, -300, -1000, -Number.MAX_VALUE]) {
    const scale = prepare(settled(minimum), 'mobile');
    const before = JSON.stringify(scale);
    for (const axisLength of [0, 1, -10, NaN, Infinity, Number.MIN_VALUE, 120, 256, 1600, Number.MAX_VALUE]) {
      for (const minimumLabelSpacing of [undefined, 0, -1, NaN, Infinity, Number.MIN_VALUE, 10, 80]) {
        const labels = calculateHealthBarLegend(scale, { axisLength, minimumLabelSpacing });
        assert(labels.length >= 3 && labels.length <= 9);
        for (const value of [0, 35]) assert(labels.some((label) => label.value === value));
        assert(labels.some((label) => label.value < 0));
        if (scale.domainMin === -5) assert(labels.some((label) => label.value === -5));
        equal(new Set(labels.map((label) => label.value)).size, labels.length);
        for (const label of labels) {
          // Extreme finite bounds retain their existing floating-point representation.
          if (Number.isSafeInteger(label.value)) assert(label.value % 5 === 0);
          assert(Number.isFinite(label.value) && Number.isFinite(label.position));
          equal(label.position, mapHealthBarValue(scale, label.value));
        }
      }
    }
    equal(JSON.stringify(scale), before);
    equal(calculateHealthBarLegend(scale, { axisLength: 0 }).map((label) => label.value).sort((a, b) => a - b),
      [scale.domainMin, 0, 35]);
  }
});

Deno.test('health scale: mobile uses nine balanced labels with consistent negative increments', () => {
  const scale = prepare(settled(-40), 'mobile');
  for (const axisLength of [256, 1600]) {
    equal(calculateHealthBarLegend(scale, { axisLength }).map((label) => label.value),
      [-40, -30, -20, -10, 0, 10, 20, 30, 35]);
  }
  const shallow = calculateHealthBarLegend(prepare(settled(-2), 'mobile'), { axisLength: 256 });
  equal(shallow.map((label) => label.value), [-5, 0, 5, 10, 15, 20, 25, 30, 35]);
  for (const minimum of [-40, -45, -60]) {
    const negatives = calculateHealthBarLegend(prepare(settled(minimum), 'mobile'), { axisLength: 256 })
      .filter((label) => label.value < 0).map((label) => label.value);
    assert(negatives.includes(-10) && !negatives.includes(-5));
    assert(negatives.every((value) => value % 10 === 0));
    for (let index = 1; index < negatives.length; index += 1) equal(negatives[index] - negatives[index - 1], 10);
  }
  const narrow = calculateHealthBarLegend(scale, { axisLength: 120 });
  assert(narrow.length < 9 && narrow.some((label) => label.value < 0));
});

Deno.test('health scale: mobile optional ticks retain negative context and respect mapped spacing', () => {
  const scale = prepare(settled(-300), 'mobile');
  const labels = calculateHealthBarLegend(scale, { axisLength: 256 });
  assert(labels.some((label) => label.value === -300));
  assert(labels.some((label) => label.value < -5 && label.value > -300));
  for (const label of labels.filter((label) => label.value !== 35)) {
    for (const other of labels.filter((other) => other !== label && other.value !== 35)) {
      assert(Math.abs(label.position - other.position) * 256 >= 24);
    }
  }
});

Deno.test('health scale: mobile budget includes expanded endpoints and applies with orientation overrides', () => {
  for (const presentation of [settled(25, 1000), settled(-1000, 1000), settled(-300, 43)]) {
    const scale = prepare(presentation);
    const before = JSON.stringify(scale);
    for (const axisLength of [120, 256, 1600, Number.MAX_VALUE]) {
      for (const minimumLabelSpacing of [undefined, Number.MIN_VALUE, 10, 80]) {
        const labels = calculateHealthBarLegend(scale, { orientation: 'mobile', axisLength, minimumLabelSpacing });
        assert(labels.length <= 9);
        for (const value of [0, scale.domainMax]) assert(labels.some((label) => label.value === value));
        if (scale.domainMin < 0) assert(labels.some((label) => label.value < 0));
        for (const label of labels) {
          assert(label.value % 5 === 0);
          equal(label.position, mapHealthBarValue(scale, label.value));
        }
      }
    }
    equal(JSON.stringify(scale), before);
  }
  const desktop = calculateHealthBarLegend(prepare(settled(-300)), { axisLength: 1600 });
  assert(desktop.length > 9);
});

for (const axisLength of [0, 1, -10, NaN, Infinity, Number.MIN_VALUE]) {
  Deno.test(`health scale: mandatory labels survive degenerate axis ${String(axisLength)}`, () => {
    const scale = prepare(settled(-300));
    const labels = calculateHealthBarLegend(scale, { axisLength });
    equal(labels.map((label) => label.value), [0, 35]);
    equal(labels.map((label) => label.position), [scale.zeroPosition, 1]);
  });
}

Deno.test('health scale: optional labels respect mapped spacing and negative context has priority', () => {
  const scale = prepare(settled(-63));
  const labels = calculateHealthBarLegend(scale, { axisLength: 350, minimumLabelSpacing: 24 });
  equal(labels[0].value, -65);
  for (let index = 1; index < labels.length; index += 1) {
    assert((labels[index].position - labels[index - 1].position) * 350 >= 24);
  }
});

Deno.test('health scale: extreme ranges and axis sizes have bounded, valid and unique labels', () => {
  for (const presentation of [settled(-Number.MAX_VALUE, Number.MAX_VALUE), settled(-300), settled(-Number.MIN_VALUE)]) {
    const scale = prepare(presentation);
    for (const axisLength of [0, 100, 1e308, Number.MAX_VALUE]) {
      for (const minimumLabelSpacing of [0, -1, NaN, Infinity, Number.MIN_VALUE, 24]) {
        const labels = calculateHealthBarLegend(scale, { axisLength, minimumLabelSpacing });
        assert(labels.length >= 2 && labels.length <= 259);
        equal(new Set(labels.map((label) => label.value)).size, labels.length);
        for (const label of labels) {
          assert(Number.isFinite(label.value) && Number.isFinite(label.position));
          assert(label.position >= 0 && label.position <= 1);
          assert(!Object.is(label.value, -0) && label.label !== '-0');
          equal(label.position, mapHealthBarValue(scale, label.value));
        }
      }
    }
  }
});

Deno.test('health scale: prepared scalar data and cap metadata are detached and immutable', () => {
  const presentation = settled(20, 43, 30, 70);
  const scale = prepare(presentation);
  assert([scale, scale.identity, scale.leftCap, scale.rightCap].every(Object.isFrozen));
  const labels = calculateHealthBarLegend(scale, { axisLength: 300 });
  assert(Object.isFrozen(labels) && labels.every(Object.isFrozen));
  assert(presentation.mode === 'settled');
  Object.assign(presentation.left, { maxHealth: 999, health: -999 });
  equal([scale.domainMin, scale.domainMax, scale.leftCap.value], [0, 70, 43]);
});

Deno.test('health scale: retain expanded geometry through release/build and explicitly contract next resolution', () => {
  const expanded = prepare(live(side('p1', 25, 325, 310)));
  for (const phase of ['damage', 'clearance', 'healing', 'surplus', 'settling', 'build', 'selection']) {
    assert(retainPreparedHealthBarScale(expanded, context) === expanded, phase);
  }
  // A subsequent settled DTO is not a reason to call preparation or contract.
  const current = settled(35, 35);
  assert(current.mode === 'settled');
  assert(retainPreparedHealthBarScale(expanded, { ...context, identity: current.identity }) === expanded);
  const next = prepare(live(side('p1'), side('p2'), 5));
  equal([next.domainMin, next.domainMax, next.resolvedTurnNumber], [0, 35, 5]);
  equal([expanded.domainMin, expanded.resolvedTurnNumber], [-300, 4]);
});

Deno.test('health scale: game/viewer/order/session/recovery changes invalidate retained geometry', () => {
  const scale = prepare();
  for (const changed of [
    { ...context, continuityKey: 'game/viewer/recovery-1' },
    { ...context, identity: { ...identity, gameId: 'other' } },
    { ...context, identity: { ...identity, viewerId: 'spectator' } },
    { ...context, identity: { ...identity, viewerRole: 'spectator' as const } },
    { ...context, identity: { ...identity, leftPlayerId: 'p2', rightPlayerId: 'p1' } },
  ]) equal(retainPreparedHealthBarScale(scale, changed), null);
  equal(retainPreparedHealthBarScale(scale, null), null);
  equal(retainPreparedHealthBarScale(null, context), null);
  equal(prepareHealthBarScale(live(), { ...context, continuityKey: 'new' }, { orientation: 'desktop' }), null);
  equal(prepareHealthBarScale(live(), { ...context, identity: { ...identity, gameId: 'other' } }, { orientation: 'desktop' }), null);
});

Deno.test('health scale: settled recovery uses current health and preserves unknown caps without contributions', () => {
  const recoveryContext = { ...context, continuityKey: 'recovery-1' };
  const scale = prepareHealthBarScale(settled(-13, null, 45, 50), recoveryContext, { orientation: 'mobile' });
  assert(scale);
  equal([scale.domainMin, scale.domainMax, scale.sourceMode, scale.presentationKey, scale.resolvedTurnNumber],
    [-15, 50, 'settled', null, null]);
  equal(scale.leftCap, { playerId: 'p1', value: null, position: null });
  equal(scale.rightCap, { playerId: 'p2', value: 50, position: 1 });
  const unknown = prepare(settled());
  equal([unknown.domainMax, unknown.leftCap.value, unknown.rightCap.value], [35, null, null]);
});

Deno.test('health scale: terminal results retain their complete final-health domain', () => {
  const scale = prepare(live(side('p1', 12, 30, 5), side('p2', 10, 40, 0), 4, true));
  equal([scale.domainMin, scale.domainMax, scale.isTerminal], [-30, 35, true]);
  assert(mapHealthBarValue(scale, -13) !== null && mapHealthBarValue(scale, -30) !== null);
  assert(retainPreparedHealthBarScale(scale, context) === scale);
});

Deno.test('health scale: accepts production 20B.1 live and settled preparation outputs', () => {
  const state = {
    gameId: 'game', turnNumber: 4, phaseKey: 'battle.end_of_turn_resolution', status: 'active',
    players: [{ id: 'p1', role: 'player', health: 23, maxHealth: 35 },
      { id: 'p2', role: 'player', health: 28, maxHealth: 43 }],
    gameData: { lastTurnDamageByPlayerId: { p1: 85, p2: 2 }, lastTurnHealByPlayerId: { p1: 83, p2: 0 },
      lastTurnNetByPlayerId: { p1: -2, p2: -2 }, turnData: { phaseHold: { holdReason: 'end_of_turn_health' } } },
  };
  const snapshot = captureResolvedHealthSnapshot({ state, ...context, resolvedTurnNumber: 4, source: 'poll' });
  assert(snapshot);
  const scale = prepare({ mode: 'live', snapshot });
  equal([scale.domainMin, scale.domainMax], [-60, 45]);
  const current = buildSettledHealthPresentation(state, identity);
  assert(current);
  equal([prepare(current).domainMin, prepare(current).domainMax], [0, 45]);
});
