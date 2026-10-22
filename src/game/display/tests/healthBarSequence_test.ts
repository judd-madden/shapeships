import { describe, expect, it } from 'vitest';
import { HEALTH_BAR_EXAMPLES, createHealthBarExample } from '../../../components/dev/healthBarExampleFixtures';
import { healthBarEasing, healthBarMovementDuration } from '../healthBars/healthBarAnimationConfig';
import { prepareHealthBarSequence, sampleHealthBarSequence, type HealthBarSequence, type HealthBarAnimationStage } from '../healthBars/healthBarSequence';
import { calculateHealthBarGeometry } from '../healthBars/healthBarPresentation';
import { mapHealthBarValue, prepareHealthBarScale } from '../healthBars/healthBarScale';

function sequence(id: string): HealthBarSequence {
  const example = HEALTH_BAR_EXAMPLES.find((item) => item.id === id)!;
  if (example.presentation.mode !== 'live') throw new Error('Expected live snapshot');
  return prepareHealthBarSequence(example.presentation.snapshot, example.scales);
}
function sample(sequence: HealthBarSequence, name: HealthBarAnimationStage, fraction = 0.5) {
  const stage = sequence.stages.find((item) => item.name === name)!;
  if (!stage) throw new Error(`Missing ${name}`);
  return sampleHealthBarSequence(sequence, stage.startMs + stage.durationMs * fraction);
}

