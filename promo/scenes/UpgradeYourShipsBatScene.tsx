import {
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";
import { BattlecruiserShip } from "../../src/graphics/human/Battlecruiser";
import { DefenderShip } from "../../src/graphics/human/Defender";
import { FighterShip } from "../../src/graphics/human/Fighter";
import { OrbitalShip } from "../../src/graphics/human/Orbital";

const INGREDIENT_ENTRY_DELAY_MS = 150;
const INGREDIENT_ENTRY_MS = 1_200;
const INGREDIENT_LINE_STAGGER_MS = 120;
const EQUALS_REVEAL_DELAY_MS = 850;
const EQUALS_REVEAL_MS = 300;
const EQUALS_BAR_STAGGER_MS = 80;
const INGREDIENT_HOLD_MS = 1200;
const TO_RESULT_MS = 400;
const RESULT_ENTRY_MS = 1_300;
const RESULT_TEXT_STAGGER_MS = 140;
const RESULT_COST_DELAY_MS = 140;
const RESULT_SETTLE_SAFETY_MS = 100;
const RESULT_HOLD_MS = 2100;
const RESULT_EXIT_MS = 700;
const HEADER_EXIT_MS = 350;

const INGREDIENT_SETTLE_MS = Math.max(
  INGREDIENT_ENTRY_DELAY_MS + INGREDIENT_ENTRY_MS,
  INGREDIENT_ENTRY_DELAY_MS +
    INGREDIENT_ENTRY_MS +
    3 * INGREDIENT_LINE_STAGGER_MS,
  EQUALS_REVEAL_DELAY_MS + EQUALS_REVEAL_MS + EQUALS_BAR_STAGGER_MS,
);

const RESULT_SETTLE_MS = Math.max(
  TO_RESULT_MS,
  RESULT_ENTRY_MS,
  RESULT_COST_DELAY_MS + RESULT_ENTRY_MS,
  RESULT_TEXT_STAGGER_MS + RESULT_ENTRY_MS,
) + RESULT_SETTLE_SAFETY_MS;

type ScenePhase =
  | "ingredients-entering"
  | "ingredients-holding"
  | "to-result"
  | "result-holding"
  | "result-exiting"
  | "header-exiting"
  | "done";

type ShipComponent = ComponentType<{ className?: string }>;
type ShipEntryAnimation = "move-up" | "scale-y";

interface IngredientShipDefinition {
  id: string;
  Ship: ShipComponent;
  left: number;
  top: number;
  entryAnimation: ShipEntryAnimation;
}

const INGREDIENT_SHIPS: readonly IngredientShipDefinition[] = [
  {
    id: "defender",
    Ship: DefenderShip,
    left: 336,
    top: 349,
    entryAnimation: "scale-y",
  },
  {
    id: "fighter-1",
    Ship: FighterShip,
    left: 72,
    top: 485,
    entryAnimation: "move-up",
  },
  {
    id: "orbital",
    Ship: OrbitalShip,
    left: 280,
    top: 525,
    entryAnimation: "scale-y",
  },
  {
    id: "fighter-2",
    Ship: FighterShip,
    left: 596,
    top: 485,
    entryAnimation: "move-up",
  },
];

const sceneTimingStyle = {
  "--promo-upgrade-your-ships-bat-ingredient-entry-delay": `${INGREDIENT_ENTRY_DELAY_MS}ms`,
  "--promo-upgrade-your-ships-bat-ingredient-entry-duration": `${INGREDIENT_ENTRY_MS}ms`,
  "--promo-upgrade-your-ships-bat-ingredient-line-stagger": `${INGREDIENT_LINE_STAGGER_MS}ms`,
  "--promo-upgrade-your-ships-bat-equals-reveal-delay": `${EQUALS_REVEAL_DELAY_MS}ms`,
  "--promo-upgrade-your-ships-bat-equals-reveal-duration": `${EQUALS_REVEAL_MS}ms`,
  "--promo-upgrade-your-ships-bat-equals-bar-stagger": `${EQUALS_BAR_STAGGER_MS}ms`,
  "--promo-upgrade-your-ships-bat-equals-transition-duration": `${TO_RESULT_MS}ms`,
  "--promo-upgrade-your-ships-bat-to-result-duration": `${TO_RESULT_MS}ms`,
  "--promo-upgrade-your-ships-bat-result-entry-duration": `${RESULT_ENTRY_MS}ms`,
  "--promo-upgrade-your-ships-bat-result-text-stagger": `${RESULT_TEXT_STAGGER_MS}ms`,
  "--promo-upgrade-your-ships-bat-result-cost-delay": `${RESULT_COST_DELAY_MS}ms`,
  "--promo-upgrade-your-ships-bat-result-exit-duration": `${RESULT_EXIT_MS}ms`,
  "--promo-upgrade-your-ships-bat-header-exit-duration": `${HEADER_EXIT_MS}ms`,
} as CSSProperties;

export function UpgradeYourShipsBatScene() {
  const [phase, setPhase] = useState<ScenePhase>("ingredients-entering");

  useEffect(() => {
    let nextPhase: ScenePhase;
    let durationMs: number;

    switch (phase) {
      case "ingredients-entering":
        nextPhase = "ingredients-holding";
        durationMs = INGREDIENT_SETTLE_MS;
        break;
      case "ingredients-holding":
        nextPhase = "to-result";
        durationMs = INGREDIENT_HOLD_MS;
        break;
      case "to-result":
        nextPhase = "result-holding";
        durationMs = RESULT_SETTLE_MS;
        break;
      case "result-holding":
        nextPhase = "result-exiting";
        durationMs = RESULT_HOLD_MS;
        break;
      case "result-exiting":
        nextPhase = "header-exiting";
        durationMs = RESULT_EXIT_MS;
        break;
      case "header-exiting":
        nextPhase = "done";
        durationMs = HEADER_EXIT_MS;
        break;
      case "done":
        return;
    }

    const timer = window.setTimeout(() => setPhase(nextPhase), durationMs);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const showIngredients =
    phase === "ingredients-entering" ||
    phase === "ingredients-holding" ||
    phase === "to-result";

  return (
    <section
      aria-label="Upgrade your ships Battlecruiser"
      className={`promo-upgrade-your-ships-bat-scene promo-upgrade-your-ships-bat-scene--${phase}`}
      style={sceneTimingStyle}
    >
      <img
        aria-hidden="true"
        alt=""
        className="promo-upgrade-your-ships-bat-background"
        src={spaceBackgroundUrl}
      />

      <div className="promo-upgrade-your-ships-bat-header">
        <div className="promo-upgrade-your-ships-bat-heading-mask">
          <p className="promo-upgrade-your-ships-bat-heading">
            UPGRADE YOUR SHIPS
          </p>
        </div>
        <div
          aria-hidden="true"
          className="promo-upgrade-your-ships-bat-divider"
        />
      </div>

      {showIngredients && (
        <>
          <div
            aria-hidden="true"
            className="promo-upgrade-your-ships-bat-ingredient-ships"
          >
            {INGREDIENT_SHIPS.map(
              ({ id, Ship, left, top, entryAnimation }) => (
                <div
                  className="promo-upgrade-your-ships-bat-ship-position"
                  data-entry-animation={entryAnimation}
                  key={id}
                  style={
                    {
                      "--promo-upgrade-your-ships-bat-ship-left": `${left}px`,
                      "--promo-upgrade-your-ships-bat-ship-top": `${top}px`,
                    } as CSSProperties
                  }
                >
                  <div className="promo-upgrade-your-ships-bat-ingredient-ship-animation">
                    <div className="promo-upgrade-your-ships-bat-ship-scale">
                      <Ship className="promo-upgrade-your-ships-bat-ship-svg" />
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>

          <div className="promo-upgrade-your-ships-bat-ingredient-copy-mask">
            <div className="promo-upgrade-your-ships-bat-ingredient-copy">
              <div className="promo-upgrade-your-ships-bat-ingredient-line-mask promo-upgrade-your-ships-bat-ingredient-line-mask--fighters">
                <p className="promo-upgrade-your-ships-bat-ingredient-line promo-upgrade-your-ships-bat-ingredient-line--fighters">
                  2 Fighters
                </p>
              </div>
              <div className="promo-upgrade-your-ships-bat-ingredient-line-mask promo-upgrade-your-ships-bat-ingredient-line-mask--defender">
                <p className="promo-upgrade-your-ships-bat-ingredient-line promo-upgrade-your-ships-bat-ingredient-line--defender">
                  + Defender
                </p>
              </div>
              <div className="promo-upgrade-your-ships-bat-ingredient-line-mask promo-upgrade-your-ships-bat-ingredient-line-mask--orbital">
                <p className="promo-upgrade-your-ships-bat-ingredient-line promo-upgrade-your-ships-bat-ingredient-line--orbital">
                  + Orbital
                </p>
              </div>
              <div className="promo-upgrade-your-ships-bat-ingredient-line-mask promo-upgrade-your-ships-bat-ingredient-line-mask--lines">
                <p className="promo-upgrade-your-ships-bat-ingredient-line promo-upgrade-your-ships-bat-ingredient-line--lines">
                  + 6 Lines
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div
        aria-hidden="true"
        className="promo-upgrade-your-ships-bat-equals"
      >
        <span className="promo-upgrade-your-ships-bat-equals-bar promo-upgrade-your-ships-bat-equals-bar--top" />
        <span className="promo-upgrade-your-ships-bat-equals-bar promo-upgrade-your-ships-bat-equals-bar--bottom" />
      </div>

      <div
        aria-hidden="true"
        className="promo-upgrade-your-ships-bat-result-position"
      >
        <div className="promo-upgrade-your-ships-bat-result-animation">
          <div className="promo-upgrade-your-ships-bat-ship-scale">
            <BattlecruiserShip className="promo-upgrade-your-ships-bat-ship-svg" />
          </div>
        </div>
      </div>

      <p className="promo-upgrade-your-ships-bat-cost-label">20 LINES</p>

      <div className="promo-upgrade-your-ships-bat-result-copy">
        <div className="promo-upgrade-your-ships-bat-result-title-mask">
          <p className="promo-upgrade-your-ships-bat-result-title">
            Battlecruiser
          </p>
        </div>
        <div className="promo-upgrade-your-ships-bat-result-power-mask">
          <p className="promo-upgrade-your-ships-bat-result-power">
            <span>Gain 2 lines</span>
            <span>Deal 2 damage</span>
            <span>Heal 3</span>
          </p>
        </div>
      </div>
    </section>
  );
}
