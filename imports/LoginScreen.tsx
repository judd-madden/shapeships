import svgPaths from "./svg-sgmbdp397k";

function Wrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[48px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
        {children}
      </svg>
    </div>
  );
}

export default function LoginScreen() {
  return (
    <div className="bg-[#101010] content-stretch flex flex-col items-center pb-[120px] pt-[60px] px-[240px] relative size-full" data-name="Login Screen">
      <div className="content-stretch flex flex-col gap-[80px] items-center relative shrink-0 w-full" data-name="Content Wrapper">
        <div className="content-stretch flex flex-col gap-[64px] items-center relative shrink-0 w-full" data-name="Login Header">
          <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0" data-name="Logo">
            <p className="[grid-area:1_/_1] font-['Inter:Bold',sans-serif] font-bold leading-[normal] ml-[203.9px] mt-[0.49px] not-italic relative text-[105.935px] text-nowrap text-white">SHAPESHIPS</p>
            <div className="[grid-area:1_/_1] flex h-[136.015px] items-center justify-center ml-0 mt-0 relative w-[159.556px]">
              <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                <div className="h-[136.015px] relative w-[159.556px]" data-name="Vector">
                  <div className="absolute inset-[-9.5%_-12.13%_-14.76%_-12.13%]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 198.271 169.018">
                      <path d={svgPaths.p2f58ad30} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #CD8CFF)" strokeMiterlimit="10" strokeWidth="13.0784" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="content-center flex flex-wrap gap-[20px_70px] items-center justify-center relative shrink-0 w-full" data-name="Summary Icons">
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0" data-name="Summary Icon 1">
              <Wrapper>
                <g id="Summary Icon 1 Image">
                  <path d={svgPaths.p35f60d00} fill="var(--fill-0, white)" id="Vector" />
                </g>
              </Wrapper>
              <p className="font-['Inter:Medium',sans-serif] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-nowrap text-white">
                A free space
                <br aria-hidden="true" />
                battle game
              </p>
            </div>
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0" data-name="Summary Icon 2">
              <Wrapper>
                <g id="Summary Icon 2 Image">
                  <path d={svgPaths.p79642e0} fill="var(--fill-0, white)" id="Vector" />
                </g>
              </Wrapper>
              <p className="font-['Inter:Medium',sans-serif] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[127.2px]">1v1 Online</p>
            </div>
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0" data-name="Summary Icon 3">
              <div className="h-[40.215px] relative shrink-0 w-[42.014px]" data-name="Summary Icon 3 Image Container">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42.0144 40.2151">
                  <g id="Summary Icon 3 Image Container">
                    <path d={svgPaths.pf9ce800} fill="var(--fill-0, white)" id="Vector" />
                    <path d={svgPaths.p10b2b780} fill="var(--fill-0, white)" id="Vector_2" />
                  </g>
                </svg>
              </div>
              <p className="font-['Inter:Medium',sans-serif] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[146.4px]">
                Simultaneous
                <br aria-hidden="true" />
                turns
              </p>
            </div>
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0" data-name="Summary Icon 4">
              <Wrapper>
                <g id="Summary Icon 4 Image">
                  <path d={svgPaths.p32df6780} fill="var(--fill-0, white)" id="Vector" />
                  <path d={svgPaths.p1c23b200} fill="var(--fill-0, white)" id="Vector_2" />
                </g>
              </Wrapper>
              <p className="font-['Inter:Medium',sans-serif] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[144px]">10-30 minute games</p>
            </div>
          </div>
        </div>
        <div className="content-stretch flex flex-col items-center relative shrink-0 w-full" data-name="Login Screen CONTENT">
          <div className="content-stretch flex flex-col gap-[50px] items-center relative shrink-0 w-[600px]" data-name="Login Screen - Anon Only">
            <div className="h-[309px] relative shrink-0 w-full" data-name="Login">
              <div className="flex flex-col items-center size-full">
                <div className="content-stretch flex flex-col gap-[20px] items-center px-[40px] py-[25px] relative size-full">
                  <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[36px] text-center text-white w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Enter your name
                  </p>
                  <div className="content-stretch flex flex-col gap-[29px] items-start relative shrink-0 w-full" data-name="Form">
                    <div className="content-stretch flex flex-col gap-[20px] items-start relative shrink-0 w-full" data-name="Inputs">
                      <div className="bg-black relative rounded-[10px] shrink-0 w-full" data-name="Login Screens Input Field">
                        <div aria-hidden="true" className="absolute border-2 border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
                        <div className="flex flex-row items-center justify-center size-full">
                          <div className="content-stretch flex items-center justify-center px-[20px] py-[19px] relative w-full">
                            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[24px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                              Player name
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white relative rounded-[10px] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.25)] shrink-0 w-full" data-name="Login Screens Button">
                      <div className="flex flex-row items-center justify-center size-full">
                        <div className="content-stretch flex items-center justify-center px-[20px] py-[17px] relative w-full">
                          <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[22px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                            PLAY
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative shrink-0 w-full" data-name="About Version">
              <div className="flex flex-col items-center size-full">
                <div className="content-stretch flex flex-col gap-[20px] items-center px-[40px] py-[25px] relative w-full">
                  <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[22px] relative shrink-0 text-[16px] text-center text-white w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                    <span className="font-['Roboto:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>
                      Online Client - Alpha Version 3.
                    </span>
                    <span>
                      <br aria-hidden="true" />
                      Name is just for this session.
                      <br aria-hidden="true" />
                      Games are not tracked.
                      <br aria-hidden="true" />
                      Private games only (send link to friend).
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="content-stretch flex font-['Roboto:Regular',sans-serif] font-normal gap-[45px] items-center leading-[normal] relative shrink-0 text-[22px] text-nowrap text-white underline" data-name="Footer links">
          <p className="[text-underline-position:from-font] decoration-solid relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
            How to Play
          </p>
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
      </div>
    </div>
  );
}