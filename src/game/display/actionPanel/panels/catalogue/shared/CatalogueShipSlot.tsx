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
  onClick?: () => void;
  children?: React.ReactNode;
}

export function CatalogueShipSlot({
  shipId,
  graphic,
  isDimmed,
  isClickable,
  onClick,
  children,
}: CatalogueShipSlotProps) {
  const opacity = isDimmed ? 0.4 : 1;
  const cursor = isClickable ? 'pointer' : 'default';

  return (
    <div
      data-ship-id={shipId}
      style={{ opacity, cursor }}
      onClick={isClickable ? onClick : undefined}
      className="relative"
    >
      {graphic}
      {children}
    </div>
  );
}
