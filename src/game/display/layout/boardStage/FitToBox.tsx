import React, { useLayoutEffect, useRef, useState } from 'react';

type FitToBoxProps = {
  children: React.ReactNode;
  minScale?: number; // default 0.4
  maxScale?: number; // default 1
  className?: string;
  contentAlign?: 'start' | 'center' | 'end';
  overflowVisible?: boolean;
  initialScale?: number;
  animateScale?: boolean;
  measureImmediatelyOnMount?: boolean;
  deferInnerResizeComputeMs?: number;
};

export function FitToBox({
  children,
  minScale = 0.4,
  maxScale = 1,
  className,
  contentAlign = 'center',
  overflowVisible = false,
  initialScale = 1,
  animateScale = true,
  measureImmediatelyOnMount = false,
  deferInnerResizeComputeMs = 0,
}: FitToBoxProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerMeasureRef = useRef<HTMLDivElement | null>(null);

  const rafRef = useRef<number | null>(null);
  const delayedTimeoutRef = useRef<number | null>(null);
  const innerResizeTimeoutRef = useRef<number | null>(null);
  const [scale, setScale] = useState(initialScale);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerMeasureRef.current;
    if (!outer || !inner) return;
    let initialComputePending = true;

    const compute = () => {
      const cw = outer.clientWidth;
      const ch = outer.clientHeight;

      // IMPORTANT:
      // Use layout-based measurements that are NOT affected by transforms.
      const iw = inner.offsetWidth;
      const ih = inner.offsetHeight;

      if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) {
        setScale(initialScale);
        return;
      }

      const sx = cw / iw;
      const sy = ch / ih;
      const next = Math.max(minScale, Math.min(maxScale, sx, sy));

      // Avoid tiny oscillations / re-render churn
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };

    const cancelScheduledCompute = () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (delayedTimeoutRef.current != null) {
        window.clearTimeout(delayedTimeoutRef.current);
        delayedTimeoutRef.current = null;
      }
    };

    const cancelInnerResizeCompute = () => {
      if (innerResizeTimeoutRef.current != null) {
        window.clearTimeout(innerResizeTimeoutRef.current);
        innerResizeTimeoutRef.current = null;
      }
    };

    const scheduleCompute = () => {
      cancelInnerResizeCompute();
      cancelScheduledCompute();

      // Immediate compute (RAF-scheduled)
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
        initialComputePending = false;

        // Schedule second compute after FLIP animation completes (450ms)
        delayedTimeoutRef.current = window.setTimeout(() => {
          delayedTimeoutRef.current = null;
          compute();
        }, 450);
      });
    };

    const deferInnerResizeCompute = () => {
      cancelScheduledCompute();
      cancelInnerResizeCompute();

      innerResizeTimeoutRef.current = window.setTimeout(() => {
        innerResizeTimeoutRef.current = null;
        scheduleCompute();
      }, deferInnerResizeComputeMs);
    };

    const ro = new ResizeObserver((entries) => {
      const outerResized = entries.some((entry) => entry.target === outer);
      const innerResized = entries.some((entry) => entry.target === inner);

      if (outerResized || !innerResized) {
        scheduleCompute();
        return;
      }

      if (deferInnerResizeComputeMs > 0 && !initialComputePending) {
        deferInnerResizeCompute();
        return;
      }

      scheduleCompute();
    });
    ro.observe(outer);
    ro.observe(inner);

    if (measureImmediatelyOnMount) {
      compute();
    }

    // Initial
    scheduleCompute();

    return () => {
      ro.disconnect();
      cancelScheduledCompute();
      cancelInnerResizeCompute();
    };
  }, [
    deferInnerResizeComputeMs,
    initialScale,
    maxScale,
    measureImmediatelyOnMount,
    minScale,
  ]);

  const justifyContent =
    contentAlign === 'start' ? 'flex-start' : contentAlign === 'end' ? 'flex-end' : 'center';
  const transformOrigin =
    contentAlign === 'start' ? 'left center' : contentAlign === 'end' ? 'right center' : 'center center';

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: overflowVisible ? 'visible' : 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent,
          overflow: overflowVisible ? 'visible' : 'hidden',
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin,
            transition: animateScale ? 'transform 0.4s ease-out' : 'none',
          }}
        >
          {/* This element is measured using offsetWidth/offsetHeight (transform-safe) */}
          <div ref={innerMeasureRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}
