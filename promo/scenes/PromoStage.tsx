import { type ReactNode, useEffect, useState } from "react";

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const PREVIEW_GUTTER = 48;

interface PromoStageProps {
  children: ReactNode;
}

function getPreviewScale() {
  return Math.min(
    1,
    Math.max(0, window.innerWidth - PREVIEW_GUTTER) / STAGE_WIDTH,
    Math.max(0, window.innerHeight - PREVIEW_GUTTER) / STAGE_HEIGHT,
  );
}

export function PromoStage({ children }: PromoStageProps) {
  const [scale, setScale] = useState(getPreviewScale);

  useEffect(() => {
    const updateScale = () => setScale(getPreviewScale());

    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <main className="promo-app promo-stage-page">
      <div
        className="promo-stage-preview"
        style={{
          width: STAGE_WIDTH * scale,
          height: STAGE_HEIGHT * scale,
        }}
      >
        <div
          className="promo-stage"
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
