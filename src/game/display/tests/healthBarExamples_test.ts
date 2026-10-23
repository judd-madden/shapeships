import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createHealthBarExample, HEALTH_BAR_EXAMPLES, HEALTH_BAR_EXAMPLE_AXIS_LENGTHS, type HealthBarExample } from '../../../components/dev/healthBarExampleFixtures';
import { HealthBarExamplePreview, HealthBarExamples } from '../../../components/dev/HealthBarExamples';
import { HealthBarPair } from '../healthBars/HealthBar';
function snapshot(example: HealthBarExample) {
  if (example.presentation.mode !== 'live') throw new Error('Expected complete live-shaped fixture');
  return example.presentation.snapshot;
}
function stage(example: HealthBarExample, name: string) {
  const result = example.stages.find((item) => item.name === name);
  if (!result) throw new Error(`Missing ${name} in ${example.name}`);
  return result;
}

describe('static health-bar examples', () => {
  it('keeps distinct scenario fixtures and labelled manual selectors', () => {
    expect(HEALTH_BAR_EXAMPLES.map((example) => example.id)).toEqual([
      'ordinary', 'small', 'recovery', 'negative-final', 'overheal', 'excess-healing', 'caps', 'compression', 'damage-only-negative',
    ]);
    expect(new Set(HEALTH_BAR_EXAMPLES.map((example) => example.name)).size).toBe(HEALTH_BAR_EXAMPLES.length);
    const markup = renderToStaticMarkup(createElement(HealthBarExamples));
    expect(markup.match(/<select/g)).toHaveLength(2);
    expect(markup).toMatch(/<label\b[^>]*>Scenario<select\b/);
    expect(markup).toMatch(/<label\b[^>]*>Stage<select\b/);
  });

  for (const example of HEALTH_BAR_EXAMPLES) {
    it(`${example.name}: consistent authored resolution, starting values and exact finals`, () => {
      if (example.presentation.mode !== 'live') throw new Error('Expected complete live-shaped fixture');
      const { left, right } = example.presentation.snapshot;
      for (const s of [left, right]) {
        expect(s.damageStageHealth).toBe(s.startHealth - s.damageTaken);
        expect(s.finalHealth).toBe(Math.min(s.startHealth - s.damageTaken + s.grossHealingReceived, s.maxHealth));
        expect(s.actualNetDelta).toBe(s.finalHealth - s.startHealth);
      }
      expect(example.scales.desktop.domainMin).toBe(example.scales.mobile.domainMin);
      expect(example.scales.desktop.domainMax).toBe(example.scales.mobile.domainMax);
      expect(example.stages[0].left.health).toBe(left.startHealth);
      expect(example.stages[0].right.health).toBe(right.startHealth);
      for (const side of ['left', 'right'] as const) {
        const final = example.stages.at(-1)![side];
        const health = example.presentation.snapshot[side].finalHealth;
        expect(final.health).toBe(health);
        expect(final.green).toBeUndefined();
        expect(final.red).toEqual(health < 0 ? { from: health, to: 0 } : undefined);
      }
    });
  }

  it('forwards the selected recovery pose and shared scale to both preview orientations', () => {
    const example = HEALTH_BAR_EXAMPLES.find((item) => item.id === 'recovery')!;
    const stageIndex = example.stages.findIndex((item) => item.name === 'Healing reaches final health');
    const selected = example.stages[stageIndex];
    const preview = HealthBarExamplePreview({ example, stageIndex });
    const pairs = (node: ReactNode): ReactElement<any>[] => Children.toArray(node).flatMap((child) => {
      if (!isValidElement(child)) return [];
      const element = child as ReactElement<any>;
      return element.type === HealthBarPair ? [element] : pairs(element.props.children);
    });
    const consumers = pairs(preview);
    expect(consumers.map((pair) => pair.props.orientation)).toEqual(['desktop', 'mobile']);
    for (const pair of consumers) {
      const orientation = pair.props.orientation as 'desktop' | 'mobile';
      expect(pair.props.scale).toBe(example.scales[orientation]);
      expect(pair.props.axisLength).toBe(HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation]);
      expect(pair.props.left).toBe(selected.left);
      expect(pair.props.right).toBe(selected.right);
    }
    expect(renderToStaticMarkup(preview).match(/data-health-pair=/g)).toHaveLength(2);
  });

  it('retains negative red behind recovery across zero and still demonstrates extreme compression', () => {
    const recovery = HEALTH_BAR_EXAMPLES.find((example) => example.id === 'recovery')!;
    const reached = stage(recovery, 'Healing reaches final health').left;
    expect(reached.red).toEqual({ from: -60, to: 0 });
    expect(reached.green).toEqual({ from: -60, to: 23 });
    expect(HEALTH_BAR_EXAMPLES.find((example) => example.id === 'compression')!.scales.desktop.negativeCompression).toBe(true);
  });

  it('preserves remaining negative red continuously from healing target through settling', () => {
    const negative = HEALTH_BAR_EXAMPLES.find((example) => example.id === 'negative-final')!;
    expect(negative.stages.some((sample) => sample.name === 'Retained red removed')).toBe(false);
    expect(stage(negative, 'Healing reaches final health').left.red).toEqual({ from: -18, to: 0 });
    expect(stage(negative, 'Healing clearance').left.red).toEqual({ from: -13, to: 0 });
    expect(stage(negative, 'Healing cleared').left).toEqual({ health: -13, red: { from: -13, to: 0 } });
    expect(stage(negative, 'Settled final').left).toEqual({ health: -13, red: { from: -13, to: 0 } });
    const afterDamage = negative.stages.slice(negative.stages.findIndex((sample) => sample.name === 'Damage clearance'));
    for (const sample of afterDamage) {
      expect(sample.left.red!.from).toBeLessThanOrEqual(-13);
      expect(sample.left.red!.to).toBe(0);
    }
    const damageOnly = HEALTH_BAR_EXAMPLES.find((example) => example.id === 'damage-only-negative')!;
    expect(stage(damageOnly, 'Settled final').left).toEqual({ health: -18, red: { from: -18, to: 0 } });
    expect(stage(damageOnly, 'Settled final').right).toEqual({ health: 0 });
  });

  for (const otherId of ['recovery', 'damage-only-negative'] as const) {
    for (const negativeSide of ['left', 'right'] as const) {
      it(`keeps ${negativeSide} negative-final red when its sibling recovers to ${otherId === 'recovery' ? 'positive' : 'zero'} health`, () => {
        const negative = snapshot(HEALTH_BAR_EXAMPLES.find((item) => item.id === 'negative-final')!).left;
        const other = snapshot(HEALTH_BAR_EXAMPLES.find((item) => item.id === otherId)!).right;
        const example = createHealthBarExample(`mixed-${otherId}-${negativeSide}`, 'Mixed recovery',
          { ...(negativeSide === 'left' ? negative : other), playerId: 'a' },
          { ...(negativeSide === 'right' ? negative : other), playerId: 'b' });
        const otherSide = negativeSide === 'left' ? 'right' : 'left';
        const removal = stage(example, 'Retained red removed');
        expect(removal[negativeSide].red).toEqual({ from: -13, to: 0 });
        expect(removal[negativeSide].green).toEqual({ from: -18, to: -13 });
        expect(removal[otherSide].red).toBeUndefined();
        expect(removal[otherSide].green).toEqual({ from: other.damageStageHealth, to: other.finalHealth });
        const targetIndex = example.stages.findIndex((sample) => sample.name === 'Healing reaches final health');
        const removalIndex = example.stages.findIndex((sample) => sample.name === 'Retained red removed');
        expect(removalIndex).toBeGreaterThan(targetIndex);
        expect(removalIndex).toBeLessThan(example.stages.findIndex((sample) => sample.name === 'Healing clearance'));
        for (const [index, sample] of example.stages.entries()) {
          if (index < targetIndex) continue;
          const state = sample[negativeSide];
          expect(state.health).toBe(-13);
          expect(state.red).toEqual({ from: index === targetIndex ? -18 : -13, to: 0 });
        }
        expect(stage(example, 'Healing cleared')[negativeSide]).toEqual(stage(example, 'Settled final')[negativeSide]);
      });
    }
  }

  it('uses the confirmed surplus amounts: 20, 25, 99 capped to 35, and 5 at cap 50', () => {
    for (const [id, side, unused, cap, peak] of [
      ['overheal', 'left', 20, 35, 20], ['excess-healing', 'right', 25, 35, 25],
      ['excess-healing', 'left', 99, 35, 35], ['caps', 'left', 5, 50, 5],
    ] as const) {
      const example = HEALTH_BAR_EXAMPLES.find((item) => item.id === id)!;
      const s = snapshot(example)[side];
      expect(s.damageStageHealth + s.grossHealingReceived - s.finalHealth).toBe(unused);
      expect(s.maxHealth).toBe(cap);
      expect(stage(example, 'Surplus reaches amount')[side].green).toEqual({ from: 0, to: peak });
    }
  });
});
