import type { BottomActionRailViewModel } from '../../client/useGameSession';
import type { MainPhaseControl } from '../shared/mainPhaseControl';

interface MobileBottomPhaseProps {
  vm: BottomActionRailViewModel;
  mainPhaseControl: MainPhaseControl;
}

export function MobileBottomPhase({ vm, mainPhaseControl }: MobileBottomPhaseProps) {
  const isBack = mainPhaseControl.mode === 'back';
  const readyNote = isBack
    ? null
    : (vm.readyDisabled ? vm.readyDisabledReason : vm.readyButtonNote) ?? null;
  const readyDisabled = isBack ? false : vm.readyDisabled || vm.readySelected;

  return (
    <div className="shrink-0 w-full flex flex-col items-center gap-[9px] px-[14px] pt-[4px]">
      <p
        className="w-full text-center text-[20px] font-black leading-5 text-white"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {vm.subphaseTitle}
        {vm.subphaseTitleSuffix ? (
          <span className="font-normal"> {vm.subphaseTitleSuffix}</span>
        ) : null}
        {vm.mobileSubphaseTitleExtra ? (
          <span className="font-normal"> {vm.mobileSubphaseTitleExtra}</span>
        ) : null}
      </p>

      {vm.readyButtonVisible ? (
        <button
          type="button"
          disabled={readyDisabled}
          onClick={mainPhaseControl.onActivate}
          className={`flex h-[50px] w-full items-center justify-center gap-[5px] rounded-[5px] px-[14px] text-black transition-transform ${
            isBack
              ? 'bg-[var(--shapeships-grey-20)] cursor-pointer active:scale-[0.99]'
              : vm.readySelected
              ? 'bg-[var(--shapeships-green)] cursor-not-allowed'
              : vm.readyDisabled
                ? 'bg-[var(--shapeships-grey-50)] cursor-not-allowed'
                : 'bg-white cursor-pointer active:scale-[0.99]'
          }`}
        >
          <span
            className="min-w-0 truncate text-[16px] font-black leading-none"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {isBack ? 'BACK' : vm.readyButtonLabel}
          </span>
          {readyNote ? (
            <span
              className="min-w-0 truncate text-[15px] font-normal leading-none"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {readyNote}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="h-[44px] w-full" aria-hidden="true" />
      )}
    </div>
  );
}
