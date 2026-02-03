import svgPaths from "./svg-lww7iiphxo";

function Defender() {
  return (
    <div className="h-[32px] relative shrink-0 w-[52px]" data-name="Defender">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 52 32">
        <g id="Defender">
          <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #9CFF84)" strokeMiterlimit="10" strokeWidth="4" />
        </g>
      </svg>
    </div>
  );
}

function DefenderStack() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Defender Stack">
      <Defender />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[50px] relative shrink-0 text-[#9cff84] text-[50px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        2
      </p>
    </div>
  );
}

function Fighter() {
  return (
    <div className="h-[45px] relative shrink-0 w-[52px]" data-name="Fighter">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 52 45">
        <g id="Fighter">
          <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF8282)" strokeMiterlimit="10" strokeWidth="4" />
        </g>
      </svg>
    </div>
  );
}

function FighterStack() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Fighter Stack">
      <Fighter />
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[50px] relative shrink-0 text-[#ff8282] text-[50px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        99
      </p>
    </div>
  );
}

function RowOfShips() {
  return (
    <div className="-translate-y-1/2 absolute content-stretch flex gap-[36px] items-center left-[25px] top-[calc(50%-5px)]" data-name="Row of Ships">
      <DefenderStack />
      <FighterStack />
    </div>
  );
}

export default function ShipStacks() {
  return (
    <div className="bg-[#101010] relative size-full" data-name="Ship Stacks">
      <RowOfShips />
    </div>
  );
}