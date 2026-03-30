import { useCallback, useState } from 'react';

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
  onEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onLeave: (key: BoardStatHoverKey) => void;
}

export function useBoardStatHover(): BoardStatHoverController {
  const [state, setState] = useState<BoardStatHoverState>({
    activeKey: null,
    anchorRect: null,
  });

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
    onEnter,
    onLeave,
  };
}
