/**
 * Catalogue Ship Slot
 * 
 * Wrapper component for individual ship entries in catalogue panels.
 * Handles affordability opacity and hover interaction.
 * 
 * PASS 1 - UI-only component
 */

import { createContext, type ReactNode } from 'react';
import type { ActionPanelBuildCatalogueViewModel } from '../../../../../client/gameSession/types';

export type CatalogueChallengeCondition =
  NonNullable<
    ActionPanelBuildCatalogueViewModel['catalogueChallengeIndicator']
  >['condition'];

export const CatalogueChallengeConditionContext =
  createContext<CatalogueChallengeCondition | null>(null);

interface CatalogueShipSlotProps {
  shipId: string;
  graphic: React.ReactNode;
  isDimmed: boolean;
  isClickable: boolean;
  enableGraphicHover?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  catalogueChallengeIndicator?: ActionPanelBuildCatalogueViewModel['catalogueChallengeIndicator'];
}

export function CatalogueShipSlot({
  shipId,
  graphic,
  isDimmed,
  isClickable,
  enableGraphicHover = false,
  onClick,
  children,
  catalogueChallengeIndicator = null,
}: CatalogueShipSlotProps) {
  const opacity = isDimmed ? 0.4 : 1;
  const cursor = isClickable ? 'pointer' : 'default';
  const challengeCondition =
    catalogueChallengeIndicator?.shipDefId === shipId
      ? catalogueChallengeIndicator.condition
      : null;

  return (
    <CatalogueChallengeConditionContext.Provider value={challengeCondition}>
      <div
        data-ship-id={shipId}
        data-catalogue-graphic-hover={enableGraphicHover ? '1' : undefined}
        style={{ opacity, cursor }}
        onClick={isClickable ? onClick : undefined}
        className="ss-catalogueShipSlot relative"
      >
        <div className="ss-catalogueShipGraphic">{graphic}</div>
        {children}
      </div>
    </CatalogueChallengeConditionContext.Provider>
  );
}
