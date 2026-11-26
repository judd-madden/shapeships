import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { MissionFindingCard, MissionFindingsView } from '../../../../components/panels/lore/MissionFindingsPanel';
import { missionFindings } from '../../../../components/panels/lore/loreContent';
import { createMissionMapLayout, mapSystems, markerColors, speciesColors } from '../../../../components/panels/lore/missionFindingsMapLayout';
import { MULTI_MISSION_FINDING_REQUIREMENTS } from '../../../client/gameSession/mission/missionFindingUnlocks';

const five = new Set([
  'sol-1', 'proxima-centauri', 'delta-aquarii', 'betelgeuse',
  ...MULTI_MISSION_FINDING_REQUIREMENTS['rebel-alliance'],
]);
const all = new Set(missionFindings.flatMap((finding) => [...(finding.requiredFindingIds ?? [finding.id])]));

test.each([[new Set<string>(), 0], [five, 5], [all, 10]] as const)(
  'the rendered counter counts displayed Findings and agrees with every card (%s)',
  (completedFindingIds, count) => {
    const markup = renderToStaticMarkup(createElement(MissionFindingsView, { completedFindingIds }));
    expect(markup).toContain('aria-label="' + count + ' of 10 Mission Findings unlocked"');
    expect(markup.match(/data-finding-unlocked="true"/g) ?? []).toHaveLength(count);
    expect(markup.match(/data-finding-id=/g)).toHaveLength(10);
    expect(markup.match(/data-system-marker=/g)).toHaveLength(10);
    expect(markup).not.toContain('Lorem ipsum');
  },
);

test('Ancient contributions independently color map markers before their grouped Finding unlocks', () => {
  const sol = mapSystems.find((system) => system.id === 'sol')!;
  const epsilon = mapSystems.find((system) => system.id === 'epsilon-eridani')!;
  expect(markerColors(sol, new Set(['ancient-mysteries-human']))).toEqual({
    core: 'var(--shapeships-grey-70)', ring: 'var(--shapeships-grey-50)', outer: speciesColors.ancient,
  });
  expect(markerColors(epsilon, new Set(['ancient-mysteries-centaur'])).core).toBe(speciesColors.ancient);
  expect(markerColors(epsilon, new Set(['ancient-mysteries-centaur'])).ring).toBe(speciesColors.centaur);
  for (const id of MULTI_MISSION_FINDING_REQUIREMENTS['ancient-mysteries']) {
    const markup = renderToStaticMarkup(createElement(MissionFindingsView, { completedFindingIds: new Set([id]) }));
    expect(markup).toContain('aria-label="0 of 10 Mission Findings unlocked"');
    expect(markup).toContain('data-finding-id="ancient-mysteries" data-finding-unlocked="false"');
    if (id === 'ancient-mysteries-xenite') expect(markup).toContain('data-system-marker="unknown" data-unlocked="true"');
  }
});

test('locked cards retain authored layout text with accessible hiding and a named lock state', () => {
  for (const finding of missionFindings) {
    const locked = renderToStaticMarkup(createElement(MissionFindingCard, { finding, unlocked: false }));
    const unlocked = renderToStaticMarkup(createElement(MissionFindingCard, { finding, unlocked: true }));
    expect(locked).toContain('class="invisible" aria-hidden="true"');
    expect(locked).toContain(finding.topic.replaceAll('&', '&amp;').replaceAll("'", '&#x27;'));
    expect(locked).toContain(', locked"');
    expect(locked).toContain('LOCKED');
    expect(unlocked).not.toContain('class="invisible"');
    expect(unlocked).not.toContain('LOCKED');
  }
});

test('desktop geometry follows Lore width, grows for wrapped cards and maintains stack clearances', () => {
  expect(createMissionMapLayout(651, 719).desktop).toBe(false);
  expect(createMissionMapLayout(652, 720).desktop).toBe(true);
  for (const [width, loreWidth] of [[652, 720], [932, 1040]]) {
    const layout = createMissionMapLayout(width, loreWidth, {
      'groombridge': 160, 'tau-ceti': 192, 'betelgeuse': 160, 'gamma-leporis': 144,
      'delta-aquarii': 144, 'barnards-star': 160, 'sol-1': 112, 'proxima-centauri': 144,
    });
    const right = ['delta-aquarii', 'barnards-star', 'sol-1', 'proxima-centauri'].map((id) => layout.cards[id]);
    for (let i = 1; i < right.length; i++) expect(right[i].y - right[i - 1].y - right[i - 1].height).toBeCloseTo(20);
    expect(layout.unknown.y).toBeGreaterThan(right[3].y + right[3].height);
    for (const card of Object.values(layout.cards)) {
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(width);
      expect(card.y + card.height).toBeLessThan(layout.height - 40);
    }
  }
});

test('stored legacy completion cannot color Groombridge or contribute to the rendered count', () => {
  const markup = renderToStaticMarkup(createElement(MissionFindingsView, { completedFindingIds: new Set(['mintaka']) }));
  expect(markup).toContain('aria-label="0 of 10 Mission Findings unlocked"');
  expect(markup).toContain('data-system-marker="groombridge" data-unlocked="false"');
});
