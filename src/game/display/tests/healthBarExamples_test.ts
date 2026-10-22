import { Children, createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HEALTH_BAR_EXAMPLES, HEALTH_BAR_EXAMPLE_AXIS_LENGTHS } from '../../../components/dev/healthBarExampleFixtures';
import { HealthBarExamplePreview, HealthBarExamples } from '../../../components/dev/HealthBarExamples';
import { calculateHealthBarGeometry, healthBarValuePosition } from '../healthBars/healthBarPresentation';
import { HealthBarPair } from '../healthBars/HealthBar';
import { mapHealthBarValue } from '../healthBars/healthBarScale';

describe('static health-bar examples', () => {
  it('provides the eight named scenarios and labelled manual selectors', () => {
    expect(HEALTH_BAR_EXAMPLES).toHaveLength(8);
    expect(new Set(HEALTH_BAR_EXAMPLES.map((example) => example.name)).size).toBe(8);
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
      expect(example.stages.at(-1)!.left).toEqual({ health: left.finalHealth });
      expect(example.stages.at(-1)!.right).toEqual({ health: right.finalHealth });
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
            if (stage.name.startsWith('Surplus') && state.green) {
              const cap = side === 'left' ? left.maxHealth : right.maxHealth;
              expect(state.health).toBe(cap);
              expect(state.green.from).toBeGreaterThanOrEqual(0);
              expect(state.green.to).toBeLessThanOrEqual(cap);
              const length = HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation];
              const geometry = calculateHealthBarGeometry(scale, side, state, orientation, length);
              const capPosition = healthBarValuePosition(scale, cap, orientation, length)!;
              const zeroPosition = healthBarValuePosition(scale, 0, orientation, length)!;
              const start = orientation === 'desktop' ? geometry.green!.top : geometry.green!.left;
              const extent = orientation === 'desktop' ? geometry.green!.height : geometry.green!.width;
              expect(start).toBeGreaterThanOrEqual(Math.min(capPosition, zeroPosition) - 1e-10);
              expect(start + extent).toBeLessThanOrEqual(Math.max(capPosition, zeroPosition) + 1e-10);
            }
          }
        }
        // Both production orientations render every supplied pose without browser tooling.
        expect(renderToStaticMarkup(createElement(HealthBarExamplePreview, { example, stageIndex: index })).match(/data-health-pair=/g)).toHaveLength(2);
      }
    });
  }

  it('includes simultaneous layers, crossing-zero recovery, compressed and negative final poses', () => {
    const states = HEALTH_BAR_EXAMPLES.flatMap((example) => example.stages.flatMap((stage) => [stage.left, stage.right]));
    expect(states.some((state) => state.red && state.green)).toBe(true);
    expect(states.some((state) => state.green && state.green.from < 0 && state.green.to > 0)).toBe(true);
    expect(HEALTH_BAR_EXAMPLES.find((example) => example.id === 'compression')!.scales.desktop.negativeCompression).toBe(true);
    const negative = HEALTH_BAR_EXAMPLES.find((example) => example.id === 'negative-final')!;
    expect(calculateHealthBarGeometry(negative.scales.desktop, 'left', negative.stages.at(-1)!.left, 'desktop', 320).white).toBeNull();
  });
});
