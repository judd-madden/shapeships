/**
 * Species Card Button
 * Reusable species selection card with hover and selected states
 */

export type SpeciesId = 'human' | 'xenite' | 'centaur' | 'ancient';

interface SpeciesCardButtonProps {
  speciesId: SpeciesId;
  title: string;
  blurbLines: string[];
  backgroundClassName: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}

export function SpeciesCardButton({
  title,
  blurbLines,
  backgroundClassName,
  icon,
  selected,
  onClick,
}: SpeciesCardButtonProps) {
  return (
    <button
      onClick={onClick}
      className="content-stretch flex flex-col h-[129px] items-start p-[5px] relative rounded-[14px] shrink-0 w-[310px] cursor-pointer transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      type="button"
    >
      {selected && (
        <div
          aria-hidden="true"
          className="absolute border-[6px] border-solid border-white inset-[-6px] pointer-events-none rounded-[20px]"
        />
      )}
      <div
        className={`${backgroundClassName} content-stretch flex h-[118px] items-center justify-between px-[24px] py-[21px] relative rounded-[10px] shrink-0 w-[300px]`}
      >
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 text-black w-[180px]">
          <p
            className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[22px] text-left uppercase w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {title}
          </p>
          <p
            className="font-['Roboto:Medium',sans-serif] font-medium leading-[20px] relative shrink-0 text-[13px] text-left w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {blurbLines.join(' ')}
          </p>
        </div>
        <div className="relative shrink-0">
          {icon}
        </div>
      </div>
    </button>
  );
}