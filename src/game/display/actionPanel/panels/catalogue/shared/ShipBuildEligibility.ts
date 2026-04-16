import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import type { ActionPanelBuildCatalogueViewModel } from '../../../../../client/gameSession/types';

export type ShipEligibilityState =
  | 'CAN_BUILD'
  | 'NEED_COMPONENTS'
  | 'NOT_ENOUGH_LINES'
  | 'MAX_LIMIT'
  | 'BUILD_STATE_UNAVAILABLE'
  | 'REFERENCE_ONLY';

export interface ShipEligibility {
  state: ShipEligibilityState;
  missingComponentShipIds?: string[];
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
    return { state: 'BUILD_STATE_UNAVAILABLE' };
  }

  const eligibility = buildCatalogue.eligibilityByShipId[shipId];
  if (!eligibility) {
    return { state: 'NOT_ENOUGH_LINES' };
  }

  return {
    state: eligibility.state,
    missingComponentShipIds: eligibility.missingComponentTokens,
  };
}
