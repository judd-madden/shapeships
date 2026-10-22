import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HEALTH_BAR_EXAMPLES } from '../../../components/dev/healthBarExampleFixtures';
import { HealthBarPair } from '../healthBars/HealthBar';
import { calculateHealthBarGeometry, healthBarValuePosition } from '../healthBars/healthBarPresentation';
import { calculateHealthBarLegend, mapHealthBarValue, prepareHealthBarScale } from '../healthBars/healthBarScale';
import { prepareHealthBarSequence, sampleHealthBarSequence } from '../healthBars/healthBarSequence';
import { interpolateHealthBarScale, prepareHealthBarLegendTransition, sampleHealthBarLegendTransition } from '../healthBars/healthBarScaleTransition';

function scales() {
  const example = HEALTH_BAR_EXAMPLES.find((item) => item.id === 'compression')!;
  if (example.presentation.mode !== 'live') throw new Error('Expected snapshot');
  const snapshot = example.presentation.snapshot;
  const narrow = prepareHealthBarScale({ mode: 'settled', identity: snapshot.identity, outcome: snapshot.outcome,
    left: { playerId: 'a', health: 25, maxHealth: 35 }, right: { playerId: 'b', health: 30, maxHealth: 50 } },
  snapshot, { orientation: 'desktop' })!;
  return { narrow, wide: example.scales.desktop, example, snapshot };
}

