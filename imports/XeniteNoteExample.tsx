import svgPaths from "./svg-pcpx1iaq3v";
import clsx from "clsx";

function Wrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 size-[36.994px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.9945 36.9945">
        {children}
      </svg>
    </div>
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

export default function XeniteNoteExample() {
  return (
    <div className="content-stretch flex flex-col items-start relative size-full" data-name="Xenite Note Example">
      <div className="bg-[#555] h-[80px] relative shrink-0 w-full" data-name="Upgraded Ships Header">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex items-center justify-between px-[32px] py-[19px] relative size-full">
            <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[22px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
              UPgraded Ships
            </p>
            <div className="content-stretch flex items-center relative shrink-0" data-name="Battle Phase">
              <div className="content-stretch flex gap-[28px] items-center justify-end relative shrink-0" data-name="Power Time Note">
                <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Build Phase">
                  <Wrapper>
                    <g id="Icon - Build">
                      <g id="Vector">
                        <path d={svgPaths.p3f9e4200} fill="var(--fill-0, #D5D5D5)" />
                        <path d={svgPaths.p3fe87100} fill="var(--fill-0, #D5D5D5)" />
                      </g>
                    </g>
                  </Wrapper>
                  <Text text="Build Phase." additionalClassNames="w-[141.041px]" />
                </div>
                <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Battle Phase">
                  <Wrapper>
                    <g id="Icon - Battle">
                      <path d={svgPaths.p2d33f00} fill="var(--fill-0, white)" id="Star 1" />
                    </g>
                  </Wrapper>
                  <Text text="Battle Phase." additionalClassNames="w-[145.666px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#212121] h-[52px] relative shrink-0 w-full" data-name="Xenites within Upgrades Note">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex items-center px-[32px] py-[16px] relative size-full">
            <p className="font-['Roboto:Italic',sans-serif] font-normal italic leading-[20px] relative shrink-0 text-[16px] text-nowrap text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
              Xenites within upgraded ships cannot be Evolved and DO NOT count for Mantis and Hell Hornet powers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}