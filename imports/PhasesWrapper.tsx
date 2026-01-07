import svgPaths from "./svg-j1vvk8r33j";
import clsx from "clsx";

function Wrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="bg-[#212121] relative shrink-0 w-full">
      <div className="content-stretch flex gap-[30px] items-start pb-[30px] pl-[30px] pr-[40px] pt-[24px] relative w-full">{children}</div>
    </div>
  );
}
type TextProps = {
  text: string;
  additionalClassNames?: string;
};

function Text({ text, additionalClassNames = "" }: TextProps) {
  return (
    <div className={clsx("content-stretch flex items-center relative shrink-0", additionalClassNames)}>
      <p className="font-['Roboto:SemiBold',sans-serif] font-semibold leading-[24.365px] relative shrink-0 text-[#62fff6] text-[24.365px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}

export default function PhasesWrapper() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start relative size-full" data-name="Phases Wrapper">
      <Wrapper>
        <div className="h-[96px] relative shrink-0 w-[134px]" data-name="Dice">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 134 96">
            <g clipPath="url(#clip0_498_861)" id="Dice">
              <g id="Icon - Build">
                <path d={svgPaths.p1b14fc00} fill="var(--fill-0, #D5D5D5)" id="Vector" />
                <path d={svgPaths.p3db06680} fill="var(--fill-0, #D5D5D5)" id="Vector_2" />
              </g>
            </g>
            <defs>
              <clipPath id="clip0_498_861">
                <rect fill="white" height="96" width="134" />
              </clipPath>
            </defs>
          </svg>
        </div>
        <div className="basis-0 content-stretch flex flex-col gap-[12px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Build Phase Content">
          <Text text="Build Phase" />
          <div className="font-['Inter:Regular',sans-serif] font-normal leading-[0] min-w-full not-italic relative shrink-0 text-[0px] text-white w-[min-content]">
            <p className="font-['Roboto:SemiBold',sans-serif] font-semibold leading-[26px] mb-[12.182741165161133px] text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Roll a six-sided dice.
            </p>
            <p className="font-['Roboto:SemiBold',sans-serif] font-semibold leading-[26px] mb-[12.182741165161133px] text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              All players draw (or save) that many LINES this turn.
            </p>
            <p className="leading-[26px] mb-[12.182741165161133px] text-[18px]">
              <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{`LINES make Shapeships, which are defined shapes that have powers (see `}</span>
              <span className="font-['Roboto:SemiBold',sans-serif] font-semibold text-white" style={{ fontVariationSettings: "'wdth' 100" }}>{`Shapeships `}</span>
              <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
                below).
              </span>
            </p>
            <p className="font-['Roboto:Regular',sans-serif] leading-[26px] mb-[12.182741165161133px] text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Players draw lines simultaneously, and drawing is hidden until the Battle Phase. You may save lines over multiple turns.
            </p>
            <p className="leading-[26px] text-[18px]">
              <span className="font-['Roboto:SemiBold',sans-serif] font-semibold text-white" style={{ fontVariationSettings: "'wdth' 100" }}>{`Players may action their Shapeship POWERS that occur in the Build Phase. `}</span>
              <span className="font-['Roboto:Bold',sans-serif] font-bold" style={{ fontVariationSettings: "'wdth' 100" }}>
                {" "}
              </span>
              <span className="font-['Roboto:Italic',sans-serif] font-normal italic" style={{ fontVariationSettings: "'wdth' 100" }}>
                Dice Manipulation, Line Generation, Ships That Build, Drawing, End of Build Phase.
              </span>
            </p>
          </div>
        </div>
      </Wrapper>
      <Wrapper>
        <div className="content-stretch flex items-center justify-center relative shrink-0 w-[134px]" data-name="Battle Icon">
          <div className="relative shrink-0 size-[96px]" data-name="Icon - Battle">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 96 96">
              <g id="Icon - Battle">
                <path d={svgPaths.p1733eb00} fill="var(--fill-0, white)" id="Star 1" />
              </g>
            </svg>
          </div>
        </div>
        <div className="basis-0 content-stretch flex flex-col gap-[15px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Battle Phase Content">
          <Text text="Battle Phase" additionalClassNames="gap-[5px]" />
          <div className="font-['Inter:Regular',sans-serif] font-normal leading-[0] min-w-full not-italic relative shrink-0 text-[0px] text-white w-[min-content]">
            <p className="font-['Roboto:SemiBold',sans-serif] font-semibold leading-[26px] mb-[12.182741165161133px] text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Players ships are revealed to opponents.
            </p>
            <p className="leading-[26px] mb-[12.182741165161133px] text-[18px]">
              <span className="font-['Roboto:SemiBold',sans-serif] font-semibold text-white" style={{ fontVariationSettings: "'wdth' 100" }}>{`Players Shapeship POWERS that occur in the `}</span>
              <span className="font-['Roboto:SemiBold',sans-serif] font-semibold text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                Battle Phase are actioned
              </span>
              <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{`.  Players may declare charges (optional ship powers) and respond to charges. `}</span>
            </p>
            <p className="leading-[26px] mb-[12.182741165161133px] text-[18px]">
              <span className="font-['Roboto:SemiBold',sans-serif] font-semibold text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                Each player’s HEALTH will update.
              </span>
              <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{` (if it has changed).  `}</span>
            </p>
            <p className="leading-[26px] text-[18px]">
              <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{`If either player’s health is `}</span>
              <span className="font-['Roboto:SemiBold',sans-serif] font-semibold text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                0
              </span>
              <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{` or less at the end of the turn the game is over (see `}</span>
              <span className="font-['Roboto:SemiBold',sans-serif] font-semibold text-white" style={{ fontVariationSettings: "'wdth' 100" }}>{`Victory `}</span>
              <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
                below).
              </span>
            </p>
          </div>
        </div>
      </Wrapper>
    </div>
  );
}