import svgPaths from "./svg-kkplcgqof3";

function MercuryCore() {
  return (
    <div className="h-[85px] relative shrink-0 w-[40px]" data-name="Mercury Core">
      <div className="absolute inset-[0_-5%_-2.35%_-5%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 44 87">
          <g id="Mercuryâ¨Core">
            <path d="M22 45L22 85" id="Line 5" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeWidth="4" />
            <path d="M2 65H42" id="Line 6" stroke="var(--stroke-0, #FF8282)" strokeLinecap="round" strokeWidth="4" />
            <circle cx="22" cy="30" fill="var(--fill-0, black)" id="Ellipse 1" r="15" stroke="var(--stroke-0, #FF8282)" strokeWidth="4" />
            <path d={svgPaths.p8b7f4b0} id="Ellipse 2" stroke="var(--stroke-0, #FF8282)" strokeWidth="4" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function MercuryCoreAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-center relative shrink-0 w-[40px]" data-name="Mercury Core and Cost">
      <MercuryCore />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        4
      </p>
    </div>
  );
}

function PlutoCore() {
  return (
    <div className="h-[70px] relative shrink-0 w-[40px]" data-name="Pluto Core">
      <div className="absolute inset-[-2.86%_-5%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 44 74">
          <g id="Plutoâ¨Core">
            <path d="M22 32L22 72" id="Line 7" stroke="var(--stroke-0, #9CFF84)" strokeLinecap="round" strokeWidth="4" />
            <path d="M2 52L42 52" id="Line 8" stroke="var(--stroke-0, #9CFF84)" strokeLinecap="round" strokeWidth="4" />
            <circle cx="22" cy="17" fill="var(--fill-0, black)" id="Ellipse 3" r="15" stroke="var(--stroke-0, #9CFF84)" strokeWidth="4" />
            <circle cx="22" cy="17" id="Ellipse 4" r="8" stroke="var(--stroke-0, #9CFF84)" strokeWidth="4" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function PlutoCoreAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-center relative shrink-0 w-[40px]" data-name="Pluto Core and Cost">
      <PlutoCore />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        4
      </p>
    </div>
  );
}

