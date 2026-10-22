import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ResolvedHealthPresentation } from '../../client/gameSession/types';
import { HealthBar, HealthBarLegend, HealthBarPair } from '../healthBars/HealthBar';
import {
  calculateHealthBarGeometry, healthBarIntervalRectangle, healthBarValuePosition,
  type HealthBarPresentationState,
} from '../healthBars/healthBarPresentation';
import {
  calculateHealthBarLegend, mapHealthBarValue, prepareHealthBarScale,
  type HealthBarOrientation,
} from '../healthBars/healthBarScale';

const identity = { gameId: 'g', viewerId: 'a', viewerRole: 'player' as const, leftPlayerId: 'a', rightPlayerId: 'b' };
function scale(min = -60, leftCap: number | null = 35, rightCap: number | null = 50, orientation: HealthBarOrientation = 'desktop') {
  const presentation: ResolvedHealthPresentation = { mode: 'settled', identity,
    left: { playerId: 'a', health: min, maxHealth: leftCap },
    right: { playerId: 'b', health: 25, maxHealth: rightCap },
    outcome: { isTerminal: false, winnerPlayerId: null, resultReason: null } };
  const result = prepareHealthBarScale(presentation, { identity, continuityKey: 'test' }, { orientation });
  if (!result) throw new Error('Expected scale');
  return result;
}

type Element = ReactElement<Record<string, any>>;
function elements(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const element = child as Element;
    return [element, ...elements(element.props.children)];
  });
}

describe('health-bar production geometry', () => {
  for (const orientation of ['desktop', 'mobile'] as const) {
    it(`${orientation}: maps both endpoints before orienting crossing and reversed intervals`, () => {
      const prepared = scale(-300, 35, 50, orientation);
      for (const [from, to] of [[-200, 25], [25, -200], [-150, -50], [0, 35]]) {
        const bounds = healthBarIntervalRectangle(prepared, { from, to }, orientation, 320)!;
        const positions = [from, to].map((value) => mapHealthBarValue(prepared, value)!);
        const lower = Math.min(...positions);
        const upper = Math.max(...positions);
        expect(orientation === 'desktop' ? bounds.height : bounds.width).toBeCloseTo((upper - lower) * 320);
        expect(orientation === 'desktop' ? bounds.top : bounds.left).toBeCloseTo(2 + (orientation === 'desktop' ? 1 - upper : lower) * 320);
        expect(orientation === 'desktop' ? [bounds.left, bounds.width] : [bounds.top, bounds.height]).toEqual(orientation === 'desktop' ? [2, 24] : [2, 10]);
      }
    });

    it(`${orientation}: positive white fill stops at the player's cap`, () => {
      const prepared = scale(-60, 35, 50, orientation);
      const geometry = calculateHealthBarGeometry(prepared, 'left', { health: 48 }, orientation, 256);
      expect(geometry.white).toEqual(healthBarIntervalRectangle(prepared, { from: 0, to: 35 }, orientation, 256));
      expect(calculateHealthBarGeometry(prepared, 'right', { health: 48 }, orientation, 256).white)
        .toEqual(healthBarIntervalRectangle(prepared, { from: 0, to: 48 }, orientation, 256));
      for (const health of [-60, -1, 0]) {
        expect(calculateHealthBarGeometry(prepared, 'left', { health }, orientation, 256).white).toBeNull();
      }
      expect([geometry.width, geometry.height]).toEqual(orientation === 'desktop' ? [28, 260] : [260, 14]);
    });

    it(`${orientation}: preserves exact small intervals, omits invalid and empty intervals`, () => {
      const prepared = scale();
      const tiny = healthBarIntervalRectangle(prepared, { from: 10, to: 10.001 }, orientation, 100)!;
      expect(orientation === 'desktop' ? tiny.height : tiny.width).toBeLessThan(0.01);
      for (const interval of [{ from: 5, to: 5 }, { from: -61, to: 0 }, { from: 0, to: 51 }, { from: NaN, to: 0 }, { from: 0, to: Infinity }]) {
        expect(healthBarIntervalRectangle(prepared, interval, orientation, 100)).toBeNull();
      }
    });

    it(`${orientation}: keeps a complete zero marker at the edge and over zero-crossing fills`, () => {
      const edge = calculateHealthBarGeometry(scale(0, 35, 35), 'left', { health: 25 }, orientation, 100);
      expect(edge.zero).toEqual(orientation === 'desktop'
        ? { left: 2, top: 99, width: 24, height: 3 }
        : { left: 2, top: 2, width: 3, height: 10 });
      const prepared = scale();
      const crossing = calculateHealthBarGeometry(prepared, 'left', {
        health: 10, red: { from: -60, to: 0 }, green: { from: -60, to: 10 },
      }, orientation, 256);
      expect((orientation === 'desktop' ? crossing.zero.top : crossing.zero.left) + 1.5)
        .toBeCloseTo(healthBarValuePosition(prepared, 0, orientation, 256)!);
      expect(crossing.red).not.toBeNull();
      expect(crossing.green).not.toBeNull();
    });

    it(`${orientation}: unknown caps remain unknown and compression alone enables the cue`, () => {
      const unknown = scale(-60, null, null, orientation);
      const geometry = calculateHealthBarGeometry(unknown, 'left', { health: 30 }, orientation, 256);
      expect(geometry.capPosition).toBeNull();
      expect(geometry.white).toEqual(healthBarIntervalRectangle(unknown, { from: 0, to: 30 }, orientation, 256));
      expect(geometry.compressionPosition).toBeNull();
      const compressed = scale(-300, 35, 50, orientation);
      const marked = calculateHealthBarGeometry(compressed, 'left', { health: -25 }, orientation, 256);
      expect(marked.compressionPosition).not.toBeNull();
      expect(orientation === 'desktop' ? marked.compressionPosition! > marked.zeroPosition : marked.compressionPosition! < marked.zeroPosition).toBe(true);
      expect(marked.capPosition).toBe(healthBarValuePosition(compressed, 35, orientation, 256));
      expect(calculateHealthBarGeometry(compressed, 'right', { health: 25 }, orientation, 256).capPosition).toBeNull();
    });
  }
});

