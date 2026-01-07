import svgPaths from "./svg-gidv1d6x5r";
import clsx from "clsx";
import imgD6 from "figma:asset/1efd037aa013abea7a113cc6e3e9a869d374841d.png";
type Wrapper1Props = {
  additionalClassNames?: string;
};

function Wrapper1({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper1Props>) {
  return (
    <div className={clsx("relative shrink-0 w-full", additionalClassNames)}>
      <div className="content-stretch flex flex-col gap-[8.397px] items-start pl-[104.966px] pr-[75.576px] py-[33.589px] relative w-full">{children}</div>
    </div>
  );
}

function Wrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[33.589px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 33.5892 33.5892">
        {children}
      </svg>
    </div>
  );
}
type ChevronRightProps = {
  additionalClassNames?: string;
};

function ChevronRight({ additionalClassNames = "" }: ChevronRightProps) {
  return (
    <div className={clsx("absolute size-[50.384px]", additionalClassNames)}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 50.3837 50.3837">
        <g clipPath="url(#clip0_503_244)" id="chevron_right">
          <g id="Vector"></g>
          <path d={svgPaths.p12e4c000} fill="var(--fill-0, #555555)" id="Vector_2" />
        </g>
        <defs>
          <clipPath id="clip0_503_244">
            <rect fill="white" height="50.3837" width="50.3837" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

export default function MenuScreenRulesTurnTimings() {
  return (
    <div className="content-stretch flex flex-col gap-[90px] items-start justify-center relative size-full" data-name="Menu Screen - Rules - Turn Timings">
      <div className="content-stretch flex flex-col gap-[48px] items-start relative shrink-0 w-full" data-name="Rules - Turn Timings">
        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Rules Header">
          <div className="content-stretch flex gap-[20px] items-center relative shrink-0" data-name="Species">
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[36px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              Turn Timings
            </p>
          </div>
          <p className="font-['Roboto:Regular',sans-serif] font-normal h-[49px] leading-[22px] relative shrink-0 text-[16px] text-right text-white w-[215px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            A breakdown of the phases that can occur during a turn.
          </p>
        </div>
        <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[20.993px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
          START OF TURN
        </p>
        <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Timings - Build Wrapper">
          <div aria-hidden="true" className="absolute border-[#555] border-[3px] border-solid inset-[-3px] pointer-events-none" />
          <div className="bg-[#555] h-[75.576px] relative shrink-0 w-full" data-name="Build Phase Header">
            <div className="flex flex-row items-center size-full">
              <div className="content-stretch flex items-center px-[41.986px] py-[18.894px] relative size-full">
                <div className="content-stretch flex gap-[16.795px] items-center relative shrink-0" data-name="Heading and Icon">
                  <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[20.993px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Build Phase
                  </p>
                  <Wrapper>
                    <g id="Icon - Build">
                      <g id="Vector">
                        <path d={svgPaths.p15f6e780} fill="var(--fill-0, #D5D5D5)" />
                        <path d={svgPaths.p25645a50} fill="var(--fill-0, #D5D5D5)" />
                      </g>
                    </g>
                  </Wrapper>
                </div>
              </div>
            </div>
          </div>
          <Wrapper1>
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[20.993px] min-w-full relative shrink-0 text-[18.894px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              <span>{`Dice Roll `}</span>
              <span className="font-['Roboto:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>{`& Dice Manipulation`}</span>
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[16.795px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Roll a six sided dice for all players. Dice Manipulation powers may change the result.
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              <span>{`Leviathan, `}</span>Ark of Knowledge.
            </p>
            <div className="absolute h-[50px] left-[31px] top-[33.42px] w-[52px]" data-name="Dice">
              <div className="absolute inset-[0_0_-3.8%_0]" data-name="d6">
                <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgD6} />
              </div>
            </div>
          </Wrapper1>
          <Wrapper1 additionalClassNames="bg-[#212121]">
            <p className="font-['Roboto:SemiBold',sans-serif] font-semibold leading-[20.993px] min-w-full relative shrink-0 text-[18.894px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Line Generation
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[16.795px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Players calculate available lines by adding the dice roll, any saved lines, and any bonus lines from ships powers.
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Orbital, Battlecruiser, 3rd Science Vessel, Oxite Face, Asterite Face, Ship of Vigor, Ark of Redemption, Ark of Power, Ark of Domination, Convert.
            </p>
            <ChevronRight additionalClassNames="left-[34px] top-[calc(50%-54.84px)] translate-y-[-50%]" />
          </Wrapper1>
          <Wrapper1>
            <p className="font-['Roboto:SemiBold',sans-serif] font-semibold leading-[20.993px] min-w-full relative shrink-0 text-[18.894px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Ships That Build
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[16.795px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Players may use their Ships That Build before the drawing phase. Ships made now can be used for upgrades, and are active this Battle Phase.
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Carrier, Bug Breeder, Zenith, Sacrificial Pool.
            </p>
            <ChevronRight additionalClassNames="left-[34px] top-[calc(50%-43.32px)] translate-y-[-50%]" />
          </Wrapper1>
          <Wrapper1 additionalClassNames="bg-[#212121]">
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[20.993px] min-w-full relative shrink-0 text-[18.894px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Drawing
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[16.795px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              <span>{`Players draw ships, and/or save lines. Drawing powers occur in this phase. Note that any ‘Ships That Build’ drawn `}</span>
              <span className="font-['Roboto:Italic',sans-serif] italic" style={{ fontVariationSettings: "'wdth' 100" }}>
                now
              </span>
              <span>{` will not be active until next turn.`}</span>
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Frigate, Dreadnought, Evolver, Zenith, Ship of Legacy.
            </p>
            <ChevronRight additionalClassNames="left-[34px] top-[19.51px]" />
          </Wrapper1>
          <Wrapper1>
            <p className="font-['Roboto:SemiBold',sans-serif] font-semibold leading-[20.993px] min-w-full relative shrink-0 text-[18.894px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              End of Build Phase
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[16.795px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Some special powers occur now, before the Battle Phase begins.
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Chronoswarm, Ark of Redemption.
            </p>
            <ChevronRight additionalClassNames="left-[34px] top-[calc(50%-31.76px)] translate-y-[-50%]" />
          </Wrapper1>
        </div>
        <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Timings - Battle Wrapper">
          <div aria-hidden="true" className="absolute border-[#555] border-[3px] border-solid inset-[-3px] pointer-events-none" />
          <div className="bg-[#555] h-[75.576px] relative shrink-0 w-full" data-name="Battle Phase Header">
            <div className="content-stretch flex flex-col items-start px-[41.986px] py-[20.993px] relative size-full">
              <div className="content-stretch flex gap-[18.894px] items-center relative shrink-0" data-name="Heading and Icon">
                <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[20.993px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
                  BATTLE PHASE
                </p>
                <Wrapper>
                  <g id="Icon - Battle">
                    <path d={svgPaths.p4b01e80} fill="var(--fill-0, white)" id="Star 1" />
                  </g>
                </Wrapper>
              </div>
            </div>
          </div>
          <Wrapper1>
            <p className="font-['Roboto:SemiBold',sans-serif] font-semibold leading-[20.993px] min-w-full relative shrink-0 text-[18.894px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              First Strike
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[16.795px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Ship powers with First Strike occur. Any ships that are destroyed during this phase will not activate their Battle Phase powers. Any ships that are stolen during this phase will be active for their owner.
            </p>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Guardian, Ark of Domination.
            </p>
            <ChevronRight additionalClassNames="left-[34px] top-[calc(50%-43.81px)] translate-y-[-50%]" />
          </Wrapper1>
          <Wrapper1 additionalClassNames="bg-[#212121]">
            <p className="font-['Inter:Semi_Bold',sans-serif] font-['Roboto:SemiBold',sans-serif] font-semibold leading-[20.993px] min-w-full not-italic relative shrink-0 text-[18.894px] text-white w-[min-content]">
              <span style={{ fontVariationSettings: "'wdth' 100" }}>{`Charge Declaration `}</span>
              <span className="text-[#d4d4d4]" style={{ fontVariationSettings: "'wdth' 100" }}>
                / Solar Powers
              </span>
            </p>
            <div className="font-['Roboto:Regular',sans-serif] font-normal leading-[0] min-w-full relative shrink-0 text-[16.795px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              <p className="leading-[23.093px] mb-[8.39729118347168px]">Players may declare charge powers (max one per ship per turn) or hold the charges. Ancients may use solar powers if they have energy to do so. Players may declare multiple charges, or hold them in response to opponent declarations.</p>
              <p className="leading-[23.093px]">
                <span>{`If NO players declare charges now, then proceed to `}</span>
                <span className="font-['Roboto:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>
                  End of Turn Resolution
                </span>
                .
              </p>
            </div>
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Interceptor, Antlion, Ship of Equality, Ship of Wisdom, Ship of Family, Solar Powers.
            </p>
            <ChevronRight additionalClassNames="left-[34px] top-[calc(50%-70.78px)] translate-y-[-50%]" />
          </Wrapper1>
          <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Charge Response / Solar Powers">
            <div aria-hidden="true" className="absolute border-[#555] border-[0px_0px_0px_21px] border-solid inset-0 pointer-events-none" />
            <div className="relative shrink-0 w-full" data-name="Charge Response Inner">
              <div className="content-stretch flex flex-col gap-[8.397px] items-start pl-[146.953px] pr-[75.576px] py-[41.986px] relative w-full">
                <p className="font-['Inter:Semi_Bold',sans-serif] font-['Roboto:SemiBold',sans-serif] font-semibold leading-[20.993px] min-w-full not-italic relative shrink-0 text-[18.894px] text-white w-[min-content]">
                  <span style={{ fontVariationSettings: "'wdth' 100" }}>Charge Response</span>
                  <span className="text-[#d4d4d4]" style={{ fontVariationSettings: "'wdth' 100" }}>{` / Solar Powers`}</span>
                </p>
                <div className="font-['Roboto:Regular',sans-serif] font-normal leading-[0] min-w-full relative shrink-0 text-[0px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  <p className="leading-[23.093px] mb-[8.39729118347168px] text-[16.795px]">Players may declare charge powers in response to opponent’s declarations or hold the charges. Ancients may use solar powers if they have energy to do so. Players may declare multiple charges, or hold them until a future turn.</p>
                  <p className="leading-[23.093px] mb-[8.39729118347168px]">
                    <span className="text-[16.795px]">{`If a charge-based ship is destroyed, it’s charge still occurs. `}</span>
                    <span className="font-['Roboto:Italic',sans-serif] font-normal italic text-[14.8px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                      See also Ship of Equality rules.
                    </span>
                  </p>
                  <p className="leading-[23.093px] mb-[8.39729118347168px] text-[16.795px]">If a ship with Automatic damage and healing is destroyed, it’s power does NOT occur (except ‘once only’ powers).</p>
                  <p className="leading-[23.093px] text-[16.795px]">
                    <span>{`All damage and healing is resolved in `}</span>
                    <span className="font-['Roboto:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>
                      End of Turn Resolution.
                    </span>
                  </p>
                </div>
                <ChevronRight additionalClassNames="left-[80px] top-[27.04px]" />
              </div>
            </div>
            <Wrapper1 additionalClassNames="bg-[#212121]">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[20.993px] relative shrink-0 text-[18.894px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                End of Turn Resolution
              </p>
              <p className="font-['Inter:Medium',sans-serif] font-medium leading-[23.093px] min-w-full not-italic relative shrink-0 text-[16.795px] text-white w-[min-content]">
                <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{`Resolve all damage and healing effects simultaneously, then update health once. This includes damage and healing from all `}</span>
                <span className="font-['Roboto:Black',sans-serif] font-black" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Automatic
                </span>
                <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{` ship powers (including ‘once-only’), and all damage and healing from Charges. Players cannot be above 35 health after resolution. If any player is 0 or below go to `}</span>
                <span className="font-['Roboto:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Victory
                </span>
                <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>{` (Core Rules).`}</span>
              </p>
              <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
                (All Automatic Ships)
              </p>
              <div className="absolute left-[34px] size-[50.384px] top-[18.67px]" data-name="favorite">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 50.3837 50.3837">
                  <g clipPath="url(#clip0_503_231)" id="favorite">
                    <g id="Vector"></g>
                    <path d={svgPaths.p2486ca00} fill="var(--fill-0, white)" id="Vector_2" />
                  </g>
                  <defs>
                    <clipPath id="clip0_503_231">
                      <rect fill="white" height="50.3837" width="50.3837" />
                    </clipPath>
                  </defs>
                </svg>
              </div>
            </Wrapper1>
          </div>
        </div>
        <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[20.993px] text-nowrap text-right text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
          END OF TURN
        </p>
        <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Button">
          <div className="bg-white content-stretch flex items-center justify-center px-[30px] py-[20px] relative rounded-[10px] shrink-0">
            <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              Next: Core Rules
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}