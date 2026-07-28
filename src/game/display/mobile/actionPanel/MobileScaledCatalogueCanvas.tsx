import type { ReactNode } from 'react';

export const MOBILE_CATALOGUE_SCALE = 0.72;

interface MobileScaledCatalogueCanvasProps {
  width: number;
  height: number;
  scale?: number;
  children: ReactNode;
}

export function MobileScaledCatalogueCanvas({
  width,
  height,
  scale = MOBILE_CATALOGUE_SCALE,
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
