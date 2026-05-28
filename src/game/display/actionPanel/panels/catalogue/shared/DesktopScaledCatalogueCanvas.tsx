import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface DesktopScaledCatalogueCanvasProps {
  width: number;
  height: number;
  minScale?: number;
  children: ReactNode;
}

const DEFAULT_MIN_SCALE = 0.72;

function clampScale(value: number, minScale: number) {
  return Math.min(1, Math.max(minScale, value));
}

export function DesktopScaledCatalogueCanvas({
  width,
  height,
  minScale = DEFAULT_MIN_SCALE,
  children,
}: DesktopScaledCatalogueCanvasProps) {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const safeMinScale = Math.min(1, Math.max(0.1, minScale));

  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    if (!measureEl) {
      return;
    }

    const updateScale = () => {
      const availableWidth = measureEl.clientWidth;
      if (availableWidth <= 0) {
        setScale(1);
        return;
      }

      setScale(clampScale(availableWidth / width, safeMinScale));
    };

    updateScale();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale);
      return () => {
        window.removeEventListener('resize', updateScale);
      };
    }

    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(measureEl);

    return () => {
      resizeObserver.disconnect();
    };
  }, [safeMinScale, width]);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return (
    <div ref={measureRef} className="w-full min-w-0">
      <div
        className="mx-auto"
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
      >
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
