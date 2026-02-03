import svgPaths from "./svg-4h7xzehh03";

function HellHornet() {
  return (
    <div className="h-[34px] relative shrink-0 w-[85px]" data-name="Hell Hornet">
      <div className="absolute inset-[-7.35%_-0.94%_-7.35%_-2.94%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 88.3 39">
          <g id="Hell Hornet">
            <path d="M2.5 20.35H36.5" id="Vector" stroke="var(--stroke-0, #FF8282)" strokeLinejoin="round" strokeWidth="5" />
            <path d="M2.5 2.5V36.5" id="Vector_2" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
            <path d="M37.35 2.5V36.5" id="Vector_3" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
            <path d="M51.8 20.35H85.8" id="Vector_4" stroke="var(--stroke-0, #FF8282)" strokeLinejoin="round" strokeWidth="5" />
            <path d="M51.8 2.5V36.5" id="Vector_5" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
            <path d="M85.8 2.5V36.5" id="Vector_6" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function HellHornetAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0" data-name="Hell Hornet and Cost">
      <HellHornet />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        6
      </p>
    </div>
  );
}

function BugBreeder() {
  return (
    <div className="h-[34px] relative shrink-0 w-[85px]" data-name="Bug Breeder">
      <div className="absolute inset-[-7.35%_-2.94%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 90 39">
          <g id="Bug Breeder">
            <path d={svgPaths.p1ad98780} id="Vector" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
            <path d={svgPaths.p3a1d9e00} id="Vector_2" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function BugBreederAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0" data-name="Bug Breeder and Cost">
      <BugBreeder />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        6
      </p>
    </div>
  );
}

function Zenith() {
  return (
    <div className="h-[34px] relative shrink-0 w-[127.5px]" data-name="Zenith">
      <div className="absolute inset-[-7.35%_-1.96%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 132.5 39">
          <g id="Zenith">
            <path d={svgPaths.pcab5d40} id="Vector" stroke="var(--stroke-0, #FCFF81)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
            <path d={svgPaths.p3b710600} id="Vector_2" stroke="var(--stroke-0, #FCFF81)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
            <path d={svgPaths.pc30c300} id="Vector_3" stroke="var(--stroke-0, #FCFF81)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function ZentihAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0" data-name="Zentih and Cost">
      <Zenith />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        9
      </p>
    </div>
  );
}

function BasicShipsRow1() {
  return (
    <div className="absolute content-stretch flex items-end justify-between left-[6px] top-[175px] w-[372px]" data-name="Basic Ships Row 2">
      <HellHornetAndCost />
      <BugBreederAndCost />
      <ZentihAndCost />
    </div>
  );
}

function Xenite() {
  return (
    <div className="relative shrink-0 size-[36px]" data-name="Xenite">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36 36">
        <g id="Xenite">
          <path d="M30.5 5.5L5.5 30.5" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          <path d="M5.5 5.5L30.5 30.5" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        </g>
      </svg>
    </div>
  );
}

function XeniteAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0 w-[36px]" data-name="Xenite and Cost">
      <Xenite />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        2
      </p>
    </div>
  );
}

function Antlion() {
  return (
    <div className="h-[34px] relative shrink-0 w-[40px]" data-name="Antlion">
      <div className="absolute inset-[-7.35%_-6.25%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 45.0008 39.0004">
          <g id="Antlion">
            <path d={svgPaths.p3bc96900} id="Vector" stroke="var(--stroke-0, #FFBB56)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
            <path d="M9.30891 27.15H35.6919" id="Vector_2" stroke="var(--stroke-0, #FFBB56)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function AntlionAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0" data-name="Antlion and Cost">
      <Antlion />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        3
      </p>
    </div>
  );
}

function Mantis() {
  return (
    <div className="h-[34px] relative shrink-0 w-[37px]" data-name="Mantis">
      <div className="absolute inset-[-7.35%_-6.76%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42 39.0001">
          <g id="Mantis">
            <path d={svgPaths.p23756f00} id="Vector" stroke="var(--stroke-0, #9CFF84)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function MantisAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0" data-name="Mantis and Cost">
      <Mantis />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        4
      </p>
    </div>
  );
}

