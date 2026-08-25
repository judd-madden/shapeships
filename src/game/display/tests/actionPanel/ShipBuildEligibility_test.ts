declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  getCatalogueDisplayCost,
  getShipEligibilityForHover,
  shouldDimCatalogueShip,
} from '../../actionPanel/panels/catalogue/shared/ShipBuildEligibility';
import type { ActionPanelBuildCatalogueViewModel } from '../../../client/gameSession/types';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
    );
  }
}

function makeBuildCatalogue(args: {
  context: 'buildable' | 'reference_only' | 'unavailable';
  unavailableExplanation: 'build_in_drawing_phase' | null;
  canAddShip?: boolean;
  displayCost?: number;
}): ActionPanelBuildCatalogueViewModel {
  return {
    context: args.context,
    unavailableExplanation: args.unavailableExplanation,
    canAddShipById: { FIG: args.canAddShip === true },
    displayCostByShipId: args.displayCost === undefined ? {} : { FIG: args.displayCost },
    eligibilityByShipId: args.canAddShip === undefined
      ? {}
      : {
          FIG: {
            state: args.canAddShip ? 'CAN_BUILD' : 'NOT_ENOUGH_LINES',
          },
    },
    catalogueChallengeIndicator: null,
  };
}

Deno.test('catalogue display cost preserves projected cost outside reference mode', () => {
  const fallbackCost = 8;

  for (const context of ['buildable', 'unavailable'] as const) {
    assertEquals(
      getCatalogueDisplayCost({
        shipId: 'FIG',
        fallbackCost,
        buildCatalogue: makeBuildCatalogue({
          context,
          unavailableExplanation: context === 'unavailable' ? 'build_in_drawing_phase' : null,
          displayCost: 5,
        }),
      }),
      5,
      `${context} catalogues should consume the existing projected display cost`
    );
  }

  assertEquals(
    getCatalogueDisplayCost({
      shipId: 'FIG',
      fallbackCost,
      buildCatalogue: makeBuildCatalogue({
        context: 'reference_only',
        unavailableExplanation: null,
        displayCost: 5,
      }),
    }),
    fallbackCost,
    'reference-only catalogues should keep the printed cost'
  );
});

Deno.test('explicit reference inspection keeps printed cost for mobile presentation', () => {
  assertEquals(
    getCatalogueDisplayCost({
      shipId: 'FIG',
      fallbackCost: 8,
      buildCatalogue: makeBuildCatalogue({
        context: 'unavailable',
        unavailableExplanation: 'build_in_drawing_phase',
        displayCost: 5,
      }),
      referenceOnly: true,
    }),
    8,
    'explicit reference inspection should override a live projected cost'
  );
});

Deno.test('temporary unavailable catalogue dims ships without misleading explanation', () => {
  assertEquals(
    shouldDimCatalogueShip({ context: 'unavailable', canAddShip: true }),
    true,
    'unavailable presentation should dim even provisionally eligible ships'
  );
  assertEquals(
    getShipEligibilityForHover({
      shipId: 'FIG',
      buildCatalogue: makeBuildCatalogue({
        context: 'unavailable',
        unavailableExplanation: null,
      }),
    }),
    { state: 'BUILD_STATE_UNAVAILABLE', unavailableExplanation: null },
    'the temporary dice hold should not claim that Drawing is unavailable'
  );
});

Deno.test('restored buildable catalogue uses normal per-ship eligibility for opacity', () => {
  assertEquals(
    shouldDimCatalogueShip({ context: 'buildable', canAddShip: true }),
    false,
    'eligible ships should return to full opacity after settlement'
  );
  assertEquals(
    shouldDimCatalogueShip({ context: 'buildable', canAddShip: false }),
    true,
    'ineligible ships should remain dimmed after settlement'
  );
});

Deno.test('unrelated unavailable and reference catalogue presentation remains unchanged', () => {
  assertEquals(
    getShipEligibilityForHover({
      shipId: 'FIG',
      buildCatalogue: makeBuildCatalogue({
        context: 'unavailable',
        unavailableExplanation: 'build_in_drawing_phase',
      }),
    }),
    {
      state: 'BUILD_STATE_UNAVAILABLE',
      unavailableExplanation: 'build_in_drawing_phase',
    },
    'ordinary unavailable catalogues should retain their existing explanation'
  );
  assertEquals(
    shouldDimCatalogueShip({ context: 'reference_only', canAddShip: false }),
    false,
    'reference-only catalogues should retain their normal appearance'
  );
});
