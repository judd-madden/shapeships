/**
 * Catalogue Ship Slot
 * 
 * Wrapper component for individual ship entries in catalogue panels.
 * Handles affordability opacity and hover interaction.
 * 
 * PASS 1 - UI-only component
 */

import type React from 'react';

interface CatalogueShipSlotProps {
  shipId: string;
  graphic: React.ReactNode;
  isDimmed: boolean;
  isClickable: boolean;
  enableGraphicHover?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function CatalogueShipSlot({
  shipId,
  graphic,
  isDimmed,
  isClickable,
  enableGraphicHover = false,
  onClick,
  children,
}: CatalogueShipSlotProps) {
  const opacity = isDimmed ? 0.4 : 1;
  const cursor = isClickable ? 'pointer' : 'default';

  return (
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
  );
}
