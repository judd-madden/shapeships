/**
 * Bottom Action Rail
 * Info bar with Subphase Info, Ready controls, and Misc info
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import { ReadyButton } from '../../../components/ui/primitives/buttons/ReadyButton';
import { AnimatedEllipsisText } from '../../../components/ui/primitives/AnimatedEllipsisText';
import type { BottomActionRailViewModel, GameSessionActions } from '../../client/useGameSession';
import type { MainPhaseControl } from '../shared/mainPhaseControl';

interface BottomActionRailProps {
  vm: BottomActionRailViewModel;
  actions: GameSessionActions;
  mainPhaseControl: MainPhaseControl;
}

export function BottomActionRail({ vm, actions, mainPhaseControl }: BottomActionRailProps) {
  const isBack = mainPhaseControl.mode === 'back';

  return (
    <div
      className="content-stretch flex flex-col lg:flex-row items-start justify-between relative shrink-0 w-full"
      data-name="Bottom Action Rail"
    >
      {/* Subphase Info */}
      <div className="basis-0 grow min-h-px min-w-px relative shrink-0" data-name="Subphase Info">
        <div className="content-stretch flex flex-col gap-[3px] items-start leading-[normal] pl-[20px] pr-0 py-0 relative text-white w-full min-[768px]:max-[1599px]:pl-[12px]">
          <p
            className="font-black relative shrink-0 text-[36px] w-full min-[768px]:max-[1599px]:text-[30px]"
          >
            {vm.subphaseTitle}
            {vm.subphaseTitleSuffix ? (
              <span className="font-normal"> {vm.subphaseTitleSuffix}</span>
            ) : null}
          </p>
          <p
            className="font-normal relative shrink-0 text-[16px] w-full min-[768px]:max-[1599px]:text-[14px]"
          >
            <AnimatedEllipsisText text={vm.subphaseSubheading} />
          </p>
        </div>
      </div>

      {/* Ready Wrapper */}
      <div
        className="content-stretch flex gap-[20px] items-center justify-center pb-0 pt-[16px] px-0 relative shrink-0 min-[768px]:max-[1599px]:gap-[12px]"
        data-name="Ready Wrapper"
      >
        {vm.canUndoActions && (
          <p
            className="[text-underline-position:from-font] decoration-solid font-normal leading-[normal] relative shrink-0 text-[16px] text-right text-white underline w-[130px] cursor-pointer min-[768px]:max-[1599px]:w-[80px]"
            onClick={actions.onUndoActions}
          >
            Undo Actions
          </p>
        )}
        {!vm.canUndoActions && (
          <div className="w-[130px] min-[768px]:max-[1599px]:w-[40px]" />
        )}
        {vm.readyButtonVisible ? (
          <div className="w-[300px] ">
            <ReadyButton
              label={isBack ? 'BACK' : vm.readyButtonLabel}
              selected={isBack ? false : vm.readySelected}
              disabled={isBack ? false : vm.readyDisabled || vm.readySelected}
              note={isBack
                ? undefined
                : (vm.readyDisabled ? vm.readyDisabledReason : vm.readyButtonNote) ?? undefined}
              variant={isBack ? 'back' : 'ready'}
              onClick={mainPhaseControl.onActivate}
            />
          </div>
        ) : (
          // Keep layout stable when hidden
          <div className="w-[300px]" />
        )}
        <p
          className="font-bold leading-[normal] relative shrink-0 text-[0px] text-[16px] text-white w-[130px] min-[768px]:max-[1599px]:w-[40px]"
        >
        </p>
      </div>

      {/* Misc */}
      <div
        className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px pb-0 pt-[10px] px-0 relative shrink-0"
        data-name="Misc"
      >
        {vm.spectatorCount > 0 && (
          <p
            className="font-normal leading-[normal] relative shrink-0 text-[16px] text-right text-white w-full"
          >
            {vm.isSpectatorViewer
              ? `You are spectating. ${vm.spectatorCount} total spectator${vm.spectatorCount !== 1 ? 's' : ''}`
              : `${vm.spectatorCount} spectator${vm.spectatorCount !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>
    </div>
  );
}
