import { useEffect, useState, type CSSProperties } from "react";
// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";
import { LogoIcon } from "../../src/components/ui/primitives/icons/LogoIcon";

const SETTLE_START_DELAY_MS = 120;
const DIVIDER_MOVE_MS = 1_600;
const LOGO_ENTRY_MS = 1_800;
const CTA_ENTRY_MS = 1_700;
const URL_ENTRY_MS = 1_700;
const CTA_ENTRY_DELAY_MS = 340;
const URL_ENTRY_DELAY_MS = 560;
const CTA_PULSE_DELAY_MS = 3_500;
const CTA_PULSE_DURATION_MS = 400;
const CTA_PULSE_SCALE = 1.1;
const STAR_COUNT = 24;
const STAR_STREAM_START_DELAY_MS = 500;
const STAR_START_SPACING_MS = 260;
const STAR_MIN_DURATION_MS = 1_200;
const STAR_MAX_DURATION_MS = 3_400;
const STAR_SEED = 534_221;

interface ShootingStarSpec {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  sizePx: number;
  opacity: number;
  delayMs: number;
  durationMs: number;
}

type ShootingStarStyle = CSSProperties & {
  [key: `--promo-final-cta-star-${string}`]: string;
};

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function lerp(min: number, max: number, value: number) {
  return min + (max - min) * value;
}

function createShootingStars(): ShootingStarSpec[] {
  const random = createSeededRandom(STAR_SEED);

  return Array.from({ length: STAR_COUNT }, (_, index) => {
    const delayJitterMs = lerp(0, 180, random());

    return {
      id: `final-cta-star-${index}`,
      x: Math.round(lerp(80, 1840, random())),
      y: Math.round(lerp(1120, 1260, random())),
      dx: Math.round(lerp(0, 0, random())),
      dy: Math.round(lerp(-1500, -1300, random())),
      sizePx: Number(lerp(2, 5, random()).toFixed(2)),
      opacity: Number(lerp(0.45, 0.95, random()).toFixed(2)),
      delayMs: Math.round(
        STAR_STREAM_START_DELAY_MS +
          index * STAR_START_SPACING_MS +
          delayJitterMs,
      ),
      durationMs: Math.round(
        lerp(STAR_MIN_DURATION_MS, STAR_MAX_DURATION_MS, random()),
      ),
    };
  });
}

const shootingStars = createShootingStars();

const sceneTimingStyle = {
  "--promo-final-cta-divider-move-duration": `${DIVIDER_MOVE_MS}ms`,
  "--promo-final-cta-logo-entry-duration": `${LOGO_ENTRY_MS}ms`,
  "--promo-final-cta-cta-entry-duration": `${CTA_ENTRY_MS}ms`,
  "--promo-final-cta-url-entry-duration": `${URL_ENTRY_MS}ms`,
  "--promo-final-cta-cta-entry-delay": `${CTA_ENTRY_DELAY_MS}ms`,
  "--promo-final-cta-url-entry-delay": `${URL_ENTRY_DELAY_MS}ms`,
  "--promo-final-cta-pulse-delay": `${CTA_PULSE_DELAY_MS}ms`,
  "--promo-final-cta-pulse-duration": `${CTA_PULSE_DURATION_MS}ms`,
  "--promo-final-cta-pulse-scale": CTA_PULSE_SCALE,
} as CSSProperties;

export function FinalCtaScene() {
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setIsSettled(true),
      SETTLE_START_DELAY_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <section
      aria-label="Final CTA"
      className={`promo-final-cta-scene${
        isSettled ? " promo-final-cta-scene--settled" : ""
      }`}
      style={sceneTimingStyle}
    >
      <img
        aria-hidden="true"
        alt=""
        className="promo-final-cta-background"
        src={spaceBackgroundUrl}
      />

      <div aria-hidden="true" className="promo-final-cta-shooting-stars">
        {shootingStars.map((star) => (
          <span
            className="promo-final-cta-shooting-star"
            key={star.id}
            style={
              {
                "--promo-final-cta-star-x": `${star.x}px`,
                "--promo-final-cta-star-y": `${star.y}px`,
                "--promo-final-cta-star-dx": `${star.dx}px`,
                "--promo-final-cta-star-dy": `${star.dy}px`,
                "--promo-final-cta-star-size": `${star.sizePx}px`,
                "--promo-final-cta-star-opacity": `${star.opacity}`,
                "--promo-final-cta-star-delay": `${star.delayMs}ms`,
                "--promo-final-cta-star-duration": `${star.durationMs}ms`,
              } as ShootingStarStyle
            }
          />
        ))}
      </div>

      <div aria-hidden="true" className="promo-final-cta-divider" />

      <div className="promo-final-cta-logo-mask">
        <div className="promo-final-cta-logo-lockup">
          <LogoIcon className="promo-final-cta-logo-symbol" />
          <p className="promo-final-cta-wordmark">SHAPESHIPS</p>
        </div>
      </div>

      <div className="promo-final-cta-copy">
        <div className="promo-final-cta-line-mask">
          <div className="promo-final-cta-cta-pulse-wrapper">
            <p className="promo-final-cta-line promo-final-cta-line--cta">
              PLAY FREE NOW
            </p>
          </div>
        </div>
        <div className="promo-final-cta-line-mask">
          <p className="promo-final-cta-line promo-final-cta-line--url">
            shapeships.com
          </p>
        </div>
      </div>
    </section>
  );
}
