// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";

export interface TextOnlyCenteredSceneProps {
  topText?: string;
  bottomText?: string;
  topColor?: string;
  bottomColor?: string;
}

export function TextOnlyCenteredScene({
  topText = "CHALLENGE FRIENDS",
  bottomText = "PLAY AGAINST BOTS",
  topColor = "var(--shapeships-white)",
  bottomColor = "var(--shapeships-grey-50)",
}: TextOnlyCenteredSceneProps) {
  return (
    <section className="promo-text-only-scene">
      <img
        aria-hidden="true"
        alt=""
        className="promo-text-only-background"
        src={spaceBackgroundUrl}
      />
      <div className="promo-text-only-content">
        <div className="promo-text-only-mask promo-text-only-mask--top">
          <p
            className="promo-text-only-line promo-text-only-line--top"
            style={{ color: topColor }}
          >
            {topText}
          </p>
        </div>
        <div aria-hidden="true" className="promo-divider" />
        <div className="promo-text-only-mask promo-text-only-mask--bottom">
          <p
            className="promo-text-only-line promo-text-only-line--bottom"
            style={{ color: bottomColor }}
          >
            {bottomText}
          </p>
        </div>
      </div>
    </section>
  );
}
