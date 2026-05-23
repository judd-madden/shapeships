import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type AnchoredHoverPlacement = 'top' | 'left' | 'bottom';
export type AnchoredHoverPlacementMode = 'anchored' | 'mobile-viewport-centered';

export interface AnchoredHoverPlacementOptions {
  preferredPlacement?: 'top' | 'bottom';
  mode?: AnchoredHoverPlacementMode;
}

export interface AnchoredHoverPlacementResult {
  placement: AnchoredHoverPlacement;
  anchorX: number;
  anchorY: number;
  cardTransform: string;
  cardRef: RefObject<HTMLDivElement | null>;
  cardLeft?: number;
  cardWidth?: number;
  tailX?: number;
}

const VIEWPORT_PADDING_PX = 12;
const HOVER_GAP_PX = 8;
const TAIL_PROTRUSION_PX = 12 / Math.sqrt(2);
const MOBILE_CARD_SIDE_PADDING_PX = 16;
const MOBILE_TAIL_INSET_PX = 24;
const MOBILE_TAIL_X_OFFSET_PX = -5;
const MOBILE_MATERIAL_ROOM_DELTA_PX = 32;

export function useAnchoredHoverPlacement(
  anchorRect: DOMRect,
  options: AnchoredHoverPlacementOptions = {}
): AnchoredHoverPlacementResult {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<AnchoredHoverPlacement>('top');
  const preferredPlacement = options.preferredPlacement;
  const mode = options.mode ?? 'anchored';
  const viewportWidth = typeof window === 'undefined' ? 360 : window.innerWidth;
  const mobileCardLeft = MOBILE_CARD_SIDE_PADDING_PX;
  const mobileCardWidth = Math.max(0, viewportWidth - (MOBILE_CARD_SIDE_PADDING_PX * 2));
  const anchorCenterX = anchorRect.left + (anchorRect.width / 2);
  const unclampedTailX = anchorCenterX - mobileCardLeft + MOBILE_TAIL_X_OFFSET_PX;
  const mobileTailMaxX = Math.max(MOBILE_TAIL_INSET_PX, mobileCardWidth - MOBILE_TAIL_INSET_PX);
  const mobileTailX = Math.min(
    mobileTailMaxX,
    Math.max(MOBILE_TAIL_INSET_PX, unclampedTailX)
  );

  useLayoutEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl) {
      return;
    }

    const cardRect = cardEl.getBoundingClientRect();
    const topAnchorY = anchorRect.top - HOVER_GAP_PX - TAIL_PROTRUSION_PX;
    const bottomAnchorY = anchorRect.bottom + HOVER_GAP_PX + TAIL_PROTRUSION_PX;
    const topAvailableRoom = topAnchorY - VIEWPORT_PADDING_PX;
    const bottomAvailableRoom = window.innerHeight - VIEWPORT_PADDING_PX - bottomAnchorY;
    const topFits = topAvailableRoom >= cardRect.height;
    const bottomFits = bottomAvailableRoom >= cardRect.height;
    const requestedPlacement = preferredPlacement ?? 'top';

    let nextPlacement: AnchoredHoverPlacement;
    if (mode === 'mobile-viewport-centered') {
      if (requestedPlacement === 'bottom') {
        if (bottomFits) {
          nextPlacement = 'bottom';
        } else if (topFits) {
          nextPlacement = 'top';
        } else {
          nextPlacement =
            topAvailableRoom > bottomAvailableRoom + MOBILE_MATERIAL_ROOM_DELTA_PX
              ? 'top'
              : 'bottom';
        }
      } else if (topFits) {
        nextPlacement = 'top';
      } else if (bottomFits) {
        nextPlacement = 'bottom';
      } else {
        nextPlacement =
          bottomAvailableRoom > topAvailableRoom + MOBILE_MATERIAL_ROOM_DELTA_PX
            ? 'bottom'
            : 'top';
      }
    } else if (preferredPlacement === 'bottom') {
      nextPlacement = bottomFits ? 'bottom' : topFits ? 'top' : 'left';
    } else if (preferredPlacement === 'top') {
      nextPlacement = topFits ? 'top' : bottomFits ? 'bottom' : 'left';
    } else {
      nextPlacement = topFits ? 'top' : 'left';
    }

    setPlacement((currentPlacement) =>
      currentPlacement === nextPlacement ? currentPlacement : nextPlacement
    );
  });

  if (mode === 'mobile-viewport-centered') {
    if (placement === 'bottom') {
      return {
        placement,
        anchorX: mobileCardLeft,
        anchorY: anchorRect.bottom + HOVER_GAP_PX + TAIL_PROTRUSION_PX,
        cardTransform: 'translateY(0)',
        cardRef,
        cardLeft: mobileCardLeft,
        cardWidth: mobileCardWidth,
        tailX: mobileTailX,
      };
    }

    return {
      placement: 'top',
      anchorX: mobileCardLeft,
      anchorY: anchorRect.top - HOVER_GAP_PX - TAIL_PROTRUSION_PX,
      cardTransform: 'translateY(-100%)',
      cardRef,
      cardLeft: mobileCardLeft,
      cardWidth: mobileCardWidth,
      tailX: mobileTailX,
    };
  }

  if (placement === 'left') {
    return {
      placement,
      anchorX: anchorRect.left - HOVER_GAP_PX - TAIL_PROTRUSION_PX,
      anchorY: anchorRect.top + (anchorRect.height / 2),
      cardTransform: 'translate(-100%, -50%)',
      cardRef,
    };
  }

  if (placement === 'bottom') {
    return {
      placement,
      anchorX: anchorRect.left + (anchorRect.width / 2),
      anchorY: anchorRect.bottom + HOVER_GAP_PX + TAIL_PROTRUSION_PX,
      cardTransform: 'translate(-50%, 0)',
      cardRef,
    };
  }

  return {
    placement,
    anchorX: anchorRect.left + (anchorRect.width / 2),
    anchorY: anchorRect.top - HOVER_GAP_PX - TAIL_PROTRUSION_PX,
    cardTransform: 'translate(-50%, -100%)',
    cardRef,
  };
}