function QuantumMystic() {
  return (
    <div className="h-[57px] relative shrink-0 w-[90px]" data-name="Quantum Mystic">
      <div className="absolute inset-[-3.51%_0_-2.75%_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 90 60.5685">
          <g id="Quantumâ¨Mystic">
            <path d={svgPaths.p18fd3280} id="Rectangle 5" stroke="var(--stroke-0, #CD8CFF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            <path d={svgPaths.p3ec7780} id="Rectangle 6" stroke="var(--stroke-0, #CD8CFF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            <path d="M16 30L73 30" id="Line 8" stroke="var(--stroke-0, #CD8CFF)" strokeLinecap="round" strokeWidth="4" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function QuantumMysticAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-center relative shrink-0 w-[90px]" data-name="Quantum Mystic and Cost">
      <QuantumMystic />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        5
      </p>
    </div>
  );
}

function Spiral() {
  return (
    <div className="relative shrink-0 size-[60px]" data-name="Spiral">
      <div className="absolute inset-[-3.33%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 64 64">
          <g id="Spiral">
            <path d={svgPaths.p12ea1880} id="Rectangle 3" stroke="var(--stroke-0, #FF86E4)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function SpiralAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-center relative shrink-0 w-[60px]" data-name="Spiral and Cost">
      <Spiral />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        6
      </p>
    </div>
  );
}

function BasicShipsRow() {
  return (
    <div className="absolute content-stretch flex items-end justify-between left-0 right-[42px] top-[33px]" data-name="Basic Ships Row 1">
      <MercuryCoreAndCost />
      <PlutoCoreAndCost />
      <QuantumMysticAndCost />
      <SpiralAndCost />
    </div>
  );
}

function UranusCore() {
  return (
    <div className="relative shrink-0 size-[70px]" data-name="Uranus Core">
      <div className="absolute inset-[-2.86%_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 70 74">
          <g id="Uranusâ¨Core">
            <path d="M35 42L35 2" id="Line 9" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeWidth="4" />
            <path d="M55 22L15 22" id="Line 10" stroke="var(--stroke-0, #62FFF6)" strokeLinecap="round" strokeWidth="4" />
            <circle cx="35" cy="57" fill="var(--fill-0, black)" id="Ellipse 5" r="15" stroke="var(--stroke-0, #62FFF6)" strokeWidth="4" transform="rotate(180 35 57)" />
            <path d={svgPaths.p1c820cc0} id="Ellipse 6" stroke="var(--stroke-0, #62FFF6)" strokeWidth="4" />
            <path d={svgPaths.p1e7aad80} id="Ellipse 7" stroke="var(--stroke-0, #62FFF6)" strokeWidth="4" />
            <path d={svgPaths.p16b6dd40} id="Ellipse 8" stroke="var(--stroke-0, #62FFF6)" strokeWidth="4" />
            <path d={svgPaths.pc0b1280} id="Ellipse 9" stroke="var(--stroke-0, #62FFF6)" strokeWidth="4" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function UranusCoreAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-center relative shrink-0 w-[70px]" data-name="Uranus Core and Cost">
      <UranusCore />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        7
      </p>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents inset-[10%]">
      <div className="absolute flex inset-[10%_52.5%_52.5%_10%] items-center justify-center">
        <div className="flex-none rotate-180 size-[30px]">
          <div className="relative size-full">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 30 30">
              <circle cx="15" cy="15" id="Ellipse 5" r="13" stroke="var(--stroke-0, #FCFF81)" strokeWidth="4" />
            </svg>
          </div>
        </div>
      </div>
      <div className="absolute flex inset-[10%_10%_52.5%_52.5%] items-center justify-center">
        <div className="flex-none rotate-180 size-[30px]">
          <div className="relative size-full">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 30 30">
              <circle cx="15" cy="15" id="Ellipse 5" r="13" stroke="var(--stroke-0, #FCFF81)" strokeWidth="4" />
            </svg>
          </div>
        </div>
      </div>
      <div className="absolute flex inset-[52.5%_52.5%_10%_10%] items-center justify-center">
        <div className="flex-none rotate-180 size-[30px]">
          <div className="relative size-full">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 30 30">
              <circle cx="15" cy="15" id="Ellipse 5" r="13" stroke="var(--stroke-0, #FCFF81)" strokeWidth="4" />
            </svg>
          </div>
        </div>
      </div>
      <div className="absolute flex inset-[52.5%_10%_10%_52.5%] items-center justify-center">
        <div className="flex-none rotate-180 size-[30px]">
          <div className="relative size-full">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 30 30">
              <circle cx="15" cy="15" id="Ellipse 5" r="13" stroke="var(--stroke-0, #FCFF81)" strokeWidth="4" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function SolarReserveDm() {
  return (
    <div className="h-[80px] relative shrink-0 w-full" data-name="Solar Reserve [dm]">
      <Group />
      <div aria-hidden="true" className="absolute border-4 border-[#fcff81] border-solid inset-[-4px] pointer-events-none" />
    </div>
  );
}

function SolarReserverAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-center relative shrink-0 w-[80px]" data-name="Solar Reserver and Cost">
      <SolarReserveDm />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[18px] text-center text-white w-full whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        8
      </p>
    </div>
  );
}

function Cube() {
  return (
    <div className="relative shrink-0 size-[70px]" data-name="Cube">
      <div className="absolute inset-[-2.86%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 74 74">
          <g id="Cube">
            <path d={svgPaths.pe807380} id="Rectangle 17" stroke="var(--stroke-0, #FFBB56)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            <path d={svgPaths.pb8b7600} id="Rectangle 18" stroke="var(--stroke-0, #FFBB56)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            <path d={svgPaths.p28fc94c0} id="Rectangle 20" stroke="var(--stroke-0, #FFBB56)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function CubeAndCost() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-center relative shrink-0 w-[70px]" data-name="Cube and Cost">
      <Cube />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] min-w-full relative shrink-0 text-[18px] text-center text-white w-[min-content] whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        9
      </p>
    </div>
  );
}

function BasicShipsRow1() {
  return (
    <div className="absolute content-stretch flex items-end justify-between left-[-5px] px-[16px] right-[37px] top-[165px]" data-name="Basic Ships Row 2">
      <UranusCoreAndCost />
      <SolarReserverAndCost />
      <CubeAndCost />
    </div>
  );
}

function RedEnergy() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Red Energy">
      <div className="absolute inset-[-2.01%_0_0_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20.4028">
          <g id="Red Energy">
            <circle cx="10" cy="10" fill="var(--fill-0, #FF8282)" id="Red Energy_2" r="10" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function RedEnergyCount() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Red Energy Count">
      <RedEnergy />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#ff8282] text-[22px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        9 red
      </p>
    </div>
  );
}

