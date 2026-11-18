import { LogoIcon } from '../../ui/primitives/icons/LogoIcon';

const SOCIAL_LINKS = [
  { label: 'Discord', href: 'https://discord.gg/MjPtf4G6Gt' },
  { label: 'YouTube', href: 'https://www.youtube.com/@Shapeships' },
  { label: 'Reddit', href: 'https://www.reddit.com/r/shapeships/' },
  { label: 'Pen & Paper', href: 'https://juddmadden.com/shapeships/' },
];

export function MenuHeader() {
  return (
    <header className="relative flex w-full shrink-0 flex-col items-center justify-between gap-4 pb-[20px] md:pb-[40px] lg:flex-row lg:gap-10">
      <div className="relative inline-grid shrink-0 grid-cols-[max-content] grid-rows-[max-content] place-items-start leading-[0]">
        <p className="[grid-area:1_/_1] relative ml-[60px] mt-[0.31px] text-[36px] font-bold leading-[normal] text-nowrap sm:ml-[80px] sm:text-[48px] md:ml-[130.04px] md:text-[67.563px]">
          SHAPESHIPS
        </p>
        <div className="[grid-area:1_/_1] relative flex h-[45px] w-[52.5px] items-center justify-center sm:h-[60px] sm:w-[70px] md:h-[86.748px] md:w-[101.762px]">
          <div className="flex-none rotate-[180deg] scale-y-[-100%]">
            <LogoIcon className="h-[45px] w-[52.5px] sm:h-[60px] sm:w-[70px] md:h-[86.748px] md:w-[101.762px]" />
          </div>
        </div>
      </div>
      <div className="w-full min-w-0 md:w-auto lg:max-w-[720px]">
        <div className="flex w-full flex-wrap items-center justify-between gap-y-[12px] text-[12px] font-normal leading-[normal] underline md:justify-center md:gap-x-[24px] md:text-[18px] lg:justify-end">
          {SOCIAL_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 cursor-pointer decoration-solid [text-underline-position:from-font] hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-shapeships-pastel-purple"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
