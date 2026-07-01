import {
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";
import { DefenderShip } from "../../src/graphics/human/Defender";
import { FighterShip } from "../../src/graphics/human/Fighter";
import { TacticalCruiserShip } from "../../src/graphics/human/TacticalCruiser";

const HEADER_ENTRY_MS = 1_200;
const INGREDIENT_ENTRY_DELAY_MS = 300;
const INGREDIENT_ENTRY_MS = 1_200;
const INGREDIENT_LINE_STAGGER_MS = 120;
const EQUALS_REVEAL_DELAY_MS = 850;
const EQUALS_REVEAL_MS = 300;
const EQUALS_BAR_STAGGER_MS = 80;
const INGREDIENT_HOLD_MS = 1000;
const TO_RESULT_MS = 400;
const RESULT_ENTRY_MS = 1_300;
const RESULT_TEXT_STAGGER_MS = 140;
const RESULT_COST_DELAY_MS = 140;
const RESULT_HOLD_MS = 2100;
const RESULT_EXIT_MS = 400;

const INGREDIENT_SETTLE_MS = Math.max(
  HEADER_ENTRY_MS,
  INGREDIENT_ENTRY_DELAY_MS + INGREDIENT_ENTRY_MS,
  INGREDIENT_ENTRY_DELAY_MS +
    INGREDIENT_ENTRY_MS +
    2 * INGREDIENT_LINE_STAGGER_MS,
  EQUALS_REVEAL_DELAY_MS + EQUALS_REVEAL_MS + EQUALS_BAR_STAGGER_MS,
);

const RESULT_SETTLE_MS = Math.max(
  TO_RESULT_MS,
  RESULT_ENTRY_MS,
  RESULT_COST_DELAY_MS + RESULT_ENTRY_MS,
  RESULT_ENTRY_MS + RESULT_TEXT_STAGGER_MS,
);

type ScenePhase =
  | "ingredients-entering"
  | "ingredients-holding"
  | "to-result"
  | "result-holding"
  | "result-exiting"
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
    id: "fighter",
    Ship: FighterShip,
    left: 332,
    top: 360,
    entryAnimation: "move-up",
  },
  {
    id: "defender-left",
    Ship: DefenderShip,
    left: 180,
    top: 692,
    entryAnimation: "scale-y",
  },
  {
    id: "defender-right",
    Ship: DefenderShip,
    left: 484,
    top: 692,
    entryAnimation: "scale-y",
  },
];

const sceneTimingStyle = {
  "--promo-upgrade-your-ships-header-entry-duration": `${HEADER_ENTRY_MS}ms`,
  "--promo-upgrade-your-ships-ingredient-entry-delay": `${INGREDIENT_ENTRY_DELAY_MS}ms`,
  "--promo-upgrade-your-ships-ingredient-entry-duration": `${INGREDIENT_ENTRY_MS}ms`,
  "--promo-upgrade-your-ships-ingredient-line-stagger": `${INGREDIENT_LINE_STAGGER_MS}ms`,
  "--promo-upgrade-your-ships-equals-reveal-delay": `${EQUALS_REVEAL_DELAY_MS}ms`,
  "--promo-upgrade-your-ships-equals-reveal-duration": `${EQUALS_REVEAL_MS}ms`,
  "--promo-upgrade-your-ships-equals-bar-stagger": `${EQUALS_BAR_STAGGER_MS}ms`,
  "--promo-upgrade-your-ships-equals-transition-duration": `${TO_RESULT_MS}ms`,
  "--promo-upgrade-your-ships-to-result-duration": `${TO_RESULT_MS}ms`,
  "--promo-upgrade-your-ships-result-entry-duration": `${RESULT_ENTRY_MS}ms`,
  "--promo-upgrade-your-ships-result-text-stagger": `${RESULT_TEXT_STAGGER_MS}ms`,
  "--promo-upgrade-your-ships-result-cost-delay": `${RESULT_COST_DELAY_MS}ms`,
  "--promo-upgrade-your-ships-result-exit-duration": `${RESULT_EXIT_MS}ms`,
} as CSSProperties;

