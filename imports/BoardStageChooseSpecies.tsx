import svgPaths from "./svg-h27fqsqj0z";
type HelperProps = {
  text: string;
  text1: string;
  text2: string;
};

function Helper({ text, text1, text2 }: HelperProps) {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 text-black w-[180px]">
      <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[22px] uppercase w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
      <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[20px] relative shrink-0 text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text1}
        <br aria-hidden="true" />
        {text2}
      </p>
    </div>
  );
}

export default function BoardStageChooseSpecies() {
  return (
    <div className="content-stretch flex gap-[8px] items-start justify-center px-0 py-[12px] relative size-full" data-name="Board Stage - Choose Species">
      <div className="basis-0 content-stretch flex grow h-full items-center justify-center min-h-px min-w-px relative shrink-0" data-name="Choose Species Wrapper">
        <div className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0 w-[641px]" data-name="Game Screen - Choose Species">
          <div className="content-stretch flex flex-col gap-[12px] items-center relative shrink-0 w-full" data-name="Choose Heading">
            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[30px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                Choose Your Species
              </p>
              <div className="content-stretch flex flex-col items-start pl-[4px] pr-0 py-0 relative shrink-0">
                <div className="bg-white content-stretch flex gap-[4px] h-[50px] items-center justify-center leading-[normal] px-[20px] py-[19px] relative rounded-[10px] shrink-0 text-[18px] text-black text-nowrap w-[300px]" data-name="Game Screen - Ready Button">
                  <p className="font-['Roboto:Black',sans-serif] font-black relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
                    CONFIRM
                  </p>
                  <p className="font-['Roboto:Regular',sans-serif] font-normal relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
                    - HUMAN
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="content-start flex flex-wrap gap-[28px_20px] items-start relative shrink-0 w-full" data-name="Official Species Selection">
            <div className="content-stretch flex flex-col h-[129px] items-start p-[5px] relative rounded-[14px] shrink-0 w-[310px]" data-name="Human Selection - Selected with Outline">
              <div aria-hidden="true" className="absolute border-[6px] border-solid border-white inset-[-6px] pointer-events-none rounded-[20px]" />
              <div className="bg-[#62fff6] content-stretch flex h-[118px] items-center justify-between px-[24px] py-[21px] relative rounded-[10px] shrink-0 w-[300px]" data-name="Human Selection Inner">
                <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 text-black w-[180px]" data-name="Human Heading and Blurb">
                  <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[22px] uppercase w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                    HUMAN
                  </p>
                  <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[20px] relative shrink-0 text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Metal. Explosions. Expansion. Onward and upward.
                  </p>
                </div>
                <div className="h-[50.497px] relative shrink-0 w-[57.979px]" data-name="Carrier [lm]">
                  <div className="absolute inset-[-4.12%_-4.13%]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 62.7709 54.6536">
                      <g id="Carrier [lm]">
                        <path d={svgPaths.peedeb00} fill="var(--fill-0, #62FFF6)" id="Carrier" stroke="var(--stroke-0, black)" strokeMiterlimit="10" strokeWidth="4.15617" />
                      </g>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="content-stretch flex flex-col h-[129px] items-start p-[5px] relative rounded-[14px] shrink-0 w-[310px]" data-name="Xenite Selection">
              <div className="bg-[#9cff84] content-stretch flex h-[118px] items-center justify-between px-[24px] py-[21px] relative rounded-[10px] shrink-0 w-[300px]" data-name="Xenite Selection Inner">
                <Helper text="Xenite" text1="Swarm. Queen. Hive." text2="Always growing." />
                <div className="relative shrink-0 size-[41.562px]" data-name="Xenite [lm]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 41.5617 41.5617">
                    <g id="Xenite [lm]">
                      <path d={svgPaths.p38f7d950} id="Vector" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.9874" />
                      <path d={svgPaths.pdb7aac0} id="Vector_2" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.9874" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            <div className="content-stretch flex flex-col h-[129px] items-start p-[5px] relative rounded-[14px] shrink-0 w-[310px]" data-name="Centaur Selection">
              <div className="bg-[#ff8282] content-stretch flex h-[118px] items-center justify-between px-[24px] py-[21px] relative rounded-[10px] shrink-0 w-[300px]" data-name="Centaur Selection Inner">
                <Helper text="CENTAUR" text1="Power. Timing. Domination." text2="Cull the weak." />
                <div className="relative shrink-0 size-[59.433px]" data-name="Ship of Wisdom">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 59.4332 59.4332">
                    <path d={svgPaths.p12cdbd00} fill="var(--fill-0, #FF8282)" id="Vector" stroke="var(--stroke-0, black)" strokeMiterlimit="10" strokeWidth="3.52197" />
                  </svg>
                  <div className="absolute inset-[11.11%]" data-name="Vector">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 46.2258 46.2258">
                      <path d={svgPaths.p1d3f6880} fill="var(--fill-0, #FF8282)" id="Vector" stroke="var(--stroke-0, black)" strokeMiterlimit="10" strokeWidth="3.52197" />
                    </svg>
                  </div>
                  <div className="absolute contents inset-[36.67%_21.11%]" data-name="Group">
                    <div className="absolute inset-[36.67%_21.11%]">
                      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34.3392 15.8489">
                        <g id="Group 1">
                          <path d={svgPaths.pc35f800} fill="var(--fill-0, #FF8282)" id="Vector" stroke="var(--stroke-0, black)" strokeMiterlimit="10" strokeWidth="3.52197" />
                          <path d={svgPaths.p10eb4d00} fill="var(--fill-0, #FF8282)" id="Vector_2" stroke="var(--stroke-0, black)" strokeMiterlimit="10" strokeWidth="3.52197" />
                        </g>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="content-stretch flex flex-col h-[129px] items-start p-[5px] relative rounded-[14px] shrink-0 w-[310px]" data-name="Ancient Selection">
              <div className="bg-[#cd8cff] content-stretch flex h-[118px] items-center justify-between px-[24px] py-[21px] relative rounded-[10px] shrink-0 w-[300px]" data-name="Ancient Selection Inner">
                <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-[180px]" data-name="Ancient Heading and Blurb">
                  <div className="content-stretch flex gap-[15px] items-center relative shrink-0" data-name="Ancient Future">
                    <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[22px] text-black text-nowrap uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
                      Ancient
                    </p>
                  </div>
                  <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[20px] min-w-full relative shrink-0 text-[13px] text-black w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Energy. Solar Powers.
                    <br aria-hidden="true" />
                    Ever present.
                  </p>
                </div>
                <div className="h-[58.602px] relative shrink-0 w-[27.431px]" data-name="Mercury Core">
                  <div className="absolute inset-[0_-7.58%_-3.55%_-7.58%]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 31.5869 60.6801">
                      <g id="Mercuryâ¨Core">
                        <path d={svgPaths.p31620d00} id="Line 5" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeWidth="4.15617" />
                        <path d={svgPaths.p2ab1dd60} id="Line 6" stroke="var(--stroke-0, black)" strokeLinecap="round" strokeWidth="4.15617" />
                        <ellipse cx="15.7934" cy="20.6831" id="Ellipse 1" rx="10.2865" ry="10.3415" stroke="var(--stroke-0, black)" strokeWidth="4.15617" />
                        <path d={svgPaths.p6451600} id="Ellipse 2" stroke="var(--stroke-0, black)" strokeWidth="4.15617" />
                      </g>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="basis-0 content-stretch flex flex-col grow h-full items-center min-h-px min-w-px relative shrink-0" data-name="Share Wrapper">
        <div className="content-stretch flex flex-col gap-[24px] items-center pb-0 pt-[130px] px-0 relative shrink-0 w-[657.6px]" data-name="Game Screen - Share Game Large Prompt">
          <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] min-w-full relative shrink-0 text-[30px] text-center text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Share Game URL
          </p>
          <div className="bg-white content-stretch flex gap-[13.3px] items-center px-[21px] py-[7px] relative rounded-[7px] shrink-0" data-name="Game URL Button">
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[16px] text-black text-center text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              https://shapeships.juddmadden.com/game=?F2FS44
            </p>
            <div className="relative shrink-0 size-[42px]" data-name="content_copy">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42 42">
                <g clipPath="url(#clip0_580_364)" id="content_copy">
                  <g id="Vector"></g>
                  <path d={svgPaths.p3cb8d00} fill="var(--fill-0, black)" id="Vector_2" />
                </g>
                <defs>
                  <clipPath id="clip0_580_364">
                    <rect fill="white" height="42" width="42" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[15.4px] text-black text-center text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              COPY URL
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}