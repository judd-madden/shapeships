import { useCallback, useState } from 'react';
import type { ShipDefId } from '../../types/ShipTypes.engine';

export interface FleetShipHoverState {
  activeShipId: ShipDefId | null;
  anchorRect: DOMRect | null;
}

export interface FleetShipHoverController {
  state: FleetShipHoverState;
  onEnter: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  onLeave: (shipId: ShipDefId) => void;
}

export function useFleetShipHover(): FleetShipHoverController {
  const [state, setState] = useState<FleetShipHoverState>({
    activeShipId: null,
    anchorRect: null,
  });

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
    onEnter,
    onLeave,
  };
}
