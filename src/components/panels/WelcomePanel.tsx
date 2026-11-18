import { useState } from 'react';
import { Dice } from '../ui/primitives/dice/Dice';
import { usePrefersReducedMotion } from '../../game/display/shared/usePrefersReducedMotion';
import { WelcomeSpeciesIllustration } from '../../graphics/welcome/WelcomeSpeciesIllustration';
import { WelcomeBuildFleetIllustration } from '../../graphics/welcome/WelcomeBuildFleetIllustration';
import { WelcomeWinIllustration } from '../../graphics/welcome/WelcomeWinIllustration';

type DiceFace = 1 | 2 | 3 | 4 | 5 | 6;

export function WelcomePanel() {
  const [face] = useState<DiceFace>(() => (Math.floor(Math.random() * 6) + 1) as DiceFace);
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <section aria-label="Welcome" className="flex w-full flex-col items-center text-center text-shapeships-white [container-type:inline-size] max-md:my-auto max-md:shrink-0">
      <h2 className="mb-[32px] text-[54px] font-black italic leading-[0.9] min-[400px]:text-[70px] md:mb-[72px] md:text-[clamp(64px,11cqw,106px)]">
        Our galaxy at war!
      </h2>
      <div className="grid w-full max-w-[288px] grid-cols-[128px_128px] justify-between gap-y-[32px] md:max-w-[664px] md:grid-cols-[300px_300px] md:gap-y-[64px]">
        <div className="flex flex-col items-center gap-[8px] md:gap-[16px]">
          <div aria-hidden="true" className="flex h-[89px] items-center justify-center md:h-[173px]">
            <WelcomeSpeciesIllustration className="h-[80px] w-[80px] md:h-[165px] md:w-[165px]" />
          </div>
          <p className="text-[16px] font-normal leading-[1.2] md:text-[40px] md:leading-[48px]">Choose Your Species</p>
        </div>
        <div className="flex flex-col items-center gap-[8px] md:gap-[16px]">
          <div aria-hidden="true" className="flex h-[89px] items-center justify-center md:h-[173px]">
            <Dice
              value={face}
              animateOnMount={!prefersReducedMotion}
              animateKey="welcome-mount"
              enableRotate={false}
              className="size-[89px]! md:size-[173px]!"
            />
          </div>
          <p className="text-[16px] font-normal leading-[1.2] md:text-[40px] md:leading-[48px]">Use the Dice</p>
        </div>
        <div className="flex flex-col items-center gap-[8px] md:gap-[16px]">
          <div aria-hidden="true" className="flex h-[72px] items-center justify-center md:h-[153px]">
            <WelcomeBuildFleetIllustration className="h-auto w-[80px] md:w-[171px]" />
          </div>
          <p className="text-[16px] font-normal leading-[1.2] md:text-[40px] md:leading-[48px]">Build Your Fleet</p>
        </div>
        <div className="flex flex-col items-center gap-[8px] md:gap-[16px]">
          <div aria-hidden="true" className="flex h-[72px] items-center justify-center md:h-[153px]">
            <WelcomeWinIllustration className="h-auto w-[80px] md:w-[172px]" />
          </div>
          <p className="text-[16px] font-normal leading-[1.2] md:text-[40px] md:leading-[48px]">WIN</p>
        </div>
      </div>
    </section>
  );
}
