import svgPaths from "./svg-dt0b851f8e";
import clsx from "clsx";

function Wrapper6({ children }: React.PropsWithChildren<{}>) {
  return (
    <svg fill="none" preserveAspectRatio="none" viewBox="0 0 79 70" className="block size-full">
      <g id="Orbital">{children}</g>
    </svg>
  );
}

function Wrapper5({ children }: React.PropsWithChildren<{}>) {
  return (
    <svg fill="none" preserveAspectRatio="none" viewBox="0 0 102 102" className="block size-full">
      <g id="Starship">{children}</g>
    </svg>
  );
}

function Wrapper4({ children }: React.PropsWithChildren<{}>) {
  return (
    <svg fill="none" preserveAspectRatio="none" viewBox="0 0 52 45" className="block size-full">
      <g id="Fighter">{children}</g>
    </svg>
  );
}

function Wrapper3({ children }: React.PropsWithChildren<{}>) {
  return (
    <svg fill="none" preserveAspectRatio="none" viewBox="0 0 52 32" className="block size-full">
      <g id="Defender">{children}</g>
    </svg>
  );
}

function Wrapper2({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="absolute flex inset-0 items-center justify-center">
      <div className="flex-none rotate-[180deg] scale-y-[-100%] size-[48px]">
        <div className="relative size-full" data-name="Vector">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
            {children}
          </svg>
        </div>
      </div>
    </div>
  );
}
type Wrapper1Props = {
  additionalClassNames?: string;
};

