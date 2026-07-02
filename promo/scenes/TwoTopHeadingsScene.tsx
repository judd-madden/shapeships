import { useEffect, useState, type CSSProperties } from "react";
// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";

const HEADINGS = ["GROW YOUR FLEET", "REACT TO YOUR OPPONENT"] as const;

const HEADING_ENTRY_MS = 1_200;
const HEADING_HOLD_MS = 3_000;
const HEADING_EXIT_MS = 350;

type HeadingPhase = "entering" | "holding" | "exiting" | "done";

const sceneTimingStyle = {
  "--promo-two-top-headings-entry-duration": `${HEADING_ENTRY_MS}ms`,
  "--promo-two-top-headings-exit-duration": `${HEADING_EXIT_MS}ms`,
} as CSSProperties;

export function TwoTopHeadingsScene() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<HeadingPhase>("entering");

  useEffect(() => {
    if (phase === "done") {
      return;
    }

    let durationMs: number;
    let advance: () => void;

    switch (phase) {
      case "entering":
        durationMs = HEADING_ENTRY_MS;
        advance = () => setPhase("holding");
        break;
      case "holding":
        durationMs = HEADING_HOLD_MS;
        advance = () => setPhase("exiting");
        break;
      case "exiting":
        durationMs = HEADING_EXIT_MS;
        advance = () => {
          if (activeIndex === HEADINGS.length - 1) {
            setPhase("done");
            return;
          }

          setActiveIndex((currentIndex) => currentIndex + 1);
          setPhase("entering");
        };
        break;
    }

    const timeoutId = window.setTimeout(advance, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, phase]);

  return (
    <section
      aria-label="Two top headings"
      className={`promo-two-top-headings-scene promo-two-top-headings-scene--${phase}`}
      style={sceneTimingStyle}
    >
      <img
        aria-hidden="true"
        alt=""
        className="promo-two-top-headings-background"
        src={spaceBackgroundUrl}
      />

      <div className="promo-two-top-headings-header">
        <div className="promo-two-top-headings-heading-mask">
          {phase !== "done" && (
            <p
              className={`promo-two-top-headings-heading promo-two-top-headings-heading--${phase}`}
              key={activeIndex}
            >
              {HEADINGS[activeIndex]}
            </p>
          )}
        </div>
        <div aria-hidden="true" className="promo-two-top-headings-divider" />
      </div>
    </section>
  );
}