describe('health-bar sequence preparation and elapsed sampling', () => {
  it('carries the retained floor through missing or shallower outgoing scales without affecting standalone scenarios', () => {
    const source = sequence('ordinary');
    const presentation = { mode: 'live' as const, snapshot: source.snapshot };
    const scales = {
      desktop: prepareHealthBarScale(presentation, source.snapshot, { orientation: 'desktop', retainedNegativeFloor: -40 })!,
      mobile: prepareHealthBarScale(presentation, source.snapshot, { orientation: 'mobile', retainedNegativeFloor: -40 })!,
    };
    for (const previous of [null, source.scales]) {
      const retained = prepareHealthBarSequence(source.snapshot, scales, previous, -40);
      for (const orientation of ['desktop', 'mobile'] as const) {
        expect(retained.previousScales[orientation].domainMin).toBe(-40);
        expect(retained.scales[orientation].domainMin).toBe(-40);
        expect(Object.isFrozen(retained.scales[orientation])).toBe(true);
      }
      for (const stage of retained.stages) {
        const frame = sampleHealthBarSequence(retained, stage.startMs + stage.durationMs / 2);
        if (stage.name !== 'scale') expect(frame.scales).toBe(retained.scales);
        expect(frame.scales.desktop.domainMin).toBe(-40);
        expect(frame.scales.mobile.domainMin).toBe(-40);
      }
    }
    expect(sequence('ordinary').scales.desktop.domainMin).toBe(0);
    expect(sequence('ordinary').previousScales.mobile.domainMin).toBe(0);
  });

  it('uses bounded mapped travel and evaluates cubic-bezier time rather than its parameter', () => {
    expect([0, 0.25, 0.5, 0.75, 1, 100].map(healthBarMovementDuration)).toEqual([700, 700, 700, 1050, 1400, 1400]);
    expect(healthBarEasing(0)).toBe(0);
    expect(healthBarEasing(1)).toBe(1);
    expect(healthBarEasing(0.5)).toBeCloseTo(0.5, 10);
    // At t=.25 the Bezier's x is .353125 and y is .15625.
    expect(healthBarEasing(0.353125)).toBeCloseTo(0.15625, 10);
    // Independent polynomial sample at parameter t=.1.
    expect(healthBarEasing(0.1792)).toBeCloseTo(0.028, 10);
  });

  it('uses compressed endpoint distance and the slower sibling duration, not net/raw health', () => {
    const s = sequence('compression');
    const scale = s.scales.desktop;
    const travel = Math.max(...(['left', 'right'] as const).map((side) =>
      Math.abs(mapHealthBarValue(scale, s.snapshot[side].startHealth)! - mapHealthBarValue(scale, s.snapshot[side].damageStageHealth)!)));
    expect(s.stages.find((stage) => stage.name === 'damage')!.durationMs).toBeCloseTo(healthBarMovementDuration(travel));
    expect(s.stages.find((stage) => stage.name === 'damage')!.durationMs).toBeLessThan(1400);
    const mid = sample(s, 'damage');
    for (const side of ['left', 'right'] as const) {
      expect(mapHealthBarValue(scale, mid[side].health)).toBeCloseTo(
        (mapHealthBarValue(scale, s.snapshot[side].startHealth)! + mapHealthBarValue(scale, s.snapshot[side].damageStageHealth)!) / 2);
      expect(mid[side].red!.from).toBe(mid[side].health);
    }
  });

  it('has a positive empty handoff and exactly one conditional 200ms pause', () => {
    const s = sequence('ordinary');
    const handover = s.stages.filter((stage) => stage.name === 'handover');
    expect(handover).toHaveLength(1);
    expect(handover[0].durationMs).toBe(200);
    const frame = sample(s, 'handover');
    for (const side of ['left', 'right'] as const) {
      expect(frame[side].red).toBeUndefined();
      expect(frame[side].green!.from).toBe(frame[side].green!.to);
    }
    expect(sequence('overheal').stages.some((stage) => stage.name === 'handover')).toBe(false);
  });

  it('skips all absent movement and unnecessary handover, including fully negative clearance', () => {
    const source = sequence('ordinary').snapshot;
    const stationary = { ...source.left, startHealth: 25, damageTaken: 0, damageStageHealth: 25,
      grossHealingReceived: 0, finalHealth: 25, actualNetDelta: 0 };
    const example = createHealthBarExample('none', 'None', stationary, { ...stationary, playerId: 'b' });
    if (example.presentation.mode !== 'live') throw new Error('Expected live');
    const s = prepareHealthBarSequence(example.presentation.snapshot, example.scales);
    expect(s.stages).toHaveLength(0);
    expect(sampleHealthBarSequence(s, 0).complete).toBe(true);
    const damageOnly = createHealthBarExample('damage-only', 'Damage',
      { ...stationary, damageTaken: 5, damageStageHealth: 20, finalHealth: 20, actualNetDelta: -5 },
      { ...stationary, playerId: 'b' });
    if (damageOnly.presentation.mode !== 'live') throw new Error('Expected live');
    expect(prepareHealthBarSequence(damageOnly.presentation.snapshot, damageOnly.scales).stages.map((stage) => stage.name))
      .toEqual(['damage', 'damage-clearance']);
  });

  it('keeps full negative red behind green throughout recovery, including crossing zero', () => {
    const s = sequence('recovery');
    for (const fraction of [0, 0.1, 0.5, 0.9, 0.999999]) {
      const frame = sample(s, 'healing', fraction);
      for (const side of ['left', 'right'] as const) {
        expect(frame[side].red).toEqual({ from: -60, to: 0 });
        expect(frame[side].green!.from).toBe(-60);
        expect(frame[side].green!.to).toBe(frame[side].health);
      }
    }
    const clear = sample(s, 'damage-clearance', 0.999999);
    expect(clear.left.red!.to).toBeCloseTo(0);
    expect(sample(s, 'handover').left.red).toEqual({ from: -60, to: 0 });
    expect(sample(s, 'healing-clearance', 0).left.red).toBeUndefined();
  });

  it('keeps final-negative red continuously through trimming, clearance and settling', () => {
    const s = sequence('negative-final');
    expect(sample(s, 'healing', 0.999999).left.red).toEqual({ from: -18, to: 0 });
    for (const fraction of [0, 0.1, 0.5, 0.9, 0.999999]) {
      const frame = sample(s, 'healing-clearance', fraction);
      expect(frame.left.red).toEqual({ from: -13, to: 0 });
      expect(frame.left.green!.to).toBe(-13);
      expect(frame.left.health).toBe(-13);
    }
    expect(sampleHealthBarSequence(s, s.durationMs).left).toEqual({ health: -13, red: { from: -13, to: 0 } });
    const damageOnly = sequence('damage-only-negative');
    expect(sample(damageOnly, 'healing').left.red).toEqual({ from: -18, to: 0 });
    expect(sample(damageOnly, 'healing-clearance').left.red).toEqual({ from: -18, to: 0 });
  });

  it('preserves a negative sibling while the other recovers to zero or positive, in either seat', () => {
    const negative = sequence('negative-final').snapshot.left;
    for (const other of [sequence('recovery').snapshot.right, sequence('damage-only-negative').snapshot.right]) {
      for (const side of ['left', 'right'] as const) {
        const example = createHealthBarExample(`mixed-${side}`, 'Mixed',
          { ...(side === 'left' ? negative : other), playerId: 'a' },
          { ...(side === 'right' ? negative : other), playerId: 'b' });
        if (example.presentation.mode !== 'live') throw new Error('Expected live');
        const s = prepareHealthBarSequence(example.presentation.snapshot, example.scales);
        expect(sample(s, 'healing')[side].red).toEqual({ from: -18, to: 0 });
        expect(sample(s, 'healing-clearance', 0)[side].red).toEqual({ from: -13, to: 0 });
        expect(sampleHealthBarSequence(s, s.durationMs)[side].red).toEqual({ from: -13, to: 0 });
      }
    }
  });

  it('extends surplus from fixed zero and returns to zero without changing white health or domain', () => {
    const s = sequence('excess-healing');
    for (const fraction of [0, 0.2, 0.5, 0.8, 0.999999]) {
      const out = sample(s, 'surplus-out', fraction);
      const back = sample(s, 'surplus-return', fraction);
      for (const side of ['left', 'right'] as const) {
        expect(out[side].green!.from).toBe(0);
        expect(back[side].green!.from).toBe(0);
        expect(out[side].health).toBe(35);
        expect(back[side].health).toBe(35);
      }
      expect(out.scales).toBe(s.scales);
    }
    expect(sample(s, 'surplus-return', 0).left.green).toEqual({ from: 0, to: 35 });
    expect(sample(s, 'surplus-return', 0).right.green).toEqual({ from: 0, to: 25 });
    expect(sampleHealthBarSequence(s, s.durationMs).left.green).toBeUndefined();
  });

  for (const example of HEALTH_BAR_EXAMPLES) {
    it(`${example.id}: agrees with the approved static semantic boundaries`, () => {
      const s = sequence(example.id);
      const normalize = (state: typeof s.final.left) => ({ health: state.health,
        ...(state.red && state.red.from !== state.red.to ? { red: state.red } : {}),
        ...(state.green && state.green.from !== state.green.to ? { green: state.green } : {}) });
      for (const [semantic, reference] of [
        ['damage', 'Damage reaches affected range'], ['damage-clearance', 'Damage clearance'],
        ['handover', 'Red/green handoff'], ['healing', 'Healing reaches final health'],
        ['healing-clearance', 'Healing cleared'], ['surplus-out', 'Surplus reaches amount'],
        ['surplus-return', 'Surplus cleared'],
      ] as const) {
        const stage = s.stages.find((item) => item.name === semantic);
        const pose = example.stages.find((item) => item.name === reference);
        if (!stage || !pose) continue;
        for (const side of ['left', 'right'] as const) expect(normalize(stage.to[side])).toEqual(normalize(pose[side]));
      }
    });

    it(`${example.id}: bounded shared stages, retained mapping and equivalent oriented geometry`, () => {
      const s = sequence(example.id);
      expect(s.durationMs).toBeLessThanOrEqual(350 + 6 * 1400 + 200);
      for (const stage of s.stages) {
        for (const fraction of [0, 0.25, 0.5, 0.75, 0.999999]) {
          const frame = sampleHealthBarSequence(s, stage.startMs + stage.durationMs * fraction);
          if (stage.name !== 'scale') expect(frame.scales).toBe(s.scales);
          for (const side of ['left', 'right'] as const) {
            const desktop = calculateHealthBarGeometry(frame.scales.desktop, side, frame[side], 'desktop', 320);
            const mobile = calculateHealthBarGeometry(frame.scales.mobile, side, frame[side], 'mobile', 320);
            for (const layer of ['white', 'red', 'green'] as const) {
              expect(!!desktop[layer]).toBe(!!mobile[layer]);
              if (desktop[layer] && mobile[layer]) {
                expect(desktop[layer]!.height).toBeCloseTo(mobile[layer]!.width);
                expect(desktop[layer]!.top + desktop[layer]!.height + mobile[layer]!.left).toBeCloseTo(324);
              }
            }
            if (frame[side].health <= 0) expect(desktop.white).toBeNull();
          }
        }
      }
      const final = sampleHealthBarSequence(s, s.durationMs);
      expect(final.complete).toBe(true);
      expect(final.left.health).toBe(s.snapshot.left.finalHealth);
      expect(final.right.health).toBe(s.snapshot.right.finalHealth);
    });
  }

  it('keeps extreme finite contributions bounded with finite sampled endpoints', () => {
    const example = createHealthBarExample('finite-extreme', 'Finite extreme',
      { playerId: 'a', startHealth: 1e308, damageTaken: 1.5e308, damageStageHealth: -5e307,
        grossHealingReceived: 1.5e308, finalHealth: 1e308, actualNetDelta: 0, maxHealth: 1e308 },
      { playerId: 'b', startHealth: 25, damageTaken: 0, damageStageHealth: 25,
        grossHealingReceived: 0, finalHealth: 25, actualNetDelta: 0, maxHealth: 35 });
    if (example.presentation.mode !== 'live') throw new Error('Expected live');
    const s = prepareHealthBarSequence(example.presentation.snapshot, example.scales);
    expect(Number.isFinite(s.durationMs)).toBe(true);
    expect(s.durationMs).toBeLessThanOrEqual(8950);
    for (const stage of s.stages) {
      const frame = sampleHealthBarSequence(s, stage.startMs + stage.durationMs / 2);
      for (const side of ['left', 'right'] as const) {
        expect(Number.isFinite(frame[side].health)).toBe(true);
        for (const interval of [frame[side].red, frame[side].green]) {
          if (!interval) continue;
          expect(Number.isFinite(interval.from)).toBe(true);
          expect(Number.isFinite(interval.to)).toBe(true);
        }
      }
    }
  });
});
