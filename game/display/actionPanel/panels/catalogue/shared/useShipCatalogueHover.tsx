/**
 * Ship Catalogue Hover Hook
 * 
 * Global hover state controller for ship catalogue panels.
 * Tracks active ship and anchor element for portal-based hover cards.
 * 
 * PASS 2: Simple on/off hover (no mouse-following)
 */

import { useState, useCallback } from 'react';
import type { ShipDefId } from '../../../../../types/ShipTypes.engine';

/**
 * Hover state
 */
export interface ShipCatalogueHoverState {
  /** Currently hovered ship ID (null if no hover) */
  activeShipId: ShipDefId | null;
  
  /** Bounding rect of anchor element (for positioning) */
  anchorRect: DOMRect | null;
}

/**
 * Hover state controller API
 */
export interface ShipCatalogueHoverController {
  /** Current hover state */
  state: ShipCatalogueHoverState;
  
  /** Enter hover (show card) */
  onEnter: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  
  /** Leave hover (hide card) */
  onLeave: (shipId: ShipDefId) => void;
}

/**
 * Hook for ship catalogue hover state
 * 
 * Usage:
 * ```tsx
 * const hover = useShipCatalogueHover();
 * 
 * <div
 *   onMouseEnter={(e) => hover.onEnter('DEF', e.currentTarget)}
 *   onMouseLeave={() => hover.onLeave('DEF')}
 * >
 *   Ship hitbox
 * </div>
 * 
 * {hover.state.activeShipId && (
 *   <ShipHoverCard
 *     shipId={hover.state.activeShipId}
 *     anchorRect={hover.state.anchorRect!}
 *   />
 * )}
 * ```
 */
export function useShipCatalogueHover(): ShipCatalogueHoverController {
  const [state, setState] = useState<ShipCatalogueHoverState>({
    activeShipId: null,
    anchorRect: null
  });
  
  const onEnter = useCallback((shipId: ShipDefId, anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    setState({
      activeShipId: shipId,
      anchorRect: rect
    });
  }, []);
  
  const onLeave = useCallback((shipId: ShipDefId) => {
    // Only clear if leaving the currently active ship
    setState(prev => {
      if (prev.activeShipId === shipId) {
        return { activeShipId: null, anchorRect: null };
      }
      return prev;
    });
  }, []);
  
  return {
    state,
    onEnter,
    onLeave
  };
}