import { useCallback, useState } from 'react';
import {
  useHoverPanelPresence,
  type HoverPanelMotionState,
} from '../../shared/useHoverPanelPresence';

export type BoardStatHoverKey =
  | 'my-last-damage'
  | 'opponent-last-damage'
  | 'my-last-healing'
  | 'opponent-last-healing'
  | 'my-bonus'
  | 'opponent-bonus';

export interface BoardStatHoverState {
  activeKey: BoardStatHoverKey | null;
  anchorRect: DOMRect | null;
}

export interface BoardStatHoverController {
  state: BoardStatHoverState;
  presentState: BoardStatHoverState;
  motionState: HoverPanelMotionState | null;
  onEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onLeave: (key: BoardStatHoverKey) => void;
}

const EMPTY_BOARD_STAT_HOVER_STATE: BoardStatHoverState = {
  activeKey: null,
  anchorRect: null,
};

export function useBoardStatHover(): BoardStatHoverController {
  const [state, setState] = useState<BoardStatHoverState>({
    activeKey: null,
    anchorRect: null,
  });
  const activePresenceState = state.activeKey && state.anchorRect ? state : null;
  const { presentValue, motionState } = useHoverPanelPresence(activePresenceState);

  const onEnter = useCallback((key: BoardStatHoverKey, anchorEl: HTMLElement) => {
    setState({
      activeKey: key,
      anchorRect: anchorEl.getBoundingClientRect(),
    });
  }, []);

  const onLeave = useCallback((key: BoardStatHoverKey) => {
    setState((prev) => {
      if (prev.activeKey !== key) {
        return prev;
      }

      return {
        activeKey: null,
        anchorRect: null,
      };
    });
  }, []);

  return {
    state,
    presentState: presentValue ?? EMPTY_BOARD_STAT_HOVER_STATE,
    motionState,
    onEnter,
    onLeave,
  };
}
