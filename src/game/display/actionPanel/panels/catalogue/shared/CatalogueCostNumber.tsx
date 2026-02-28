/**
 * Catalogue Cost Number
 * 
 * Pure presentational component for numeric cost display.
 * Inherits opacity from parent slot.
 * 
 * PASS 1 - UI-only component
 */

interface CatalogueCostNumberProps {
  cost: number;
  className?: string;
}

export function CatalogueCostNumber({ cost, className = '' }: CatalogueCostNumberProps) {
  return (
    <p
      className={`font-['Roboto'] font-bold leading-[normal] text-[18px] pt-[6px] text-center text-white ${className}`}
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      {cost}
    </p>
  );
}
