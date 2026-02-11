import React, { useLayoutEffect, useRef, useState } from 'react';

type FitToBoxProps = {
  children: React.ReactNode;
  minScale?: number; // default 0.6
  className?: string;
};

export function FitToBox({ children, minScale = 0.4, className }: FitToBoxProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerMeasureRef = useRef<HTMLDivElement | null>(null);

  const rafRef = useRef<number | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerMeasureRef.current;
    if (!outer || !inner) return;

    const compute = () => {
      const cw = outer.clientWidth;
      const ch = outer.clientHeight;

      // IMPORTANT:
      // Use layout-based measurements that are NOT affected by transforms.
      const iw = inner.offsetWidth;
      const ih = inner.offsetHeight;

      if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) {
        setScale(1);
        return;
      }

      const sx = cw / iw;
      const sy = ch / ih;
      const next = Math.max(minScale, Math.min(1, sx, sy));

      // Avoid tiny oscillations / re-render churn
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };

    const scheduleCompute = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    const ro = new ResizeObserver(() => scheduleCompute());
    ro.observe(outer);
    ro.observe(inner);

    // Initial
    scheduleCompute();

    return () => {
      ro.disconnect();
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [minScale]);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.4s ease-out', }}>
          {/* This element is measured using offsetWidth/offsetHeight (transform-safe) */}
          <div ref={innerMeasureRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}
