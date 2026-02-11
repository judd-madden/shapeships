/**
 * Menu Action Panel
 * Shown when vm.activePanelId === 'ap.menu.root'
 * Displays in-progress game menu with draw offer and resign options
 */

import { GameMenuButton } from '../../../../components/ui/primitives/buttons/GameMenuButton';

interface MenuActionPanelProps {
  title: string;     // "Shapeships Game: {me} v {opponent}"
  subtitle: string;  // "In Progress. Turn {n}."
  onOfferDraw: () => void;
  onResignGame: () => void;
}

export function MenuActionPanel({ 
  title, 
  subtitle, 
  onOfferDraw, 
  onResignGame 
}: MenuActionPanelProps) {
  return (
    <div className="content-stretch flex flex-col items-center justify-center relative size-full">
      <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0 w-full">
        {/* Title */}
        <p 
          className="font-bold leading-[normal] relative shrink-0 text-[30px] text-center text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {title}
        </p>

        {/* Subtitle */}
        <p 
          className="font-bold leading-[normal] relative shrink-0 text-[18px] text-center text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {subtitle}
        </p>

        {/* Buttons */}
        <div className="content-stretch flex gap-[20px] items-center justify-center pt-[8px] relative shrink-0 w-full">
          <GameMenuButton
            requiresConfirm={true}
            confirmLabel="Offer Draw (Confirm)"
            onClick={onOfferDraw}
          >
            Offer Draw
          </GameMenuButton>

          <GameMenuButton
            requiresConfirm={true}
            confirmLabel="Resign Game (Confirm)"
            onClick={onResignGame}
          >
            Resign Game
          </GameMenuButton>
        </div>
      </div>
    </div>
  );
}
