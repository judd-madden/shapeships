declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  ACTION_PANEL_IDS,
  isActionPanelId,
} from '../../actionPanel/ActionPanelRegistry';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`values differ\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

Deno.test('Drawing Prelude exposes one registered Carrier action panel', () => {
  const carrierPanelIds = ACTION_PANEL_IDS.filter((id) => id.includes('carrier'));
  assertEquals(carrierPanelIds, ['ap.build.drawing.prelude.carrier']);
  assert(isActionPanelId('ap.build.drawing.prelude.carrier'));
});
