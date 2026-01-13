import svgPaths from "./svg-mjqya7g3nq";
import clsx from "clsx";

function Wrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        {children}
      </svg>
    </div>
  );
}
type Text1Props = {
  text: string;
};

function Text1({ text }: Text1Props) {
  return (
    <p style={{ fontVariationSettings: "'wdth' 100" }} className="font-['Roboto:Medium',sans-serif] font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap">
      <span className="font-['Roboto:Bold',sans-serif] font-bold" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </span>
      <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{` joining lines`}</span>
    </p>
  );
}
type Helper2Props = {
  additionalClassNames?: string;
};

function Helper2({ additionalClassNames = "" }: Helper2Props) {
  return (
    <div style={{ "--transform-inner-width": "300", "--transform-inner-height": "150" } as React.CSSProperties} className={clsx("absolute flex items-center justify-center left-[calc(50%-0.99px)] size-[40.012px] translate-x-[-50%]", additionalClassNames)}>
      <div className="flex-none rotate-[270deg]">
        <div className="relative size-[40.012px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40.0117 40.0119">
            <g id="Mask group">
              <mask height="41" id="mask0_628_580" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="21" x="0" y="0">
                <path d={svgPaths.pa36e540} fill="var(--fill-0, #212121)" id="Rectangle 59" stroke="var(--stroke-0, #D5D5D5)" />
              </mask>
              <g mask="url(#mask0_628_580)">
                <path d={svgPaths.p1869e200} fill="var(--fill-0, #212121)" id="Rectangle 60" stroke="var(--stroke-0, #555555)" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function Helper1() {
  return (
    <div className="h-0 relative shrink-0 w-full">
      <div className="absolute inset-[-1px_0_0_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 260 1">
          <line id="HR" stroke="var(--stroke-0, #555555)" x2="260" y1="0.5" y2="0.5" />
        </svg>
      </div>
    </div>
  );
}
type ShipPowerNoteTextProps = {
  text: string;
};

function ShipPowerNoteText({ text }: ShipPowerNoteTextProps) {
  return (
    <div className="content-stretch flex items-center relative shrink-0 w-full">
      <p className="basis-0 font-['Roboto:Italic',sans-serif] font-normal grow italic leading-[18px] min-h-px min-w-px relative shrink-0 text-[13px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}

function IconBattle() {
  return (
    <Wrapper>
      <g id="Icon - Battle" opacity="0.5">
        <path d={svgPaths.p13bb3a00} fill="var(--fill-0, #D5D5D5)" id="Star 1" />
      </g>
    </Wrapper>
  );
}
type TextProps = {
  text: string;
};

function Text({ text }: TextProps) {
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
    <Wrapper>
      <g id="Icon - Build" opacity="0.5">
        <g id="Vector">
          <path d={svgPaths.p18b0500} fill="var(--fill-0, #D5D5D5)" />
          <path d={svgPaths.p10157980} fill="var(--fill-0, #D5D5D5)" />
        </g>
      </g>
    </Wrapper>
  );
}
type HelperProps = {
  text: string;
  text1: string;
};

function Helper({ text, text1 }: HelperProps) {
  return (
    <div className="content-stretch flex gap-[6px] items-center leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white w-full">
      <p className="font-['Roboto:Black',sans-serif] font-black relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
      <p className="font-['Roboto:Bold',sans-serif] font-bold relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text1}
      </p>
    </div>
  );
}

export default function ShipHovers() {
  return (
    <div className="bg-[#101010] relative size-full" data-name="Ship Hovers">
      <div className="absolute bg-[#212121] content-stretch flex flex-col gap-[12px] items-start justify-end left-[381px] pb-[20px] pt-[16px] px-[20px] rounded-[10px] top-[293px] w-[300px]" data-name="Ship Rules Hover - Can Build (Complex Example)">
        <div aria-hidden="true" className="absolute border border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
        <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full" data-name="Cost Title Phases">
          <Helper text="44" text1="Leviathan" />
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            AUTOMATIC, DICE MANIPULATION
          </p>
        </div>
        <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
          <span className="font-['Roboto:Bold',sans-serif] font-bold" style={{ fontVariationSettings: "'wdth' 100" }}>
            12
          </span>{" "}
          <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
            joining lines
          </span>
        </p>
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Powers">
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBuild />
            <Text text="All dice rolls read as 6 for you." />
          </div>
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBattle />
            <Text text="Deal 12 damage." />
          </div>
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBattle />
            <Text text="Heal 12." />
          </div>
        </div>
        <ShipPowerNoteText text="Carrier charges must all be used before upgrading. Overrides reroll powers." />
        <Helper1 />
        <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[12px] relative shrink-0 text-[15px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
          Click to build
        </p>
        <Helper2 additionalClassNames="bottom-[-19px]" />
      </div>
      <div className="absolute bg-[#212121] content-stretch flex flex-col gap-[12px] items-start justify-end left-[37px] pb-[20px] pt-[16px] px-[20px] rounded-[10px] top-[422px] w-[300px]" data-name="Ship Rules Hover - Can Build (Simple Example)">
        <div aria-hidden="true" className="absolute border border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
        <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full" data-name="Cost Title Phases">
          <Helper text="3" text1="Fighter" />
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            AUTOMATIC
          </p>
        </div>
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Powers">
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBattle />
            <Text text="Deal 1 damage." />
          </div>
        </div>
        <Helper1 />
        <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[12px] relative shrink-0 text-[15px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
          Click to build
        </p>
        <Helper2 additionalClassNames="bottom-[-19px]" />
      </div>
      <div className="absolute bg-[#212121] content-stretch flex flex-col gap-[12px] items-start justify-end left-[1413px] pb-[20px] pt-[16px] px-[20px] rounded-[10px] top-[391px] w-[300px]" data-name="Ship Rules Hover - Opponent Ship (can\'t build)">
        <div aria-hidden="true" className="absolute border border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
        <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full" data-name="Cost Title Phases">
          <Helper text="4" text1="Mantis" />
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            AUTOMATIC
          </p>
        </div>
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Powers">
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBattle />
            <Text text="Heal 1 for every TWO of your Xenites." />
          </div>
        </div>
        <ShipPowerNoteText text="Each Mantis can heal a maximum of 10 per turn." />
        <Helper2 additionalClassNames="bottom-[-19.01px]" />
      </div>
      <div className="absolute bg-[#212121] content-stretch flex flex-col gap-[12px] items-start justify-end left-[1069px] pb-[20px] pt-[16px] px-[20px] rounded-[10px] top-[231px] w-[300px]" data-name="Ship Rules Hover - Not Enough Lines">
        <div aria-hidden="true" className="absolute border border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
        <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
          <Helper text="27" text1="Dreadnought" />
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            DRAWING, AUTOMATIC
          </p>
        </div>
        <Text1 text="10" />
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Powers">
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBuild />
            <Text text="When you complete a ship, you may make a FREE additional Fighter." />
          </div>
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBattle />
            <Text text="Deal 10 damage." />
          </div>
        </div>
        <ShipPowerNoteText text="The Dreadnought’s build power activates whenever you make a basic ship (including from Carriers) or complete an upgraded ship. It can occur multiple times per turn. Is not activated by itself or other Dreadnoughts." />
        <Helper1 />
        <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
          Not enough lines
        </p>
        <Helper2 additionalClassNames="bottom-[-19px]" />
      </div>
      <div className="absolute bg-[#212121] content-stretch flex flex-col gap-[12px] items-start justify-end left-[1413px] pb-[20px] pt-[16px] px-[20px] rounded-[10px] top-[26px] w-[300px]" data-name="Ship Rules Hover - Need Component Ships">
        <div aria-hidden="true" className="absolute border border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
        <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
          <Helper text="25" text1="Hive" />
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            AUTOMATIC, PASSIVE
          </p>
        </div>
        <Text1 text="4" />
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Powers">
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBuild />
            <Text text="Deal 1 damage for each of your ships." />
          </div>
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBuild />
            <Text text="Heal 1 for each of your ships." />
          </div>
          <div className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full" data-name="Ship Power">
            <IconBuild />
            <Text text="Xenites, Oxites and Asterites within your upgraded ships DO count for Mantis and Hell Hornet powers." />
          </div>
        </div>
        <Helper1 />
        <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
          Need component ships
        </p>
        <div className="content-center flex flex-wrap gap-[16px] items-center relative shrink-0" data-name="Component Ships">
          <div className="relative shrink-0 size-[22px]" data-name="Xenite [lm]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
              <g id="Xenite [lm]">
                <path d="M18.5 3.5L3.5 18.5" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                <path d="M3.5 3.5L18.5 18.5" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              </g>
            </svg>
          </div>
          <div className="content-stretch flex gap-[6px] items-center relative shrink-0" data-name="Multiple Component Ships">
            <div className="h-[20px] relative shrink-0 w-[22px]" data-name="Mantis">
              <div className="absolute inset-[-7.5%_-6.82%]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 25 23">
                  <g id="Mantis">
                    <path d={svgPaths.pd062300} id="Vector" stroke="var(--stroke-0, #9CFF84)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  </g>
                </svg>
              </div>
            </div>
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              2
            </p>
          </div>
          <div className="content-stretch flex gap-[6px] items-center relative shrink-0" data-name="Multiple Component Ships">
            <div className="h-[20px] relative shrink-0 w-[50px]" data-name="Bug Breeder">
              <div className="absolute inset-[-7.5%_-3%]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 53 23">
                  <g id="Bug Breeder">
                    <path d={svgPaths.p33bda380} id="Vector" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                    <path d={svgPaths.p8a28650} id="Vector_2" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    <path d={svgPaths.p7291400} id="Vector_3" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    <path d={svgPaths.p351d7f90} id="Vector_4" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    <path d={svgPaths.p1ea32d80} id="Vector_5" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    <path d={svgPaths.p2a9d3a80} id="Vector_6" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  </g>
                </svg>
              </div>
            </div>
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              2
            </p>
          </div>
          <div className="h-[20px] relative shrink-0 w-[50px]" data-name="Hell Hornet">
            <div className="absolute inset-[-7.5%_-1%_-7.5%_-3%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 52 23">
                <g id="Hell Hornet">
                  <path d="M1.5 12H21.5" id="Vector" stroke="var(--stroke-0, #FF8282)" strokeLinejoin="round" strokeWidth="3" />
                  <path d="M1.5 1.5V21.5" id="Vector_2" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  <path d="M22 1.5V21.5" id="Vector_3" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  <path d="M30.5 12H50.5" id="Vector_4" stroke="var(--stroke-0, #FF8282)" strokeLinejoin="round" strokeWidth="3" />
                  <path d="M30.5 1.5V21.5" id="Vector_5" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  <path d="M50.5 1.5V21.5" id="Vector_6" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                </g>
              </svg>
            </div>
          </div>
        </div>
        <Helper2 additionalClassNames="bottom-[-18.01px]" />
      </div>
    </div>
  );
}