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
  alphaDisableAuth: boolean;
  onGameCreated: (gameId: string) => void;
  onCreatePrivateGame: () => Promise<string>;
  onNavigateToCreateGame?: () => void;
}

const DISCORD_URL = 'https://discord.gg/MjPtf4G6Gt';

const ALPHA_BULLETS = [
  'Play private games against friends',
  'Play against bots',
  'Choose from Human, Xenite, and Centaur',
] as const;

const ROADMAP_LEFT = [
  'Player Accounts',
  'Public Multiplayer Lobby',
  'Game History & Stats',
] as const;

const ROADMAP_RIGHT = [
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
      <div className="w-full max-w-[800px] pt-[60px]">
        <div className="flex flex-wrap items-start gap-[40px]">
          <div className="max-w-full shrink-0">
            <BattlecruiserShip className="max-w-full" />
          </div>

          <div className="min-w-[280px] flex-1">
            <h2
              className="mb-[30px] font-['Roboto',sans-serif] text-[36px] font-normal leading-[normal] text-shapeships-white"
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

            <div className="mt-[40px] flex flex-wrap items-center gap-[30px]">
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

            <div className="mt-[80px]">
              <h3
                className="mb-[20px] font-['Roboto',sans-serif] text-[18px] font-bold leading-[normal] text-shapeships-grey-50"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Development Roadmap
              </h3>

              <div className="flex flex-wrap gap-x-[20px] gap-y-[20px]">
                <div className="w-[260px]">
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

                <div className="w-[260px]">
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
