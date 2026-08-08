import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import type { HoverPanelMotionState } from './useHoverPanelPresence';

export type HoverPanelPlacement = 'top' | 'bottom' | 'left' | 'right';

interface HoverPanelFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode;
  placement: HoverPanelPlacement;
  motionState?: HoverPanelMotionState | null;
  motionDirection?: HoverPanelPlacement;
  tailOffset?: CSSProperties['left'];
  interactive?: boolean;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

function getTailStyle(
  placement: HoverPanelPlacement,
  tailOffset: CSSProperties['left']
): CSSProperties {
  const resolvedOffset = tailOffset ?? '50%';

  switch (placement) {
    case 'bottom':
      return {
        left: resolvedOffset,
        top: '-0px',
        transform: 'translateX(calc(-50% - 2px))',
        borderLeftWidth: '1px',
        borderTopWidth: '1px',
      };
    case 'left':
      return {
        right: '-2px',
        top: resolvedOffset,
        transform: 'translateY(-50%)',
        borderRightWidth: '1px',
        borderTopWidth: '1px',
      };
    case 'right':
      return {
        left: '-10px',
        top: resolvedOffset,
        transform: 'translateY(-50%)',
        borderBottomWidth: '1px',
        borderLeftWidth: '1px',
      };
    case 'top':
    default:
      return {
        bottom: '-11px',
        left: resolvedOffset,
        transform: 'translateX(calc(-50% - 2px))',
        borderBottomWidth: '1px',
        borderRightWidth: '1px',
      };
  }
}

export const HoverPanelFrame = forwardRef<HTMLDivElement, HoverPanelFrameProps>(
  function HoverPanelFrame(
    {
      children,
      placement,
      motionState,
      motionDirection = placement,
      tailOffset,
      interactive = false,
      className,
      style,
      ...props
    },
    ref
  ) {
    const hasMotion = motionState != null;

    return (
      <div
        ref={ref}
        className={cx(
          hasMotion && 'ss-hoverPanelMotion',
          'relative rounded-[10px] bg-[var(--shapeships-grey-90)]',
          className
        )}
        data-hover-panel-motion-direction={hasMotion ? motionDirection : undefined}
        data-hover-panel-motion-state={motionState ?? undefined}
        style={{ pointerEvents: interactive ? 'auto' : 'none', ...style }}
        {...props}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[10px] border border-solid border-[var(--shapeships-grey-70)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-[12px] rotate-45 border-solid border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)]"
          style={getTailStyle(placement, tailOffset)}
        />
        {children}
      </div>
    );
  }
);
