import { useEffect, useState } from "react";
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";
import dice1Url from "../images/Dice1.png";
import dice2Url from "../images/Dice2.png";
import dice3Url from "../images/Dice3.png";
import dice4Url from "../images/Dice4.png";
import dice5Url from "../images/Dice5.png";
import dice6Url from "../images/Dice6.png";

const DICE_ANIMATION_DELAY_MS = 2_500;
const DICE_FACE_SEQUENCE = [2, 6, 1, 5, 3, 2, 6, 1, 5, 2, 6, 3, 4] as const;
const DICE_TICK_INTERVALS_MS = [
  120, 125, 130, 135, 145, 155, 170, 185, 200, 220, 235, 250,
] as const;
const DICE_FACE_URLS = [
  dice1Url,
  dice2Url,
  dice3Url,
  dice4Url,
  dice5Url,
  dice6Url,
] as const;

export function SharedDiceScene() {
  const [face, setFace] = useState<number>(DICE_FACE_SEQUENCE[0]);

  useEffect(() => {
    let elapsedMs = DICE_ANIMATION_DELAY_MS;
    const timers = DICE_TICK_INTERVALS_MS.map((intervalMs, index) => {
      elapsedMs += intervalMs;
      const nextFace = DICE_FACE_SEQUENCE[index + 1];

      return window.setTimeout(() => setFace(nextFace), elapsedMs);
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <section className="promo-shared-dice-scene">
      <img
        aria-hidden="true"
        alt=""
        className="promo-shared-dice-background"
        src={spaceBackgroundUrl}
      />
      <div className="promo-shared-dice-content">
        <div className="promo-shared-dice-text-group">
          <div className="promo-text-only-mask promo-text-only-mask--top">
            <p
              className="promo-text-only-line promo-text-only-line--top"
              style={{ color: "var(--shapeships-white)" }}
            >
              SHARED DICE
            </p>
          </div>
          <div aria-hidden="true" className="promo-divider" />
          <div className="promo-text-only-mask promo-text-only-mask--bottom">
            <p
              className="promo-text-only-line promo-text-only-line--bottom"
              style={{ color: "var(--shapeships-grey-50)" }}
            >
              DIFFERENT FLEETS
            </p>
          </div>
        </div>
        <div className="promo-shared-dice-wrapper">
          <img
            alt={`Dice face ${face}`}
            className="promo-shared-dice-image"
            src={DICE_FACE_URLS[face - 1]}
          />
        </div>
      </div>
    </section>
  );
}
