import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import type { ActionPanelBuildCatalogueViewModel } from '../../../../../client/gameSession/types';

export type ShipEligibilityState =
  | 'CAN_BUILD'
  | 'NEED_COMPONENTS'
  | 'NOT_ENOUGH_LINES'
  | 'MAX_LIMIT'
  | 'RULE_RESTRICTED'
  | 'BUILD_STATE_UNAVAILABLE'
  | 'REFERENCE_ONLY';

export interface ShipEligibility {
  state: ShipEligibilityState;
  missingComponentShipIds?: string[];
  restrictionReason?: 'FOREIGN_BASIC';
  unavailableExplanation?: ActionPanelBuildCatalogueViewModel['unavailableExplanation'];
}

export function getCatalogueDisplayCost(args: {
  shipId: ShipDefId;
  fallbackCost: number;
  buildCatalogue: ActionPanelBuildCatalogueViewModel;
  referenceOnly?: boolean;
}): number {
  const { shipId, fallbackCost, buildCatalogue, referenceOnly = false } = args;

  if (referenceOnly || buildCatalogue.context === 'reference_only') {
    return fallbackCost;
  }

  return buildCatalogue.displayCostByShipId[shipId] ?? fallbackCost;
}

export function shouldDimCatalogueShip(args: {
  context: ActionPanelBuildCatalogueViewModel['context'];
  canAddShip: boolean;
}): boolean {
  return (
    args.context === 'unavailable' ||
    (args.context === 'buildable' && !args.canAddShip)
  );
}

export function shouldEnableCatalogueGraphicHover(args: {
  context: ActionPanelBuildCatalogueViewModel['context'];
  canAddShip: boolean;
  hoverDisabled?: boolean;
}): boolean {
  if (args.hoverDisabled) {
    return false;
  }

  if (args.context === 'reference_only') {
    return true;
  }

  if (args.context === 'buildable') {
    return args.canAddShip;
  }

  return false;
}

export function getShipEligibilityForHover(args: {
  shipId: ShipDefId;
  buildCatalogue: ActionPanelBuildCatalogueViewModel;
}): ShipEligibility {
  const { shipId, buildCatalogue } = args;

  if (buildCatalogue.context === 'reference_only') {
    return { state: 'REFERENCE_ONLY' };
  }

  if (buildCatalogue.context === 'unavailable') {
    return {
      state: 'BUILD_STATE_UNAVAILABLE',
      unavailableExplanation: buildCatalogue.unavailableExplanation,
    };
  }

  const eligibility = buildCatalogue.eligibilityByShipId[shipId];
  if (!eligibility) {
    return { state: 'NOT_ENOUGH_LINES' };
  }

  return {
    state: eligibility.state,
    missingComponentShipIds: eligibility.missingComponentTokens,
    restrictionReason: eligibility.restrictionReason,
  };
}