function GreenEnergy() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Green Energy">
      <div className="absolute inset-[-2.01%_0_0_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20.4028">
          <g id="Green Energy">
            <circle cx="10" cy="10" fill="var(--fill-0, #9CFF84)" id="Green  Energy" r="10" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function GreenEnergyCount() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Green Energy Count">
      <GreenEnergy />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#9cff84] text-[22px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        9 green
      </p>
    </div>
  );
}

function BlueEnergy() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Blue Energy">
      <div className="absolute inset-[-2.01%_0_0_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20.4028">
          <g id="Blue Energy">
            <circle cx="10" cy="10" fill="var(--fill-0, #62FFF6)" id="Blue Energy_2" r="10" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function BlueEnergyCount() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Blue Energy Count">
      <BlueEnergy />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#62fff6] text-[22px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        9 blue
      </p>
    </div>
  );
}

function EnergyCount() {
  return (
    <div className="content-stretch flex gap-[29px] items-center justify-end relative shrink-0" data-name="Energy Count">
      <RedEnergyCount />
      <GreenEnergyCount />
      <BlueEnergyCount />
    </div>
  );
}

function EnergyCountWrapper() {
  return (
    <div className="absolute content-stretch flex gap-[32px] items-center right-[-780px] top-[4px]" data-name="Energy Count Wrapper">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white">Available Energy:</p>
      <EnergyCount />
    </div>
  );
}

function SpButton() {
  return (
    <div className="h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="SP Button">
      <div aria-hidden="true" className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[10px] items-center justify-center px-[20px] py-[19px] relative size-full">
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#ff8282] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>{`Asteroid `}</p>
          <div className="relative shrink-0 size-[14.4px]">
            <div className="absolute inset-[-6.42%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                <circle cx="8.124" cy="8.124" fill="var(--fill-0, #FF8282)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Asteroid() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0 w-full" data-name="Asteroid">
      <SpButton />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">Deal 1 damage</p>
    </div>
  );
}

function Frame1() {
  return (
    <div className="h-[14.4px] relative shrink-0 w-[55.2px]">
      <div className="absolute inset-[-6.42%_-1.67%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 57.048 16.248">
          <g id="Frame 219">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, #FF8282)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
            <circle cx="28.524" cy="8.124" fill="var(--fill-0, #FF8282)" id="Ellipse 2" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
            <circle cx="48.924" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 3" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function SpButton1() {
  return (
    <div className="h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="SP Button">
      <div aria-hidden="true" className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[10px] items-center justify-center px-[20px] py-[19px] relative size-full">
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#ff8282] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
            Supernova
          </p>
          <Frame1 />
        </div>
      </div>
    </div>
  );
}

function Supernova() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center opacity-50 relative shrink-0 w-full" data-name="Supernova">
      <SpButton1 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">Deal X damage</p>
    </div>
  );
}

function MercurianPowers() {
  return (
    <div className="content-stretch flex flex-col gap-[30px] items-start relative shrink-0 w-[169px]" data-name="Mercurian Powers">
      <Asteroid />
      <Supernova />
    </div>
  );
}

