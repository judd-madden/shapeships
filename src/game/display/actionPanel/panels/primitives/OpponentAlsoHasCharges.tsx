/**
 * OpponentAlsoHasCharges - Callout primitive for charge declaration (UI only)
 * 
 * Renders:
 * - Large red exclamation mark (text character, not SVG)
 * - Bold white heading
 * - Grey explanatory paragraphs
 * 
 * ARCHITECTURAL NOTES:
 * - UI primitive only (no wiring to game state)
 * - Visibility controlled entirely by caller
 * - Copy is overridable but defaults match design
 */

// ============================================================================
// TYPES
// ============================================================================

interface OpponentAlsoHasChargesProps {
  className?: string;

  heading?: string;
  lines?: string[];
}

// ============================================================================
// DEFAULT COPY (MATCHES DESIGN)
// ============================================================================

const DEFAULT_HEADING = 'Your opponent also has charges available.';

const DEFAULT_LINES = [
  'If you use any charges, they can respond.',
  'If they use any charges, you can respond.',
  'If you both hold all charges, play proceeds.',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function OpponentAlsoHasCharges({
  className,
  heading = DEFAULT_HEADING,
  lines = DEFAULT_LINES,
}: OpponentAlsoHasChargesProps) {
  return (
    <div
      className={`content-stretch flex gap-[14px] items-start relative ${className ?? ''}`}
      data-name="Opponent Also Has Charges"
    >
      {/* Large Red Exclamation Mark (Text Character) */}
      <p
        className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[var(--shapeships-pastel-red)] text-[40px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        !
      </p>

      {/* Text Content Block */}
      <div
        className="content-stretch flex flex-col gap-[16px] items-start pb-[10px] relative shrink-0 text-[18px] w-[202px] whitespace-pre-wrap"
        data-name="Charge Information Content"
      >
        {/* Heading (Bold White) */}
        <p
          className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-white w-full"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {heading}
        </p>

        {/* Paragraphs (Grey 50) */}
        <div
          className="font-['Roboto:Regular',sans-serif] font-normal leading-[0] relative shrink-0 text-[var(--shapeships-grey-50)] w-full"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {lines.map((line, index) => (
            <p
              key={index}
              className={index < lines.length - 1 ? 'mb-[12px]' : ''}
            >
              <span className="leading-[normal]">{line}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
