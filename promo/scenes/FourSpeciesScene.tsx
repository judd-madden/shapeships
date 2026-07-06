import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";
import { BlackCarrierIcon } from "../../src/components/ui/primitives/icons/BlackCarrierIcon";
import { BlackMercuryCoreIcon } from "../../src/components/ui/primitives/icons/BlackMercuryCoreIcon";
import { BlackShipOfWisdomIcon } from "../../src/components/ui/primitives/icons/BlackShipOfWisdomIcon";
import { BlackXeniteIcon } from "../../src/components/ui/primitives/icons/BlackXeniteIcon";

const HEADING_ENTRY_MS = 1_200;
const FIRST_PANEL_DELAY_MS = 500;
const PANEL_ENTRY_MS = 600;
const HERO_ENTRY_DELAY_MS = 300;
const HERO_ENTRY_MS = 700;
const PANEL_HOLD_MS = 1_800;
const PANEL_EXIT_MS = 200;
const NEXT_PANEL_DELAY_MS = 100;
const HEADING_EXIT_MS = 350;

type HeroAnimationKind = "carrier" | "xenite" | "wisdom" | "default";
type PanelPhase =
  | "waiting"
  | "panel-entering"
  | "hero-entering"
  | "holding"
  | "exiting"
  | "done";
type HeadingPhase = "entering" | "holding" | "exiting" | "done";
type HeroIcon = ComponentType<{ className?: string; color?: string }>;

interface SpeciesEntry {
  id: string;
  title: string;
  paragraphLines: readonly [string, string];
  background: string;
  Icon: HeroIcon;
  heroAnimationKind: HeroAnimationKind;
  iconWidth: string;
  iconHeight: string;
}

const SPECIES: readonly SpeciesEntry[] = [
  {
    id: "human",
    title: "HUMAN",
    paragraphLines: [
      "Metal. Explosions. Expansion.",
      "Onward and upward.",
    ],
    background: "var(--shapeships-pastel-blue)",
    Icon: BlackCarrierIcon,
    heroAnimationKind: "carrier",
    iconWidth: "232px",
    iconHeight: "200px",
  },
  {
    id: "xenite",
    title: "XENITE",
    paragraphLines: ["Swarm. Queen. Hive.", "Always growing."],
    background: "var(--shapeships-pastel-green)",
    Icon: BlackXeniteIcon,
    heroAnimationKind: "xenite",
    iconWidth: "168px",
    iconHeight: "168px",
  },
  {
    id: "centaur",
    title: "CENTAUR",
    paragraphLines: ["Power. Timing. Domination.", "Cull the weak."],
    background: "var(--shapeships-pastel-red)",
    Icon: BlackShipOfWisdomIcon,
    heroAnimationKind: "wisdom",
    iconWidth: "236px",
    iconHeight: "236px",
  },
  {
    id: "ancient",
    title: "ANCIENT",
    paragraphLines: ["Energy. Solar Powers.", "Ever present."],
    background: "var(--shapeships-pastel-purple)",
    Icon: BlackMercuryCoreIcon,
    heroAnimationKind: "default",
    iconWidth: "128px",
    iconHeight: "244px",
  },
];

const sceneTimingStyle = {
  "--promo-four-species-heading-entry-duration": `${HEADING_ENTRY_MS}ms`,
  "--promo-four-species-heading-exit-duration": `${HEADING_EXIT_MS}ms`,
  "--promo-four-species-panel-entry-duration": `${PANEL_ENTRY_MS}ms`,
  "--promo-four-species-panel-exit-duration": `${PANEL_EXIT_MS}ms`,
  "--promo-four-species-hero-entry-duration": `${HERO_ENTRY_MS}ms`,
} as CSSProperties;