describe('coordinated health-bar scale and legend transitions', () => {
  for (const direction of ['expansion', 'contraction'] as const) {
    it(`${direction}: continuous monotonic shared mapping with fixed logical health and exact target`, () => {
      const { narrow, wide } = scales();
      const [from, to] = direction === 'expansion' ? [narrow, wide] : [wide, narrow];
      const values = [-10000, -300, -60, 0, 20, 25, 35, 50];
      for (const p of [0, 0.1, 0.5, 0.9, 0.99999]) {
        const scale = interpolateHealthBarScale(from, to, p);
        const positions = values.map((value) => mapHealthBarValue(scale, value)!);
        expect(positions.every((value, index) => index === 0 || value >= positions[index - 1])).toBe(true);
        const clampMap = (s: typeof narrow, v: number) => mapHealthBarValue(s, Math.max(s.domainMin, Math.min(s.domainMax, v)))!;
        for (const value of [0, 25, 35]) {
          expect(mapHealthBarValue(scale, value)).toBeCloseTo((1 - p) * clampMap(from, value) + p * clampMap(to, value));
        }
        for (const orientation of ['desktop', 'mobile'] as const) {
          const geometry = calculateHealthBarGeometry(scale, 'left', { health: 25 }, orientation, 320);
          expect(geometry.zeroPosition).toBe(healthBarValuePosition(scale, 0, orientation, 320));
          expect(geometry.capPosition).toBe(healthBarValuePosition(scale, scale.leftCap.value!, orientation, 320));
          expect(geometry.white).not.toBeNull();
        }
      }
      expect(interpolateHealthBarScale(from, to, 1)).toBe(to);
    });
  }

  it('keeps numeric tick identity, maps matching labels, and fades only entering/leaving labels', () => {
    const { narrow, wide } = scales();
    const prepared = prepareHealthBarLegendTransition(narrow, wide, 'desktop', 320);
    const scale = interpolateHealthBarScale(narrow, wide, 0.5);
    const labels = sampleHealthBarLegendTransition(prepared, scale, 0.5);
    const old = new Set(prepared.from.map((tick) => tick.value));
    const incoming = new Set(prepared.to.map((tick) => tick.value));
    expect(labels.some((tick) => !old.has(tick.value))).toBe(true);
    expect(labels.some((tick) => !incoming.has(tick.value))).toBe(true);
    for (const tick of labels) {
      expect(tick.label).toBe(String(tick.value));
      expect(tick.position).toBe(mapHealthBarValue(scale, tick.value));
      expect(tick.opacity).toBe(old.has(tick.value) && incoming.has(tick.value) ? 1 : 0.5);
    }
    const markup = renderToStaticMarkup(createElement(HealthBarPair, {
      scale, orientation: 'desktop', axisLength: 320, left: { health: 25 }, right: { health: 30 },
      leftLabel: 'A', rightLabel: 'B', legendLabels: labels,
    }));
    expect(markup).toContain('opacity:0.5');
    expect(markup).toContain('data-health-marker="zero"');
  });

  it('holds logical starting health through 350ms preparation, then freezes mapping through completion', () => {
    const { example, snapshot } = scales();
    const sequence = prepareHealthBarSequence(snapshot, example.scales);
    expect(sequence.stages[0].name).toBe('scale');
    expect(sequence.stages[0].durationMs).toBe(350);
    for (const elapsed of [0, 100, 200, 349]) {
      const frame = sampleHealthBarSequence(sequence, elapsed);
      expect(frame.left.health).toBe(snapshot.left.startHealth);
      expect(frame.right.health).toBe(snapshot.right.startHealth);
    }
    for (const elapsed of [350, 1000, sequence.durationMs, sequence.durationMs + 5000]) {
      expect(sampleHealthBarSequence(sequence, elapsed).scales).toBe(sequence.scales);
    }
  });

  it('uses shared mobile density and mandatory ticks for each prepared transition endpoint', () => {
    const { narrow, wide, snapshot } = scales();
    const defaultScale = prepareHealthBarScale({ mode: 'settled', identity: snapshot.identity, outcome: snapshot.outcome,
      left: { playerId: 'a', health: 25, maxHealth: 35 }, right: { playerId: 'b', health: 30, maxHealth: 35 } },
    snapshot, { orientation: 'mobile' })!;
    expect(prepareHealthBarLegendTransition(defaultScale, wide, 'mobile', 256).from.map((tick) => tick.value))
      .toEqual([0, 5, 10, 15, 20, 25, 30, 35]);
    for (const [health, expected] of [
      [-2, [-5, 0, 5, 10, 15, 20, 25, 30, 35]],
      [-40, [-40, -30, -20, -10, 0, 10, 20, 30, 35]],
    ] as const) {
      const negativeScale = prepareHealthBarScale({ mode: 'settled', identity: snapshot.identity, outcome: snapshot.outcome,
        left: { playerId: 'a', health, maxHealth: 35 }, right: { playerId: 'b', health: 30, maxHealth: 35 } },
      snapshot, { orientation: 'mobile' })!;
      const expansion = prepareHealthBarLegendTransition(defaultScale, negativeScale, 'mobile', 256);
      const contraction = prepareHealthBarLegendTransition(negativeScale, defaultScale, 'mobile', 256);
      expect(expansion.to.map((tick) => tick.value)).toEqual(expected);
      expect(contraction.from).toEqual(expansion.to);
    }
    for (const [from, to] of [[defaultScale, wide], [wide, defaultScale], [wide, narrow]]) {
      for (const axisLength of [0, 120, 256, 1600]) {
        const prepared = prepareHealthBarLegendTransition(from, to, 'mobile', axisLength);
        for (const [scale, ticks] of [[from, prepared.from], [to, prepared.to]] as const) {
          expect(ticks).toEqual(calculateHealthBarLegend(scale, { orientation: 'mobile', axisLength }));
          expect(ticks.length).toBeLessThanOrEqual(9);
          expect(ticks.map((tick) => tick.value)).toEqual(expect.arrayContaining([0, scale.domainMax]));
          if (scale.domainMin < 0) expect(ticks.some((tick) => tick.value < 0)).toBe(true);
        }
        const expectedValues = new Set([...prepared.from, ...prepared.to].map((tick) => tick.value));
        for (const progress of [0, 0.5, 1]) {
          const scale = interpolateHealthBarScale(from, to, progress);
          const labels = sampleHealthBarLegendTransition(prepared, scale, progress);
          expect(new Set(labels.map((tick) => tick.value))).toEqual(expectedValues);
          for (const tick of labels) {
            expect(tick.position).toBe(mapHealthBarValue(scale, tick.value) ??
              [...prepared.to, ...prepared.from].find((label) => label.value === tick.value)!.position);
            const old = prepared.from.some((label) => label.value === tick.value);
            const incoming = prepared.to.some((label) => label.value === tick.value);
            expect(tick.opacity).toBe(old ? incoming ? 1 : 1 - progress : progress);
          }
        }
      }
    }
  });

  it('reselects density for dimensions without mutating a transition or logical progress', () => {
    const { narrow, wide } = scales();
    const small = prepareHealthBarLegendTransition(narrow, wide, 'mobile', 128);
    const large = prepareHealthBarLegendTransition(narrow, wide, 'desktop', 640);
    expect(large.to.length).toBeGreaterThan(small.to.length);
    const scale = interpolateHealthBarScale(narrow, wide, 0.4);
    expect(sampleHealthBarLegendTransition(small, scale, 0.4).find((tick) => tick.value === 0)!.position)
      .toBe(sampleHealthBarLegendTransition(large, scale, 0.4).find((tick) => tick.value === 0)!.position);
  });
});
