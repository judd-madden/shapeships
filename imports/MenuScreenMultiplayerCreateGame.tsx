import svgPaths from "./svg-sa2kpiv0ww";

function VariantHeading({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0 w-full">
      <CheckBox />
      <p className="basis-0 font-['Inter:Semi_Bold','Noto_Sans:SemiBold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px] text-white">{children}</p>
    </div>
  );
}

function Dropdown({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="bg-black content-stretch flex items-center p-[10px] relative rounded-[10px] shrink-0 w-[180px]">
      <div aria-hidden="true" className="absolute border-2 border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Wrapper3>
        <g id="Chevron Down">
          <path d={svgPaths.pd09fd80} fill="var(--fill-0, white)" id="Vector" />
        </g>
      </Wrapper3>
      <p className="font-['Roboto:Black',sans-serif] font-black leading-[36px] relative shrink-0 text-[36px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {children}
      </p>
    </div>
  );
}

function Wrapper3({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[40px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40 40">
        {children}
      </svg>
    </div>
  );
}

function RadioButton1({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[60px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 60 60">
        <g id="Radio Button">{children}</g>
      </svg>
    </div>
  );
}

function RadioButton({ children }: React.PropsWithChildren<{}>) {
  return (
    <Wrapper3>
      <g id="Radio Button">{children}</g>
    </Wrapper3>
  );
}

function Wrapper2({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[30px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 30 30">
        <g id="Check Box">{children}</g>
      </svg>
    </div>
  );
}

function Wrapper1({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 w-full">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center pl-[40px] pr-0 py-0 relative w-full">{children}</div>
      </div>
    </div>
  );
}

function Wrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <Wrapper1>
      <p className="basis-0 font-['Inter:Regular',sans-serif] font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px] text-white">{children}</p>
    </Wrapper1>
  );
}
type VariantHeadingTextProps = {
  text: string;
};

function VariantHeadingText({ text }: VariantHeadingTextProps) {
  return (
    <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0 w-full">
      <CheckBox />
      <p className="basis-0 font-['Inter:Semi_Bold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px] text-white">{text}</p>
    </div>
  );
}

function CheckBox() {
  return (
    <Wrapper2>
      <path d={svgPaths.p4d99e80} fill="var(--fill-0, white)" id="Vector" />
    </Wrapper2>
  );
}
type VariantDescriptionTextProps = {
  text: string;
};

function VariantDescriptionText({ text }: VariantDescriptionTextProps) {
  return <Wrapper>{text}</Wrapper>;
}

export default function MenuScreenMultiplayerCreateGame() {
  return (
    <div className="content-stretch flex flex-col gap-[40px] items-start relative size-full" data-name="Menu Screen - Multiplayer - Create Game">
      <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Create Game Header">
        <div className="content-stretch flex flex-col gap-[9px] items-start leading-[normal] relative shrink-0 text-white" data-name="Heading Description">
          <p className="font-['Roboto:Black',sans-serif] font-black relative shrink-0 text-[36px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Create Private Game
          </p>
          <p className="font-['Roboto:Regular',sans-serif] font-normal min-w-full relative shrink-0 text-[20px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Share the game URL with a friend.
          </p>
        </div>
        <div className="bg-[#cd8cff] content-stretch flex h-[72px] items-center justify-center p-[20px] relative rounded-[10px] shrink-0 w-[280px]" data-name="Menu Screens Button Private">
          <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            CREATE PRIVATE GAME
          </p>
        </div>
      </div>
      <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] h-px opacity-70 shrink-0 to-[rgba(255,255,255,0)] via-50% via-[#ffffff] w-full" data-name="HR" />
      <div className="relative shrink-0 w-full" data-name="Time Wrapper">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex gap-[72px] items-center pl-[50px] pr-0 py-0 relative w-full">
            <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-[164px]" data-name="Timed/Not Timed">
              <div className="content-stretch flex gap-[8px] items-center relative shrink-0 w-full" data-name="Timed">
                <RadioButton>
                  <path d={svgPaths.p278a5800} fill="var(--fill-0, white)" id="Vector" />
                  <path d={svgPaths.p1cd47a80} fill="var(--fill-0, white)" id="Vector_2" />
                </RadioButton>
                <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[26px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Timed
                </p>
              </div>
              <div className="content-stretch flex gap-[8px] items-center relative shrink-0 w-full" data-name="Not Timed">
                <RadioButton>
                  <path d={svgPaths.p24b0b080} fill="var(--fill-0, white)" id="Vector" />
                </RadioButton>
                <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[26px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Not timed
                </p>
              </div>
            </div>
            <div className="content-stretch flex gap-[52px] items-center relative shrink-0" data-name="Time Selection">
              <div className="content-stretch flex flex-col gap-[12px] items-start justify-center relative shrink-0" data-name="Minutes">
                <Dropdown>
                  <span>{`10 `}</span>
                  <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
                    min
                  </span>
                </Dropdown>
                <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Each player
                </p>
              </div>
              <div className="content-stretch flex flex-col gap-[12px] items-start justify-center relative shrink-0" data-name="Increment">
                <Dropdown>
                  <span>{`15 `}</span>
                  <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
                    sec
                  </span>
                </Dropdown>
                <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Increment per turn
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[rgba(0,0,0,0.5)] h-[129px] relative rounded-[14px] shrink-0 w-full" data-name="1v1 Standard (Default) [not selected]">
        <div aria-hidden="true" className="absolute border-2 border-[#555] border-solid inset-[-2px] pointer-events-none rounded-[16px]" />
        <div className="content-stretch flex flex-col items-start px-[37px] py-[34px] relative size-full">
          <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Radio and heading">
            <RadioButton1>
              <path d={svgPaths.p251e2300} fill="var(--fill-0, white)" id="Vector" />
              <path d={svgPaths.p20f2f8c0} fill="var(--fill-0, white)" id="Vector_2" />
            </RadioButton1>
            <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[36px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              1v1 Standard
            </p>
          </div>
        </div>
      </div>
      <div className="bg-black h-[510px] opacity-30 relative rounded-[14px] shrink-0 w-full" data-name="1v1 Variant [selected]">
        <div aria-hidden="true" className="absolute border-[6px] border-solid border-white inset-[-6px] pointer-events-none rounded-[20px]" />
        <div className="content-stretch flex flex-col gap-[40px] items-start px-[40px] py-[35px] relative size-full">
          <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="1v1 Variant Heading">
            <RadioButton1>
              <path d={svgPaths.p389a6b80} fill="var(--fill-0, white)" id="Vector" />
            </RadioButton1>
            <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[36px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              1v1 Variant<span className="font-['Roboto:Light',sans-serif] font-light" style={{ fontVariationSettings: "'wdth' 100" }}>{` (future)`}</span>
            </p>
          </div>
          <div className="h-[340px] relative shrink-0 w-full" data-name="Variant Grid [show only on selected]">
            <div className="gap-[50px] grid grid-cols-[repeat(2,_minmax(0px,_1fr))] grid-rows-[repeat(3,_minmax(0px,_1fr))] pb-[40px] pl-[30px] pr-0 pt-0 relative size-full">
              <div className="[grid-area:1_/_1] content-stretch flex flex-col gap-[5px] items-start relative self-start shrink-0 w-[414.5px]" data-name="Variant Listing">
                <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0 w-full" data-name="Variant Heading">
                  <Wrapper2>
                    <path d={svgPaths.p2da22940} fill="var(--fill-0, white)" id="Vector" />
                  </Wrapper2>
                  <p className="basis-0 font-['Inter:Semi_Bold','Noto_Sans:SemiBold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px] text-white">{`Quick Start `}</p>
                </div>
                <VariantDescriptionText text="On the first turn, roll the dice three times and add, both players receive this many lines." />
              </div>
              <div className="[grid-area:1_/_2] content-stretch flex flex-col gap-[5px] items-start relative self-start shrink-0 w-[414.5px]" data-name="Variant Listing">
                <VariantHeadingText text="Accelerated Game" />
                <VariantDescriptionText text="Roll two dice per turn. Any dice interactions occur on the second dice only." />
              </div>
              <div className="[grid-area:2_/_1] content-stretch flex flex-col gap-[5px] items-start relative self-start shrink-0 w-[414.5px]" data-name="Variant Listing">
                <VariantHeadingText text="No Destroy Powers" />
                <Wrapper>
                  <span className="font-['Inter:Italic',sans-serif] italic">Guardian</span>
                  <span>{` and `}</span>
                  <span className="font-['Inter:Italic',sans-serif] italic">Black Hole</span>
                  <span>{` are banned, and `}</span>
                  <span className="font-['Inter:Italic',sans-serif] italic">Ships of Equality</span>
                  <span>{` are built with their charges used.`}</span>
                </Wrapper>
              </div>
              <div className="[grid-area:2_/_2] content-stretch flex flex-col gap-[5px] items-start relative self-start shrink-0 w-[414.5px]" data-name="Variant Listing">
                <VariantHeading>{`Less 1s `}</VariantHeading>
                <Wrapper1>
                  <p className="basis-0 font-['Inter:Regular','Noto_Sans:Regular',sans-serif] font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px] text-white">{`Reroll 1's. Until a 6 is rolled, then the next 1 is not rerolled. `}</p>
                </Wrapper1>
              </div>
              <div className="[grid-area:3_/_1] content-stretch flex flex-col gap-[5px] items-start relative self-start shrink-0 w-[414.5px]" data-name="Variant Listing">
                <VariantHeading>{`Epic Battle `}</VariantHeading>
                <VariantDescriptionText text="Players start with 50 health, 70 max." />
              </div>
              <div className="[grid-area:3_/_2] content-stretch flex flex-col gap-[5px] items-start relative self-start shrink-0 w-[414.5px]" data-name="Variant Listing">
                <VariantHeading>{`Antimatter Species `}</VariantHeading>
                <VariantDescriptionText text="One player draws lines equal to 7 minus the dice roll, resulting in asymmetrical line amounts." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}