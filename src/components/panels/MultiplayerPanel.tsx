/**
 * MULTIPLAYER PANEL
 *
 * Temporary alpha multiplayer / welcome hub for private games and community links.
 */

import React from 'react';
import { BattlecruiserShip } from '../../graphics/human/Battlecruiser';
import { GameMenuButton } from '../ui/primitives/buttons/GameMenuButton';
import { MenuButton } from '../ui/primitives/buttons/MenuButton';

interface MultiplayerPanelProps {
  onNavigateToCreateGame?: () => void;
}

const DISCORD_URL = 'https://discord.gg/MjPtf4G6Gt';

const ALPHA_BULLETS = [
  'Play private games against friends',
  'Play against bots',
  'Choose from Human, Xenite, and Centaur',
] as const;

const ROADMAP_LEFT = [
  'Mobile Device Support',
  'Player Accounts',
  'Public Multiplayer Lobby',
  'Match Archive & Stats',
] as const;

const ROADMAP_RIGHT = [
  'Spectator Mode',
  'Single Player Campaign',
  'Ancient Species',
  'Rankings & Tournaments',
] as const;

export function MultiplayerPanel({
  onNavigateToCreateGame,
}: MultiplayerPanelProps) {
  const handleOpenDiscord = () => {
    window.open(DISCORD_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full">
      <div className="w-full">
        <div className="flex flex-wrap items-start gap-[32px] lg:gap-[40px] lg:pl-[50px]">
          <div className="max-w-full shrink-0 hidden sm:block">
            <BattlecruiserShip className="max-w-full" />
          </div>

          <div className="min-w-0 flex-1">
            <h2
              className="mb-[24px] font-['Roboto',sans-serif] text-[32px] font-normal leading-[normal] text-shapeships-white sm:text-[36px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Welcome to the Shapeships Alpha
            </h2>

            <div className="flex flex-col gap-[12px]">
              {ALPHA_BULLETS.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-start gap-[6px] font-['Roboto',sans-serif] text-[20px] font-normal leading-[normal] text-shapeships-white"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  <span aria-hidden="true">&bull;</span>
                  <span>{bullet}</span>
                </div>
              ))}

              <div
                className="flex items-start gap-[6px] font-['Roboto',sans-serif] text-[20px] font-normal leading-[normal] text-shapeships-white"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                <span aria-hidden="true">&bull;</span>
                <span>
                  <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-solid hover:opacity-80"
                  >
                    Join Discord
                  </a>
                  <span>{` for feedback and bugs`}</span>
                </span>
              </div>
            </div>

            <div className="mt-[40px] flex flex-wrap items-center gap-[20px] md:gap-[30px]">
              <MenuButton
                variant="private"
                onClick={() => onNavigateToCreateGame?.()}
              >
                CREATE PRIVATE GAME
              </MenuButton>

              <GameMenuButton
                onClick={handleOpenDiscord}
                className="w-[240px]"
              >
                Find Opponents on Discord
              </GameMenuButton>
            </div>

            <div className="mt-[56px] md:mt-[80px]">
              <h3
                className="mb-[20px] font-['Roboto',sans-serif] text-[18px] font-bold leading-[normal] text-shapeships-grey-50"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Soundtrack on Bandcamp
              </h3>

              <div className="flex flex-wrap gap-x-[20px] gap-y-[20px]">
                  <div className="flex flex-wrap gap-x-[24px] gap-y-[16px] text-[18px]">
                    <a 
                      href="https://colourhigh.bandcamp.com/track/sonder" 
                      target="_blank" 
                      rel="noreferrer"
                      className="[text-underline-position:from-font] decoration-solid relative shrink-0 cursor-pointer hover:opacity-80" 
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      Human Theme
                    </a>
                    <a 
                      href="https://colourhigh.bandcamp.com/track/outworld-destroyer" 
                      target="_blank" 
                      rel="noreferrer"
                      className="[text-underline-position:from-font] decoration-solid relative shrink-0 cursor-pointer hover:opacity-80" 
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      Xenite Theme
                    </a>
                    <a 
                      href="https://colourhigh.bandcamp.com/track/rain-sample" 
                      target="_blank" 
                      rel="noreferrer"
                      className="[text-underline-position:from-font] decoration-solid relative shrink-0 cursor-pointer hover:opacity-80" 
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      Centaur Theme
                    </a>
                  </div>
              </div>
            </div>
            
            <div className="mt-[56px] md:mt-[80px]">
              <h3
                className="mb-[20px] font-['Roboto',sans-serif] text-[18px] font-bold leading-[normal] text-shapeships-grey-50"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Development Roadmap
              </h3>

              <div className="flex flex-wrap gap-x-[20px] gap-y-[20px]">
                <div className="min-w-[220px] flex-1 max-w-[260px]">
                  <div className="flex flex-col gap-[12px]">
                    {ROADMAP_LEFT.map((item) => (
                      <p
                        key={item}
                        className="font-['Roboto',sans-serif] text-[18px] font-normal leading-[normal] text-shapeships-grey-50"
                        style={{ fontVariationSettings: "'wdth' 100" }}
                      >
                        <span aria-hidden="true">&bull;</span> {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="min-w-[220px] flex-1 max-w-[260px]">
                  <div className="flex flex-col gap-[12px]">
                    {ROADMAP_RIGHT.map((item) => (
                      <p
                        key={item}
                        className="font-['Roboto',sans-serif] text-[18px] font-normal leading-[normal] text-shapeships-grey-50"
                        style={{ fontVariationSettings: "'wdth' 100" }}
                      >
                        <span aria-hidden="true">&bull;</span> {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
