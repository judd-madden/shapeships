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
  canAfford: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function CatalogueShipSlot({
  shipId,
  graphic,
  canAfford,
  onClick,
  children,
}: CatalogueShipSlotProps) {
  const opacity = canAfford ? 1 : 0.4;
  const cursor = canAfford ? 'pointer' : 'default';

  return (
    <div
      data-ship-id={shipId}
      style={{ opacity, cursor }}
      onClick={canAfford ? onClick : undefined}
      className="relative"
    >
      {graphic}
      {children}
    </div>
  );
}