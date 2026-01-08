type SpeciesProps = {
  text: string;
  text1: string;
};

function Species({ text, text1 }: SpeciesProps) {
  return (
    <div className="content-stretch flex gap-[20px] items-center relative shrink-0 text-nowrap">
      <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[36px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[0px] text-[20px] text-right">
        <span className="font-['Roboto:Regular',sans-serif] font-normal text-white" style={{ fontVariationSettings: "'wdth' 100" }}>{`from `}</span>
        <span className="font-['Roboto:SemiBold',sans-serif]" style={{ fontVariationSettings: "'wdth' 100" }}>
          {text1}
        </span>
      </p>
    </div>
  );
}

export default function SpeciesHeaderCorrections() {
  return (
    <div className="content-stretch flex flex-col gap-[40px] items-start relative size-full" data-name="Species Header Corrections">
      <div className="content-stretch flex h-[49px] items-center justify-between relative shrink-0 text-white w-full" data-name="Rules Header">
        <Species text="Human" text1="Sol" />
        <p className="font-['Roboto:Regular',sans-serif] font-normal h-[49px] leading-[22px] relative shrink-0 text-[16px] text-right w-[255px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Metal. Explosions. Expansion.
          <br aria-hidden="true" />
          {` Onward and upward.`}
        </p>
      </div>
      <div className="content-stretch flex items-center justify-between relative shrink-0 text-white w-full" data-name="Rules Header">
        <Species text="Xenite" text1="Xenon" />
        <p className="font-['Roboto:Regular',sans-serif] font-normal h-[49px] leading-[22px] relative shrink-0 text-[16px] text-right w-[255px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Swarm. Queen. Hive.
          <br aria-hidden="true" />
          Always growing.
        </p>
      </div>
      <div className="content-stretch flex items-center justify-between relative shrink-0 text-white w-full" data-name="Rules Header">
        <Species text="Centaur" text1="Alpha Centauri" />
        <p className="font-['Roboto:Regular',sans-serif] font-normal h-[49px] leading-[22px] relative shrink-0 text-[16px] text-right w-[255px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Power. Timing. Domination.
          <br aria-hidden="true" />
          Cull the weak.
        </p>
      </div>
      <div className="content-stretch flex items-center justify-between relative shrink-0 text-white w-full" data-name="Rules Header">
        <Species text="Ancient" text1="Sol" />
        <p className="font-['Roboto:Regular',sans-serif] font-normal h-[49px] leading-[22px] relative shrink-0 text-[16px] text-right w-[255px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Energy. Solar Powers.
          <br aria-hidden="true" />
          Ever present.
        </p>
      </div>
    </div>
  );
}