import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";
import { DefenderShip } from "../../src/graphics/human/Defender";
import { FighterShip } from "../../src/graphics/human/Fighter";
import { OrbitalShip } from "../../src/graphics/human/Orbital";

const BODY_ENTRY_MS = 1_200;
const BODY_HOLD_MS = 2_000;
const BODY_EXIT_MS = 700;
const FIRST_BODY_DELAY_MS = 300;
const NEXT_BODY_DELAY_MS = 100;
const FINAL_HEADER_EXIT_OFFSET_MS = 350;

type BodyPhase = "entering" | "holding" | "exiting";
type ScenePhase = "intro" | "outro";
type ShipEntryAnimationKind = "scale-y" | "move-up";
type ShipComponent = ComponentType<{ className?: string }>;

interface ShipPowerBodyState {
  id: string;
  title: string;
  powerText: string;
  costText: string;
  color: string;
  Ship: ShipComponent;
  shipEntryAnimationKind: ShipEntryAnimationKind;
  shipTopMargin: string;
  costLabelMarginTop: string;
}

const BODY_STATES: readonly ShipPowerBodyState[] = [
  {
    id: "defender",
    title: "Defender",
    powerText: "Heal 1",
    costText: "2 LINES",
    color: "var(--shapeships-pastel-green)",
    Ship: DefenderShip,
    shipEntryAnimationKind: "scale-y",
    shipTopMargin: "-30px",
    costLabelMarginTop: "-80px",
  },
  {
    id: "fighter",
    title: "Fighter",
    powerText: "Deal 1 damage",
    costText: "3 LINES",
    color: "var(--shapeships-pastel-red)",
    Ship: FighterShip,
    shipEntryAnimationKind: "move-up",
    shipTopMargin: "-40px",
    costLabelMarginTop: "-70px",
  },
  {
    id: "orbital",
    title: "Orbital",
    powerText: "Gain 1 line",
    costText: "6 LINES",
    color: "var(--shapeships-pastel-blue)",
    Ship: OrbitalShip,
    shipEntryAnimationKind: "scale-y",
    shipTopMargin: "20px",
    costLabelMarginTop: "0px",
  },
];

const sceneTimingStyle = {
  "--promo-ships-have-powers-body-entry-duration": `${BODY_ENTRY_MS}ms`,
  "--promo-ships-have-powers-body-hold-duration": `${BODY_HOLD_MS}ms`,
  "--promo-ships-have-powers-body-exit-duration": `${BODY_EXIT_MS}ms`,
  "--promo-ships-have-powers-final-header-exit-offset": `${FINAL_HEADER_EXIT_OFFSET_MS}ms`,
} as CSSProperties;

export function ShipsHavePowersScene() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [bodyPhase, setBodyPhase] = useState<BodyPhase>("entering");
  const [scenePhase, setScenePhase] = useState<ScenePhase>("intro");

  useEffect(() => {
    const timers: number[] = [];

    const schedule = (callback: () => void, delayMs: number) => {
      const timer = window.setTimeout(callback, delayMs);
      timers.push(timer);
    };

    const runBody = (index: number, delayMs: number) => {
      schedule(() => {
        setActiveIndex(index);
        setBodyPhase("entering");

        schedule(() => {
          setBodyPhase("holding");

          schedule(() => {
            setBodyPhase("exiting");

            const isFinalBody = index === BODY_STATES.length - 1;
            if (isFinalBody) {
              schedule(
                () => setScenePhase("outro"),
                Math.max(0, BODY_EXIT_MS - FINAL_HEADER_EXIT_OFFSET_MS),
              );
            }

            schedule(() => {
              if (index < BODY_STATES.length - 1) {
                runBody(index + 1, NEXT_BODY_DELAY_MS);
                return;
              }

              setActiveIndex(null);
            }, BODY_EXIT_MS);
          }, BODY_HOLD_MS);
        }, BODY_ENTRY_MS);
      }, delayMs);
    };

    runBody(0, FIRST_BODY_DELAY_MS);

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const activeBody =
    activeIndex === null ? null : BODY_STATES[activeIndex] ?? null;

  return (
    <section
      aria-label="Ships have powers"
      className={`promo-ships-have-powers-scene promo-ships-have-powers-scene--${scenePhase}`}
      style={sceneTimingStyle}
    >
      <img
        aria-hidden="true"
        alt=""
        className="promo-ships-have-powers-background"
        src={spaceBackgroundUrl}
      />

      <div className="promo-ships-have-powers-text-group">
        <div className="promo-ships-have-powers-heading-mask">
          <p className="promo-ships-have-powers-heading">
            SHIPS HAVE POWERS
          </p>
        </div>
        <div
          aria-hidden="true"
          className="promo-ships-have-powers-divider"
        />
      </div>

      {activeBody && (
        <ShipPowerBody
          key={activeBody.id}
          body={activeBody}
          phase={bodyPhase}
        />
      )}
    </section>
  );
}

function ShipPowerBody({
  body,
  phase,
}: {
  body: ShipPowerBodyState;
  phase: BodyPhase;
}) {
  const bodyStyle = {
    "--promo-ships-have-powers-active-color": body.color,
    "--promo-ships-have-powers-ship-top-margin": body.shipTopMargin,
    "--promo-ships-have-powers-cost-label-margin-top":
      body.costLabelMarginTop,
  } as CSSProperties;
  const Ship = body.Ship;

  return (
    <div
      className={`promo-ships-have-powers-body promo-ships-have-powers-body--${phase}`}
      data-ship-animation={body.shipEntryAnimationKind}
      style={bodyStyle}
    >
      <div className="promo-ships-have-powers-copy">
        <div className="promo-ships-have-powers-title-mask">
          <p className="promo-ships-have-powers-title">{body.title}</p>
        </div>
        <div className="promo-ships-have-powers-power-mask">
          <p className="promo-ships-have-powers-power">{body.powerText}</p>
        </div>
      </div>

      <div className="promo-ships-have-powers-ship-group">
        <div className="promo-ships-have-powers-ship-slot">
          <div className="promo-ships-have-powers-ship-animation-wrapper">
            <div className="promo-ships-have-powers-ship-scale-wrapper">
              <Ship className="promo-ships-have-powers-ship-svg" />
            </div>
          </div>
        </div>
        <p className="promo-ships-have-powers-cost-label">
          {body.costText}
        </p>
      </div>
    </div>
  );
}
