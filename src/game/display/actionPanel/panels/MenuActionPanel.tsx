/**
 * Menu Action Panel
 * Shown when vm.activePanelId === 'ap.menu.root'
 * Displays in-progress game menu with draw offer and resign options
 *
 * NEW: Turn Flow widget (static phase list + current-phase dot)
 */

import { GameMenuButton } from '../../../../components/ui/primitives/buttons/GameMenuButton';
import { PhaseBreakdownView } from './menu/PhaseBreakdownView';

interface MenuActionPanelProps {
  title: string;     // "Shapeships Game: {me} v {opponent}"
  subtitle: string;  // "In Progress. Turn {n}."
  turnNumber: number;
  phaseKey: string;
  isSpectator: boolean;
  hasActionsForMe: boolean;
  canOfferDraw: boolean;
  canResign: boolean;
  canAbortGame: boolean;
  onOfferDraw: () => void;
  onResignGame: () => void;
  onAbortGame: () => void;
  onReturnToMainMenu: () => void;
}

export function MenuActionPanel({
  title,
  subtitle,
  turnNumber,
  phaseKey,
  isSpectator,
  hasActionsForMe,
  canOfferDraw,
  canResign,
  canAbortGame,
  onOfferDraw,
  onResignGame,
  onAbortGame,
  onReturnToMainMenu,
}: MenuActionPanelProps) {
  const dangerAction = canAbortGame
    ? {
        disabled: false,
        confirmLabel: 'Abort Game (Confirm)',
        label: 'Abort Game',
        onClick: onAbortGame,
      }
    : {
        disabled: !canResign,
        confirmLabel: 'Resign Game (Confirm)',
        label: 'Resign Game',
        onClick: onResignGame,
      };

  return (
      <div className="flex items-center justify-center relative w-full h-full">
        <div className="flex items-center justify-center w-full" style={{ gap: 40 }}>
        {/* Left: Turn flow */}
        <PhaseBreakdownView turnNumber={turnNumber} phaseKey={phaseKey} hasActionsForMe={hasActionsForMe} layout="desktop" />

        {/* Right: Existing menu block */}
        <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0">
          {/* Title */}
          <p
            className="font-bold leading-[normal] relative shrink-0 text-[24px] text-center text-white"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {title}
          </p>

          {/* Subtitle */}
          <p
            className="font-bold leading-[normal] relative shrink-0 text-[16px] text-center text-white"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {subtitle}
          </p>

          {/* Buttons */}
          <div className="content-stretch flex gap-[20px] items-center justify-center pt-[8px] relative shrink-0 w-full">
            {isSpectator ? (
              <GameMenuButton onClick={onReturnToMainMenu}>
                Back to Main Menu
              </GameMenuButton>
            ) : (
              <>
                <GameMenuButton
                  disabled={!canOfferDraw}
                  requiresConfirm={true}
                  confirmLabel="Offer Draw (Confirm)"
                  onClick={onOfferDraw}
                >
                  Offer Draw
                </GameMenuButton>

                <GameMenuButton
                  disabled={dangerAction.disabled}
                  requiresConfirm={true}
                  confirmLabel={dangerAction.confirmLabel}
                  onClick={dangerAction.onClick}
                >
                  {dangerAction.label}
                </GameMenuButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