export function FourSpeciesScene() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelPhase, setPanelPhase] = useState<PanelPhase>("waiting");
  const [headingPhase, setHeadingPhase] =
    useState<HeadingPhase>("entering");

  useEffect(() => {
    if (headingPhase === "holding" || headingPhase === "done") {
      return;
    }

    const durationMs =
      headingPhase === "entering" ? HEADING_ENTRY_MS : HEADING_EXIT_MS;
    const timeoutId = window.setTimeout(
      () =>
        setHeadingPhase(
          headingPhase === "entering" ? "holding" : "done",
        ),
      durationMs,
    );

    return () => window.clearTimeout(timeoutId);
  }, [headingPhase]);

  useEffect(() => {
    if (panelPhase === "done") {
      return;
    }

    let durationMs: number;
    let advance: () => void;

    switch (panelPhase) {
      case "waiting":
        durationMs = activeIndex === 0 ? FIRST_PANEL_DELAY_MS : NEXT_PANEL_DELAY_MS;
        advance = () => setPanelPhase("panel-entering");
        break;
      case "panel-entering":
        durationMs = HERO_ENTRY_DELAY_MS;
        advance = () => setPanelPhase("hero-entering");
        break;
      case "hero-entering":
        durationMs = HERO_ENTRY_MS;
        advance = () => setPanelPhase("holding");
        break;
      case "holding":
        durationMs = PANEL_HOLD_MS;
        advance = () => setPanelPhase("exiting");
        break;
      case "exiting":
        durationMs = PANEL_EXIT_MS;
        advance = () => {
          if (activeIndex === SPECIES.length - 1) {
            setPanelPhase("done");
            setHeadingPhase("exiting");
            return;
          }

          setActiveIndex((currentIndex) => currentIndex + 1);
          setPanelPhase("waiting");
        };
        break;
    }

    const timeoutId = window.setTimeout(advance, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, panelPhase]);

  const activeSpecies = SPECIES[activeIndex];

  return (
    <section
      aria-label="Four species"
      className="promo-four-species-scene"
      style={sceneTimingStyle}
    >
      <img
        aria-hidden="true"
        alt=""
        className="promo-four-species-background"
        src={spaceBackgroundUrl}
      />

      <div className="promo-four-species-header">
        <div className="promo-four-species-heading-mask">
          {headingPhase !== "done" && (
            <p
              className={`promo-four-species-heading promo-four-species-heading--${headingPhase}`}
            >
              <span className="promo-four-species-heading-primary">
                FOUR SPECIES
              </span>
              <span className="promo-four-species-heading-secondary">
                60+ SHIPS
              </span>
            </p>
          )}
        </div>
        <div aria-hidden="true" className="promo-four-species-divider" />
      </div>

      {panelPhase !== "waiting" &&
        panelPhase !== "done" &&
        activeSpecies && (
          <SpeciesPanel
            key={activeSpecies.id}
            phase={panelPhase}
            species={activeSpecies}
          />
        )}
    </section>
  );
}

function SpeciesPanel({
  phase,
  species,
}: {
  phase: Exclude<PanelPhase, "waiting" | "done">;
  species: SpeciesEntry;
}) {
  const Icon = species.Icon;
  const panelStyle = {
    "--promo-four-species-panel-background": species.background,
    "--promo-four-species-icon-width": species.iconWidth,
    "--promo-four-species-icon-height": species.iconHeight,
  } as CSSProperties;

  return (
    <article
      className={`promo-four-species-panel promo-four-species-panel--${phase}`}
      data-hero-animation={species.heroAnimationKind}
      style={panelStyle}
    >
      <div className="promo-four-species-copy">
        <h2 className="promo-four-species-title">{species.title}</h2>
        <p className="promo-four-species-paragraph">
          {species.paragraphLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
      </div>

      <div className="promo-four-species-hero-layout">
        <div className="promo-four-species-hero-animation">
          <div className="promo-four-species-hero-icon">
            <Icon color="black" />
          </div>
        </div>
      </div>
    </article>
  );
}