function SpButton2() {
  return (
    <div className="h-[50px] opacity-50 relative rounded-[10px] shrink-0 w-full" data-name="SP Button">
      <div aria-hidden="true" className="absolute border-2 border-[#9cff84] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[10px] items-center justify-center px-[20px] py-[19px] relative size-full">
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#9cff84] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
            Life
          </p>
          <div className="relative shrink-0 size-[14.4px]">
            <div className="absolute inset-[-6.42%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                <circle cx="8.124" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 3" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Life() {
  return (
    <div className="content-stretch flex flex-col gap-[11px] items-center relative shrink-0 w-full" data-name="Life">
      <SpButton2 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic opacity-50 relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">Heal 1</p>
    </div>
  );
}

function Frame2() {
  return (
    <div className="h-[14.4px] relative shrink-0 w-[55.2px]">
      <div className="absolute inset-[-6.42%_-1.67%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 57.048 16.248">
          <g id="Frame 220">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 3" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
            <circle cx="28.524" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 4" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
            <circle cx="48.924" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 5" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function SpButton3() {
  return (
    <div className="h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="SP Button">
      <div aria-hidden="true" className="absolute border-2 border-[#9cff84] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[10px] items-center justify-center px-[20px] py-[19px] relative size-full">
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#9cff84] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
            Star Birth
          </p>
          <Frame2 />
        </div>
      </div>
    </div>
  );
}

function StarBirth() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center opacity-50 relative shrink-0 w-full" data-name="Star Birth">
      <SpButton3 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">Heal X</p>
    </div>
  );
}

function PlutonianPowers() {
  return (
    <div className="content-stretch flex flex-col gap-[29px] items-start relative shrink-0 w-[169px]" data-name="Plutonian Powers">
      <Life />
      <StarBirth />
    </div>
  );
}

function SpButton4() {
  return (
    <div className="h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="SP Button">
      <div aria-hidden="true" className="absolute border-2 border-[#62fff6] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[10px] items-center justify-center px-[20px] py-[19px] relative size-full">
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#62fff6] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
            Convert
          </p>
          <div className="relative shrink-0 size-[14.4px]">
            <div className="absolute inset-[-6.42%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                <circle cx="8.124" cy="8.124" fill="var(--fill-0, #62FFF6)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #62FFF6)" strokeWidth="1.848" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Convert() {
  return (
    <div className="content-stretch flex flex-col gap-[11px] items-center relative shrink-0 w-full" data-name="Convert">
      <SpButton4 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">+1 Line</p>
    </div>
  );
}

function Frame() {
  return (
    <div className="h-[50px] relative rounded-[10px] shrink-0 w-full">
      <div aria-hidden="true" className="absolute border-2 border-[#62fff6] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[10px] items-center justify-center px-[20px] py-[19px] relative size-full">
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#62fff6] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
            Simulacrum X
          </p>
          <div className="relative shrink-0 size-[14.4px]">
            <div className="absolute inset-[-6.42%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                <circle cx="8.124" cy="8.124" fill="var(--fill-0, #62FFF6)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #62FFF6)" strokeWidth="1.848" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame9() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0 w-full">
      <Frame />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">Copy basic enemy ship</p>
    </div>
  );
}

function UranianPowers() {
  return (
    <div className="content-stretch flex flex-col gap-[29px] items-start relative shrink-0 w-[169px]" data-name="Uranian Powers">
      <Convert />
      <Frame9 />
    </div>
  );
}

function Frame3() {
  return (
    <div className="h-[14.4px] relative shrink-0 w-[34.8px]">
      <div className="absolute inset-[-6.42%_-2.66%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.648 16.248">
          <g id="Frame 221">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, #FF8282)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
            <circle cx="28.524" cy="8.124" fill="var(--fill-0, #FF8282)" id="Ellipse 2" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Frame4() {
  return (
    <div className="h-[14.4px] relative shrink-0 w-[34.8px]">
      <div className="absolute inset-[-6.42%_-2.66%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.648 16.248">
          <g id="Frame 222">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 3" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
            <circle cx="28.524" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 4" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function SpButton5() {
  return (
    <div className="h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="SP Button">
      <div aria-hidden="true" className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[10px] items-center justify-center px-[20px] py-[19px] relative size-full">
          <Frame3 />
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[16px] text-center text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
            Siphon
          </p>
          <Frame4 />
        </div>
      </div>
    </div>
  );
}

function Siphon() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center opacity-50 relative shrink-0 w-full" data-name="Siphon">
      <SpButton5 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">Deal X damage, heal X</p>
    </div>
  );
}

function Frame5() {
  return (
    <div className="h-[14.4px] relative shrink-0 w-[32.8px]">
      <div className="absolute inset-[-6.42%_-2.82%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34.648 16.248">
          <g id="Frame 221">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, #FF8282)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
            <circle cx="26.524" cy="8.124" fill="var(--fill-0, #FF8282)" id="Ellipse 2" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Frame6() {
  return (
    <div className="h-[14.4px] relative shrink-0 w-[32.8px]">
      <div className="absolute inset-[-6.42%_-2.82%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34.648 16.248">
          <g id="Frame 222">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 3" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
            <circle cx="26.524" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 4" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function SpButton6() {
  return (
    <div className="h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="SP Button">
      <div aria-hidden="true" className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[8px] items-center justify-center px-[20px] py-[19px] relative size-full">
          <Frame5 />
          <Frame6 />
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[16px] text-center text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
            Vortex
          </p>
          <div className="relative shrink-0 size-[14.4px]">
            <div className="absolute inset-[-6.42%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                <circle cx="8.124" cy="8.124" fill="var(--fill-0, #62FFF6)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #62FFF6)" strokeWidth="1.848" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Vortex() {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-center opacity-50 relative shrink-0 w-full" data-name="Vortex">
      <SpButton6 />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">Deal X damage</p>
    </div>
  );
}

function BinaryPowers() {
  return (
    <div className="content-stretch flex flex-col gap-[30px] items-start relative shrink-0 w-[188px]" data-name="Binary Powers">
      <Siphon />
      <Vortex />
    </div>
  );
}

function SolarPowersWrapper() {
  return (
    <div className="absolute content-stretch flex items-center justify-between left-[427px] right-[-782px] top-[67px]" data-name="Solar Powers Wrapper">
      <MercurianPowers />
      <PlutonianPowers />
      <UranianPowers />
      <BinaryPowers />
    </div>
  );
}

function Frame7() {
  return (
    <div className="h-[51.2px] relative shrink-0 w-[14.4px]">
      <div className="absolute inset-[-1.8%_-6.42%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 53.048">
          <g id="Frame 221">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, #FF8282)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
            <circle cx="8.124" cy="26.524" fill="var(--fill-0, #FF8282)" id="Ellipse 2" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
            <circle cx="8.124" cy="44.924" fill="var(--fill-0, black)" id="Ellipse 3" r="7.2" stroke="var(--stroke-0, #FF8282)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Frame8() {
  return (
    <div className="h-[51.2px] relative shrink-0 w-[14.4px]">
      <div className="absolute inset-[-1.8%_-6.42%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 53.048">
          <g id="Frame 222">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, black)" id="Ellipse 3" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
            <circle cx="8.124" cy="26.524" fill="var(--fill-0, black)" id="Ellipse 4" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
            <circle cx="8.124" cy="44.924" fill="var(--fill-0, black)" id="Ellipse 5" r="7.2" stroke="var(--stroke-0, #9CFF84)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Frame10() {
  return (
    <div className="h-[51.2px] relative shrink-0 w-[14.4px]">
      <div className="absolute inset-[-1.8%_-6.42%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 53.048">
          <g id="Frame 242">
            <circle cx="8.124" cy="8.124" fill="var(--fill-0, #62FFF6)" id="Ellipse 1" r="7.2" stroke="var(--stroke-0, #62FFF6)" strokeWidth="1.848" />
            <circle cx="8.124" cy="26.524" fill="var(--fill-0, #62FFF6)" id="Ellipse 2" r="7.2" stroke="var(--stroke-0, #62FFF6)" strokeWidth="1.848" />
            <circle cx="8.124" cy="44.924" fill="var(--fill-0, #62FFF6)" id="Ellipse 3" r="7.2" stroke="var(--stroke-0, #62FFF6)" strokeWidth="1.848" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function BlackHoleEnergy() {
  return (
    <div className="content-stretch flex gap-[32px] items-center justify-center relative shrink-0 w-[136px]" data-name="Black Hole Energy">
      <Frame7 />
      <Frame8 />
      <Frame10 />
    </div>
  );
}

function SpButton7() {
  return (
    <div className="relative rounded-[10px] shrink-0 w-full" data-name="SP Button">
      <div aria-hidden="true" className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col gap-[8px] items-center justify-center px-[20px] py-[15px] relative w-full">
          <BlackHoleEnergy />
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[16px] text-center text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
            Black Hole
          </p>
        </div>
      </div>
    </div>
  );
}

function BlackHole() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[12px] items-start opacity-50 right-[-782px] top-[280px] w-[188px]" data-name="Black Hole">
      <SpButton7 />
      <div className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[15px] text-center text-white w-full whitespace-pre-wrap">
        <p className="mb-[8px]">Destroy TWO of the opponent’s basic ships.</p>
        <p>Deal 4 damage.</p>
      </div>
    </div>
  );
}

export default function ApCentaurShips() {
  return (
    <div className="bg-[#101010] relative size-full" data-name="AP - Centaur Ships">
      <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-0 text-[18px] text-white top-0" style={{ fontVariationSettings: "'wdth' 100" }}>
        Ancient Basic Ships
      </p>
      <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[427px] text-[18px] text-white top-0" style={{ fontVariationSettings: "'wdth' 100" }}>
        Ancient Solar Powers
      </p>
      <div className="absolute bg-[#555] h-[469px] left-[406px] top-0 w-px" data-name="VR" />
      <BasicShipsRow />
      <BasicShipsRow1 />
      <EnergyCountWrapper />
      <SolarPowersWrapper />
      <BlackHole />
    </div>
  );
}