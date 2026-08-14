import type { ActionPanelViewModel, GameSessionActions, TurnPhasePresentationVm, TurnPhaseVm } from '../../../client/useGameSession';
import { Checkbox, GameMenuButton } from '../../../../components/ui/primitives';
import { ChallengeIcon } from '../../../../components/ui/primitives/icons/ChallengeIcon';
import { MobileTakeoverShell } from './MobileTakeoverShell';
import { TurnPhaseList } from '../../shared/TurnPhaseList';

interface MobileMenuTakeoverProps {
  vm: ActionPanelViewModel['menu'];
  turnPhasesVm: TurnPhaseVm;
  turnPhasePresentation: TurnPhasePresentationVm;
  actions: GameSessionActions;
  showChallengeAction: boolean;
  onOpenChallenge: () => void;
  onClose: () => void;
  onReturnToMainMenu: () => void;
  soundEnabled: boolean;
  boardFlashEnabled: boolean;
  onSoundEnabledChange: (checked: boolean) => void;
  onBoardFlashEnabledChange: (checked: boolean) => void;
  onToggleSound: () => void;
  onToggleBoardFlash: () => void;
}

function MobilePreferenceToggle({
  label,
  checked,
  onChange,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-[7px]">
      <Checkbox
        className="size-[30px]"
        checked={checked}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={onToggle}
        className="text-[16px] font-bold leading-none text-white transition-opacity active:opacity-80"
      >
        {label}
      </button>
    </div>
  );
}

export function MobileMenuTakeover({
  vm,
  turnPhasesVm,
  turnPhasePresentation,
  actions,
  showChallengeAction,
  onOpenChallenge,
  onClose,
  onReturnToMainMenu,
  soundEnabled,
  boardFlashEnabled,
  onSoundEnabledChange,
  onBoardFlashEnabledChange,
  onToggleSound,
  onToggleBoardFlash,
}: MobileMenuTakeoverProps) {
  const dangerAction = vm.canAbortGame
    ? {
        disabled: false,
        confirmLabel: 'Abort Game (Confirm)',
        label: 'Abort Game',
        onClick: onReturnToMainMenu,
      }
    : {
        disabled: !vm.canResign,
        confirmLabel: 'Resign Game (Confirm)',
        label: 'Resign Game',
        onClick: actions.onResignGame,
      };

  return (
    <MobileTakeoverShell
      title="Menu"
      onClose={onClose}
      bodyClassName="flex flex-col"
    >
      <div className="flex min-h-full flex-col">
        <div className="flex grow shrink-0 flex-col items-center justify-center px-[16px] pb-[24px] pt-[8px]">

          <div className="flex w-full flex-col items-center gap-[8px]">
            <p
              className="max-w-full text-center text-[24px] font-bold leading-[28px] text-white"
            >
              {vm.title}
            </p>
            <p
              className="max-w-full text-center text-[16px] font-bold leading-[20px] text-white"
            >
              {vm.subtitle}
            </p>
          </div>

          <div className="mt-[28px] flex w-full flex-col items-center gap-[14px]">
            {vm.isSpectator ? (
              <GameMenuButton
                className="h-[54px] w-[260px] max-w-full"
                onClick={onReturnToMainMenu}
              >
                Back to Main Menu
              </GameMenuButton>
            ) : (
              <>
                <GameMenuButton
                  className="h-[54px] w-[260px] max-w-full"
                  disabled={!vm.canOfferDraw}
                  requiresConfirm={true}
                  confirmLabel="Offer Draw (Confirm)"
                  onClick={actions.onOfferDraw}
                >
                  Offer Draw
                </GameMenuButton>

                <GameMenuButton
                  className="h-[54px] w-[260px] max-w-full"
                  disabled={dangerAction.disabled}
                  requiresConfirm={true}
                  confirmLabel={dangerAction.confirmLabel}
                  onClick={dangerAction.onClick}
                >
                  {dangerAction.label}
                </GameMenuButton>

                {showChallengeAction ? (
                  <GameMenuButton
                    className="h-[54px] w-[260px] max-w-full"
                    onClick={onOpenChallenge}
                  >
                    <span className="flex items-center gap-[10px]">
                      <ChallengeIcon className="h-[28px] w-auto text-black" />
                      <span>Challenge</span>
                    </span>
                  </GameMenuButton>
                ) : null}
              </>
            )}
          </div>
        </div>

          <div className="flex flex-wrap items-center justify-center gap-x-[26px] gap-y-[12px] mb-[32px]">
            <MobilePreferenceToggle
              label="Sound"
              checked={soundEnabled}
              onChange={onSoundEnabledChange}
              onToggle={onToggleSound}
            />
            <MobilePreferenceToggle
              label="Health Flash"
              checked={boardFlashEnabled}
              onChange={onBoardFlashEnabledChange}
              onToggle={onToggleBoardFlash}
            />
          </div>
        <div className="w-full grow shrink-0 bg-[var(--shapeships-grey-90)] px-[18px] py-[22px]">
          <h2 className="mb-[16px] text-[16px] font-bold text-[var(--shapeships-white)]">Turn Phases</h2>
          <TurnPhaseList vm={turnPhasesVm} presentation={turnPhasePresentation} />
        </div>
      </div>
    </MobileTakeoverShell>
  );
}
