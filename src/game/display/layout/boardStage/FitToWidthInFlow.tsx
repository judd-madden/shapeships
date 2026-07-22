import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const SCALE_CHANGE_EPSILON = 0.001;
const HEIGHT_CHANGE_EPSILON_PX = 0.5;
const FIT_TRANSITION = '400ms ease-out';

type FlowFitLayout = {
  scale: number;
  flowHeight: number;
};

export function FitToWidthInFlow({
  children,
  minScale,
  className,
  overflowVisible = false,
}: {
  children: ReactNode;
  minScale: number;
  className?: string;
  overflowVisible?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerMeasureRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<FlowFitLayout>({
    scale: 1,
    flowHeight: 0,
  });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerMeasureRef.current;
    if (!outer || !inner) return;

    const compute = () => {
      const availableWidth = outer.clientWidth;
      const intrinsicWidth = inner.offsetWidth;
      const intrinsicHeight = inner.offsetHeight;
      if (availableWidth <= 0 || intrinsicWidth <= 0 || intrinsicHeight <= 0) {
        setLayout((previous) =>
          previous.flowHeight === 0 ? previous : { scale: 1, flowHeight: 0 }
        );
        return;
      }

      const scale = Math.max(minScale, Math.min(1, availableWidth / intrinsicWidth));
      const flowHeight = intrinsicHeight * scale;
      setLayout((previous) =>
        Math.abs(previous.scale - scale) < SCALE_CHANGE_EPSILON &&
        Math.abs(previous.flowHeight - flowHeight) < HEIGHT_CHANGE_EPSILON_PX
          ? previous
          : { scale, flowHeight }
      );
    };

    compute();
    const resizeObserver = new ResizeObserver(compute);
    resizeObserver.observe(outer);
    resizeObserver.observe(inner);
    return () => resizeObserver.disconnect();
  }, [minScale]);

  const overflow = overflowVisible ? 'visible' : 'hidden';

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        width: '100%',
        height: `${layout.flowHeight}px`,
        overflow,
        position: 'relative',
        transition: `height ${FIT_TRANSITION}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          display: 'flex',
          justifyContent: 'center',
          overflow,
        }}
      >
        <div
          style={{
            transform: `scale(${layout.scale})`,
            transformOrigin: 'top center',
            transition: `transform ${FIT_TRANSITION}`,
          }}
        >
          <div ref={innerMeasureRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}
