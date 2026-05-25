import type { BottomActionRailViewModel, GameSessionActions } from '../../client/useGameSession';

interface MobileBottomPhaseProps {
  vm: BottomActionRailViewModel;
  actions: Pick<GameSessionActions, 'onReadyToggle'>;
}

export function MobileBottomPhase({ vm, actions }: MobileBottomPhaseProps) {
  const readyNote = (vm.readyDisabled ? vm.readyDisabledReason : vm.readyButtonNote) ?? null;
  const readyDisabled = vm.readyDisabled || vm.readySelected;

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
      </p>

      {vm.readyButtonVisible ? (
        <button
          type="button"
          disabled={readyDisabled}
          onClick={actions.onReadyToggle}
          className={`flex h-[50px] w-full items-center justify-center gap-[5px] rounded-[5px] px-[14px] text-black transition-transform ${
            vm.readySelected
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
            {vm.readyButtonLabel}
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
