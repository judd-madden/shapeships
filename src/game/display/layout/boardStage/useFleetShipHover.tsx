import { useCallback, useState } from 'react';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import {
  useHoverPanelPresence,
  type HoverPanelMotionState,
} from '../../shared/useHoverPanelPresence';

export interface FleetShipHoverState {
  activeShipId: ShipDefId | null;
  anchorRect: DOMRect | null;
}

export interface FleetShipHoverController {
  state: FleetShipHoverState;
  presentState: FleetShipHoverState;
  motionState: HoverPanelMotionState | null;
  onEnter: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  onLeave: (shipId: ShipDefId) => void;
}

const EMPTY_FLEET_SHIP_HOVER_STATE: FleetShipHoverState = {
  activeShipId: null,
  anchorRect: null,
};

export function useFleetShipHover(): FleetShipHoverController {
  const [state, setState] = useState<FleetShipHoverState>({
    activeShipId: null,
    anchorRect: null,
  });
  const activePresenceState = state.activeShipId && state.anchorRect ? state : null;
  const { presentValue, motionState } = useHoverPanelPresence(activePresenceState);

  const onEnter = useCallback((shipId: ShipDefId, anchorEl: HTMLElement) => {
    setState({
      activeShipId: shipId,
      anchorRect: anchorEl.getBoundingClientRect(),
    });
  }, []);

  const onLeave = useCallback((shipId: ShipDefId) => {
    setState((prev) => {
      if (prev.activeShipId !== shipId) {
        return prev;
      }

      return {
        activeShipId: null,
        anchorRect: null,
      };
    });
  }, []);

  return {
    state,
    presentState: presentValue ?? EMPTY_FLEET_SHIP_HOVER_STATE,
    motionState,
    onEnter,
    onLeave,
  };
}
