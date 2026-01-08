import clsx from "clsx";
type Text2Props = {
  text: string;
  additionalClassNames?: string;
};

function Text2({ text, additionalClassNames = "" }: Text2Props) {
  return (
    <div className={clsx("content-stretch flex items-center justify-center px-[15px] py-[8px] relative rounded-[7px] shrink-0", additionalClassNames)}>
      <p className="font-['Roboto:Medium',sans-serif] font-medium leading-[normal] relative shrink-0 text-[13px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}
type Text1Props = {
  text: string;
  additionalClassNames?: string;
};

function Text1({ text, additionalClassNames = "" }: Text1Props) {
  return (
    <div className={clsx("content-stretch flex items-center justify-center px-[20px] py-[9px] relative rounded-[10px] shrink-0 w-[118px]", additionalClassNames)}>
      <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[14px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
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
    <div className={clsx("content-stretch flex h-[50px] items-center justify-center px-[30px] py-[19px] relative rounded-[10px] shrink-0 w-[210px]", additionalClassNames)}>
      <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[16px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        {text}
      </p>
    </div>
  );
}

export default function BuildKitAdditions() {
  return (
    <div className="relative size-full" data-name="Build Kit Additions">
      <div className="absolute content-stretch flex flex-col gap-[33px] items-start left-[47px] top-[278px] w-[314px]" data-name="Game Screen - Menu Button/Default">
        <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Game Screen - Menu Button/Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal h-[19px] leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - Menu Button/Default
          </p>
          <div className="content-stretch flex gap-[20px] items-center relative shrink-0" data-name="Game Screen - Menu Button/Default">
            <Text text="Return to Main Menu" additionalClassNames="bg-[#d4d4d4]" />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Game Screen - Menu Button/Hover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal h-[19px] leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - Menu Button/Hover
          </p>
          <div className="content-stretch flex gap-[20px] items-center relative shrink-0" data-name="Game Screen - Menu Button/Hover">
            <Text text="Return to Main Menu" additionalClassNames="bg-white" />
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[14px] items-start relative shrink-0 w-full" data-name="Game Screen - Menu Button/Confirm">
          <p className="font-['Roboto:Regular',sans-serif] font-normal h-[19px] leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - Menu Button/Confirm
          </p>
          <Text text="Resign Game (Confirm)" additionalClassNames="bg-[#ff8282]" />
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[39px] items-start left-[47px] top-[34px] w-[314px]" data-name="Game Screen - Chat Send Button">
        <div className="content-stretch flex flex-col gap-[13px] items-start relative shrink-0" data-name="Game Screen - In-Chat Button/Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-[313px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - In-Chat Button/Default
          </p>
          <Text1 text="Accept" additionalClassNames="bg-[#d4d4d4]" />
        </div>
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0" data-name="Game Screen - In-Chat Button/Hover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-[313px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - In-Chat Button/Hover
          </p>
          <Text1 text="Accept" additionalClassNames="bg-white" />
        </div>
      </div>
      <div className="absolute content-stretch flex flex-col gap-[42px] items-start left-[430px] top-[34px] w-[313px]" data-name="Game Screen - Chat Send Button">
        <div className="content-stretch flex flex-col gap-[13px] items-start relative shrink-0 w-full" data-name="Game Screen - Chat Send Button/Default">
          <p className="font-['Roboto:Regular',sans-serif] font-normal h-[19px] leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - Chat Send Button/Default
          </p>
          <Text2 text="SEND" additionalClassNames="bg-black" />
        </div>
        <div className="content-stretch flex flex-col gap-[13px] items-start relative shrink-0 w-full" data-name="Game Screen - Chat Send Button/Hover">
          <p className="font-['Roboto:Regular',sans-serif] font-normal h-[19px] leading-[normal] relative shrink-0 text-[#da41b9] text-[16px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
            Game Screen - Chat Send Button/Hover
          </p>
          <Text2 text="SEND" additionalClassNames="bg-[#212121]" />
        </div>
      </div>
    </div>
  );
}