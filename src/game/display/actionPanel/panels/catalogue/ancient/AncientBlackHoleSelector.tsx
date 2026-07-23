import { BlackHole } from '../../../../../../graphics/ancient/assets';

interface AncientBlackHoleSelectorProps {
  damagePreview: number;
  x: number;
  y: number;
  gap: number;
}

export function AncientBlackHoleSelector({
  damagePreview,
  x,
  y,
  gap,
}: AncientBlackHoleSelectorProps) {
  return (
    <div
      className="absolute flex items-center"
      style={{ left: `${x}px`, top: `${y}px`, gap: `${gap}px` }}
    >
      <div className="shrink-0">
        <BlackHole />
      </div>

      <div
        className="flex w-[330px] shrink-0 flex-col gap-[16px] text-[18px] font-normal leading-[1.3] text-white"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <div className="flex items-baseline gap-[24px] font-bold">
          <span>Black Hole</span>
          <span className="text-[var(--shapeships-pastel-red)]">
            {damagePreview} Damage
          </span>
        </div>
        <div>
          <p className='text-[18px]'>You may select up to two basic enemy ships on the battlefield to destroy.</p>
          <p className="text-[18px] mt-[16px]">Damage will still occur if no ships are destroyed.</p>
        </div>
      </div>

      <div
        className="flex w-[270px] shrink-0 flex-col gap-[16px] font-['Roboto'] text-[18px] font-normal leading-[1.3] text-[var(--shapeships-grey-50)]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <p>If a charge-based ship is destroyed, it’s charge still occurs.</p>
        <p>
          If a ship with Automatic damage and healing is destroyed, it’s power does NOT occur
          (except ‘once only’ powers).
        </p>
      </div>
    </div>
  );
}
