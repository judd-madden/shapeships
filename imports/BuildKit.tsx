import svgPaths from "./svg-2kgvw5ynl8";
import clsx from "clsx";
import imgD1 from "figma:asset/1c079466ca4622fc310a4f4ac8a31668545f5746.png";
import imgD2 from "figma:asset/4bd8b8c2966031c9e4cbf7d3b033a13886100b60.png";
import imgD3 from "figma:asset/a16cee3aa31290b8446f22654a82b25c0a85b15f.png";
import imgD4 from "figma:asset/f4cefbd083b166a8239a0a29b3e1634d669d8e03.png";
import imgD5 from "figma:asset/7f932d29011f8a0686994b103e84e580f9dedcd1.png";
import imgD6 from "figma:asset/1efd037aa013abea7a113cc6e3e9a869d374841d.png";

function Wrapper3({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[30px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 30 30">
        {children}
      </svg>
    </div>
  );
}

function Wrapper2({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[40px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40 40">
        {children}
      </svg>
    </div>
  );
}
type Wrapper1Props = {
  additionalClassNames?: string;
};

function Wrapper1({ children, additionalClassNames = "" }: React.PropsWithChildren<Wrapper1Props>) {
  return (
    <div className={additionalClassNames}>
      <div aria-hidden="true" className="absolute border-2 border-black border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="flex flex-row items-center justify-center size-full">{children}</div>
    </div>
  );
}
type WrapperProps = {
  additionalClassNames?: string;
};

function Wrapper({ children, additionalClassNames = "" }: React.PropsWithChildren<WrapperProps>) {
  return <Wrapper1 additionalClassNames={clsx("bg-[#2555ff] relative rounded-[10px] shrink-0 w-full", additionalClassNames)}>{children}</Wrapper1>;
}
type ButtonInnerTextProps = {
  text: string;
  additionalClassNames?: string;
};

function ButtonInnerText({ text, additionalClassNames = "" }: ButtonInnerTextProps) {
  return (
    <Wrapper1 additionalClassNames={clsx("h-[34px] relative rounded-[10px] shrink-0 w-full", additionalClassNames)}>
      <div className="content-stretch flex items-center justify-center px-[20px] py-[10px] relative size-full">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[14px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
          {text}
        </p>
      </div>
    </Wrapper1>
  );
}
type Helper2Props = {
  text: string;
  text1: string;
  additionalClassNames?: string;
};

function Helper2({ text, text1, additionalClassNames = "" }: Helper2Props) {
  return (
    <div className={clsx("content-stretch flex gap-[4px] items-center justify-center leading-[normal] px-[20px] py-[19px] relative size-full text-[16px] text-nowrap", additionalClassNames)}>
      <p className="font-['Roboto:Bold',sans-serif] font-bold relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
      <p className="font-['Roboto:Regular',sans-serif] font-normal relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text1}
      </p>
    </div>
  );
}
type ButtonInnerProps = {
  text: string;
  text1: string;
  additionalClassNames?: string;
};

function ButtonInner({ text, text1, additionalClassNames = "" }: ButtonInnerProps) {
  return (
    <Wrapper1 additionalClassNames={clsx("h-[50px] relative rounded-[10px] shrink-0 w-full", additionalClassNames)}>
      <Helper2 text={text} text1={text1} additionalClassNames="text-black" />
    </Wrapper1>
  );
}

function IconTick() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="icon/tick">
          <path d={svgPaths.p24c59180} fill="var(--fill-0, black)" id="Combined Shape Copy 4" />
        </g>
      </svg>
    </div>
  );
}
type Text5Props = {
  text: string;
};

function Text5({ text }: Text5Props) {
  return (
    <p style={{ fontVariationSettings: "'wdth' 100" }} className="font-['Roboto:Black',sans-serif] font-['Roboto:Regular',sans-serif] font-black font-normal leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap">
      <span style={{ fontVariationSettings: "'wdth' 100" }}>{`- `}</span>
      <span style={{ fontVariationSettings: "'wdth' 100" }}>{text}</span>
    </p>
  );
}
type Helper1Props = {
  text: string;
  text1: string;
};

function Helper1({ text, text1 }: Helper1Props) {
  return (
    <div className="flex flex-row items-center justify-center size-full">
      <div className="content-stretch flex font-['Roboto:Black',sans-serif] font-black gap-[4px] items-center justify-center px-[20px] py-[19px] relative size-full text-[18px] text-black text-nowrap">
        <p className="leading-[normal] relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
          {text}
        </p>
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
          <span style={{ fontVariationSettings: "'wdth' 100" }}>{`- `}</span>
          <span style={{ fontVariationSettings: "'wdth' 100" }}>{text1}</span>
        </p>
      </div>
    </div>
  );
}
type Text4Props = {
  text: string;
  additionalClassNames?: string;
};

function Text4({ text, additionalClassNames = "" }: Text4Props) {
  return (
    <div className={clsx("content-stretch flex items-center justify-center px-[20px] py-[10px] relative", additionalClassNames)}>
      <p className="[text-underline-position:from-font] decoration-solid font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[18px] text-nowrap text-white underline" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}
type Text3Props = {
  text: string;
  additionalClassNames?: string;
};

function Text3({ text, additionalClassNames = "" }: Text3Props) {
  return (
    <div className={clsx("content-stretch flex items-center justify-center px-[20px] py-[10px] relative", additionalClassNames)}>
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[18px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}
type Text2Props = {
  text: string;
  additionalClassNames?: string;
};

function Text2({ text, additionalClassNames = "" }: Text2Props) {
  return (
    <div className={clsx("relative rounded-tl-[10px] rounded-tr-[10px] shrink-0 w-full", additionalClassNames)}>
      <div className="flex flex-row items-center justify-center size-full">
        <Text3 text={text} additionalClassNames="w-full" />
      </div>
    </div>
  );
}
type HelperProps = {
  additionalClassNames?: string;
};

function Helper({ additionalClassNames = "" }: HelperProps) {
  return (
    <div className={clsx("content-stretch flex flex-col gap-[10px] items-start justify-center px-[40px] py-[25px] relative shrink-0 w-[958px]", additionalClassNames)}>
      <Details text="Guest 12" text1="Standard" text2="X v Any" text3="10m + 30s" text4="45m" additionalClassNames="text-white" />
      <div className="content-stretch flex items-center justify-center pl-[215px] pr-0 py-0 relative shrink-0">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#888] text-[15px] w-[662px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          {"Epic Health, Accelerated Game, No Destruction"}
        </p>
      </div>
    </div>
  );
}
type DetailsProps = {
  text: string;
  text1: string;
  text2: string;
  text3: string;
  text4: string;
  additionalClassNames?: string;
};

function Details({ text, text1, text2, text3, text4, additionalClassNames = "" }: DetailsProps) {
  return (
    <div className={clsx("content-stretch flex font-['Roboto:Regular',sans-serif] font-normal gap-[20px] items-center leading-[normal] relative shrink-0 text-[20px]", additionalClassNames)}>
      <p className="relative shrink-0 w-[195px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
      <p className="relative shrink-0 w-[168px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text1}
      </p>
      <p className="relative shrink-0 w-[144px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text2}
      </p>
      <p className="relative shrink-0 w-[182px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text3}
      </p>
      <p className="relative shrink-0 w-[109px]" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text4}
      </p>
    </div>
  );
}
type Text1Props = {
  text: string;
};

function Text1({ text }: Text1Props) {
  return (
    <div className="bg-black content-stretch flex h-[72px] items-center justify-center p-[20px] relative rounded-[10px] shrink-0 w-[280px]">
      <div aria-hidden="true" className="absolute border-[3px] border-solid border-white inset-[-3px] pointer-events-none rounded-[13px]" />
      <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}
type TextProps = {
  text: string;
  additionalClassNames?: string;
};

function Text({ text, additionalClassNames = "" }: TextProps) {
  return (
    <div className={clsx("content-stretch flex h-[72px] items-center justify-center p-[20px] relative rounded-[10px] shrink-0 w-[280px]", additionalClassNames)}>
      <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}

export default function BuildKit() {
  return (
    <div className="bg-[#101010] relative size-full" data-name="Build Kit">
      <div className="absolute content-stretch flex flex-col gap-[36px] items-start left-[78px] top-[52px] w-[360px]" data-name="Login Screens Button">
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Login Screens Button / Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Login Screens Button / Default
          </p>
          <div className="bg-white content-stretch flex items-center justify-center px-[20px] py-[17px] relative rounded-[10px] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.25)] shrink-0 w-[360px]" data-name="Login Screens Button / Default">
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[22px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              CREATE ACCOUNT
            </p>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[21px] items-start relative shrink-0" data-name="Login Screens Button / Hover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Login Screens Button / Hover
          </p>
          <div className="bg-white content-stretch flex items-center justify-center px-[20px] py-[17px] relative rounded-[10px] shrink-0 w-[360px]" data-name="Login Screens Button / Hover">
            <div aria-hidden="true" className="absolute border-[3px] border-solid border-white inset-[-3px] pointer-events-none rounded-[13px] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.25)]" />
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[22px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              CREATE ACCOUNT
            </p>
          </div>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[30px] items-start left-[587px] top-[52px] w-[360px]" data-name="Login Screens Input Field">
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Login Screens Input Field / Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Login Screens Input Field / Default
          </p>
          <div className="bg-black content-stretch flex items-center justify-center px-[20px] py-[19px] relative rounded-[10px] shrink-0 w-[360px]" data-name="Login Screens Input Field / Default">
            <div aria-hidden="true" className="absolute border-2 border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[24px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              Input Field
            </p>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Login Screens Input Field / Hover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Login Screens Input Field / Hover
          </p>
          <div className="bg-black content-stretch flex items-center justify-center px-[20px] py-[19px] relative rounded-[10px] shrink-0 w-[360px]" data-name="Login Screens Input Field / Hover">
            <div aria-hidden="true" className="absolute border-2 border-[#888] border-solid inset-0 pointer-events-none rounded-[10px]" />
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[24px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              Input Field
            </p>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Login Screens Input Field / Focus">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Login Screens Input Field / Focus
          </p>
          <div className="bg-black content-stretch flex items-center justify-center px-[20px] py-[19px] relative rounded-[10px] shrink-0 w-[360px]" data-name="Login Screens Input Field / Focus">
            <div aria-hidden="true" className="absolute border-2 border-solid border-white inset-0 pointer-events-none rounded-[10px]" />
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[24px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              Input Field
            </p>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Login Screens Input Field / Error">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Login Screens Input Field / Error
          </p>
          <div className="bg-black content-stretch flex items-center justify-center px-[20px] py-[19px] relative rounded-[10px] shrink-0 w-[360px]" data-name="Login Screens Input Field / Error">
            <div aria-hidden="true" className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
            <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[24px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              Input Field
            </p>
          </div>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[30px] items-start left-[78px] top-[679px] w-[282px]" data-name="Menu Screens Button Private">
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Private / Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Private / Default
          </p>
          <Text text="CREATE PRIVATE GAME" additionalClassNames="bg-[#cd8cff]" />
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Private / Hover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Private / Hover
          </p>
          <div className="bg-[#cd8cff] content-stretch flex h-[72px] items-center justify-center p-[20px] relative rounded-[10px] shrink-0 w-[280px]" data-name="Menu Screens Button Private / Hover">
            <div aria-hidden="true" className="absolute border-[#cd8cff] border-[3px] border-solid inset-[-3px] pointer-events-none rounded-[13px]" />
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              CREATE PRIVATE GAME
            </p>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Private / Selected">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Private / Selected
          </p>
          <Text1 text="CREATE PRIVATE GAME" />
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[30px] items-start left-[462px] top-[679px] w-[280px]" data-name="Menu Screens Button Private">
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Public / Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Public / Default
          </p>
          <Text text="CREATE LOBBY GAME" additionalClassNames="bg-[#9cff84]" />
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Public / Hover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Public / Hover
          </p>
          <div className="bg-[#9cff84] content-stretch flex h-[72px] items-center justify-center p-[20px] relative rounded-[10px] shrink-0 w-[280px]" data-name="Menu Screens Button Public / Hover">
            <div aria-hidden="true" className="absolute border-[#9cff84] border-[3px] border-solid inset-[-3px] pointer-events-none rounded-[13px]" />
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              CREATE LOBBY GAME
            </p>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Public / Selected">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Public / Selected
          </p>
          <Text1 text="CREATE LOBBY GAME" />
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[30px] items-start left-[844px] top-[679px] w-[312px]" data-name="Menu Screens Button Join">
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Join / Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Join / Default
          </p>
          <Text text="JOIN LOBBY GAME" additionalClassNames="bg-[#555]" />
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Join / Available">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Join / Available
          </p>
          <Text text="JOIN LOBBY GAME" additionalClassNames="bg-white" />
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Menu Screens Button Public / Selected">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Menu Screens Button Join / Available Hover
          </p>
          <div className="bg-white content-stretch flex h-[72px] items-center justify-center p-[20px] relative rounded-[10px] shrink-0 w-[280px]" data-name="Menu Screens Button Public / Selected">
            <div aria-hidden="true" className="absolute border-[3px] border-solid border-white inset-[-3px] pointer-events-none rounded-[13px]" />
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              JOIN LOBBY GAME
            </p>
          </div>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[30px] items-start left-[78px] top-[1177px] w-[958px]" data-name="Lobby Row">
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Lobby Row / Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Lobby Row / Default
          </p>
          <Helper additionalClassNames="bg-[#212121]" />
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Lobby Row / Alternate">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Lobby Row / Alternate
          </p>
          <Helper additionalClassNames="bg-black" />
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Lobby Row / Hover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Lobby Row / Hover
          </p>
          <div className="bg-[#555] content-stretch flex flex-col gap-[10px] items-start justify-center px-[40px] py-[25px] relative shrink-0 w-[958px]" data-name="Lobby Row / Hover">
            <Details text="Guest 12" text1="Standard" text2="X v Any" text3="10m + 30s" text4="45m" additionalClassNames="text-white" />
            <div className="content-stretch flex items-center justify-center pl-[215px] pr-0 py-0 relative shrink-0" data-name="Variants">
              <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[15px] text-white w-[662px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                Epic Health, Accelerated Game, No Destruction
              </p>
            </div>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[18px] items-start relative shrink-0" data-name="Lobby Row / Selected-Own">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Lobby Row / Selected-Own
          </p>
          <div className="bg-white content-stretch flex flex-col gap-[10px] items-start justify-center px-[40px] py-[25px] relative shrink-0 w-[958px]" data-name="Lobby Row / Selected-Own">
            <Details text="Guest 12" text1="Standard" text2="X v Any" text3="10m + 30s" text4="45m" additionalClassNames="text-black" />
            <div className="content-stretch flex items-center justify-center pl-[215px] pr-0 py-0 relative shrink-0" data-name="Variants">
              <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#555] text-[15px] w-[662px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                Epic Health, Accelerated Game, No Destruction
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col items-start left-[78px] top-[1946px] w-[147px]" data-name="Icon - Chevron Down">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] min-w-full relative shrink-0 text-[#da41b9] text-[16px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Icon - Chevron Down
        </p>
        <div className="h-[40.35px] relative shrink-0 w-[40px]" data-name="Icon - Chevron Down">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40 40.35">
            <g id="Icon - Chevron Down">
              <path d={svgPaths.p398ebc00} fill="var(--fill-0, white)" id="Vector" />
            </g>
          </svg>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[12px] items-start left-[355px] top-[1946px] w-[79px]" data-name="Icon - Build">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] min-w-full relative shrink-0 text-[#da41b9] text-[16px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Icon - Build
        </p>
        <div className="h-[11.091px] relative shrink-0 w-[19.533px]" data-name="Icon - Build">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.5333 11.0914">
            <g id="Icon - Build">
              <path d={svgPaths.p21a90370} fill="var(--fill-0, #D5D5D5)" id="Vector" />
              <path d={svgPaths.pd85dc70} fill="var(--fill-0, #D5D5D5)" id="Vector_2" />
            </g>
          </svg>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[12px] items-start left-[550px] top-[1946px] w-[85px]" data-name="Icon - Battle">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] min-w-full relative shrink-0 text-[#da41b9] text-[16px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Icon - Battle
        </p>
        <div className="relative shrink-0 size-[16px]" data-name="Icon - Battle">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
            <g id="Icon - Battle">
              <path d={svgPaths.p35a2ca80} fill="var(--fill-0, #D5D5D5)" id="Star 1" />
            </g>
          </svg>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[29px] items-start left-[81px] top-[2132px] w-[152px]" data-name="Icon - Radio">
        <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0" data-name="Icon - Radio/Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Icon - Radio/Default
          </p>
          <Wrapper2>
            <g id="Icon - Radio/Default">
              <path d={svgPaths.p24b0b080} fill="var(--fill-0, white)" id="Vector" />
            </g>
          </Wrapper2>
        </div>
        <div className="content-stretch flex flex-col gap-[9px] items-start relative shrink-0" data-name="Icon - Radio/Selected">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Icon - Radio/Selected
          </p>
          <Wrapper2>
            <g id="Icon - Radio/Selected">
              <path d={svgPaths.p278a5800} fill="var(--fill-0, #9CFF84)" id="Vector" />
              <path d={svgPaths.p1cd47a80} fill="var(--fill-0, #9CFF84)" id="Vector_2" />
            </g>
          </Wrapper2>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[34px] items-start left-[355px] top-[2132px] w-[187px]" data-name="Icon - Check Box">
        <div className="content-stretch flex flex-col gap-[11px] items-start relative shrink-0" data-name="Icon - Check Box/Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Icon - Check Box/Default
          </p>
          <Wrapper3>
            <g id="Icon - Check Box/Default">
              <path d={svgPaths.p4d99e80} fill="var(--fill-0, white)" id="Vector" />
            </g>
          </Wrapper3>
        </div>
        <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0" data-name="Icon - Check Box/Selected">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Icon - Check Box/Selected
          </p>
          <Wrapper3>
            <g id="Icon - Check Box/Selected">
              <path d={svgPaths.p2da22940} fill="var(--fill-0, white)" id="Vector" />
            </g>
          </Wrapper3>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[15px] items-start left-[84px] top-[2413px] w-[115px]" data-name="Tab/Default">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
          Tab/Default
        </p>
        <Text2 text="Tab Style" additionalClassNames="bg-[#212121]" />
      </div>
      <div className="absolute content-stretch flex flex-col gap-[10px] items-start left-[84px] top-[2520px] w-[115px]" data-name="Tab/Hover">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
          Tab/Hover
        </p>
        <div className="bg-[#212121] relative rounded-tl-[10px] rounded-tr-[10px] shrink-0 w-full" data-name="Tab/Hover">
          <div className="flex flex-row items-center justify-center size-full">
            <Text4 text="Tab Style" additionalClassNames="w-full" />
          </div>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[13px] items-start left-[84px] top-[2619px] w-[115px]" data-name="Tab/Selected">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
          Tab/Selected
        </p>
        <Text2 text="Tab Style" additionalClassNames="bg-[#555]" />
      </div>
      <div className="absolute content-stretch flex flex-col gap-[10px] items-start left-[467px] top-[2520px] w-[192px]" data-name="Secondary Nav Item/Hover">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] min-w-full relative shrink-0 text-[#da41b9] text-[16px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Secondary Nav Item/Hover
        </p>
        <Text4 text="Secondary" additionalClassNames="bg-[#212121] rounded-[10px] shrink-0" />
      </div>
      <div className="absolute content-stretch flex flex-col gap-[15px] items-start left-[467px] top-[2413px] w-[201px]" data-name="Secondary Nav Item/Default">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] min-w-full relative shrink-0 text-[#da41b9] text-[16px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Secondary Nav Item/Default
        </p>
        <Text3 text="Secondary" additionalClassNames="bg-[#212121] rounded-[10px] shrink-0" />
      </div>
      <div className="absolute content-stretch flex flex-col gap-[13px] items-start left-[467px] top-[2619px] w-[212px]" data-name="Secondary Nav Item/Selected">
        <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] min-w-full relative shrink-0 text-[#da41b9] text-[16px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Secondary Nav Item/Selected
        </p>
        <div className="bg-white content-stretch flex items-center justify-center px-[20px] py-[10px] relative rounded-[10px] shrink-0" data-name="Secondary Nav Item/Selected">
          <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Secondary
          </p>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[28px] items-start left-[872px] top-[1946px] w-[164px]" data-name="Dice">
        <div className="content-stretch flex flex-col gap-[5px] items-start relative shrink-0" data-name="Dice - 1">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Dice - 1
          </p>
          <div className="relative shrink-0 size-[164px]" data-name="d1">
            <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgD1} />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0" data-name="Dice - 2">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Dice - 2
          </p>
          <div className="relative shrink-0 size-[164px]" data-name="d2">
            <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgD2} />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[9px] items-start relative shrink-0" data-name="Dice - 3">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Dice - 3
          </p>
          <div className="relative shrink-0 size-[164px]" data-name="d3">
            <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgD3} />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0" data-name="Dice - 4">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Dice - 4
          </p>
          <div className="relative shrink-0 size-[164px]" data-name="d4">
            <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgD4} />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[7px] items-start relative shrink-0" data-name="Dice - 5">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Dice - 5
          </p>
          <div className="relative shrink-0 size-[164px]" data-name="d5">
            <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgD5} />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[7px] items-start relative shrink-0" data-name="Dice - 6">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Dice - 6
          </p>
          <div className="relative shrink-0 size-[164px]" data-name="d6">
            <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgD6} />
          </div>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[40px] items-start left-[84px] top-[2801px] w-[313px]" data-name="Game Screen - Ready Button">
        <div className="content-stretch flex flex-col gap-[15px] items-start relative shrink-0 w-[300px]" data-name="Game Screen - Ready Button/Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - Ready Button/Default
          </p>
          <div className="bg-white h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="Game Screen - Ready Button/Default">
            <Helper1 text="READY" text1="[Conditional note]" />
          </div>
        </div>
        <div className="content-stretch flex flex-col items-start relative shrink-0 w-[300px]" data-name="Game Screen - Ready Button/Hover">
          <div className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            <p className="mb-0">Game Screen - Ready Button/Hover</p>
            <p>&nbsp;</p>
          </div>
          <div className="bg-white h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="Game Screen - Ready Button/Hover">
            <div aria-hidden="true" className="absolute border-2 border-solid border-white inset-[-2px] pointer-events-none rounded-[12px]" />
            <Helper1 text="READY" text1="[Conditional note]" />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[10px] items-start relative shrink-0 w-[300px]" data-name="Game Screen - Ready Button/Selected">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - Ready Button/Selected
          </p>
          <div className="bg-[#00bd13] h-[50px] relative rounded-[10px] shrink-0 w-full" data-name="Game Screen - Ready Button/Selected">
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex gap-[4px] items-center justify-center px-[20px] py-[19px] relative size-full">
                <IconTick />
                <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                  READY
                </p>
                <Text5 text="[Conditional note]" />
              </div>
            </div>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[13px] items-start relative shrink-0 w-full" data-name="Game Screen - Ready Button/SelectedHover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] min-w-full relative shrink-0 text-[#da41b9] text-[16px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - Ready Button/SelectedHover
          </p>
          <div className="bg-[#00bd13] content-stretch flex gap-[4px] h-[50px] items-center justify-center px-[20px] py-[19px] relative rounded-[10px] shrink-0 w-[300px]" data-name="Game Screen - Ready Button">
            <div aria-hidden="true" className="absolute border-2 border-[#00bd13] border-solid inset-[-2px] pointer-events-none rounded-[12px]" />
            <IconTick />
            <p className="font-['Roboto:Black',sans-serif] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              READY
            </p>
            <Text5 text="[Conditional note]" />
          </div>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[32px] items-start left-[467px] top-[2801px] w-[230px]" data-name="Action Button">
        <div className="content-stretch flex flex-col gap-[15px] items-start relative shrink-0 w-full" data-name="Action Button/Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Action Button/Default
          </p>
          <div className="content-stretch flex flex-col h-[50px] items-start relative rounded-[10px] shrink-0 w-full" data-name="Action Button">
            <ButtonInner text="Action" text1="(charge count)" additionalClassNames="bg-[#d4d4d4]" />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full" data-name="Action Button/Selected">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Action Button/Selected
          </p>
          <div className="content-stretch flex flex-col h-[50px] items-start relative rounded-[10px] shrink-0 w-full" data-name="Action Button/Selected">
            <div aria-hidden="true" className="absolute border-[3px] border-solid border-white inset-[-3px] pointer-events-none rounded-[13px]" />
            <ButtonInner text="Action" text1="(charge count)" additionalClassNames="bg-[#fcff81]" />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[15px] items-start relative shrink-0 w-full" data-name="Note">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Note: Selected state colours are based on related ship colour:
          </p>
          <div className="content-stretch flex flex-col h-[50px] items-start relative rounded-[10px] shrink-0 w-full" data-name="Action Button/Selected">
            <div aria-hidden="true" className="absolute border-[3px] border-solid border-white inset-[-3px] pointer-events-none rounded-[13px]" />
            <Wrapper additionalClassNames="h-[50px]">
              <Helper2 text="Action" text1="(charge count)" additionalClassNames="text-white" />
            </Wrapper>
          </div>
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[26px] items-end left-[466px] top-[3225px] w-[231px]" data-name="Action Button Small">
        <div className="content-stretch flex flex-col gap-[10px] items-start relative shrink-0 w-full" data-name="Action Button Small/Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Action Button Small/Default
          </p>
          <div className="content-stretch flex flex-col h-[34px] items-start relative rounded-[10px] shrink-0 w-full" data-name="Action Button Small/Default">
            <ButtonInnerText text="Hold Charge" additionalClassNames="bg-[#d4d4d4]" />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Action Button Small/Selected">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Action Button Small/Selected
          </p>
          <div className="content-stretch flex flex-col h-[34px] items-start relative rounded-[10px] shrink-0 w-full" data-name="Action Button Small/Selected">
            <div aria-hidden="true" className="absolute border-[3px] border-solid border-white inset-[-3px] pointer-events-none rounded-[13px]" />
            <ButtonInnerText text="Hold Charge" additionalClassNames="bg-[#fcff81]" />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[15px] items-start relative shrink-0 w-full" data-name="Note">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Note: Selected state colours are based on related ship colour:
          </p>
          <div className="content-stretch flex flex-col h-[34px] items-start relative rounded-[10px] shrink-0 w-full" data-name="Action Button Small">
            <div aria-hidden="true" className="absolute border-[3px] border-solid border-white inset-[-3px] pointer-events-none rounded-[13px]" />
            <Wrapper additionalClassNames="h-[34px]">
              <div className="content-stretch flex items-center justify-center px-[20px] py-[10px] relative size-full">
                <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[14px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Hold Charge
                </p>
              </div>
            </Wrapper>
          </div>
        </div>
      </div>
    </div>
  );
}