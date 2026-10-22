import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HEALTH_BAR_EXAMPLES } from '../../../components/dev/healthBarExampleFixtures';
import { HealthBarPair } from '../healthBars/HealthBar';
import { calculateHealthBarGeometry, healthBarValuePosition } from '../healthBars/healthBarPresentation';
import { mapHealthBarValue, prepareHealthBarScale } from '../healthBars/healthBarScale';
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
