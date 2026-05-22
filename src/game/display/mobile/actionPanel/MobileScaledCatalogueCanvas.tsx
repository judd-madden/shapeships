import type { ReactNode } from 'react';

interface MobileScaledCatalogueCanvasProps {
  width: number;
  height: number;
  scale?: number;
  children: ReactNode;
}

export function MobileScaledCatalogueCanvas({
  width,
  height,
  scale = 0.72,
  children,
}: MobileScaledCatalogueCanvasProps) {
  return (
    <div
      style={{
        width: `${width * scale}px`,
        height: `${height * scale}px`,
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
  );
}
