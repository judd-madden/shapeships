/**
 * Menu Action Panel
 * Shown when vm.activePanelId === 'ap.menu.root'
 * Displays in-progress game menu with draw offer and resign options
 */

import { Checkbox } from '../../../../components/ui/primitives';
import { GameMenuButton } from '../../../../components/ui/primitives/buttons/GameMenuButton';
import { ChallengeIcon } from '../../../../components/ui/primitives/icons/ChallengeIcon';

interface MenuActionPanelProps {
  title: string;     // "Shapeships Game: {me} v {opponent}"
  subtitle: string;  // "In Progress. Turn {n}."
  isSpectator: boolean;
  canOfferDraw: boolean;
  canResign: boolean;
  canAbortGame: boolean;
  onOfferDraw: () => void;
  onResignGame: () => void;
  onAbortGame: () => void;
  onReturnToMainMenu: () => void;
  showChallengeAction: boolean;
  onOpenChallenge?: () => void;
  soundEnabled: boolean;
  boardFlashEnabled: boolean;
  onSoundEnabledChange: (checked: boolean) => void;
  onBoardFlashEnabledChange: (checked: boolean) => void;
}

export function MenuActionPanel({
  title,
  subtitle,
  isSpectator,
  canOfferDraw,
  canResign,
  canAbortGame,
  onOfferDraw,
  onResignGame,
  onAbortGame,
  onReturnToMainMenu,
  showChallengeAction,
  onOpenChallenge,
  soundEnabled,
  boardFlashEnabled,
  onSoundEnabledChange,
  onBoardFlashEnabledChange,
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
    <div className="relative flex size-full items-center justify-center">
      <div className="content-stretch relative flex shrink-0 flex-col items-center">
        <p className="relative shrink-0 text-center text-[24px] font-bold leading-[normal] text-white">
          {title}
        </p>

        <p className="relative mt-[20px] shrink-0 text-center text-[16px] font-bold leading-[normal] text-white">
          {subtitle}
        </p>

        <div className="content-stretch relative mt-[20px] flex w-full shrink-0 items-center justify-center gap-[20px] pt-[8px]">
          {isSpectator ? (
            <GameMenuButton onClick={onReturnToMainMenu}>
              Back to Main Menu
            </GameMenuButton>
          ) : (
            <>
              {showChallengeAction ? (
                <GameMenuButton
                  className="!w-[150px] !px-[20px]"
                  onClick={onOpenChallenge}
                >
                  <span className="flex items-center gap-[10px]">
                    <ChallengeIcon className="h-[28px] w-auto text-black" />
                    <span>Challenge</span>
                  </span>
                </GameMenuButton>
              ) : null}
              
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

        <div className="mt-[32px] flex items-center justify-center gap-[32px]">
          <Checkbox
            checked={soundEnabled}
            onChange={onSoundEnabledChange}
            label="Sound"
            labelClassName="text-[18px] font-bold leading-none text-white"
          />
          <Checkbox
            checked={boardFlashEnabled}
            onChange={onBoardFlashEnabledChange}
            label="Health Flash"
            labelClassName="text-[18px] font-bold leading-none text-white"
          />
        </div>
      </div>
    </div>
  );
}