function Evolver() {
  return (
    <div className="relative shrink-0 size-[34px]" data-name="Evolver">
      <div className="absolute inset-[-7.35%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 39 39">
          <g id="Evolver">
            <path d="M5.05 19.5H36.5" id="Vector" stroke="var(--stroke-0, #CD8CFF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
            <path d="M36.5 2.5H2.5V36.5H36.5" id="Vector_2" stroke="var(--stroke-0, #CD8CFF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function EvolverAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0" data-name="Evolver and Cost">
      <Evolver />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        4
      </p>
    </div>
  );
}

function BasicShipsRow() {
  return (
    <div className="absolute content-stretch flex items-end justify-between left-0 top-[61px] w-[378px]" data-name="Basic Ships Row 1">
      <XeniteAndCost />
      <AntlionAndCost />
      <MantisAndCost />
      <EvolverAndCost />
    </div>
  );
}

function XeniteLm() {
  return (
    <div className="absolute inset-[5.8%_51.25%_62.32%_21.25%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function XeniteLm1() {
  return (
    <div className="absolute inset-[37.68%_36.25%_30.43%_36.25%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function XeniteLm2() {
  return (
    <div className="absolute inset-[5.8%_21.25%_62.32%_51.25%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function DefenseSwarm() {
  return (
    <div className="h-[103.5px] relative shrink-0 w-[120px]" data-name="Defense Swarm">
      <div className="-translate-x-1/2 absolute bottom-0 flex items-center justify-center left-1/2 top-0 w-[120px]">
        <div className="-scale-y-100 flex-none h-[103.5px] w-[120px]">
          <div className="relative size-full" data-name="Vector">
            <div className="absolute inset-[-4.35%_-3.75%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 112.5">
                <path d={svgPaths.p2910b380} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #006316)" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="4.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <XeniteLm />
      <XeniteLm1 />
      <XeniteLm2 />
    </div>
  );
}

function DefenseSwarmAndCost() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-center left-[431px] top-[45px]" data-name="Defense Swarm and Cost">
      <DefenseSwarm />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        9
      </p>
    </div>
  );
}

function AntlionArray() {
  return (
    <div className="h-[103.5px] relative shrink-0 w-[120px]" data-name="Antlion Array">
      <div className="absolute inset-[-4.35%_-3.75%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 112.5">
          <g id="Antlion Array">
            <g id="Vector">
              <path d={svgPaths.p28e9cf80} fill="var(--fill-0, black)" />
              <path d={svgPaths.p303f9980} stroke="var(--stroke-0, #FF5900)" strokeLinejoin="round" strokeMiterlimit="10" strokeOpacity="0.6" strokeWidth="4.5" />
            </g>
            <g id="Antlion [lm]">
              <path d={svgPaths.p3bba2980} id="Vector_2" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              <path d="M52.5 49.5H75.75" id="Vector_3" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              <path d={svgPaths.p25fb8a90} id="Vector_4" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
            </g>
            <g id="Antlion [lm]_2">
              <path d={svgPaths.p1c153480} id="Vector_5" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              <path d="M30.75 89.25H54" id="Vector_6" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              <path d={svgPaths.p21a298b4} id="Vector_7" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
            </g>
            <g id="Antlion [lm]_3">
              <path d={svgPaths.p143e5580} id="Vector_8" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              <path d="M74.25 89.25H97.5" id="Vector_9" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              <path d={svgPaths.p3a50ad00} id="Vector_10" stroke="var(--stroke-0, #FF5900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

function AntlionArrayAndCost() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-center left-[510px] top-[106px]" data-name="Antlion Array and Cost">
      <AntlionArray />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        12
      </p>
    </div>
  );
}

function XeniteLm3() {
  return (
    <div className="absolute inset-[13.43%_11.19%_53.73%_55.97%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex items-center justify-center left-[calc(50%+0.5px)] size-[31.82px] top-[calc(50%+0.5px)]" style={{ "--transform-inner-width": "1184.53125", "--transform-inner-height": "20.90625" } as React.CSSProperties}>
        <div className="-rotate-45 flex-none">
          <div className="relative size-[22.5px]" data-name="Vector">
            <div className="absolute inset-[-10%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
                <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex items-center justify-center left-[calc(50%+0.5px)] size-[31.82px] top-[calc(50%+0.5px)]" style={{ "--transform-inner-width": "1184.53125", "--transform-inner-height": "20.90625" } as React.CSSProperties}>
        <div className="-rotate-45 flex-none">
          <div className="relative size-[22.5px]" data-name="Vector">
            <div className="absolute inset-[-10%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
                <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function XeniteLm4() {
  return (
    <div className="absolute inset-[13.43%_55.97%_53.73%_11.19%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex items-center justify-center left-[calc(50%+0.5px)] size-[31.82px] top-[calc(50%+0.5px)]" style={{ "--transform-inner-width": "1184.53125", "--transform-inner-height": "20.90625" } as React.CSSProperties}>
        <div className="-rotate-45 flex-none">
          <div className="relative size-[22.5px]" data-name="Vector">
            <div className="absolute inset-[-10%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
                <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute flex items-center justify-center left-[calc(50%+0.5px)] size-[31.82px] top-[calc(50%+0.5px)]" style={{ "--transform-inner-width": "1184.53125", "--transform-inner-height": "20.90625" } as React.CSSProperties}>
        <div className="-rotate-45 flex-none">
          <div className="relative size-[22.5px]" data-name="Vector">
            <div className="absolute inset-[-10%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
                <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents inset-[13.43%_11.19%_53.73%_11.19%]">
      <XeniteLm3 />
      <XeniteLm4 />
    </div>
  );
}

function Evolver1() {
  return (
    <div className="absolute inset-[56.72%_35.07%_13.43%_35.07%]" data-name="Evolver">
      <div className="absolute inset-[-7.5%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34.5 34.5">
          <g id="Evolver">
            <path d="M4.5 17.25H32.25" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d="M32.25 2.25H2.25V32.25H32.25" id="Vector_2" stroke="var(--stroke-0, #2555FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function AsteriteFace() {
  return (
    <div className="relative shrink-0 size-[100.5px]" data-name="Asterite Face">
      <div className="absolute bg-black inset-0">
        <div aria-hidden="true" className="absolute border-[4.5px] border-[rgba(37,85,255,0.6)] border-solid inset-[-4.5px] pointer-events-none" />
      </div>
      <Group1 />
      <Evolver1 />
    </div>
  );
}

function AsteriteFaceAndCost() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-center left-[754px] top-[149px]" data-name="Asterite Face and Cost">
      <AsteriteFace />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        12
      </p>
    </div>
  );
}

function XeniteLm5() {
  return (
    <div className="absolute inset-[13.43%_33.58%_53.73%_33.58%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #DD0000)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #DD0000)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function AntlionLm() {
  return (
    <div className="absolute inset-[55.22%_53.73%_14.93%_11.19%]" data-name="Antlion [lm]">
      <div className="absolute inset-[-7.5%_-6.38%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 39.7507 34.5004">
          <g id="Antlion [lm]">
            <path d={svgPaths.p29a67340} id="Vector" stroke="var(--stroke-0, #DD0000)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d="M8.25036 24H31.5004" id="Vector_2" stroke="var(--stroke-0, #DD0000)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d={svgPaths.p1b0ac900} id="Vector_3" stroke="var(--stroke-0, #DD0000)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function AntlionLm1() {
  return (
    <div className="absolute inset-[55.22%_11.19%_14.93%_53.73%]" data-name="Antlion [lm]">
      <div className="absolute inset-[-7.5%_-6.38%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 39.7507 34.5004">
          <g id="Antlion [lm]">
            <path d={svgPaths.p29a67340} id="Vector" stroke="var(--stroke-0, #DD0000)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d="M8.25036 24H31.5004" id="Vector_2" stroke="var(--stroke-0, #DD0000)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d={svgPaths.p1b0ac900} id="Vector_3" stroke="var(--stroke-0, #DD0000)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function SacrificialPool() {
  return (
    <div className="relative shrink-0 size-[100.5px]" data-name="Sacrificial Pool">
      <div className="absolute bg-black inset-0">
        <div aria-hidden="true" className="absolute border-[4.5px] border-[rgba(221,0,0,0.6)] border-solid inset-[-4.5px] pointer-events-none" />
      </div>
      <XeniteLm5 />
      <AntlionLm />
      <AntlionLm1 />
    </div>
  );
}

function SacrificialPoolAndCost() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-center left-[625px] top-[44px]" data-name="Sacrificial Pool and Cost">
      <SacrificialPool />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        12
      </p>
    </div>
  );
}

function XeniteLm6() {
  return (
    <div className="absolute inset-[13.43%_11.19%_53.73%_55.97%]" data-name="Xenite [lm]">
      <div className="absolute inset-[27.27%]" data-name="Vector">
        <div className="absolute inset-[-15%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.5 19.5">
            <path d="M17.25 2.25L2.25 17.25" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[27.27%]" data-name="Vector">
        <div className="absolute inset-[-15%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.5 19.5">
            <path d="M2.25 2.25L17.25 17.25" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[33px] top-[calc(50%+0.5px)]">
        <div className="absolute inset-[-13.64%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42 42">
            <circle cx="21" cy="21" id="Ellipse 1" r="18.75" stroke="var(--stroke-0, #FFC400)" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function XeniteLm7() {
  return (
    <div className="absolute inset-[13.43%_55.97%_53.73%_11.19%]" data-name="Xenite [lm]">
      <div className="absolute inset-[27.27%]" data-name="Vector">
        <div className="absolute inset-[-15%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.5 19.5">
            <path d="M17.25 2.25L2.25 17.25" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[27.27%]" data-name="Vector">
        <div className="absolute inset-[-15%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.5 19.5">
            <path d="M2.25 2.25L17.25 17.25" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[33px] top-[calc(50%+0.5px)]">
        <div className="absolute inset-[-13.64%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42 42">
            <circle cx="21" cy="21" id="Ellipse 1" r="18.75" stroke="var(--stroke-0, #FFC400)" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents inset-[13.43%_11.19%_53.73%_11.19%]">
      <XeniteLm6 />
      <XeniteLm7 />
    </div>
  );
}

function Evolver2() {
  return (
    <div className="absolute inset-[56.72%_35.07%_13.43%_35.07%]" data-name="Evolver">
      <div className="absolute inset-[-7.5%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34.5 34.5">
          <g id="Evolver">
            <path d="M4.5 17.25H32.25" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d="M32.25 2.25H2.25V32.25H32.25" id="Vector_2" stroke="var(--stroke-0, #FFC400)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function OxiteFace() {
  return (
    <div className="relative shrink-0 size-[100.5px]" data-name="Oxite Face">
      <div className="absolute bg-black inset-0">
        <div aria-hidden="true" className="absolute border-[4.5px] border-[rgba(255,195,0,0.6)] border-solid inset-[-4.5px] pointer-events-none" />
      </div>
      <Group />
      <Evolver2 />
    </div>
  );
}

function OxiteFaceAndCost() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-center left-[754px] top-[6px]" data-name="Oxite Face and Cost">
      <OxiteFace />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        12
      </p>
    </div>
  );
}

function BugBreederLm() {
  return (
    <div className="absolute inset-[58.28%_22.99%_17.18%_23.53%]" data-name="Bug Breeder [lm]">
      <div className="absolute inset-[-7.5%_-3%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 79.5 34.5">
          <g id="Bug Breeder [lm]">
            <path d={svgPaths.p3b119300} id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d={svgPaths.p9622816} id="Vector_2" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
            <path d={svgPaths.p2095d800} id="Vector_3" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
            <path d={svgPaths.p33546600} id="Vector_4" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
            <path d={svgPaths.p164b7d40} id="Vector_5" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
            <path d={svgPaths.p3dc576c0} id="Vector_6" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function AntlionLm2() {
  return (
    <div className="absolute inset-[22.7%_63.1%_52.76%_11.76%]" data-name="Antlion [lm]">
      <div className="absolute inset-[-7.5%_-6.38%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 39.7507 34.5004">
          <g id="Antlion [lm]">
            <path d={svgPaths.p29a67340} id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d="M8.25036 24H31.5004" id="Vector_2" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d={svgPaths.p1b0ac900} id="Vector_3" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function AntlionLm3() {
  return (
    <div className="absolute inset-[22.7%_11.23%_52.76%_63.64%]" data-name="Antlion [lm]">
      <div className="absolute inset-[-7.5%_-6.38%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 39.7507 34.5004">
          <g id="Antlion [lm]">
            <path d={svgPaths.p29a67340} id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d="M8.25036 24H31.5004" id="Vector_2" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d={svgPaths.p1b0ac900} id="Vector_3" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function XeniteLm8() {
  return (
    <div className="absolute inset-[7.98%_37.97%_65.03%_38.5%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Queen() {
  return (
    <div className="h-[122.25px] relative shrink-0 w-[140.25px]" data-name="Queen">
      <div className="absolute flex inset-0 items-center justify-center">
        <div className="-scale-y-100 flex-none h-[122.25px] rotate-180 w-[140.25px]">
          <div className="relative size-full" data-name="Carrier">
            <div className="absolute inset-[-3.68%_-3.21%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 149.25 131.25">
                <g id="Carrier">
                  <path d={svgPaths.p39267d80} fill="var(--fill-0, black)" />
                  <path d={svgPaths.p1b00cac0} stroke="var(--stroke-0, #00B6EF)" strokeLinejoin="round" strokeMiterlimit="10" strokeOpacity="0.6" strokeWidth="4.5" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <BugBreederLm />
      <AntlionLm2 />
      <AntlionLm3 />
      <XeniteLm8 />
    </div>
  );
}

function QueenAndCost() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-center left-[880px] top-[74px]" data-name="Queen and Cost">
      <Queen />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        20
      </p>
    </div>
  );
}

function Zenith1() {
  return (
    <div className="absolute inset-[66.67%_10.99%_10.73%_10.47%]" data-name="Zenith">
      <div className="absolute inset-[-7.5%_-2%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 117 34.5">
          <g id="Zenith">
            <path d={svgPaths.p1e0db1c0} id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d={svgPaths.p263098c0} id="Vector_2" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
            <path d={svgPaths.p5bbf500} id="Vector_3" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function XeniteLm9() {
  return (
    <div className="absolute inset-[32.77%_67.54%_42.37%_9.42%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function XeniteLm10() {
  return (
    <div className="absolute inset-[32.77%_38.74%_42.37%_38.22%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function XeniteLm11() {
  return (
    <div className="absolute inset-[32.77%_9.95%_42.37%_67.02%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function XeniteLm12() {
  return (
    <div className="absolute inset-[6.21%_67.54%_68.93%_9.42%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function XeniteLm13() {
  return (
    <div className="absolute inset-[6.21%_38.74%_68.93%_38.22%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function XeniteLm14() {
  return (
    <div className="absolute inset-[6.21%_9.95%_68.93%_67.02%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M24.75 2.25L2.25 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.5px)] size-[22.5px] top-[calc(50%+0.5px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
            <path d="M2.25 2.25L24.75 24.75" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Chronoswarm() {
  return (
    <div className="h-[132.75px] relative shrink-0 w-[143.25px]" data-name="Chronoswarm">
      <div className="absolute bg-black inset-0">
        <div aria-hidden="true" className="absolute border-[4.5px] border-[rgba(250,0,255,0.6)] border-solid inset-[-4.5px] pointer-events-none" />
      </div>
      <Zenith1 />
      <XeniteLm9 />
      <XeniteLm10 />
      <XeniteLm11 />
      <XeniteLm12 />
      <XeniteLm13 />
      <XeniteLm14 />
    </div>
  );
}

function ChronoswarmAndCost() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-center left-[1049px] top-[6px]" data-name="Chronoswarm and Cost">
      <Chronoswarm />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        25
      </p>
    </div>
  );
}

function Mantis1() {
  return (
    <div className="absolute inset-[26.37%_56.16%_61.35%_30.34%]" data-name="Mantis">
      <div className="absolute inset-[-7.5%_-6.82%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 33.75 31.0501">
          <g id="Mantis">
            <path d={svgPaths.p3852e900} id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Mantis2() {
  return (
    <div className="absolute inset-[26.37%_30.69%_61.35%_55.81%]" data-name="Mantis">
      <div className="absolute inset-[-7.5%_-6.82%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 33.75 31.0501">
          <g id="Mantis">
            <path d={svgPaths.p3852e900} id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Group2() {
  return (
    <div className="absolute contents inset-[26.37%_30.69%_61.35%_30.34%]">
      <Mantis1 />
      <Mantis2 />
    </div>
  );
}

function BugBreederLm1() {
  return (
    <div className="absolute inset-[43.56%_13.5%_44.17%_55.81%]" data-name="Bug Breeder [lm]">
      <div className="absolute inset-[-7.5%_-3%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 71.55 31.05">
          <g id="Bug Breeder [lm]">
            <path d={svgPaths.p111bf4f1} id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
            <path d={svgPaths.p19c5c400} id="Vector_2" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
            <path d={svgPaths.p2fa53e00} id="Vector_3" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
            <path d={svgPaths.p3d9aaf80} id="Vector_4" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
            <path d={svgPaths.p13107e80} id="Vector_5" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
            <path d={svgPaths.p3b447b00} id="Vector_6" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function BugBreederLm2() {
  return (
    <div className="absolute inset-[43.56%_55.54%_44.17%_13.77%]" data-name="Bug Breeder [lm]">
      <div className="absolute inset-[-7.5%_-3%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 71.55 31.05">
          <g id="Bug Breeder [lm]">
            <path d={svgPaths.p111bf4f1} id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
            <path d={svgPaths.p19c5c400} id="Vector_2" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
            <path d={svgPaths.p2fa53e00} id="Vector_3" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
            <path d={svgPaths.p3d9aaf80} id="Vector_4" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
            <path d={svgPaths.p13107e80} id="Vector_5" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
            <path d={svgPaths.p3b447b00} id="Vector_6" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function HellHornet1() {
  return (
    <div className="absolute inset-[61.66%_34.37%_26.06%_34.94%]" data-name="Hell Hornet">
      <div className="absolute inset-[-7.5%_-1%_-7.5%_-3%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 70.2 31.05">
          <g id="Hell Hornet">
            <path d="M2.025 16.2H29.025" id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeLinejoin="round" strokeWidth="4.05" />
            <path d="M2.025 2.025V29.025" id="Vector_2" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
            <path d="M29.7 2.025V29.025" id="Vector_3" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
            <path d="M41.175 16.2H68.175" id="Vector_4" stroke="var(--stroke-0, #8F00FF)" strokeLinejoin="round" strokeWidth="4.05" />
            <path d="M41.175 2.025V29.025" id="Vector_5" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
            <path d="M68.175 2.025V29.025" id="Vector_6" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function AntlionLm4() {
  return (
    <div className="absolute inset-[8.88%_42.65%_78.85%_42.92%]" data-name="Antlion [lm]">
      <div className="absolute inset-[-7.5%_-6.38%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 35.7756 31.0503">
          <g id="Antlion [lm]">
            <path d={svgPaths.p1bad7a80} id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
            <path d="M7.42532 21.6H28.3503" id="Vector_2" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
            <path d={svgPaths.p163a52c0} id="Vector_3" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.025" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function XeniteLm15() {
  return (
    <div className="absolute inset-[77.62%_42.96%_8.88%_43.54%]" data-name="Xenite [lm]">
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.15px)] size-[20.25px] top-[calc(50%+0.15px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24.3 24.3">
            <path d="M22.275 2.025L2.025 22.275" id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
          </svg>
        </div>
      </div>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-[calc(50%+0.15px)] size-[20.25px] top-[calc(50%+0.15px)]" data-name="Vector">
        <div className="absolute inset-[-10%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24.3 24.3">
            <path d="M2.025 2.025L22.275 22.275" id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.05" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Hive() {
  return (
    <div className="relative shrink-0 size-[219.966px]" data-name="Hive">
      <div className="absolute flex inset-0 items-center justify-center">
        <div className="-rotate-45 flex-none size-[155.54px]">
          <div className="bg-black relative size-full">
            <div aria-hidden="true" className="absolute border-[4.05px] border-[rgba(143,0,255,0.6)] border-solid inset-[-4.05px] pointer-events-none" />
          </div>
        </div>
      </div>
      <Group2 />
      <BugBreederLm1 />
      <BugBreederLm2 />
      <HellHornet1 />
      <AntlionLm4 />
      <XeniteLm15 />
    </div>
  );
}

function HiveAndCost() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-center left-[969px] top-[170px]" data-name="Hive and Cost">
      <Hive />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        35
      </p>
    </div>
  );
}

export default function ApXeniteShips() {
  return (
    <div className="relative size-full" data-name="AP - Xenite Ships">
      <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-0 text-[18px] text-white top-0" style={{ fontVariationSettings: "'wdth' 100" }}>
        Xenite Basic Ships
      </p>
      <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[427px] text-[18px] text-white top-0" style={{ fontVariationSettings: "'wdth' 100" }}>
        Xenite Upgraded Ships
      </p>
      <BasicShipsRow1 />
      <BasicShipsRow />
      <DefenseSwarmAndCost />
      <AntlionArrayAndCost />
      <AsteriteFaceAndCost />
      <SacrificialPoolAndCost />
      <OxiteFaceAndCost />
      <QueenAndCost />
      <ChronoswarmAndCost />
      <HiveAndCost />
    </div>
  );
}