export function UpgradeYourShipsScene() {
  const [phase, setPhase] = useState<ScenePhase>("ingredients-entering");

  useEffect(() => {
    const timers: number[] = [];
    let elapsedMs = INGREDIENT_SETTLE_MS;

    const schedule = (nextPhase: ScenePhase, delayMs: number) => {
      const timer = window.setTimeout(() => setPhase(nextPhase), delayMs);
      timers.push(timer);
    };

    schedule("ingredients-holding", elapsedMs);
    elapsedMs += INGREDIENT_HOLD_MS;
    schedule("to-result", elapsedMs);
    elapsedMs += RESULT_SETTLE_MS;
    schedule("result-holding", elapsedMs);
    elapsedMs += RESULT_HOLD_MS;
    schedule("result-exiting", elapsedMs);
    elapsedMs += RESULT_EXIT_MS;
    schedule("done", elapsedMs);

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const showIngredients =
    phase === "ingredients-entering" ||
    phase === "ingredients-holding" ||
    phase === "to-result";

  return (
    <section
      aria-label="Upgrade your ships"
      className={`promo-upgrade-your-ships-scene promo-upgrade-your-ships-scene--${phase}`}
      style={sceneTimingStyle}
    >
      <img
        aria-hidden="true"
        alt=""
        className="promo-upgrade-your-ships-background"
        src={spaceBackgroundUrl}
      />

      <div className="promo-upgrade-your-ships-header">
        <div className="promo-upgrade-your-ships-heading-mask">
          <p className="promo-upgrade-your-ships-heading">
            UPGRADE YOUR SHIPS
          </p>
        </div>
        <div
          aria-hidden="true"
          className="promo-upgrade-your-ships-divider"
        />
      </div>

      {showIngredients && (
        <>
          <div aria-hidden="true" className="promo-upgrade-your-ships-ingredient-ships">
            {INGREDIENT_SHIPS.map(
              ({ id, Ship, left, top, entryAnimation }) => (
                <div
                  className="promo-upgrade-your-ships-ship-position"
                  data-entry-animation={entryAnimation}
                  key={id}
                  style={
                    {
                      "--promo-upgrade-your-ships-ship-left": `${left}px`,
                      "--promo-upgrade-your-ships-ship-top": `${top}px`,
                    } as CSSProperties
                  }
                >
                  <div className="promo-upgrade-your-ships-ingredient-ship-animation">
                    <div className="promo-upgrade-your-ships-ship-scale">
                      <Ship className="promo-upgrade-your-ships-ship-svg" />
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>

          <div className="promo-upgrade-your-ships-ingredient-copy-mask">
            <div className="promo-upgrade-your-ships-ingredient-copy">
              <div className="promo-upgrade-your-ships-ingredient-line-mask promo-upgrade-your-ships-ingredient-line-mask--fighter">
                <p className="promo-upgrade-your-ships-ingredient-line promo-upgrade-your-ships-ingredient-line--fighter">
                  Fighter
                </p>
              </div>
              <div className="promo-upgrade-your-ships-ingredient-line-mask promo-upgrade-your-ships-ingredient-line-mask--defenders">
                <p className="promo-upgrade-your-ships-ingredient-line promo-upgrade-your-ships-ingredient-line--defenders">
                  + 2 Defenders
                </p>
              </div>
              <div className="promo-upgrade-your-ships-ingredient-line-mask promo-upgrade-your-ships-ingredient-line-mask--lines">
                <p className="promo-upgrade-your-ships-ingredient-line promo-upgrade-your-ships-ingredient-line--lines">
                  + 3 Lines
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div aria-hidden="true" className="promo-upgrade-your-ships-equals">
        <span className="promo-upgrade-your-ships-equals-bar promo-upgrade-your-ships-equals-bar--top" />
        <span className="promo-upgrade-your-ships-equals-bar promo-upgrade-your-ships-equals-bar--bottom" />
      </div>

      <div
        aria-hidden="true"
        className="promo-upgrade-your-ships-tac-position"
      >
        <div className="promo-upgrade-your-ships-tac-animation">
          <div className="promo-upgrade-your-ships-ship-scale">
            <TacticalCruiserShip className="promo-upgrade-your-ships-ship-svg" />
          </div>
        </div>
      </div>

      <p className="promo-upgrade-your-ships-cost-label">10 LINES</p>

      <div className="promo-upgrade-your-ships-result-copy">
        <div className="promo-upgrade-your-ships-result-title-mask">
          <p className="promo-upgrade-your-ships-result-title">
            Tactical Cruiser
          </p>
        </div>
        <div className="promo-upgrade-your-ships-result-power-mask">
          <p className="promo-upgrade-your-ships-result-power">
            <span>Deal 1 damage for each</span>
            <span>TYPE of ship you have</span>
          </p>
        </div>
      </div>
    </section>
  );
}
