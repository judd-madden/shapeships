/**
 * Ship Catalogue Hover Hook
 * 
 * Global hover state controller for ship catalogue panels.
 * Tracks active ship and anchor element for portal-based hover cards.
 * 
 * PASS 2: Simple on/off hover (no mouse-following)
 */

import { useState, useCallback, useEffect } from 'react';
import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import {
  useHoverPanelPresence,
  type HoverPanelMotionState,
} from '../../../../shared/useHoverPanelPresence';

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

  /** Rendered hover state, retained briefly for exit animation */
  presentState: ShipCatalogueHoverState;

  /** Visual motion state for the rendered hover card */
  motionState: HoverPanelMotionState | null;
  
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
 * {hover.presentState.activeShipId && (
 *   <ShipHoverCard
 *     shipId={hover.presentState.activeShipId}
 *     anchorRect={hover.presentState.anchorRect!}
 *   />
 * )}
 * ```
 */
const EMPTY_HOVER_STATE: ShipCatalogueHoverState = {
  activeShipId: null,
  anchorRect: null,
};

export function useShipCatalogueHover(disabled?: boolean): ShipCatalogueHoverController {
  const [state, setState] = useState<ShipCatalogueHoverState>({
    activeShipId: null,
    anchorRect: null
  });
  const activePresenceState = state.activeShipId && state.anchorRect ? state : null;
  const { presentValue, motionState } = useHoverPanelPresence(activePresenceState);

  useEffect(() => {
    if (!disabled) {
      return;
    }

    setState({
      activeShipId: null,
      anchorRect: null
    });
  }, [disabled]);
  
  const onEnter = useCallback((shipId: ShipDefId, anchorEl: HTMLElement) => {
    if (disabled) {
      return;
    }

    const rect = anchorEl.getBoundingClientRect();
    setState({
      activeShipId: shipId,
      anchorRect: rect
    });
  }, [disabled]);
  
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
    presentState: presentValue ?? EMPTY_HOVER_STATE,
    motionState,
    onEnter,
    onLeave
  };
}
