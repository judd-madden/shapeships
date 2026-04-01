import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type AnchoredHoverPlacement = 'top' | 'left';

export interface AnchoredHoverPlacementResult {
  placement: AnchoredHoverPlacement;
  anchorX: number;
  anchorY: number;
  cardTransform: string;
  cardRef: RefObject<HTMLDivElement | null>;
}

const VIEWPORT_PADDING_PX = 12;
const HOVER_GAP_PX = 8;
const TAIL_PROTRUSION_PX = 12 / Math.sqrt(2);

export function useAnchoredHoverPlacement(anchorRect: DOMRect): AnchoredHoverPlacementResult {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<AnchoredHoverPlacement>('top');

  useLayoutEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl) {
      return;
    }

    const cardRect = cardEl.getBoundingClientRect();
    const topAnchorY = anchorRect.top - HOVER_GAP_PX - TAIL_PROTRUSION_PX;
    const topPlacementEdge = topAnchorY - cardRect.height;
    const nextPlacement: AnchoredHoverPlacement =
      topPlacementEdge < VIEWPORT_PADDING_PX ? 'left' : 'top';

    setPlacement((currentPlacement) =>
      currentPlacement === nextPlacement ? currentPlacement : nextPlacement
    );
  });

  if (placement === 'left') {
    return {
      placement,
      anchorX: anchorRect.left - HOVER_GAP_PX - TAIL_PROTRUSION_PX,
      anchorY: anchorRect.top + (anchorRect.height / 2),
      cardTransform: 'translate(-100%, -50%)',
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