describe('health-bar rendered structure', () => {
  it('fits the live mobile pair in 38px while keeping logical caps and outward markers', () => {
    const prepared = scale(-300, 35, 45, 'mobile');
    const upper = HealthBar({ scale: prepared, orientation: 'mobile', axisLength: 256,
      side: 'right', state: { health: 21 }, label: 'Upper player', mobileMarkerEdge: 'top' });
    const lower = HealthBar({ scale: prepared, orientation: 'mobile', axisLength: 256,
      side: 'left', state: { health: -12, red: { from: -12, to: 0 } }, label: 'Lower player', mobileMarkerEdge: 'bottom' });
    const legend = HealthBarLegend({ scale: prepared, orientation: 'mobile', axisLength: 256, compactMobile: true });
    expect(upper.props.style.height + legend.props.style.height + lower.props.style.height).toBe(38);
    for (const track of [upper, lower]) {
      expect(track.props.style.width).toBe(260);
      expect(track.props.style.background).toBe('var(--shapeships-grey-90)');
    }
    expect(upper.props['aria-label']).toContain('Upper player: displayed health 21; maximum 45');
    expect(lower.props['aria-label']).toContain('Lower player: displayed health -12; maximum 35');
    const markers = (tree: Element) => elements(tree).filter((node) =>
      ['cap', 'compression'].includes(node.props['data-health-marker']));
    expect(markers(upper).every((marker) => marker.props.style.top < 0)).toBe(true);
    expect(markers(lower).every((marker) => marker.props.style.top === 16)).toBe(true);
    const lowerCap = markers(lower).find((marker) => marker.props['data-health-marker'] === 'cap')!;
    expect(lowerCap.props.style.left + 2).toBe(healthBarValuePosition(prepared, 35, 'mobile', 256));
    const zeros = [upper, lower].map((tree) => elements(tree).find((node) => node.props['data-health-marker'] === 'zero')!);
    expect(zeros[0].props.style).toEqual(zeros[1].props.style);
    expect(zeros[0].props.style.width).toBe(3);
    expect(zeros[0].props.style.height).toBe(10);
    expect(legend.props.style).toMatchObject({ width: 260, height: 10, fontSize: 10 });
    for (const tick of elements(legend).filter((node) => node.props['data-health-tick'] !== undefined)) {
      expect(tick.props.className).not.toContain('py-');
      expect(tick.props.style.left).toBe(healthBarValuePosition(prepared, tick.props['data-health-tick'], 'mobile', 256));
    }
    const ordinary = HealthBarLegend({ scale: prepared, orientation: 'mobile', axisLength: 256 });
    expect(ordinary.props.style.height).toBe(18);
    expect(elements(ordinary).some((node) => node.props.className?.includes('py-[2px]'))).toBe(true);
  });

  it('keeps independent red/green layers in order with the zero marker last', () => {
    const prepared = scale(-300);
    const state: HealthBarPresentationState = { health: 12, red: { from: -60, to: 0 }, green: { from: -60, to: 12 } };
    const props = { scale: prepared, side: 'left' as const, state, orientation: 'desktop' as const, axisLength: 320, label: 'Player A' };
    const tree = HealthBar(props);
    const nodes = elements(tree);
    const ordered = nodes.map((node) => node.props['data-health-layer'] ?? node.props['data-health-marker']).filter(Boolean);
    expect(ordered).toEqual(['white', 'red', 'green', 'cap', 'compression', 'zero']);
    const markup = renderToStaticMarkup(createElement(HealthBar, props));
    expect(markup).toContain('role="img"');
    expect(markup).toContain('red interval -60 to 0; green interval -60 to 12');
    const moved = elements(HealthBar({ ...props, state: { ...state, red: { from: -20, to: 0 } } }));
    expect(moved.find((node) => node.props['data-health-layer'] === 'green')!.props.style)
      .toEqual(nodes.find((node) => node.props['data-health-layer'] === 'green')!.props.style);
    const cleared = elements(HealthBar({ ...props, state: { health: 12, green: state.green } }));
    expect(cleared.some((node) => node.props['data-health-layer'] === 'red')).toBe(false);
    expect(cleared.some((node) => node.props['data-health-layer'] === 'green')).toBe(true);
  });

  for (const orientation of ['desktop', 'mobile'] as const) {
    it(`${orientation}: handoff renders zero-length intervals without visible minimums`, () => {
      const prepared = scale(-60, 35, 50, orientation);
      for (const health of [13, -60]) {
        const state: HealthBarPresentationState = { health,
          red: { from: health, to: health < 0 ? 0 : health }, green: { from: health, to: health } };
        const geometry = calculateHealthBarGeometry(prepared, 'left', state, orientation, 256);
        expect(geometry.green).toBeNull();
        if (health >= 0) expect(geometry.red).toBeNull();
        else expect(geometry.red).toEqual(healthBarIntervalRectangle(prepared, { from: -60, to: 0 }, orientation, 256));
        const markup = renderToStaticMarkup(createElement(HealthBar, { scale: prepared, orientation,
          axisLength: 256, side: 'left', state, label: 'A' }));
        expect(markup).not.toContain('data-health-layer="green"');
        expect(markup.includes('data-health-layer="red"')).toBe(health < 0);
        expect(markup).toContain('data-health-marker="zero"');
      }
    });

    it(`${orientation}: keeps the negative red rectangle behind green through zero crossing`, () => {
      const prepared = scale(-60, 35, 50, orientation);
      const red = healthBarIntervalRectangle(prepared, { from: -60, to: 0 }, orientation, 256);
      for (const health of [-47.55, -18.5, 23]) {
        const state = { health, red: { from: -60, to: 0 }, green: { from: -60, to: health } };
        const geometry = calculateHealthBarGeometry(prepared, 'left', state, orientation, 256);
        expect(geometry.red).toEqual(red);
        const nodes = elements(HealthBar({ scale: prepared, orientation, axisLength: 256, side: 'left', state, label: 'A' }));
        const order = nodes.map((node) => node.props['data-health-layer'] ?? node.props['data-health-marker']).filter(Boolean);
        expect(order.indexOf('red')).toBeLessThan(order.indexOf('green'));
        expect(order.at(-1)).toBe('zero');
        if (health < 0) expect(geometry.white).toBeNull();
      }
    });

    it(`${orientation}: negative settled red is explicit and maps final health to zero`, () => {
      const prepared = scale(-60, 35, 50, orientation);
      const state = { health: -13, red: { from: -13, to: 0 } };
      const geometry = calculateHealthBarGeometry(prepared, 'left', state, orientation, 256);
      expect(geometry.red).toEqual(healthBarIntervalRectangle(prepared, { from: -13, to: 0 }, orientation, 256));
      expect(geometry.white).toBeNull();
      expect(geometry.green).toBeNull();
      const props = { scale: prepared, orientation, axisLength: 256, side: 'left' as const, label: 'A' };
      const final = renderToStaticMarkup(createElement(HealthBar, { ...props, state }));
      expect(final).toContain('data-health-layer="red"');
      expect(final).not.toContain('data-health-layer="white"');
      expect(final).not.toContain('data-health-layer="green"');
      for (const health of [-13, 0]) {
        const uncoloured = renderToStaticMarkup(createElement(HealthBar, { ...props, state: { health } }));
        expect(uncoloured).not.toContain('data-health-layer="red"');
        expect(uncoloured).not.toContain('data-health-layer="white"');
        expect(uncoloured).toContain('data-health-marker="zero"');
      }
    });

    it(`${orientation}: pair shares scale, inner length and aligned legend positions`, () => {
      const prepared = scale(-300, 35, 50, orientation);
      const tree = HealthBarPair({ scale: prepared, orientation, axisLength: 256,
        left: { health: 25 }, right: { health: 30 }, leftLabel: 'A', rightLabel: 'B' });
      const children = Children.toArray(tree.props.children) as Element[];
      expect(children.map((child) => child.type)).toEqual([HealthBar, HealthBarLegend, HealthBar]);
      for (const child of children) {
        expect(child.props.scale).toBe(prepared);
        expect(child.props.axisLength).toBe(256);
      }
      const legend = HealthBarLegend({ scale: prepared, orientation, axisLength: 256 });
      if (orientation === 'desktop') {
        expect(legend.props.style.width).toBeUndefined();
        expect(legend.props.className.split(/\s+/)).toEqual(expect.arrayContaining([
          'w-[36px]', 'xl:w-[42px]', '2xl:w-[52px]', 'min-[120rem]:w-[76px]',
        ]));
      } else {
        expect(legend.props.style.width).toBe(260);
      }
      const labels = elements(legend).filter((node) => node.props['data-health-tick'] !== undefined);
      expect(labels.map((node) => node.props['data-health-tick'])).toEqual(calculateHealthBarLegend(prepared, { axisLength: 256, orientation }).map((tick) => tick.value));
      for (const node of labels) {
        expect(orientation === 'desktop' ? node.props.style.top : node.props.style.left)
          .toBe(healthBarValuePosition(prepared, node.props['data-health-tick'], orientation, 256));
      }
      const unknown = renderToStaticMarkup(createElement(HealthBar, { scale: scale(0, null, null), side: 'left', state: { health: -1 }, orientation, axisLength: 256, label: 'A' }));
      expect(unknown).toContain('maximum unknown');
      expect(unknown).not.toContain('data-health-marker="cap"');
      expect(unknown).not.toContain('data-health-marker="compression"');
      expect(unknown).not.toContain('data-health-layer="white"');
      expect(unknown).toContain('data-health-marker="zero"');
    });
  }
});