function Wrapper1({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper1Props>) {
  return (
    <div className={additionalClassNames}>
      <div className="absolute inset-[-8.92%_0_-10.16%_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 93 96.4528">
          <g id="Carrier [lm]">{children}</g>
        </svg>
      </div>
    </div>
  );
}
type WrapperProps = {
  additionalClassNames?: string;
};

function Wrapper({ children, additionalClassNames = "" }: React.PropsWithChildren<WrapperProps>) {
  return (
    <div className={clsx("absolute flex items-center justify-center", additionalClassNames)}>
      <div className="flex-none h-px rotate-[90deg] w-[35px]">
        <div className="relative size-full">
          <div className="absolute inset-[-4px_0_0_0]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 35 4">
              {children}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
type Defender4Props = {
  additionalClassNames?: string;
};

function Defender4({ additionalClassNames = "" }: Defender4Props) {
  return (
    <div className={clsx("absolute", additionalClassNames)}>
      <Wrapper3>
        <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeMiterlimit="10" strokeWidth="4" />
      </Wrapper3>
    </div>
  );
}
type Defender3Props = {
  additionalClassNames?: string;
};

function Defender3({ additionalClassNames = "" }: Defender3Props) {
  return (
    <div className={clsx("absolute", additionalClassNames)}>
      <Wrapper3>
        <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF5900)" strokeMiterlimit="10" strokeWidth="4" />
      </Wrapper3>
    </div>
  );
}
type Fighter1Props = {
  additionalClassNames?: string;
};

function Fighter1({ additionalClassNames = "" }: Fighter1Props) {
  return (
    <div className={clsx("absolute", additionalClassNames)}>
      <Wrapper4>
        <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeMiterlimit="10" strokeWidth="4" />
      </Wrapper4>
    </div>
  );
}
type Defender2Props = {
  additionalClassNames?: string;
};

function Defender2({ additionalClassNames = "" }: Defender2Props) {
  return (
    <div className={clsx("absolute", additionalClassNames)}>
      <Wrapper3>
        <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="4" />
      </Wrapper3>
    </div>
  );
}
type Defender1Props = {
  additionalClassNames?: string;
};

function Defender1({ additionalClassNames = "" }: Defender1Props) {
  return (
    <div className={clsx("absolute", additionalClassNames)}>
      <Wrapper3>
        <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #DD0000)" strokeMiterlimit="10" strokeWidth="4" />
      </Wrapper3>
    </div>
  );
}
type FighterProps = {
  additionalClassNames?: string;
};

function Fighter({ additionalClassNames = "" }: FighterProps) {
  return (
    <div className={clsx("absolute", additionalClassNames)}>
      <Wrapper4>
        <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #DD0000)" strokeMiterlimit="10" strokeWidth="4" />
      </Wrapper4>
    </div>
  );
}
type DefenderProps = {
  additionalClassNames?: string;
};

function Defender({ additionalClassNames = "" }: DefenderProps) {
  return (
    <div className={additionalClassNames}>
      <Wrapper3>
        <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="4" />
      </Wrapper3>
    </div>
  );
}
type CarrierLmProps = {
  additionalClassNames?: string;
};

function CarrierLm({ additionalClassNames = "" }: CarrierLmProps) {
  return (
    <Wrapper1 additionalClassNames={additionalClassNames}>
      <path d={svgPaths.p33772500} fill="var(--fill-0, black)" id="Carrier" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="4" />
      <path d={svgPaths.p35ef73c0} id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.5" />
      <path d={svgPaths.p2d480800} id="Vector_2" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.5" />
      <path d={svgPaths.p371d9990} id="Vector_3" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.5" />
      <path d={svgPaths.pf008d00} id="Vector_4" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.5" />
      <path d={svgPaths.p18f75200} id="Vector_5" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.5" />
      <path d={svgPaths.p2330f320} id="Vector_6" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.5" />
    </Wrapper1>
  );
}
type StarshipProps = {
  additionalClassNames?: string;
};

function Starship({ additionalClassNames = "" }: StarshipProps) {
  return (
    <div className={additionalClassNames}>
      <Wrapper5>
        <path d={svgPaths.p184f1080} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="4" />
      </Wrapper5>
    </div>
  );
}

export default function ApHumanShips() {
  return (
    <div className="relative size-full" data-name="AP - Human Ships">
      <div className="absolute bg-black h-[300px] left-0 rounded-[10px] top-0 w-[1540px]" data-name="Background (Reference only)" />
      <div className="absolute contents left-[1523px] top-[9px]" data-name="Scrollbar (Reference only)">
        <div className="absolute bg-[#212121] h-[282px] left-[1523px] rounded-[10px] top-[9px] w-[9px]" />
        <div className="absolute bg-[#555] h-[235px] left-[1523px] rounded-[10px] top-[9px] w-[9px]" />
      </div>
      <div className="absolute flex h-[330px] items-center justify-center left-[518px] top-[20px] w-px" style={{ "--transform-inner-width": "0", "--transform-inner-height": "0" } as React.CSSProperties}>
        <div className="flex-none rotate-[90deg]">
          <div className="h-px relative w-[330px]" data-name="VR">
            <div className="absolute bottom-full left-0 right-0 top-[-100%]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 330 1">
                <line id="VR" stroke="var(--stroke-0, #555555)" x2="330" y1="0.5" y2="1.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute contents left-[calc(50%+601px)] top-[calc(50%+63.06px)] translate-x-[-50%] translate-y-[-50%]" data-name="Leviathan and Cost">
        <div className="absolute h-[222.123px] left-[calc(50%+614.5px)] top-[calc(50%+63.06px)] translate-x-[-50%] translate-y-[-50%] w-[239px]" data-name="Leviathan">
          <div className="absolute flex inset-[60.78%_76.57%_14.91%_15.06%] items-center justify-center">
            <div className="flex-none h-[54px] rotate-[180deg] w-[20px]">
              <div className="bg-black border-4 border-[rgba(143,0,255,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute flex inset-[19.81%_47.23%_49.97%_24.69%] items-center justify-center">
            <div className="flex-none h-[74.926px] rotate-[45deg] w-[20px]">
              <div className="bg-black border-4 border-[rgba(143,0,255,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute flex inset-[19.81%_25.05%_49.97%_46.86%] items-center justify-center">
            <div className="flex-none h-[74.926px] rotate-[135deg] scale-y-[-100%] w-[20px]">
              <div className="bg-black border-4 border-[rgba(143,0,255,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute flex inset-[49.97%_47.23%_19.81%_24.69%] items-center justify-center">
            <div className="flex-none h-[74.926px] rotate-[315deg] scale-y-[-100%] w-[20px]">
              <div className="bg-black border-4 border-[rgba(143,0,255,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute flex inset-[49.97%_25.05%_19.81%_46.86%] items-center justify-center">
            <div className="flex-none h-[74.926px] rotate-[225deg] w-[20px]">
              <div className="bg-black border-4 border-[rgba(143,0,255,0.6)] border-solid size-full" />
            </div>
          </div>
          <Starship additionalClassNames="absolute inset-[0_28.87%_54.08%_28.45%]" />
          <div className="absolute flex inset-[54.08%_28.87%_0_28.45%] items-center justify-center">
            <div className="flex-none scale-y-[-100%] size-[102px]">
              <Starship additionalClassNames="relative size-full" />
            </div>
          </div>
          <CarrierLm additionalClassNames="absolute inset-[31.51%_61.09%_32.02%_0]" />
          <Defender additionalClassNames="absolute inset-[80.14%_69.87%_5.46%_8.37%]" />
          <div className="absolute flex inset-[60.78%_15.06%_14.91%_76.57%] items-center justify-center">
            <div className="flex-none h-[54px] scale-y-[-100%] w-[20px]">
              <div className="bg-black border-4 border-[rgba(143,0,255,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute flex inset-[31.51%_0_32.02%_61.09%] items-center justify-center">
            <div className="flex-none h-[81px] rotate-[180deg] scale-y-[-100%] w-[93px]">
              <CarrierLm additionalClassNames="relative size-full" />
            </div>
          </div>
          <div className="absolute flex inset-[80.14%_8.37%_5.46%_69.87%] items-center justify-center">
            <div className="flex-none h-[32px] rotate-[180deg] scale-y-[-100%] w-[52px]">
              <Defender additionalClassNames="relative size-full" />
            </div>
          </div>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%+478.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%+72px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          44
        </p>
      </div>
      <div className="absolute contents left-[calc(50%+545px)] top-[calc(50%-99.5px)] translate-x-[-50%] translate-y-[-50%]" data-name="Dreadnought and Cost">
        <div className="absolute h-[105px] left-[calc(50%+545px)] top-[calc(50%-113.5px)] translate-x-[-50%] translate-y-[-50%] w-[198px]" data-name="Dreadnought">
          <div className="absolute bg-black border-4 border-[rgba(221,0,0,0.6)] border-solid inset-[20%_44.95%_5.71%_44.95%]" />
          <div className="absolute bg-black border-4 border-[rgba(221,0,0,0.6)] border-solid inset-[24.76%_8.08%_19.05%_81.82%]" />
          <div className="absolute bg-black border-4 border-[rgba(221,0,0,0.6)] border-solid inset-[24.76%_81.82%_19.05%_8.08%]" />
          <div className="absolute flex inset-[67.62%_13.13%_13.33%_13.13%] items-center justify-center">
            <div className="flex-none h-[146px] rotate-[90deg] w-[20px]">
              <div className="bg-black border-4 border-[rgba(221,0,0,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute inset-[54.29%_37.88%_0_37.88%]" data-name="Commander">
            <Wrapper2>
              <path d="M46 2V46H2V2H46Z" fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #DD0000)" strokeMiterlimit="10" strokeWidth="4" />
            </Wrapper2>
          </div>
          <Fighter additionalClassNames="inset-[52.38%_0_4.76%_73.74%]" />
          <Fighter additionalClassNames="inset-[52.38%_73.74%_4.76%_0]" />
          <Fighter additionalClassNames="inset-[0_36.87%_57.14%_36.87%]" />
          <Defender1 additionalClassNames="inset-[10.48%_73.74%_59.05%_0]" />
          <Defender1 additionalClassNames="inset-[10.48%_0_59.05%_73.74%]" />
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%+544.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%-54px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          27
        </p>
      </div>
      <div className="absolute contents left-[calc(50%+345.5px)] top-[calc(50%-7px)] translate-x-[-50%] translate-y-[-50%]" data-name="Earth Ship and Cost">
        <div className="absolute h-[166px] left-[calc(50%+345.5px)] top-[calc(50%-24px)] translate-x-[-50%] translate-y-[-50%] w-[211px]" data-name="Earth Ship">
          <div className="absolute flex inset-[69.88%_10.9%_18.07%_10.9%] items-center justify-center">
            <div className="flex-none h-[165px] rotate-[90deg] w-[20px]">
              <div className="bg-black border-4 border-[rgba(0,189,19,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute bg-black border-4 border-[rgba(0,189,19,0.6)] border-solid inset-[28.92%_41.71%_24.1%_42.18%]" />
          <Wrapper additionalClassNames="inset-[37.95%_50.71%_40.96%_49.29%]">
            <line id="Line 3" stroke="var(--stroke-0, #00BD13)" strokeOpacity="0.6" strokeWidth="4" x2="35" y1="2" y2="2" />
          </Wrapper>
          <div className="absolute inset-[0_31.28%_57.83%_31.28%]" data-name="Orbital">
            <Wrapper6>
              <path d={svgPaths.p288d0780} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="4" />
            </Wrapper6>
          </div>
          <Wrapper1 additionalClassNames="absolute inset-[51.2%_27.96%_0_27.96%]">
            <path d={svgPaths.p33772500} fill="var(--fill-0, black)" id="Carrier" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="4" />
            <path d={svgPaths.p35ef73c0} id="Vector" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
            <path d={svgPaths.p2d480800} id="Vector_2" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
            <path d={svgPaths.p371d9990} id="Vector_3" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
            <path d={svgPaths.pf008d00} id="Vector_4" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
            <path d={svgPaths.p18f75200} id="Vector_5" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
            <path d={svgPaths.p2330f320} id="Vector_6" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
          </Wrapper1>
          <Defender2 additionalClassNames="inset-[65.66%_76.78%_15.06%_-1.42%]" />
          <Defender2 additionalClassNames="inset-[65.66%_-1.42%_15.06%_76.78%]" />
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%+345.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%+72px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          23
        </p>
      </div>
      <div className="absolute contents left-[calc(50%+181.5px)] top-[calc(50%-97px)] translate-x-[-50%] translate-y-[-50%]" data-name="Battlecruiser and Cost">
        <div className="absolute h-[114px] left-[calc(50%+181.5px)] top-[calc(50%-111px)] translate-x-[-50%] translate-y-[-50%] w-[183px]" data-name="Battlecruiser">
          <div className="absolute bg-black border-4 border-[rgba(0,182,239,0.6)] border-solid bottom-1/2 left-[42.62%] right-[42.08%] top-[14.91%]" />
          <div className="absolute flex inset-[46.49%_14.21%_35.96%_14.21%] items-center justify-center">
            <div className="flex-none h-[131px] rotate-[90deg] w-[20px]">
              <div className="bg-black border-4 border-[rgba(0,182,239,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute inset-[38.6%_28.42%_0_28.42%]" data-name="Orbital">
            <Wrapper6>
              <path d={svgPaths.p288d0780} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeMiterlimit="10" strokeWidth="4" />
            </Wrapper6>
          </div>
          <Fighter1 additionalClassNames="inset-[29.82%_0_30.7%_71.58%]" />
          <Fighter1 additionalClassNames="inset-[29.82%_71.58%_30.7%_0]" />
          <div className="absolute inset-[0_35.52%_71.93%_36.07%]" data-name="Defender">
            <Wrapper3>
              <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeMiterlimit="10" strokeWidth="4" />
            </Wrapper3>
          </div>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%+181.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%-47px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          20
        </p>
      </div>
      <div className="absolute contents left-[calc(50%+108px)] top-[calc(50%+22.5px)] translate-x-[-50%] translate-y-[-50%]" data-name="Science Vessel and Cost">
        <div className="absolute h-[113px] left-[calc(50%+108px)] top-[calc(50%+8.5px)] translate-x-[-50%] translate-y-[-50%] w-[138px]" data-name="Science Vessel">
          <div className="absolute contents inset-[45.13%_0_-2.21%_0]">
            <div className="absolute flex inset-[45.13%_16.67%_9.17%_45.91%] items-center justify-center">
              <div className="flex-none h-[53.033px] rotate-[135deg] scale-y-[-100%] w-[20px]">
                <div className="bg-black border-4 border-[rgba(250,0,255,0.6)] border-solid size-full" />
              </div>
            </div>
            <div className="absolute flex inset-[45.13%_46.38%_9.17%_16.2%] items-center justify-center">
              <div className="flex-none h-[53.033px] rotate-[45deg] w-[20px]">
                <div className="bg-black border-4 border-[rgba(250,0,255,0.6)] border-solid size-full" />
              </div>
            </div>
            <div className="absolute flex inset-[59.73%_0_0.44%_62.32%] items-center justify-center">
              <div className="flex-none h-[45px] rotate-[180deg] scale-y-[-100%] w-[52px]">
                <div className="relative size-full" data-name="Fighter">
                  <Wrapper4>
                    <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeMiterlimit="10" strokeWidth="4" />
                  </Wrapper4>
                </div>
              </div>
            </div>
            <div className="absolute inset-[73.89%_62.32%_-2.21%_0]" data-name="Defender">
              <Wrapper3>
                <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeMiterlimit="10" strokeWidth="4" />
              </Wrapper3>
            </div>
          </div>
          <div className="absolute flex inset-[0_13.04%_9.73%_13.04%] items-center justify-center">
            <div className="flex-none rotate-[180deg] scale-y-[-100%] size-[102px]">
              <div className="relative size-full" data-name="Starship">
                <Wrapper5>
                  <path d={svgPaths.p184f1080} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeMiterlimit="10" strokeWidth="4" />
                </Wrapper5>
              </div>
            </div>
          </div>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%+107.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%+72px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          17
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-28.5px)] top-[calc(50%-63px)] translate-x-[-50%] translate-y-[-50%]" data-name="Tactical Cruiser and Cost">
        <div className="absolute h-[112px] left-[calc(50%-28.5px)] top-[calc(50%-77px)] translate-x-[-50%] translate-y-[-50%] w-[129px]" data-name="Tactical Cruiser">
          <div className="absolute inset-[20.54%_14.73%_9.82%_14.73%]" data-name="Fighter">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 91 78">
              <g id="Fighter">
                <g id="Vector">
                  <path d="M45.5 0L91 78H0L45.5 0Z" fill="var(--fill-0, black)" />
                  <path d={svgPaths.p248a1a00} stroke="var(--stroke-0, #FF5900)" strokeMiterlimit="10" strokeOpacity="0.6" strokeWidth="4" />
                </g>
              </g>
            </svg>
          </div>
          <div className="absolute inset-[0_30.23%_59.82%_29.46%]" data-name="Fighter">
            <Wrapper4>
              <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF5900)" strokeMiterlimit="10" strokeWidth="4" />
            </Wrapper4>
          </div>
          <Defender3 additionalClassNames="inset-[74.11%_59.69%_-2.68%_0]" />
          <Defender3 additionalClassNames="inset-[74.11%_0.78%_-2.68%_58.91%]" />
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-28.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%-14px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          10
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-114px)] top-[calc(50%+55px)] translate-x-[-50%] translate-y-[-50%]" data-name="Guardian and Cost">
        <div className="absolute h-[48px] left-[calc(50%-114px)] top-[calc(50%+41px)] translate-x-[-50%] translate-y-[-50%] w-[180px]" data-name="Guardian">
          <div className="absolute flex inset-[29.17%_13.89%] items-center justify-center">
            <div className="flex-none h-[130px] rotate-[90deg] w-[20px]">
              <div className="bg-black border-4 border-[rgba(37,85,255,0.6)] border-solid size-full" />
            </div>
          </div>
          <div className="absolute inset-[0_36.67%]" data-name="Commander">
            <Wrapper2>
              <path d="M46 2V46H2V2H46Z" fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeMiterlimit="10" strokeWidth="4" />
            </Wrapper2>
          </div>
          <Defender4 additionalClassNames="inset-[16.67%_71.11%_16.67%_0]" />
          <Defender4 additionalClassNames="inset-[16.67%_0.56%_16.67%_70.56%]" />
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-114.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%+72px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          12
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-181px)] top-[calc(50%-52px)] translate-x-[-50%] translate-y-[-50%]" data-name="Frigate and Cost">
        <div className="absolute h-[88px] left-[calc(50%-181px)] top-[calc(50%-67px)] translate-x-[-50%] translate-y-[-50%] w-[52px]" data-name="Frigate">
          <div className="absolute bg-black border-4 border-[rgba(255,195,0,0.6)] border-solid bottom-[9.09%] left-1/4 right-1/4 top-[20.45%]" />
          <Wrapper additionalClassNames="inset-[26.14%_53.85%_34.09%_46.15%]">
            <line id="Line 2" stroke="var(--stroke-0, #FFC300)" strokeOpacity="0.6" strokeWidth="4" x2="35" y1="2" y2="2" />
          </Wrapper>
          <div className="absolute inset-[48.86%_0_0_0]" data-name="Fighter">
            <Wrapper4>
              <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeMiterlimit="10" strokeWidth="4" />
            </Wrapper4>
          </div>
          <div className="absolute inset-[0_0_63.64%_0]" data-name="Defender">
            <Wrapper3>
              <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeMiterlimit="10" strokeWidth="4" />
            </Wrapper3>
          </div>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-181.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%-14px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          8
        </p>
      </div>
      <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[539px] text-[18px] text-nowrap text-white top-[20px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        Human Upgraded Ships
      </p>
      <div className="absolute contents left-[calc(50%-379px)] top-[calc(50%+28px)] translate-x-[-50%] translate-y-[-50%]" data-name="Starship and Cost">
        <div className="absolute left-[calc(50%-379px)] size-[102px] top-[calc(50%+14px)] translate-x-[-50%] translate-y-[-50%]" data-name="Starship">
          <Wrapper5>
            <path d={svgPaths.p184f1080} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF86E4)" strokeMiterlimit="10" strokeWidth="4" />
          </Wrapper5>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-379.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%+72px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          8
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-526.5px)] top-[calc(50%+28.5px)] translate-x-[-50%] translate-y-[-50%]" data-name="Carrier and Cost">
        <div className="absolute h-[81px] left-[calc(50%-526.5px)] top-[calc(50%+14.5px)] translate-x-[-50%] translate-y-[-50%] w-[93px]" data-name="Carrier">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 93 81">
            <g id="Carrier">
              <path d={svgPaths.p5d49500} fill="var(--fill-0, black)" id="Carrier_2" stroke="var(--stroke-0, #FCFF81)" strokeMiterlimit="10" strokeWidth="4" />
            </g>
          </svg>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-526.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%+62px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          6
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-666.5px)] top-[calc(50%+28px)] translate-x-[-50%] translate-y-[-50%]" data-name="Orbital and Cost">
        <div className="absolute h-[70px] left-[calc(50%-666.5px)] top-[calc(50%+14px)] translate-x-[-50%] translate-y-[-50%] w-[79px]" data-name="Orbital">
          <Wrapper6>
            <path d={svgPaths.p288d0780} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #62FFF6)" strokeMiterlimit="10" strokeWidth="4" />
          </Wrapper6>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-666.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%+56px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          6
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-336.5px)] top-[calc(50%-87px)] translate-x-[-50%] translate-y-[-50%]" data-name="Interceptor and Cost">
        <div className="absolute h-[52px] left-[calc(50%-336.5px)] top-[calc(50%-100px)] translate-x-[-50%] translate-y-[-50%] w-[61px]" data-name="Interceptor">
          <div className="absolute inset-[-7.6%_-9.71%_-11.81%_-9.71%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 72.8409 62.0939">
              <g id="Interceptor">
                <path d={svgPaths.p76cf480} fill="var(--fill-0, black)" id="Interceptor_2" stroke="var(--stroke-0, #CD8CFF)" strokeMiterlimit="10" strokeWidth="4" />
              </g>
            </svg>
          </div>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-336.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%-69px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          4
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-464px)] top-[calc(50%-86px)] translate-x-[-50%] translate-y-[-50%]" data-name="Commander and Cost">
        <div className="absolute left-[calc(50%-464px)] size-[48px] top-[calc(50%-100px)] translate-x-[-50%] translate-y-[-50%]" data-name="Commander">
          <Wrapper2>
            <path d="M46 2V46H2V2H46Z" fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FFBB56)" strokeMiterlimit="10" strokeWidth="4" />
          </Wrapper2>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-464.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%-69px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          4
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-587px)] top-[calc(50%-85px)] translate-x-[-50%] translate-y-[-50%]" data-name="Fighter and Cost">
        <div className="absolute h-[45px] left-[calc(50%-587px)] top-[calc(50%-99.5px)] translate-x-[-50%] translate-y-[-50%] w-[52px]" data-name="Fighter">
          <Wrapper4>
            <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF8282)" strokeMiterlimit="10" strokeWidth="4" />
          </Wrapper4>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-587.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%-69px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          3
        </p>
      </div>
      <div className="absolute contents left-[calc(50%-700px)] top-[calc(50%-79.5px)] translate-x-[-50%] translate-y-[-50%]" data-name="Defender and Cost">
        <div className="absolute h-[32px] left-[calc(50%-700px)] top-[calc(50%-95px)] translate-x-[-50%] translate-y-[-50%] w-[52px]" data-name="Defender">
          <Wrapper3>
            <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #9CFF84)" strokeMiterlimit="10" strokeWidth="4" />
          </Wrapper3>
        </div>
        <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-700.5px)] text-[18px] text-center text-nowrap text-white top-[calc(50%-69px)] translate-x-[-50%]" style={{ fontVariationSettings: "'wdth' 100" }}>
          2
        </p>
      </div>
      <p className="absolute font-['Roboto:Bold',sans-serif] font-bold leading-[normal] left-[20px] text-[18px] text-nowrap text-white top-[20px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        Human Basic Ships
      </p>
    </div>
  );
}