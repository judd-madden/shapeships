/**
 * Bottom Action Rail
 * Info bar with Subphase Info, Ready controls, and Misc info
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import { ReadyButton } from '../../../components/ui/primitives/buttons/ReadyButton';
import type { BottomActionRailViewModel, GameSessionActions } from '../../client/useGameSession';

interface BottomActionRailProps {
  vm: BottomActionRailViewModel;
  actions: GameSessionActions;
}

export function BottomActionRail({ vm, actions }: BottomActionRailProps) {
  return (
    <div
      className="content-stretch flex items-start justify-between relative shrink-0 w-full"
      data-name="Bottom Action Rail"
    >
      {/* Subphase Info */}
      <div className="basis-0 grow min-h-px min-w-px relative shrink-0" data-name="Subphase Info">
        <div className="content-stretch flex flex-col gap-[3px] items-start leading-[normal] pl-[20px] pr-0 py-0 relative text-white w-full">
          <p
            className="font-['Roboto'] font-black relative shrink-0 text-[36px] w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <span>Subphase </span>
            <span
              className="font-['Roboto'] font-normal"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              information
            </span>
          </p>
          <p
            className="font-['Roboto'] font-normal relative shrink-0 text-[16px] w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {vm.subphaseSubheading}
          </p>
        </div>
      </div>

      {/* Ready Wrapper */}
      <div
        className="content-stretch flex gap-[20px] items-center justify-center pb-0 pt-[16px] px-0 relative shrink-0"
        data-name="Ready Wrapper"
      >
        {vm.canUndoActions && (
          <p
            className="[text-underline-position:from-font] decoration-solid font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[16px] text-right text-white underline w-[130px] cursor-pointer"
            style={{ fontVariationSettings: "'wdth' 100" }}
            onClick={actions.onUndoActions}
          >
            Undo Actions
          </p>
        )}
        {!vm.canUndoActions && (
          <div className="w-[130px]" />
        )}
        <div className="w-[300px]">
          <ReadyButton
            selected={vm.readySelected}
            disabled={vm.readyDisabled || vm.readySelected}
            note={vm.readyDisabled ? vm.readyDisabledReason : vm.readyButtonNote}
            onClick={actions.onReadyToggle}
          />
        </div>
        <p
          className="font-['Roboto'] font-semibold leading-[normal] relative shrink-0 text-[0px] text-[16px] text-white w-[130px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          <span
            className="font-['Roboto'] font-normal"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Next:
            <br aria-hidden="true" />
          </span>
          <span
            className="font-['Roboto'] font-bold"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {vm.nextPhaseLabel}
          </span>
        </p>
      </div>

      {/* Misc */}
      <div
        className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px pb-0 pt-[10px] px-0 relative shrink-0"
        data-name="Misc"
      >
        {vm.spectatorCount > 0 && (
          <p
            className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[16px] text-right text-white w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {vm.spectatorCount} spectator{vm.spectatorCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}