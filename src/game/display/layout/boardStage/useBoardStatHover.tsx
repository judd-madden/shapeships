import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  useHoverPanelPresence,
  type HoverPanelMotionState,
} from '../../shared/useHoverPanelPresence';

export type BoardStatHoverKey =
  | 'my-health'
  | 'opponent-health'
  | 'my-current'
  | 'opponent-current'
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
  onFocus: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onBlur: (key: BoardStatHoverKey) => void;
  onCardEnter: (key: BoardStatHoverKey) => void;
  onCardLeave: (key: BoardStatHoverKey) => void;
  onCardFocus: (key: BoardStatHoverKey) => void;
  onCardBlur: (key: BoardStatHoverKey) => void;
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
  const anchorRef = useRef<HTMLElement | null>(null);
  const pointerKey = useRef<BoardStatHoverKey | null>(null);
  const focusKey = useRef<BoardStatHoverKey | null>(null);
  const cardPointerActive = useRef(false);
  const cardFocusActive = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const onEnter = useCallback((key: BoardStatHoverKey, anchorEl: HTMLElement) => {
    cancelClose();
    pointerKey.current = key;
    anchorRef.current = anchorEl;
    setState({
      activeKey: key,
      anchorRect: anchorEl.getBoundingClientRect(),
    });
  }, [cancelClose]);

  const scheduleClose = useCallback((key: BoardStatHoverKey) => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      if ([pointerKey.current, focusKey.current].includes(key) || cardPointerActive.current || cardFocusActive.current) return;
      setState((prev) => prev.activeKey === key ? EMPTY_BOARD_STAT_HOVER_STATE : prev);
    }, 150);
  }, [cancelClose]);

  const onLeave = useCallback((key: BoardStatHoverKey) => {
    if (pointerKey.current === key) pointerKey.current = null;
    scheduleClose(key);
  }, [scheduleClose]);

  const onFocus = useCallback((key: BoardStatHoverKey, anchorEl: HTMLElement) => {
    cancelClose();
    focusKey.current = key;
    anchorRef.current = anchorEl;
    setState({ activeKey: key, anchorRect: anchorEl.getBoundingClientRect() });
  }, [cancelClose]);

  const onBlur = useCallback((key: BoardStatHoverKey) => {
    if (focusKey.current === key) focusKey.current = null;
    scheduleClose(key);
  }, [scheduleClose]);

  const onCardEnter = useCallback(() => {
    cancelClose();
    cardPointerActive.current = true;
  }, [cancelClose]);
  const onCardLeave = useCallback((key: BoardStatHoverKey) => {
    cardPointerActive.current = false;
    scheduleClose(key);
  }, [scheduleClose]);
  const onCardFocus = useCallback(() => {
    cancelClose();
    cardFocusActive.current = true;
  }, [cancelClose]);
  const onCardBlur = useCallback((key: BoardStatHoverKey) => {
    cardFocusActive.current = false;
    scheduleClose(key);
  }, [scheduleClose]);

  const refreshAnchor = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor?.isConnected || (anchor instanceof HTMLButtonElement && anchor.disabled)) {
      pointerKey.current = null;
      focusKey.current = null;
      cardPointerActive.current = false;
      cardFocusActive.current = false;
      setState((prev) => prev.activeKey ? EMPTY_BOARD_STAT_HOVER_STATE : prev);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setState((prev) => {
      const old = prev.anchorRect;
      return !prev.activeKey || (old?.left === rect.left && old.top === rect.top &&
        old.width === rect.width && old.height === rect.height)
        ? prev : { ...prev, anchorRect: rect };
    });
  }, []);

  // Content changes can move the anchor without changing the trigger's own size.
  useLayoutEffect(refreshAnchor);
  useEffect(() => {
    if (!state.activeKey) return;
    const observer = new ResizeObserver(refreshAnchor);
    let element = anchorRef.current;
    while (element) {
      observer.observe(element);
      if (element.dataset.name === 'Board Stage') {
        const placeholders = element.querySelector('[data-name="Inactive Health Bar Placeholders"]');
        if (placeholders) observer.observe(placeholders);
        break;
      }
      element = element.parentElement;
    }
    window.addEventListener('resize', refreshAnchor);
    window.addEventListener('scroll', refreshAnchor, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refreshAnchor);
      window.removeEventListener('scroll', refreshAnchor, true);
    };
  }, [state.activeKey, refreshAnchor]);
  useEffect(() => cancelClose, [cancelClose]);

  return {
    state,
    presentState: activePresenceState ?? presentValue ?? EMPTY_BOARD_STAT_HOVER_STATE,
    motionState: activePresenceState && activePresenceState !== presentValue
      ? 'entering'
      : motionState,
    onEnter,
    onLeave,
    onFocus,
    onBlur,
    onCardEnter,
    onCardLeave,
    onCardFocus,
    onCardBlur,
  };
}
