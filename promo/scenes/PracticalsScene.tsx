// @ts-ignore
import spaceBackgroundUrl from "../../src/graphics/global/space-background.jpg";

const TOP_LINES = ["FREE FOREVER", "NO SIGNUP"] as const;
const BOTTOM_LINES = ["DESKTOP & MOBILE", "BROWSER-BASED"] as const;

export function PracticalsScene() {
  return (
    <section aria-label="Practicals" className="promo-practicals-scene">
      <img
        aria-hidden="true"
        alt=""
        className="promo-practicals-background"
        src={spaceBackgroundUrl}
      />

      <div aria-hidden="true" className="promo-practicals-divider" />

      <div className="promo-practicals-copy">
        <div className="promo-practicals-group promo-practicals-group--top">
          {TOP_LINES.map((line, index) => (
            <div
              className={`promo-practicals-line-mask promo-practicals-line-mask--top promo-practicals-line-mask--top-${index + 1}`}
              key={line}
            >
              <p
                className={`promo-practicals-line promo-practicals-line--top promo-practicals-line--${index + 1}`}
              >
                {line}
              </p>
            </div>
          ))}
        </div>

        <div className="promo-practicals-group promo-practicals-group--bottom">
          {BOTTOM_LINES.map((line, index) => (
            <div
              className={`promo-practicals-line-mask promo-practicals-line-mask--bottom promo-practicals-line-mask--bottom-${index + 1}`}
              key={line}
            >
              <p
                className={`promo-practicals-line promo-practicals-line--bottom promo-practicals-line--${index + 3}`}
              >
                {line}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
