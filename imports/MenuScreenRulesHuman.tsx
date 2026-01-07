import svgPaths from "./svg-0gi9qkrh3d";
import clsx from "clsx";
type Wrapper15Props = {
  additionalClassNames?: string;
};

function Wrapper15({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper15Props>) {
  return (
    <div className={clsx("relative shrink-0 w-full", additionalClassNames)}>
      <div className="content-stretch flex gap-[12px] items-start pl-[16px] pr-[30px] py-[30px] relative w-full">{children}</div>
    </div>
  );
}

function ShipPower({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="content-stretch flex gap-[10px] items-start relative shrink-0 w-full">
      <IconBattle1 />
      <p className="basis-0 font-['Roboto:Regular',sans-serif] font-normal grow leading-[26px] min-h-px min-w-px relative shrink-0 text-[0px] text-[18px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {children}
      </p>
    </div>
  );
}

function Wrapper14({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[36.994px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.9945 36.9945">
        {children}
      </svg>
    </div>
  );
}

function Wrapper13({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="content-stretch flex gap-[10px] items-start relative shrink-0 w-full">
      <IconBattle1 />
      <p className="basis-0 font-['Roboto:Regular',sans-serif] font-normal grow leading-[26px] min-h-px min-w-px relative shrink-0 text-[18px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {children}
      </p>
    </div>
  );
}

function Wrapper12({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[25.691px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 25.6906 25.6906">
        {children}
      </svg>
    </div>
  );
}

function Wrapper11({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="content-stretch flex gap-[10px] items-start relative shrink-0 w-full">
      <IconBuild1 />
      <p className="basis-0 font-['Roboto:Regular',sans-serif] font-normal grow leading-[26px] min-h-px min-w-px relative shrink-0 text-[18px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {children}
      </p>
    </div>
  );
}

function Wrapper10({ children }: React.PropsWithChildren<{}>) {
  return (
    <svg fill="none" preserveAspectRatio="none" viewBox="0 0 52 32" className="block size-full">
      <g id="Defender">{children}</g>
    </svg>
  );
}

function Wrapper9({ children }: React.PropsWithChildren<{}>) {
  return (
    <svg fill="none" preserveAspectRatio="none" viewBox="0 0 79 70" className="block size-full">
      <g id="Orbital">{children}</g>
    </svg>
  );
}
type Starship1Props = {
  additionalClassNames?: string;
};

function Starship1({ children, additionalClassNames = "" }: React.PropsWithChildren<Starship1Props>) {
  return (
    <div className={clsx("relative", additionalClassNames)}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 102 102">
        <g id="Starship">{children}</g>
      </svg>
    </div>
  );
}
type OrbitalProps = {
  additionalClassNames?: string;
};

function Orbital({ children, additionalClassNames = "" }: React.PropsWithChildren<OrbitalProps>) {
  return (
    <div className={clsx("absolute", additionalClassNames)}>
      <Wrapper9>{children}</Wrapper9>
    </div>
  );
}
type Wrapper8Props = {
  additionalClassNames?: string;
};

function Wrapper8({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper8Props>) {
  return (
    <div className={clsx("relative shrink-0 w-full", additionalClassNames)}>
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center pl-[16px] pr-[30px] py-[30px] relative w-full">{children}</div>
      </div>
    </div>
  );
}

function Wrapper7({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="bg-[#555] h-[80px] relative shrink-0 w-full">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between px-[32px] py-[19px] relative size-full">{children}</div>
      </div>
    </div>
  );
}
type Wrapper6Props = {
  additionalClassNames?: string;
};

function Wrapper6({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper6Props>) {
  return (
    <div className={additionalClassNames}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 52 45">
        <g id="Fighter">{children}</g>
      </svg>
    </div>
  );
}
type Wrapper5Props = {
  additionalClassNames?: string;
};

function Wrapper5({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper5Props>) {
  return <Wrapper6 additionalClassNames={clsx("relative", additionalClassNames)}>{children}</Wrapper6>;
}
type Wrapper4Props = {
  additionalClassNames?: string;
};

function Wrapper4({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper4Props>) {
  return <Wrapper6 additionalClassNames={clsx("absolute", additionalClassNames)}>{children}</Wrapper6>;
}
type Wrapper3Props = {
  additionalClassNames?: string;
};

function Wrapper3({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper3Props>) {
  return (
    <div className={clsx("absolute", additionalClassNames)}>
      <Wrapper10>{children}</Wrapper10>
    </div>
  );
}

function Wrapper2({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 w-full">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center pl-[35px] pr-0 py-0 relative w-full">{children}</div>
      </div>
    </div>
  );
}

function Wrapper1({ children }: React.PropsWithChildren<{}>) {
  return (
    <Wrapper2>
      <p className="basis-0 font-['Roboto:Italic',sans-serif] font-normal grow italic leading-[20px] min-h-px min-w-px relative shrink-0 text-[16px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {children}
      </p>
    </Wrapper2>
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
type CommanderProps = {
  additionalClassNames?: string;
};

function Commander({ children, additionalClassNames = "" }: React.PropsWithChildren<CommanderProps>) {
  return (
    <div className={additionalClassNames}>
      <div className="absolute flex inset-0 items-center justify-center">
        <div className="flex-none rotate-[180deg] scale-y-[-100%] size-[48px]">
          <div className="relative size-full" data-name="Vector">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
              {children}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
type LeviathanHelperProps = {
  additionalClassNames?: string;
};

function LeviathanHelper({ additionalClassNames = "" }: LeviathanHelperProps) {
  return (
    <div className={clsx("flex-none w-[21.6px]", additionalClassNames)}>
      <div className="bg-black border-[4.32px] border-[rgba(143,0,255,0.6)] border-solid size-full" />
    </div>
  );
}
type Defender4Props = {
  additionalClassNames?: string;
};

function Defender4({ additionalClassNames = "" }: Defender4Props) {
  return (
    <div className={additionalClassNames}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 56.16 34.56">
        <g id="Defender">
          <path d={svgPaths.p37b77f20} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="4.32" />
        </g>
      </svg>
    </div>
  );
}
type CarrierLmProps = {
  additionalClassNames?: string;
};

function CarrierLm({ additionalClassNames = "" }: CarrierLmProps) {
  return (
    <div className={additionalClassNames}>
      <div className="absolute inset-[-8.92%_0_-10.16%_0]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 100.44 104.169">
          <g id="Carrier [lm]">
            <path d={svgPaths.p32d7b600} fill="var(--fill-0, black)" id="Carrier" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="4.32" />
            <path d={svgPaths.p34036f00} id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.7" />
            <path d={svgPaths.p1a483700} id="Vector_2" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.7" />
            <path d={svgPaths.p204ff920} id="Vector_3" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.7" />
            <path d={svgPaths.p396dc280} id="Vector_4" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.7" />
            <path d={svgPaths.pbfaa440} id="Vector_5" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.7" />
            <path d={svgPaths.p14909300} id="Vector_6" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="2.7" />
          </g>
        </svg>
      </div>
    </div>
  );
}
type StarshipProps = {
  additionalClassNames?: string;
};

function Starship({ additionalClassNames = "" }: StarshipProps) {
  return (
    <div className={additionalClassNames}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 110.16 110.16">
        <g id="Starship">
          <path d={svgPaths.p1b1e6a80} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #8F00FF)" strokeMiterlimit="10" strokeWidth="4.32" />
        </g>
      </svg>
    </div>
  );
}
type Defender3Props = {
  additionalClassNames?: string;
};

function Defender3({ additionalClassNames = "" }: Defender3Props) {
  return (
    <Wrapper3 additionalClassNames={additionalClassNames}>
      <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #DD0000)" strokeMiterlimit="10" strokeWidth="4" />
    </Wrapper3>
  );
}
type Fighter1Props = {
  additionalClassNames?: string;
};

function Fighter1({ additionalClassNames = "" }: Fighter1Props) {
  return (
    <Wrapper4 additionalClassNames={additionalClassNames}>
      <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #DD0000)" strokeMiterlimit="10" strokeWidth="4" />
    </Wrapper4>
  );
}
type Defender2Props = {
  additionalClassNames?: string;
};

function Defender2({ additionalClassNames = "" }: Defender2Props) {
  return (
    <Wrapper3 additionalClassNames={additionalClassNames}>
      <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="4" />
    </Wrapper3>
  );
}
type FighterProps = {
  additionalClassNames?: string;
};

function Fighter({ additionalClassNames = "" }: FighterProps) {
  return (
    <Wrapper4 additionalClassNames={additionalClassNames}>
      <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeMiterlimit="10" strokeWidth="4" />
    </Wrapper4>
  );
}
type HelperProps = {
  text: string;
  text1: string;
};

function Helper({ text, text1 }: HelperProps) {
  return (
    <p style={{ fontVariationSettings: "'wdth' 100" }} className="basis-0 font-['Roboto:Regular',sans-serif] font-normal grow leading-[26px] min-h-px min-w-px relative shrink-0 text-[18px] text-white">
      <span className="font-['Roboto:Italic',sans-serif] italic" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </span>
      <span>
        <br aria-hidden="true" />
        {text1}
      </span>
    </p>
  );
}
type Defender1Props = {
  additionalClassNames?: string;
};

function Defender1({ additionalClassNames = "" }: Defender1Props) {
  return (
    <Wrapper3 additionalClassNames={additionalClassNames}>
      <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeMiterlimit="10" strokeWidth="4" />
    </Wrapper3>
  );
}
type DefenderProps = {
  additionalClassNames?: string;
};

function Defender({ additionalClassNames = "" }: DefenderProps) {
  return (
    <Wrapper3 additionalClassNames={additionalClassNames}>
      <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF5900)" strokeMiterlimit="10" strokeWidth="4" />
    </Wrapper3>
  );
}
type ShipName1Props = {
  text: string;
  text1: string;
  text2: string;
};

function ShipName1({ text, text1, text2 }: ShipName1Props) {
  return (
    <div className="basis-0 content-stretch flex flex-col gap-[2px] grow items-start min-h-px min-w-px relative shrink-0">
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[25.691px] min-w-full relative shrink-0 text-[20px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
      <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[24px] relative shrink-0 text-[#d4d4d4] text-[18px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text1}
      </p>
      <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[15px] min-w-full relative shrink-0 text-[#d4d4d4] text-[13px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text2}
      </p>
    </div>
  );
}
type ShipPowerText1Props = {
  text: string;
};

function ShipPowerText1({ text }: ShipPowerText1Props) {
  return <Wrapper11>{text}</Wrapper11>;
}

function IconBuild1() {
  return (
    <Wrapper12>
      <g id="Icon - Build" opacity="0.5">
        <g id="Vector">
          <path d={svgPaths.p1cb5fb00} fill="var(--fill-0, #D5D5D5)" />
          <path d={svgPaths.p1c31b500} fill="var(--fill-0, #D5D5D5)" />
        </g>
      </g>
    </Wrapper12>
  );
}
type ShipPowerNoteTextProps = {
  text: string;
};

function ShipPowerNoteText({ text }: ShipPowerNoteTextProps) {
  return <Wrapper1>{text}</Wrapper1>;
}
type ShipPowerTextProps = {
  text: string;
};

function ShipPowerText({ text }: ShipPowerTextProps) {
  return <Wrapper13>{text}</Wrapper13>;
}

function IconBattle1() {
  return (
    <Wrapper12>
      <g id="Icon - Battle" opacity="0.5">
        <path d={svgPaths.p8b7ba00} fill="var(--fill-0, #D5D5D5)" id="Star 1" />
      </g>
    </Wrapper12>
  );
}
type ShipNameProps = {
  text: string;
  text1: string;
};

function ShipName({ text, text1 }: ShipNameProps) {
  return (
    <div className="basis-0 content-stretch flex flex-col gap-[2px] grow items-start min-h-px min-w-px relative shrink-0">
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[25.691px] relative shrink-0 text-[20px] text-white w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
      <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[14.13px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text1}
      </p>
    </div>
  );
}

function IconBattle() {
  return (
    <Wrapper14>
      <g id="Icon - Battle">
        <path d={svgPaths.p2d33f00} fill="var(--fill-0, white)" id="Star 1" />
      </g>
    </Wrapper14>
  );
}
type TextProps = {
  text: string;
  additionalClassNames?: string;
};

function Text({ text, additionalClassNames = "" }: TextProps) {
  return (
    <p className={clsx("font-['Inter:Medium',sans-serif] font-medium leading-[20.809px] not-italic relative shrink-0 text-[15.029px] text-white", additionalClassNames)}>
      <span className="font-['Roboto:Medium',sans-serif]" style={{ fontVariationSettings: "'wdth' 100" }}>{`Powers that occur in the `}</span>
      <span className="font-['Roboto:ExtraBold',sans-serif] font-extrabold" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </span>
    </p>
  );
}

function IconBuild() {
  return (
    <Wrapper14>
      <g id="Icon - Build">
        <g id="Vector">
          <path d={svgPaths.p3f9e4200} fill="var(--fill-0, #D5D5D5)" />
          <path d={svgPaths.p3fe87100} fill="var(--fill-0, #D5D5D5)" />
        </g>
      </g>
    </Wrapper14>
  );
}

export default function MenuScreenRulesHuman() {
  return (
    <div className="content-stretch flex flex-col gap-[90px] items-start relative size-full" data-name="Menu Screen - Rules - Human">
      <div className="content-stretch flex flex-col gap-[48px] items-start relative shrink-0 w-full" data-name="Rules - Human">
        <div className="content-stretch flex items-center justify-between relative shrink-0 text-white w-full" data-name="Rules Header">
          <div className="content-stretch flex gap-[20px] items-center relative shrink-0 text-nowrap" data-name="Species">
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[36px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Human
            </p>
            <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[0px] text-[20px] text-right">
              <span className="font-['Roboto:Regular',sans-serif] font-normal text-white" style={{ fontVariationSettings: "'wdth' 100" }}>{`from `}</span>
              <span className="font-['Roboto:SemiBold',sans-serif]" style={{ fontVariationSettings: "'wdth' 100" }}>
                Sol
              </span>
            </p>
          </div>
          <p className="font-['Roboto:Regular',sans-serif] font-normal h-[49px] leading-[22px] relative shrink-0 text-[16px] text-right w-[255px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Metal. Explosions. Expansion.
            <br aria-hidden="true" />
            {` Onward and upward.`}
          </p>
        </div>
        <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Basic Ships Wrapper">
          <div aria-hidden="true" className="absolute border-[#555] border-[3px] border-solid inset-[-3px] pointer-events-none" />
          <Wrapper7>
            <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[22px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
              Basic Ships
            </p>
            <div className="content-stretch flex gap-[28px] items-center justify-end relative shrink-0" data-name="Power Time Note">
              <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Build Phase">
                <IconBuild />
                <Text text="Build Phase." additionalClassNames="w-[141.041px]" />
              </div>
              <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Battle Phase">
                <IconBattle />
                <Text text="Battle Phase." additionalClassNames="w-[145.666px]" />
              </div>
            </div>
          </Wrapper7>
          <Wrapper8>
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[32px] relative shrink-0 w-[52px]" data-name="Defender">
                <Wrapper10>
                  <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #9CFF84)" strokeMiterlimit="10" strokeWidth="4" />
                </Wrapper10>
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                2
              </p>
              <ShipName text="Defender" text1="AUTOMATIC" />
            </div>
            <div className="content-stretch flex flex-col items-start relative shrink-0 w-[505px]" data-name="Powers">
              <ShipPowerText text="Heal 1." />
            </div>
          </Wrapper8>
          <Wrapper8 additionalClassNames="bg-[#212121]">
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <Wrapper5 additionalClassNames="h-[45px] shrink-0 w-[52px]">
                <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF8282)" strokeMiterlimit="10" strokeWidth="4" />
              </Wrapper5>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                3
              </p>
              <ShipName text="Fighter" text1="AUTOMATIC" />
            </div>
            <div className="content-stretch flex flex-col items-start relative shrink-0 w-[505px]" data-name="Powers">
              <ShipPowerText text="Deal 1 damage." />
            </div>
          </Wrapper8>
          <Wrapper8>
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <Commander additionalClassNames="relative shrink-0 size-[48px]">
                <path d="M46 2V46H2V2H46Z" fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FFBB56)" strokeMiterlimit="10" strokeWidth="4" />
              </Commander>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                4
              </p>
              <ShipName text="Commander" text1="AUTOMATIC" />
            </div>
            <div className="content-stretch flex flex-col items-start relative shrink-0 w-[505px]" data-name="Powers">
              <ShipPowerText text="Deal 1 damage for every THREE of your Fighters." />
            </div>
          </Wrapper8>
          <Wrapper15 additionalClassNames="bg-[#212121]">
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[52px] relative shrink-0 w-[61px]" data-name="Interceptor">
                <div className="absolute inset-[-7.6%_-9.71%_-11.81%_-9.71%]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 72.8409 62.0939">
                    <g id="Interceptor">
                      <path d={svgPaths.p76cf480} fill="var(--fill-0, black)" id="Interceptor_2" stroke="var(--stroke-0, #CD8CFF)" strokeMiterlimit="10" strokeWidth="4" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                4
              </p>
              <ShipName text="Interceptor" text1="CHARGE DECLARATION" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPower>
                <span>
                  Interceptors have 1 charge:
                  <br aria-hidden="true" />
                  {`- Deal 5 damage (uses charge) `}
                </span>
                <span className="font-['Roboto:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>
                  OR
                </span>
                <span>
                  <br aria-hidden="true" />- Heal 5 (uses charge)
                </span>
              </ShipPower>
              <ShipPowerNoteText text="Interceptor will be marked when the charge has been used." />
            </div>
          </Wrapper15>
          <Wrapper15>
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[70px] relative shrink-0 w-[79px]" data-name="Orbital">
                <Wrapper9>
                  <path d={svgPaths.p288d0780} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #62FFF6)" strokeMiterlimit="10" strokeWidth="4" />
                </Wrapper9>
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                6
              </p>
              <ShipName text="Orbital" text1="LINE GENERATION" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPowerText1 text="Generate an additional line in each future build phase." />
              <ShipPowerNoteText text="You can have a maximum of 6 Orbitals. Lines may be saved." />
            </div>
          </Wrapper15>
          <Wrapper15 additionalClassNames="bg-[#212121]">
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[81px] relative shrink-0 w-[93px]" data-name="Carrier">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 93 81">
                  <g id="Carrier">
                    <path d={svgPaths.p5d49500} fill="var(--fill-0, black)" id="Carrier_2" stroke="var(--stroke-0, #FCFF81)" strokeMiterlimit="10" strokeWidth="4" />
                  </g>
                </svg>
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                6
              </p>
              <ShipName text="Carrier" text1="SHIPS THAT BUILD" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <Wrapper11>
                <span>
                  Has 6 charges. In each future build phase, may:
                  <br aria-hidden="true" />
                  {`- Make a Defender (use 1 charge) `}
                </span>
                <span className="font-['Roboto:SemiBold',sans-serif] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>
                  OR
                </span>
                <span>
                  <br aria-hidden="true" />- Make a Fighter (use 2 charges)
                </span>
              </Wrapper11>
              <ShipPowerNoteText text="Carrier will be marked each time a charge is used." />
            </div>
          </Wrapper15>
          <Wrapper8>
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <Starship1 additionalClassNames="shrink-0 size-[102px]">
                <path d={svgPaths.p184f1080} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF86E4)" strokeMiterlimit="10" strokeWidth="4" />
              </Starship1>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                6
              </p>
              <div className="basis-0 content-stretch flex flex-col gap-[2px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Ship Name">
                <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[25.691px] relative shrink-0 text-[20px] text-white w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Starship
                </p>
                <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[15.414px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                  AUTOMATIC
                </p>
              </div>
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[16px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <div className="content-stretch flex gap-[10px] items-start relative shrink-0 w-full" data-name="Ship Power">
                <IconBuild1 />
                <p className="basis-0 font-['Roboto:Regular',sans-serif] font-normal grow leading-[25.691px] min-h-px min-w-px relative shrink-0 text-[18px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Deal 8 damage, once only on the turn it is built.
                </p>
              </div>
            </div>
          </Wrapper8>
        </div>
        <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Upgraded Ships Wrapper">
          <div aria-hidden="true" className="absolute border-[#555] border-[3px] border-solid inset-[-3px] pointer-events-none" />
          <Wrapper7>
            <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[22px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
              UPgraded Ships
            </p>
            <div className="content-stretch flex gap-[7px] items-center relative shrink-0" data-name="Battle Phase">
              <IconBuild />
              <IconBattle />
              <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20.809px] not-italic relative shrink-0 text-[15.029px] text-white w-[208px]">Some upgraded ships have powers in both phases.</p>
            </div>
          </Wrapper7>
          <Wrapper15>
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[88px] relative shrink-0 w-[52px]" data-name="Frigate">
                <div className="absolute bg-black border-4 border-[rgba(255,195,0,0.6)] border-solid bottom-[9.09%] left-1/4 right-1/4 top-[20.45%]" />
                <Wrapper additionalClassNames="inset-[26.14%_53.85%_34.09%_46.15%]">
                  <line id="Line 2" stroke="var(--stroke-0, #FFC300)" strokeOpacity="0.6" strokeWidth="4" x2="35" y1="2" y2="2" />
                </Wrapper>
                <Wrapper4 additionalClassNames="inset-[48.86%_0_0_0]">
                  <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeMiterlimit="10" strokeWidth="4" />
                </Wrapper4>
                <Wrapper3 additionalClassNames="inset-[0_0_63.64%_0]">
                  <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FFC400)" strokeMiterlimit="10" strokeWidth="4" />
                </Wrapper3>
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                8
              </p>
              <ShipName1 text="Frigate" text1="(+3 joining lines)" text2="DRAWING, AUTOMATIC" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPowerText1 text="When built, write a number between 1 and 6 in the Frigate." />
              <ShipPowerText text="When the dice roll matches that number, deal 6 damage (this includes the turn when the Frigate is built)." />
              <Wrapper13>{`Heal 2. `}</Wrapper13>
            </div>
          </Wrapper15>
          <Wrapper15 additionalClassNames="bg-[#212121]">
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[112px] relative shrink-0 w-[129px]" data-name="Tactical Cruiser">
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
                <Wrapper4 additionalClassNames="inset-[0_30.23%_59.82%_29.46%]">
                  <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FF5900)" strokeMiterlimit="10" strokeWidth="4" />
                </Wrapper4>
                <Defender additionalClassNames="inset-[74.11%_59.69%_-2.68%_0]" />
                <Defender additionalClassNames="inset-[74.11%_0.78%_-2.68%_58.91%]" />
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                10
              </p>
              <ShipName1 text="Tactical Cruiser" text1="(+3)" text2="AUTOMATIC" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPowerText text="Deal 1 damage for each TYPE of ship you have." />
              <Wrapper2>
                <p className="font-['Roboto:Italic',sans-serif] font-normal italic leading-[20px] relative shrink-0 text-[16px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Includes Tactical Cruiser as a type.
                </p>
              </Wrapper2>
            </div>
          </Wrapper15>
          <Wrapper15>
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[48px] relative shrink-0 w-[180px]" data-name="Guardian">
                <div className="absolute flex inset-[29.17%_13.89%] items-center justify-center">
                  <div className="flex-none h-[130px] rotate-[90deg] w-[20px]">
                    <div className="bg-black border-4 border-[rgba(37,85,255,0.6)] border-solid size-full" />
                  </div>
                </div>
                <Commander additionalClassNames="absolute inset-[0_36.67%]">
                  <path d="M46 2V46H2V2H46Z" fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #2555FF)" strokeMiterlimit="10" strokeWidth="4" />
                </Commander>
                <Defender1 additionalClassNames="inset-[16.67%_71.11%_16.67%_0]" />
                <Defender1 additionalClassNames="inset-[16.67%_0.56%_16.67%_70.56%]" />
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                12
              </p>
              <ShipName1 text="Guardian" text1="(+4)" text2="FIRST STRIKE" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <Wrapper13>
                Guardians have 2 charges:
                <br aria-hidden="true" />- Destroy a basic enemy ship (use 1 charge)
              </Wrapper13>
              <Wrapper1>
                <span>{`Guardian will be marked each time a charge is used. Cannot destroy upgraded ships. The Guardian power occurs during Battle Phase before other ship powers. See '`}</span>
                <span className="[text-underline-position:from-font] decoration-solid underline">Destroying</span>
                <span>{`' rules for info.`}</span>
              </Wrapper1>
            </div>
          </Wrapper15>
          <Wrapper15 additionalClassNames="bg-[#212121]">
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[113px] relative shrink-0 w-[138px]" data-name="Science Vessel">
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
                      <Wrapper5 additionalClassNames="size-full">
                        <path d={svgPaths.p27c75d00} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeMiterlimit="10" strokeWidth="4" />
                      </Wrapper5>
                    </div>
                  </div>
                  <Wrapper3 additionalClassNames="inset-[73.89%_62.32%_-2.21%_0]">
                    <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeMiterlimit="10" strokeWidth="4" />
                  </Wrapper3>
                </div>
                <div className="absolute flex inset-[0_13.04%_9.73%_13.04%] items-center justify-center">
                  <div className="flex-none rotate-[180deg] scale-y-[-100%] size-[102px]">
                    <Starship1 additionalClassNames="size-full">
                      <path d={svgPaths.p184f1080} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #FA00FF)" strokeMiterlimit="10" strokeWidth="4" />
                    </Starship1>
                  </div>
                </div>
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                17
              </p>
              <ShipName1 text="Science Vessel" text1="(+4)" text2="LINE GENERATION, AUTOMATIC" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPower>
                <span className="font-['Roboto:Italic',sans-serif] italic" style={{ fontVariationSettings: "'wdth' 100" }}>
                  If you have one:
                </span>
                <span style={{ fontVariationSettings: "'wdth' 100" }}>
                  <br aria-hidden="true" />
                  Double your healing.
                </span>
              </ShipPower>
              <div className="content-stretch flex gap-[10px] items-start relative shrink-0 w-full" data-name="Ship Power">
                <IconBattle1 />
                <Helper text="If you have two:" text1="Also double your damage." />
              </div>
              <div className="content-stretch flex gap-[10px] items-start relative shrink-0 w-full" data-name="Ship Power">
                <IconBuild1 />
                <Helper text="If you have three:" text1="Also double the dice roll for you." />
              </div>
              <Wrapper1>{`Healing & Damage: Doubling does not apply to 'upon completion' or charge powers. Dice: Each future build phase, generate additional lines equal to the dice roll. (For Frigates, use dice number as read).`}</Wrapper1>
            </div>
          </Wrapper15>
          <Wrapper15>
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[114px] relative shrink-0 w-[183px]" data-name="Battlecruiser">
                <div className="absolute bg-black border-4 border-[rgba(0,182,239,0.6)] border-solid bottom-1/2 left-[42.62%] right-[42.08%] top-[14.91%]" />
                <div className="absolute flex inset-[46.49%_14.21%_35.96%_14.21%] items-center justify-center">
                  <div className="flex-none h-[131px] rotate-[90deg] w-[20px]">
                    <div className="bg-black border-4 border-[rgba(0,182,239,0.6)] border-solid size-full" />
                  </div>
                </div>
                <Orbital additionalClassNames="inset-[38.6%_28.42%_0_28.42%]">
                  <path d={svgPaths.p288d0780} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeMiterlimit="10" strokeWidth="4" />
                </Orbital>
                <Fighter additionalClassNames="inset-[29.82%_0_30.7%_71.58%]" />
                <Fighter additionalClassNames="inset-[29.82%_71.58%_30.7%_0]" />
                <Wrapper3 additionalClassNames="inset-[0_35.52%_71.93%_36.07%]">
                  <path d={svgPaths.p35825300} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00B6EF)" strokeMiterlimit="10" strokeWidth="4" />
                </Wrapper3>
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                20
              </p>
              <ShipName1 text="Battlecruiser" text1="(+6)" text2="LINE GENERATION, AUTOMATIC" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPowerText1 text="Generate TWO additional lines each future build phase." />
              <ShipPowerText text="Deal 2 damage." />
              <ShipPowerText text="Heal 3." />
              <ShipPowerNoteText text="Lines may be saved." />
            </div>
          </Wrapper15>
          <Wrapper15 additionalClassNames="bg-[#212121]">
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[166px] relative shrink-0 w-[211px]" data-name="Earth Ship">
                <div className="absolute flex inset-[69.88%_10.9%_18.07%_10.9%] items-center justify-center">
                  <div className="flex-none h-[165px] rotate-[90deg] w-[20px]">
                    <div className="bg-black border-4 border-[rgba(0,189,19,0.6)] border-solid size-full" />
                  </div>
                </div>
                <div className="absolute bg-black border-4 border-[rgba(0,189,19,0.6)] border-solid inset-[28.92%_41.71%_24.1%_42.18%]" />
                <Wrapper additionalClassNames="inset-[37.95%_50.71%_40.96%_49.29%]">
                  <line id="Line 3" stroke="var(--stroke-0, #00BD13)" strokeOpacity="0.6" strokeWidth="4" x2="35" y1="2" y2="2" />
                </Wrapper>
                <Orbital additionalClassNames="inset-[0_31.28%_57.83%_31.28%]">
                  <path d={svgPaths.p288d0780} fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="4" />
                </Orbital>
                <div className="absolute inset-[51.2%_27.96%_0_27.96%]" data-name="Carrier [lm]">
                  <div className="absolute inset-[-8.92%_0_-10.16%_0]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 93 96.4528">
                      <g id="Carrier [lm]">
                        <path d={svgPaths.p33772500} fill="var(--fill-0, black)" id="Carrier" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="4" />
                        <path d={svgPaths.p35ef73c0} id="Vector" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
                        <path d={svgPaths.p2d480800} id="Vector_2" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
                        <path d={svgPaths.p371d9990} id="Vector_3" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
                        <path d={svgPaths.pf008d00} id="Vector_4" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
                        <path d={svgPaths.p18f75200} id="Vector_5" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
                        <path d={svgPaths.p2330f320} id="Vector_6" stroke="var(--stroke-0, #00BD13)" strokeMiterlimit="10" strokeWidth="2.5" />
                      </g>
                    </svg>
                  </div>
                </div>
                <Defender2 additionalClassNames="inset-[65.66%_76.78%_15.06%_-1.42%]" />
                <Defender2 additionalClassNames="inset-[65.66%_-1.42%_15.06%_76.78%]" />
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                20
              </p>
              <ShipName1 text="Earth Ship" text1="(+7)" text2="AUTOMATIC" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPowerText text="Deal 3 damage for each of your Carriers." />
              <ShipPowerNoteText text="Carrier charges must all be used before upgrading. Damage does not count Carriers within upgraded ships." />
            </div>
          </Wrapper15>
          <Wrapper15>
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[105px] relative shrink-0 w-[198px]" data-name="Dreadnought">
                <div className="absolute bg-black border-4 border-[rgba(221,0,0,0.6)] border-solid inset-[20%_44.95%_5.71%_44.95%]" />
                <div className="absolute bg-black border-4 border-[rgba(221,0,0,0.6)] border-solid inset-[24.76%_8.08%_19.05%_81.82%]" />
                <div className="absolute bg-black border-4 border-[rgba(221,0,0,0.6)] border-solid inset-[24.76%_81.82%_19.05%_8.08%]" />
                <div className="absolute flex inset-[67.62%_13.13%_13.33%_13.13%] items-center justify-center">
                  <div className="flex-none h-[146px] rotate-[90deg] w-[20px]">
                    <div className="bg-black border-4 border-[rgba(221,0,0,0.6)] border-solid size-full" />
                  </div>
                </div>
                <Commander additionalClassNames="absolute inset-[54.29%_37.88%_0_37.88%]">
                  <path d="M46 2V46H2V2H46Z" fill="var(--fill-0, black)" id="Vector" stroke="var(--stroke-0, #DD0000)" strokeMiterlimit="10" strokeWidth="4" />
                </Commander>
                <Fighter1 additionalClassNames="inset-[52.38%_0_4.76%_73.74%]" />
                <Fighter1 additionalClassNames="inset-[52.38%_73.74%_4.76%_0]" />
                <Fighter1 additionalClassNames="inset-[0_36.87%_57.14%_36.87%]" />
                <Defender3 additionalClassNames="inset-[10.48%_73.74%_59.05%_0]" />
                <Defender3 additionalClassNames="inset-[10.48%_0_59.05%_73.74%]" />
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                27
              </p>
              <ShipName1 text="Dreadnought" text1="(+10)" text2="DRAWING, AUTOMATIC" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPowerText1 text="When you complete a ship, you may make a FREE additional Fighter." />
              <ShipPowerText text="Deal 10 damage." />
              <ShipPowerNoteText text="The Dreadnought’s build power activates whenever you make a basic ship (including from Carriers) or complete an upgraded ship. It can occur multiple times per turn. Is not activated by itself or other Dreadnoughts." />
            </div>
          </Wrapper15>
          <Wrapper15 additionalClassNames="bg-[#212121]">
            <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px]" data-name="Ship Graphic">
              <div className="h-[239.892px] relative shrink-0 w-[258.12px]" data-name="Leviathan">
                <div className="absolute flex inset-[60.78%_76.57%_14.91%_15.06%] items-center justify-center">
                  <LeviathanHelper additionalClassNames="h-[58.32px] rotate-[180deg]" />
                </div>
                <div className="absolute flex inset-[19.81%_47.23%_49.97%_24.69%] items-center justify-center">
                  <LeviathanHelper additionalClassNames="h-[80.92px] rotate-[45deg]" />
                </div>
                <div className="absolute flex inset-[19.81%_25.05%_49.97%_46.86%] items-center justify-center">
                  <LeviathanHelper additionalClassNames="h-[80.92px] rotate-[135deg] scale-y-[-100%]" />
                </div>
                <div className="absolute flex inset-[49.97%_47.23%_19.81%_24.69%] items-center justify-center">
                  <LeviathanHelper additionalClassNames="h-[80.92px] rotate-[315deg] scale-y-[-100%]" />
                </div>
                <div className="absolute flex inset-[49.97%_25.05%_19.81%_46.86%] items-center justify-center">
                  <LeviathanHelper additionalClassNames="h-[80.92px] rotate-[225deg]" />
                </div>
                <Starship additionalClassNames="absolute inset-[0_28.87%_54.08%_28.45%]" />
                <div className="absolute flex inset-[54.08%_28.87%_0_28.45%] items-center justify-center">
                  <div className="flex-none scale-y-[-100%] size-[110.16px]">
                    <Starship additionalClassNames="relative size-full" />
                  </div>
                </div>
                <CarrierLm additionalClassNames="absolute inset-[31.51%_61.09%_32.02%_0]" />
                <Defender4 additionalClassNames="absolute inset-[80.14%_69.87%_5.46%_8.37%]" />
                <div className="absolute flex inset-[60.78%_15.06%_14.91%_76.57%] items-center justify-center">
                  <LeviathanHelper additionalClassNames="h-[58.32px] scale-y-[-100%]" />
                </div>
                <div className="absolute flex inset-[31.51%_0_32.02%_61.09%] items-center justify-center">
                  <div className="flex-none h-[87.48px] rotate-[180deg] scale-y-[-100%] w-[100.44px]">
                    <CarrierLm additionalClassNames="relative size-full" />
                  </div>
                </div>
                <div className="absolute flex inset-[80.14%_8.37%_5.46%_69.87%] items-center justify-center">
                  <div className="flex-none h-[34.56px] rotate-[180deg] scale-y-[-100%] w-[56.16px]">
                    <Defender4 additionalClassNames="relative size-full" />
                  </div>
                </div>
              </div>
            </div>
            <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]" data-name="Ship Info">
              <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                44
              </p>
              <ShipName1 text="Leviathan" text1="(+12)" text2="DICE MANIPULATION, AUTOMATIC" />
            </div>
            <div className="basis-0 content-stretch flex flex-col gap-[10px] grow items-start min-h-px min-w-px relative shrink-0" data-name="Powers">
              <ShipPowerText1 text="All dice rolls read as 6 for you." />
              <ShipPowerText text="Deal 12 damage." />
              <ShipPowerText text="Heal 12." />
              <ShipPowerNoteText text="Carrier charges must all be used before upgrading. Overrides reroll powers." />
            </div>
          </Wrapper15>
        </div>
        <div className="bg-white content-stretch flex items-center justify-center px-[30px] py-[20px] relative rounded-[10px] shrink-0" data-name="Button">
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Next: Xenite Species
          </p>
        </div>
      </div>
    </div>
  );
}