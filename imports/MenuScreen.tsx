import svgPaths from "./svg-zvdkaa3igi";

function Wrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="content-stretch flex items-start pb-[5px] pt-0 px-0 relative shrink-0 w-full">
      <p className="font-['Roboto:ExtraBold',sans-serif] font-extrabold leading-[22px] relative shrink-0 text-[#888] text-[20px] text-nowrap uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
        {children}
      </p>
    </div>
  );
}

export default function MenuScreen() {
  return (
    <div className="content-stretch flex flex-col items-center justify-center pb-[120px] pt-[60px] px-[240px] relative size-full" data-name="Menu Screen">
      <div className="content-stretch flex flex-col gap-[50px] items-center relative shrink-0 w-full" data-name="Content Wrapper">
        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Menu Header">
          <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0" data-name="Logo">
            <p className="[grid-area:1_/_1] font-['Inter:Bold',sans-serif] font-bold leading-[normal] ml-[130.04px] mt-[0.31px] not-italic relative text-[67.563px] text-nowrap text-white">SHAPESHIPS</p>
            <div className="[grid-area:1_/_1] flex h-[86.748px] items-center justify-center ml-0 mt-0 relative w-[101.762px]">
              <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                <div className="h-[86.748px] relative w-[101.762px]" data-name="Vector">
                  <div className="absolute inset-[-9.5%_-12.13%_-14.76%_-12.13%]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 126.453 107.796">
                      <path d={svgPaths.p1e5c7100} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #CD8CFF)" strokeMiterlimit="10" strokeWidth="8.34112" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="content-stretch flex gap-[36px] items-center justify-end relative shrink-0" data-name="Menu Right Header">
            <div className="content-stretch flex font-['Roboto:Regular',sans-serif] font-normal gap-[34px] items-center leading-[normal] relative shrink-0 text-[18px] text-nowrap text-white underline" data-name="Social">
              <p className="[text-underline-position:from-font] decoration-solid relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
                Discord
              </p>
              <p className="[text-underline-position:from-font] decoration-solid relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
                YouTube
              </p>
              <p className="[text-underline-position:from-font] decoration-solid relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
                Reddit
              </p>
            </div>
            <div className="bg-[#cd8cff] content-stretch flex h-[72px] items-center justify-center p-[20px] relative rounded-[10px] shrink-0 w-[280px]" data-name="Menu Screens Button Private">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                CREATE PRIVATE GAME
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] h-px opacity-70 shrink-0 to-[rgba(255,255,255,0)] via-50% via-[#ffffff] w-full" data-name="Header HR" />
        <div className="content-stretch flex gap-[50px] items-start relative shrink-0 w-full" data-name="Main Wrapper">
          <div className="content-stretch flex flex-col gap-[80px] items-start relative shrink-0" data-name="Sidebar">
            <div className="content-stretch flex gap-[18px] items-center justify-end relative shrink-0" data-name="Player Name">
              <div className="relative shrink-0 size-[22px]" data-name="Online Status">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
                  <g id="Online Status">
                    <circle cx="11" cy="11" fill="var(--fill-0, #00BD13)" id="Online Status_2" r="11" />
                  </g>
                </svg>
              </div>
              <div className="content-stretch flex flex-col items-start justify-center relative shrink-0" data-name="Name and Notes">
                <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[56px] text-white w-[340px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Guest 234
                </p>
                <div className="content-stretch flex items-center pl-[4px] pr-0 py-0 relative shrink-0" data-name="Player Notes">
                  <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#888] text-[16px] w-[340px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Waiting for lobby opponent
                  </p>
                </div>
              </div>
            </div>
            <div className="content-stretch flex flex-col gap-[50px] items-start pl-[40px] pr-0 py-0 relative shrink-0" data-name="Main Nav">
              <div className="content-stretch flex items-center justify-center pb-[5px] pt-0 px-0 relative shrink-0" data-name="Multiplayer (Selected)">
                <div aria-hidden="true" className="absolute border-[#cd8cff] border-[0px_0px_7px] border-solid inset-[0_0_-7px_0] pointer-events-none" />
                <p className="font-['Roboto:Black',sans-serif] font-black leading-[32px] relative shrink-0 text-[#cd8cff] text-[28px] text-nowrap uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Multiplayer
                </p>
              </div>
              <div className="content-stretch flex items-center justify-center pb-[5px] pt-0 px-0 relative shrink-0" data-name="Rules & Codex">
                <p className="font-['Roboto:Black',sans-serif] font-black leading-[32px] relative shrink-0 text-[28px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>{`Rules & Codex`}</p>
              </div>
              <p className="font-['Roboto:ExtraBold',sans-serif] font-extrabold leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
                BACK
              </p>
              <div className="content-stretch flex flex-col gap-[25px] items-start relative shrink-0 w-full" data-name="Future Menu">
                <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[normal] relative shrink-0 text-[#888] text-[18px] uppercase w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                  IN Future:
                </p>
                <Wrapper>
                  Game History
                  <br aria-hidden="true" />
                  {`& Stats`}
                </Wrapper>
                <Wrapper>Play Computer</Wrapper>
                <Wrapper>
                  Single Player
                  <br aria-hidden="true" />
                  Campaign
                </Wrapper>
              </div>
            </div>
          </div>
          <div className="content-stretch flex flex-col items-start relative shrink-0 w-[1000px]" data-name="Menu Screen CONTENT">
            <div className="content-stretch flex items-center justify-center pb-0 pt-[170px] px-0 relative shrink-0 w-full" data-name="Temporary Holding">
              <p className="basis-0 font-['Roboto:Regular',sans-serif] font-normal grow leading-[22px] min-h-px min-w-px relative shrink-0 text-[36px] text-center text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                [Public Lobby here in future]
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}