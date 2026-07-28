/**
 * MULTIPLAYER PANEL
 *
 * Presentation-only hub for private games, community matchmaking, and credits.
 */

import React from 'react';
import { NeptuneCore } from '../../graphics/ancient/NeptuneCore';
import { ShipOfWisdom0Ship } from '../../graphics/centaur/ShipOfWisdom';
import { MenuButton } from '../ui/primitives/buttons/MenuButton';
import { MusicIcon } from '../ui/primitives/icons/MusicIcon';

interface MultiplayerPanelProps {
  onNavigateToCreateGame?: () => void;
}

interface SectionHeadingProps {
  children: React.ReactNode;
}

const DISCORD_URL = 'https://discord.gg/MjPtf4G6Gt';

const SOUNDTRACK_LINKS = [
  {
    label: 'Human Theme',
    href: 'https://colourhigh.bandcamp.com/track/sonder',
    color: 'var(--shapeships-pastel-blue)',
  },
  {
    label: 'Xenite Theme',
    href: 'https://colourhigh.bandcamp.com/track/outworld-destroyer',
    color: 'var(--shapeships-pastel-green)',
  },
  {
    label: 'Centaur Theme',
    href: 'https://colourhigh.bandcamp.com/track/rain-sample',
    color: 'var(--shapeships-pastel-red)',
  },
  {
    label: 'Ancient Theme',
    href: 'https://colourhigh.bandcamp.com/track/all-lower',
    color: 'var(--shapeships-pastel-purple)',
  },
] as const;

const PLAYER_SHOUT_OUTS = [
  'aleph_one',
  'Alex',
  'Amphethis',
  'Bevan',
  'Chris',
  'Dan',
  'Danny',
  'Erniemist',
  'Eeriemist',
  'Happy7',
  'James Harrison',
  'loredude',
  'Luke',
  'thomaslf',
  'Tom',
  'zergo',
  'ZHOZN',
] as const;

function SectionHeading({ children }: SectionHeadingProps) {
  return (
    <div className="flex w-full items-center gap-[12px]">
      <div
        aria-hidden="true"
        className="h-px min-w-0 flex-1 bg-gradient-to-r from-transparent to-[var(--shapeships-white)] opacity-30"
      />
      <h3
        className="shrink-0 text-center font-['Roboto',sans-serif] text-[clamp(18px,2.5cqw,20px)] font-bold leading-[normal] text-shapeships-white"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {children}
      </h3>
      <div
        aria-hidden="true"
        className="h-px min-w-0 flex-1 bg-gradient-to-r from-[var(--shapeships-white)] to-transparent opacity-30"
      />
    </div>
  );
}

export function MultiplayerPanel({
  onNavigateToCreateGame,
}: MultiplayerPanelProps) {
  const handleOpenDiscord = () => {
    window.open(DISCORD_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full [container-type:inline-size]">
      <div className="mx-auto flex w-full flex-col items-center text-center">
        <h2
          className="mb-[clamp(28px,4.1cqw,40px)] font-['Roboto',sans-serif] text-[clamp(64px,11cqw,106px)] font-black italic leading-[0.9] text-shapeships-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Our galaxy at war!
        </h2>

        <div className="mb-[clamp(56px,8.1cqw,80px)] flex w-full flex-col items-center justify-center gap-y-[48px] min-[641px]:flex-row min-[641px]:gap-x-[clamp(32px,10.1cqw,100px)] min-[641px]:gap-y-0">
          <div className="flex w-[clamp(250px,30cqw,280px)] max-w-full flex-col items-center gap-[20px]">
            <div className="flex h-[121.5px] w-full items-center justify-center">
              <ShipOfWisdom0Ship className="h-[121.5px] w-[121.5px]" />
            </div>
            <MenuButton
              variant="private"
              onClick={() => onNavigateToCreateGame?.()}
            >
              CREATE PRIVATE GAME
            </MenuButton>
            <p
              className="font-['Roboto',sans-serif] text-[clamp(18px,2.5cqw,20px)] font-bold leading-[normal] text-shapeships-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Challenge your friends
            </p>
          </div>

          <div className="flex w-[clamp(250px,30cqw,280px)] max-w-full flex-col items-center gap-[20px]">
            <div className="flex h-[121.5px] w-full items-center justify-center">
              <NeptuneCore className="h-[111px] w-[105px]" />
            </div>
            <MenuButton variant="community" onClick={handleOpenDiscord}>
              FIND OPPONENTS
            </MenuButton>
            <p
              className="font-['Roboto',sans-serif] text-[clamp(18px,2.5cqw,20px)] font-bold leading-[normal] text-shapeships-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Join the Discord Community
            </p>
          </div>
        </div>

        <section className="mb-[clamp(56px,8.1cqw,80px)] flex w-full max-w-[800px] flex-col items-center">
          <MusicIcon className="mb-[12px] text-shapeships-white" />
          <SectionHeading>Soundtrack on Bandcamp</SectionHeading>
          <div className="mt-[20px] flex flex-wrap items-center justify-center gap-x-[32px] gap-y-[16px]">
            {SOUNDTRACK_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-['Roboto',sans-serif] text-[clamp(16px,2.25cqw,18px)] font-normal leading-[normal] hover:underline"
                style={{
                  color: link.color,
                  fontVariationSettings: "'wdth' 100",
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </section>

        <section className="flex w-full max-w-[800px] flex-col items-center">
          <SectionHeading>Player Shout-outs</SectionHeading>
          <div className="mt-[24px] flex max-w-[670px] flex-wrap items-center justify-center gap-x-[24px] gap-y-[16px]">
            {PLAYER_SHOUT_OUTS.map((name) => (
              <span
                key={name}
                className="font-['Roboto',sans-serif] text-[clamp(14px,1.875cqw,15px)] font-normal leading-[normal] text-shapeships-white"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
