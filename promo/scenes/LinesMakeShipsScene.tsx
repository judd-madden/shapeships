// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";
import { InterceptorShip1 } from "../../src/graphics/human/Interceptor";
// @ts-ignore
import dice4Url from "../images/Dice4.png";

export function LinesMakeShipsScene() {
  return (
    <section
      aria-label="Dice gives lines, lines make ships"
      className="promo-lines-make-ships-scene"
    >
      <img
        aria-hidden="true"
        alt=""
        className="promo-lines-make-ships-background"
        src={spaceBackgroundUrl}
      />

      <div className="promo-lines-make-ships-text-group">
        <div className="promo-lines-make-ships-text-mask promo-lines-make-ships-text-mask--top">
          <p className="promo-lines-make-ships-line promo-lines-make-ships-line--old-top">
            SHARED DICE
          </p>
          <p className="promo-lines-make-ships-line promo-lines-make-ships-line--new-top">
            DICE GIVES LINES
          </p>
        </div>

        <div
          aria-hidden="true"
          className="promo-lines-make-ships-divider"
        />

        <div className="promo-lines-make-ships-text-mask promo-lines-make-ships-text-mask--bottom">
          <p className="promo-lines-make-ships-line promo-lines-make-ships-line--old-bottom">
            DIFFERENT FLEETS
          </p>
          <p className="promo-lines-make-ships-line promo-lines-make-ships-line--new-bottom">
            LINES MAKE SHIPS
          </p>
        </div>
      </div>

      <div className="promo-lines-make-ships-equation">
        <div className="promo-lines-make-ships-dice-group">
          <img
            alt="Dice face 4"
            className="promo-lines-make-ships-dice-image"
            src={dice4Url}
          />
        </div>

        <div
          aria-hidden="true"
          className="promo-lines-make-ships-equals-group"
        >
          <span className="promo-lines-make-ships-equals-bar promo-lines-make-ships-equals-bar--top" />
          <span className="promo-lines-make-ships-equals-bar promo-lines-make-ships-equals-bar--bottom" />
        </div>

        <div className="promo-lines-make-ships-ship-group">
          <InterceptorShip1 className="promo-lines-make-ships-ship" />
          <p className="promo-lines-make-ships-cost-label">4 LINE SHIP</p>
        </div>
      </div>
    </section>
  );
}
