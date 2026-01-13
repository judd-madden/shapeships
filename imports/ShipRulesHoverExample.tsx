import svgPaths from "./svg-1jmz22s33m";
type TextNudgeTextProps = {
  text: string;
};

function TextNudgeText({ text }: TextNudgeTextProps) {
  return (
    <div className="basis-0 content-stretch flex grow items-center justify-center min-h-px min-w-px pb-0 pt-[2px] px-0 relative shrink-0">
      <p className="basis-0 font-['Roboto:Regular',sans-serif] font-normal grow leading-[18px] min-h-px min-w-px relative shrink-0 text-[16px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}

function IconBuild() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon - Build" opacity="0.5">
          <g id="Vector">
            <path d={svgPaths.p18b0500} fill="var(--fill-0, #D5D5D5)" />
            <path d={svgPaths.p10157980} fill="var(--fill-0, #D5D5D5)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export default function ShipRulesHoverExample() {
  return (
    <div className="bg-[#212121] content-stretch flex flex-col gap-[12px] items-start justify-end pb-[20px] pt-[16px] px-[20px] relative rounded-[10px] size-full" data-name="Ship Rules Hover - Example">
      <div aria-hidden="true" className="absolute border border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
        <div className="content-stretch flex gap-[6px] items-center leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white w-full">
          <p className="font-['Roboto:Black',sans-serif] font-black relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
            25
          </p>
          <p className="font-['Roboto:Bold',sans-serif] font-bold relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
            Chronoswarm
          </p>
        </div>
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
          END OF BUILD PHASE
        </p>
      </div>
      <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        <span className="font-['Roboto:Bold',sans-serif] font-bold" style={{ fontVariationSettings: "'wdth' 100" }}>
          4
        </span>
        <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{` joining lines`}</span>
      </p>
      <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Powers">
        <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
          <IconBuild />
          <TextNudgeText text="Each turn, before the battle phase, you take an extra build phase. (Includes Dice Roll, Ships That Build and Drawing, but not Face lines.)" />
        </div>
        <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
          <IconBuild />
          <TextNudgeText text="If you have two: Roll 2 dice in the extra build phase." />
        </div>
        <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
          <IconBuild />
          <TextNudgeText text="If you have three: Roll 3 dice in the extra build phase." />
        </div>
      </div>
      <div className="content-stretch flex items-center relative shrink-0 w-full" data-name="Ship Power Note">
        <p className="basis-0 font-['Roboto:Italic',sans-serif] font-normal grow italic leading-[18px] min-h-px min-w-px relative shrink-0 text-[13px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
          Does not occur the turn it is built. Opponent sees the dice roll(s). If multiple players have Chronoswarms, they all use the same dice rolls. (For 2 and 3) Use only the last rolled dice for Zeniths - not each dice.
        </p>
      </div>
      <div className="h-0 relative shrink-0 w-full">
        <div className="absolute inset-[-1px_0_0_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 260 1">
            <line id="Line 33" stroke="var(--stroke-0, #555555)" x2="260" y1="0.5" y2="0.5" />
          </svg>
        </div>
      </div>
      <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        Need component ships
      </p>
      <div className="content-center flex flex-wrap gap-[16px] items-center relative shrink-0" data-name="Component Ships">
        <div className="content-stretch flex gap-[6px] items-center relative shrink-0" data-name="Multiple Component Ships">
          <div className="relative shrink-0 size-[22px]" data-name="Xenite [lm]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
              <g id="Xenite [lm]">
                <path d="M18.5 3.5L3.5 18.5" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                <path d="M3.5 3.5L18.5 18.5" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              </g>
            </svg>
          </div>
          <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
            4
          </p>
        </div>
        <div className="h-[20px] relative shrink-0 w-[75px]" data-name="Zenith">
          <div className="absolute inset-[-7.5%_-2%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 78.0001 23">
              <g id="Zenith">
                <path d={svgPaths.p2b409520} id="Vector" stroke="var(--stroke-0, #FCFF81)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                <path d="M29 1.5H49L29 21.5H49" id="Vector_2" stroke="var(--stroke-0, #FCFF81)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                <path d={svgPaths.p2df9fa20} id="Vector_3" stroke="var(--stroke-0, #FCFF81)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              </g>
            </svg>
          </div>
        </div>
      </div>
      <div className="absolute bottom-[-19px] flex items-center justify-center left-[calc(50%-0.99px)] size-[40.012px] translate-x-[-50%]" style={{ "--transform-inner-width": "0", "--transform-inner-height": "0" } as React.CSSProperties}>
        <div className="flex-none rotate-[270deg]">
          <div className="relative size-[40.012px]" data-name="Mask group">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40.0117 40.0119">
              <g id="Mask group">
                <mask height="41" id="mask0_599_193" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="21" x="0" y="0">
                  <path d={svgPaths.pa36e540} fill="var(--fill-0, #212121)" id="Rectangle 59" stroke="var(--stroke-0, #D5D5D5)" />
                </mask>
                <g mask="url(#mask0_599_193)">
                  <path d={svgPaths.p1869e200} fill="var(--fill-0, #212121)" id="Rectangle 60" stroke="var(--stroke-0, #555555)" />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}