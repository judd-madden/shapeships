import { Children, createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createHealthBarExample, HEALTH_BAR_EXAMPLES, HEALTH_BAR_EXAMPLE_AXIS_LENGTHS, type HealthBarExample } from '../../../components/dev/healthBarExampleFixtures';
import { HealthBarExamplePreview, HealthBarExamples } from '../../../components/dev/HealthBarExamples';
import { calculateHealthBarGeometry, healthBarValuePosition } from '../healthBars/healthBarPresentation';
import { HealthBar, HealthBarPair } from '../healthBars/HealthBar';
import { mapHealthBarValue } from '../healthBars/healthBarScale';
import type { HealthBarInterval } from '../healthBars/healthBarPresentation';

const visible = (interval: HealthBarInterval | undefined) => !!interval && interval.from !== interval.to;
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
  it('preserves the eight scenarios, adds damage-only negative coverage and keeps manual selectors', () => {
    expect(HEALTH_BAR_EXAMPLES.map((example) => example.id)).toEqual([
      'ordinary', 'small', 'recovery', 'negative-final', 'overheal', 'excess-healing', 'caps', 'compression', 'damage-only-negative',
    ]);
    expect(new Set(HEALTH_BAR_EXAMPLES.map((example) => example.name)).size).toBe(9);
    const markup = renderToStaticMarkup(createElement(HealthBarExamples));
    expect(markup).toContain('Health Bars');
    expect(markup.match(/<select/g)).toHaveLength(2);
    expect(markup).toContain('Scenario');
    expect(markup).toContain('Stage');
    expect(markup).toContain('Example inner axis: 320px');
    expect(markup).toContain('Example inner axis: 256px');
  });

  for (const example of HEALTH_BAR_EXAMPLES) {
    it(`${example.name}: coherent complete resolution and retained domain across all poses`, () => {
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
      for (const [index, stage] of example.stages.entries()) {
        const preview = HealthBarExamplePreview({ example, stageIndex: index });
        const columns = Children.toArray(preview.props.children) as ReactElement<any>[];
        for (const [columnIndex, orientation] of (['desktop', 'mobile'] as const).entries()) {
          const pair = (Children.toArray(columns[columnIndex].props.children) as ReactElement<any>[]).find((child) => child.type === HealthBarPair)!;
          expect(pair.props.scale).toBe(example.scales[orientation]);
          expect(pair.props.left).toBe(stage.left);
          expect(pair.props.right).toBe(stage.right);
          const scale = example.scales[orientation];
          for (const [side, state] of [['left', stage.left], ['right', stage.right]] as const) {
            expect(mapHealthBarValue(scale, state.health)).not.toBeNull();
            for (const interval of [state.red, state.green]) {
              if (!interval) continue;
              expect(mapHealthBarValue(scale, interval.from)).not.toBeNull();
              expect(mapHealthBarValue(scale, interval.to)).not.toBeNull();
            }
            const length = HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation];
            const geometry = calculateHealthBarGeometry(scale, side, state, orientation, length);
            if (state.health <= 0) expect(geometry.white).toBeNull();
            if (stage.name.startsWith('Surplus') && state.green) {
              const cap = side === 'left' ? left.maxHealth : right.maxHealth;
              expect(state.health).toBe(cap);
              expect(state.green.from).toBe(0);
              expect(state.green.to).toBeLessThanOrEqual(cap);
              if (state.green.to === 0) {
                expect(geometry.green).toBeNull();
                continue;
              }
              const capPosition = healthBarValuePosition(scale, cap, orientation, length)!;
              const zeroPosition = healthBarValuePosition(scale, 0, orientation, length)!;
              const start = orientation === 'desktop' ? geometry.green!.top : geometry.green!.left;
              const extent = orientation === 'desktop' ? geometry.green!.height : geometry.green!.width;
              expect(start).toBeGreaterThanOrEqual(Math.min(capPosition, zeroPosition) - 1e-10);
              expect(start + extent).toBeLessThanOrEqual(Math.max(capPosition, zeroPosition) + 1e-10);
              expect(orientation === 'desktop' ? start + extent : start).toBeCloseTo(zeroPosition);
            }
          }
        }
        // Both production orientations render every supplied pose without browser tooling.
        expect(renderToStaticMarkup(createElement(HealthBarExamplePreview, { example, stageIndex: index })).match(/data-health-pair=/g)).toHaveLength(2);
      }
    });

    it(`${example.name}: enforces per-player handoff, retained trail and clearance boundaries`, () => {
      const source = snapshot(example);
      const index = (name: string) => example.stages.findIndex((item) => item.name === name);
      const needsRemoval = [source.left, source.right].some((s) =>
        s.damageStageHealth < 0 && s.finalHealth >= 0 && s.finalHealth > s.damageStageHealth);
      expect(index('Retained red removed') >= 0).toBe(needsRemoval);
      for (const side of ['left', 'right'] as const) {
        const s = source[side];
        const start = s.damageStageHealth;
        const recovers = s.finalHealth > start;
        if (index('Damage clearance') >= 0) {
          const cleared = stage(example, 'Damage clearance')[side];
          expect(cleared.health).toBe(start);
          if (start < 0) expect(cleared.red).toEqual({ from: start, to: 0 });
          else expect(visible(cleared.red)).toBe(false);
        }
        if (index('Red/green handoff') >= 0) {
          const handoff = stage(example, 'Red/green handoff')[side];
          expect(handoff.health).toBe(start);
          expect(visible(handoff.green)).toBe(false);
          if (recovers) expect(handoff.green).toEqual({ from: start, to: start });
          if (start < 0) expect(handoff.red).toEqual({ from: start, to: 0 });
          else expect(visible(handoff.red)).toBe(false);
        }
        if (index('Healing begins') < 0) continue;
        const growth = ['Healing begins', 'Healing grows', 'Healing movement', 'Healing reaches final health'];
        const samples = growth.map((name) => stage(example, name)[side]);
        for (const sample of samples) {
          if (!recovers) {
            expect(sample.health).toBe(start);
            expect(sample.green).toBeUndefined();
            if (start < 0) expect(sample.red).toEqual({ from: start, to: 0 });
            else expect(visible(sample.red)).toBe(false);
            continue;
          }
          expect(sample.green).toEqual({ from: start, to: sample.health });
          if (start < 0) expect(sample.red).toEqual({ from: start, to: 0 });
          else expect(visible(sample.red)).toBe(false);
        }
        if (!recovers) {
          // A damage-only player does not lose its final red when its sibling heals.
          for (const name of ['Retained red removed', 'Healing clearance', 'Healing cleared']) {
            if (index(name) < 0) continue;
            const state = stage(example, name)[side];
            expect(state.health).toBe(s.finalHealth);
            expect(state.green).toBeUndefined();
            expect(state.red).toEqual(s.finalHealth < 0 ? { from: s.finalHealth, to: 0 } : undefined);
          }
          continue;
        }
        expect(samples[0].green).toEqual({ from: start, to: start });
        expect(samples[1].health).toBeGreaterThan(samples[0].health);
        expect(samples[2].health).toBeGreaterThan(samples[1].health);
        expect(samples[3].health).toBe(s.finalHealth);
        expect(index('Healing reaches final health')).toBeLessThan(index('Healing clearance'));
        if (start < 0 && s.finalHealth >= 0) {
          expect(index('Retained red removed')).toBeGreaterThan(index('Healing reaches final health'));
          expect(index('Retained red removed')).toBeLessThan(index('Healing clearance'));
          const removed = stage(example, 'Retained red removed')[side];
          expect(removed.red).toBeUndefined();
          expect(removed.green).toEqual({ from: start, to: s.finalHealth });
        }
        const clearing = stage(example, 'Healing clearance')[side];
        expect(clearing.red).toEqual(s.finalHealth < 0 ? { from: s.finalHealth, to: 0 } : undefined);
        expect(clearing.green!.from).toBeGreaterThan(start);
        expect(clearing.green!.to).toBe(s.finalHealth);
        const cleared = stage(example, 'Healing cleared')[side];
        expect(cleared).toEqual(stage(example, 'Settled final')[side]);
        expect(index('Healing cleared')).toBeGreaterThan(index('Healing clearance'));
        expect(index('Settled final')).toBeGreaterThan(index('Healing cleared'));
      }
      for (const sample of example.stages) {
        for (const side of ['left', 'right'] as const) {
          const state = sample[side];
          if (!visible(state.red) || !visible(state.green)) continue;
          expect(source[side].damageStageHealth).toBeLessThan(0);
          if (sample.name === 'Healing clearance' || sample.name === 'Retained red removed') {
            expect(source[side].finalHealth).toBeLessThan(0);
            expect(state.red).toEqual({ from: source[side].finalHealth, to: 0 });
            expect(state.green!.to).toBe(source[side].finalHealth);
          } else {
            expect(['Healing grows', 'Healing movement', 'Healing reaches final health']).toContain(sample.name);
            expect(state.red).toEqual({ from: source[side].damageStageHealth, to: 0 });
            expect(state.green!.from).toBe(source[side].damageStageHealth);
          }
        }
      }
    });

    it(`${example.name}: surplus grows and returns about zero using unused healing only`, () => {
      const source = snapshot(example);
      const unused = (side: 'left' | 'right') => Math.max(0,
        source[side].damageStageHealth + source[side].grossHealingReceived - source[side].finalHealth);
      const surplus = example.stages.filter((sample) => sample.name.startsWith('Surplus'));
      if (!unused('left') && !unused('right')) {
        expect(surplus).toHaveLength(0);
        return;
      }
      expect(surplus.map((sample) => sample.name)).toEqual([
        'Surplus begins', 'Surplus grows', 'Surplus reaches amount', 'Surplus returns', 'Surplus cleared',
      ]);
      for (const side of ['left', 'right'] as const) {
        const amount = Math.min(unused(side), source[side].maxHealth);
        const states = surplus.map((sample) => sample[side]);
        for (const state of states) expect(state.health).toBe(source[side].finalHealth);
        if (amount === 0) {
          for (const state of states) expect(state).toEqual(stage(example, 'Settled final')[side]);
          continue;
        }
        for (const [index, fraction] of [0, 0.5, 1, 0.5].entries()) {
          expect(states[index].green).toEqual({ from: 0, to: amount * fraction });
          expect(states[index].red).toBeUndefined();
        }
        expect(states[1].green!.to).toBeGreaterThan(states[0].green!.to);
        expect(states[2].green!.to).toBeGreaterThan(states[1].green!.to);
        expect(states[3].green!.to).toBeLessThan(states[2].green!.to);
        expect(states[4].green).toBeUndefined();
      }
    });
  }

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
      for (const orientation of ['desktop', 'mobile'] as const) {
        const geometry = calculateHealthBarGeometry(negative.scales[orientation], 'left', sample.left,
          orientation, HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation]);
        expect(geometry.red).not.toBeNull();
        expect(geometry.white).toBeNull();
      }
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
          for (const orientation of ['desktop', 'mobile'] as const) {
            const scale = example.scales[orientation];
            const axisLength = HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation];
            const geometry = calculateHealthBarGeometry(scale, negativeSide, state, orientation, axisLength);
            expect(geometry.white).toBeNull();
            expect(geometry.red).not.toBeNull();
            for (const interval of [state.red, state.green]) {
              if (!interval) continue;
              expect(mapHealthBarValue(scale, interval.from)).not.toBeNull();
              expect(mapHealthBarValue(scale, interval.to)).not.toBeNull();
            }
            const markup = renderToStaticMarkup(createElement(HealthBar, {
              scale, orientation, axisLength, side: negativeSide, state, label: 'Negative final',
            }));
            expect(markup).toContain('data-health-layer="red"');
            expect(markup).not.toContain('data-health-layer="white"');
            const preview = HealthBarExamplePreview({ example, stageIndex: index });
            const columns = Children.toArray(preview.props.children) as ReactElement<any>[];
            const column = columns[orientation === 'desktop' ? 0 : 1];
            const pair = (Children.toArray(column.props.children) as ReactElement<any>[]).find((child) => child.type === HealthBarPair)!;
            expect(pair.props.scale).toBe(scale);
            expect(pair.props[negativeSide]).toBe(state);
          }
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
