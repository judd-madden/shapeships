import { useLayoutEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { HoverPanelFrame } from './HoverPanelFrame';
import type { HoverPanelMotionState } from './useHoverPanelPresence';

export interface TurnPhaseHoverLabelValue {
  milestoneId: string;
  label: string;
  anchorRect: DOMRect;
}

interface TurnPhaseHoverLabelProps {
  value: TurnPhaseHoverLabelValue;
  motionState: HoverPanelMotionState | null;
}

const VIEWPORT_PADDING_PX = 0;
const HOVER_GAP_PX = -8;
const TAIL_PROTRUSION_PX = 12 / Math.sqrt(2);
const MIN_TAIL_INSET_PX = 12;

export function TurnPhaseHoverLabel({ value, motionState }: TurnPhaseHoverLabelProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const anchorCenterX = value.anchorRect.left + (value.anchorRect.width / 2);
  const [position, setPosition] = useState<{
    left: number;
    tailOffset: number | string;
    centred: boolean;
  }>({ left: anchorCenterX, tailOffset: '50%', centred: true });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const card = cardRef.current;
      if (!card) {
        return;
      }

      const cardWidth = card.getBoundingClientRect().width;
      const maxLeft = Math.max(
        VIEWPORT_PADDING_PX,
        window.innerWidth - VIEWPORT_PADDING_PX - cardWidth
      );
      const cardLeft = Math.min(
        maxLeft,
        Math.max(VIEWPORT_PADDING_PX, anchorCenterX - (cardWidth / 2))
      );
      const maxTailOffset = Math.max(MIN_TAIL_INSET_PX, cardWidth - MIN_TAIL_INSET_PX);
      const tailOffset = Math.min(
        maxTailOffset,
        Math.max(MIN_TAIL_INSET_PX, anchorCenterX - cardLeft)
      );

      setPosition({ left: cardLeft, tailOffset, centred: false });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [anchorCenterX, value.label]);

  const portalTarget = document.getElementById('ship-hover-layer');
  if (!portalTarget) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${position.left}px`,
        top: `${value.anchorRect.bottom + HOVER_GAP_PX + TAIL_PROTRUSION_PX}px`,
        transform: position.centred ? 'translateX(-50%)' : undefined,
      }}
    >
      <HoverPanelFrame
        ref={cardRef}
        role="tooltip"
        placement="bottom"
        motionDirection="bottom"
        motionState={motionState}
        tailOffset={position.tailOffset}
        data-turn-phase-milestone={value.milestoneId}
        className="w-max max-w-[calc(100vw-24px)] px-3 py-1.5 text-[16px] leading-normal text-[var(--shapeships-white)]"
      >
        {value.label}
      </HoverPanelFrame>
    </div>,
    portalTarget
  );
}
