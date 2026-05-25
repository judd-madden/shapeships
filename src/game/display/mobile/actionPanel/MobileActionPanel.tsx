import type { ReactNode } from 'react';
import { ChevronDown } from '../../../../components/ui/primitives/icons/ChevronDown';
import type { ActionPanelViewModel, GameSessionActions } from '../../../client/useGameSession';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import { EvolverDrawingPanel } from '../../actionPanel/panels/EvolverDrawingPanel';
import { FrigateDrawingPanel } from '../../actionPanel/panels/FrigateDrawingPanel';
import { getShipChoicePanelSpec } from '../../actionPanel/panels/ShipChoiceRegistry';
import { ShipChoicesPanel } from '../../actionPanel/panels/ShipChoicesPanel';
import { MobileCatalogueScroller } from './MobileCatalogueScroller';

interface MobileActionPanelProps {
  vm: ActionPanelViewModel;
  actions: GameSessionActions;
  onShipInspect?: (shipId: ShipDefId) => void;
}

const CATALOGUE_PANEL_IDS = new Set<ActionPanelViewModel['activePanelId']>([
  'ap.catalog.ships.human',
  'ap.catalog.ships.xenite',
  'ap.catalog.ships.centaur',
  'ap.catalog.ships.ancient',
]);

interface MobileActionPanelWrapperProps {
  children?: ReactNode;
  ariaLabel?: string;
  showScrollHint?: boolean;
}

function MobileActionPanelWrapper({
  children,
  ariaLabel = 'Mobile action panel',
  showScrollHint = false,
}: MobileActionPanelWrapperProps) {
  return (
    <div
      aria-label={ariaLabel}
      className="relative h-[204px] w-full shrink-0 border-t border-[var(--shapeships-grey-70)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    >
      <div className="h-full overflow-y-auto overflow-x-hidden px-[12px] pt-[16px] pb-[48px]">
        <div className="flex min-h-full w-full flex-col items-center gap-[14px]">
          {children}
        </div>
      </div>
      {showScrollHint ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12px] bottom-[12px] size-[20px] animate-bounce"
        >
          <ChevronDown className="size-[20px]" color="white" />
        </div>
      ) : null}
    </div>
  );
}

export function MobileActionPanel({ vm, actions, onShipInspect }: MobileActionPanelProps) {
  const phaseLocalFamilySwitch = vm.phaseLocalFamilySwitch;

  function renderMobilePhaseLocalFamilySwitch(): ReactNode {
    if (!phaseLocalFamilySwitch || phaseLocalFamilySwitch.availableFamilies.length < 2) {
      return null;
    }

    const entries =
      phaseLocalFamilySwitch.phase === 'build.drawing'
        ? phaseLocalFamilySwitch.availableFamilies.map((family) => {
            const callback = actions.onSelectBuildDrawingFamily;

            return {
              family,
              label: family === 'evolver' ? 'Evolver' : 'Frigate',
              selected: phaseLocalFamilySwitch.activeFamily === family,
              disabled: callback == null,
              onClick: callback ? () => callback(family) : undefined,
            };
          })
        : phaseLocalFamilySwitch.availableFamilies.map((family) => {
            const callback = actions.onSelectFirstStrikeFamily;

            return {
              family,
              label: family === 'guardian' ? 'Guardian' : 'Sacrificial Pool',
              selected: phaseLocalFamilySwitch.activeFamily === family,
              disabled: callback == null,
              onClick: callback ? () => callback(family) : undefined,
            };
          });

    return (
      <div className="inline-flex max-w-full items-center gap-[8px] rounded-[10px] bg-[#212121] p-[3px]">
        {entries.map((entry) => (
          <button
            key={entry.family}
            type="button"
            disabled={entry.disabled}
            className="min-w-[104px] rounded-[8px] px-[12px] py-[8px] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: entry.selected ? '#555555' : '#212121' }}
            onClick={entry.onClick}
          >
            <p
              className="font-['Roboto'] font-bold leading-[normal] text-[14px] text-nowrap text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {entry.label}
            </p>
          </button>
        ))}
      </div>
    );
  }

  function renderNoActionsAvailable() {
    return (
      <>
        {renderMobilePhaseLocalFamilySwitch()}
        <p className="text-center text-[var(--shapeships-grey-50)] text-[15px]">
          No actions available.
        </p>
      </>
    );
  }

  function renderMobilePlaceholder(title: string, message: string) {
    return (
      <>
        {renderMobilePhaseLocalFamilySwitch()}
        <div className="flex w-full max-w-[340px] flex-col items-center justify-center gap-[8px] text-center">
          <p className="text-white text-[15px] font-bold">
            {title}
          </p>
          <p className="text-[var(--shapeships-grey-50)] text-[14px]">
            {message}
          </p>
        </div>
      </>
    );
  }

  if (CATALOGUE_PANEL_IDS.has(vm.activePanelId)) {
    return (
      <div className="h-[204px] w-full shrink-0 overflow-hidden border-t border-[var(--shapeships-grey-70)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <MobileCatalogueScroller vm={vm} actions={actions} onShipInspect={onShipInspect} />
      </div>
    );
  }

  if (vm.activePanelId === 'ap.build.drawing.human') {
    const frigateCount = vm.frigateDrawing?.frigateCount ?? 0;

    return (
      <MobileActionPanelWrapper
        ariaLabel="Mobile Frigate drawing panel"
        showScrollHint={frigateCount > 1}
      >
        {renderMobilePhaseLocalFamilySwitch()}
        <FrigateDrawingPanel
          frigateCount={frigateCount}
          selectedTriggers={vm.frigateDrawing?.selectedTriggers ?? []}
          onSelectTrigger={actions.onSelectFrigateTrigger}
          layout="mobile"
        />
      </MobileActionPanelWrapper>
    );
  }

  if (vm.activePanelId === 'ap.build.drawing.xenite') {
    const evolverRows = vm.evolverDrawing?.rows ?? [];

    return (
      <MobileActionPanelWrapper
        ariaLabel="Mobile Evolver drawing panel"
        showScrollHint={evolverRows.length > 1}
      >
        {renderMobilePhaseLocalFamilySwitch()}
        <EvolverDrawingPanel
          rows={evolverRows}
          onSelectChoice={actions.onSelectEvolverChoice}
          layout="mobile"
        />
      </MobileActionPanelWrapper>
    );
  }

  const shipChoiceSpec = getShipChoicePanelSpec(vm.activePanelId);

  if (shipChoiceSpec) {
    if (shipChoiceSpec.kind === 'buttons') {
      if (!vm.shipChoices?.groups || vm.shipChoices.groups.length === 0) {
        return (
          <MobileActionPanelWrapper ariaLabel="Mobile action panel empty state">
            {renderNoActionsAvailable()}
          </MobileActionPanelWrapper>
        );
      }

      const shipChoiceRowCount = vm.shipChoices.groups.reduce(
        (sum, group) => sum + group.ships.length,
        0
      );

      return (
        <MobileActionPanelWrapper
          ariaLabel="Mobile ship choice action panel"
          showScrollHint={shipChoiceRowCount > 1}
        >
          {renderMobilePhaseLocalFamilySwitch()}
          <ShipChoicesPanel
            groups={vm.shipChoices.groups}
            layout="mobile"
            showOpponentAlsoHasCharges={
              (vm.shipChoices.showOpponentAlsoHasCharges ?? false) &&
              (vm.shipChoices.opponentEligibleAtDeclarationStart ?? false)
            }
            opponentAlsoHasChargesHeading={vm.shipChoices.opponentAlsoHasChargesHeading}
            opponentAlsoHasChargesLines={vm.shipChoices.opponentAlsoHasChargesLines}
            selectedChoiceIdBySourceInstanceId={vm.shipChoices.selectedChoiceIdBySourceInstanceId}
            centaurChargeTabs={vm.shipChoices.centaurChargeTabs}
            onSelectChoiceForInstance={actions.onSelectShipChoiceForInstance}
            onSelectCentaurChargeSubTab={actions.onSelectCentaurChargeSubTab}
          />
        </MobileActionPanelWrapper>
      );
    }

    if (shipChoiceSpec.kind === 'large') {
      return (
        <MobileActionPanelWrapper ariaLabel="Mobile large choice placeholder">
          {renderMobilePlaceholder(
            vm.largeChoicePanel?.title ?? shipChoiceSpec.title,
            'This action panel will use a mobile takeover in a later pass.'
          )}
        </MobileActionPanelWrapper>
      );
    }

    if (shipChoiceSpec.kind === 'placeholder') {
      return (
        <MobileActionPanelWrapper ariaLabel="Mobile action panel placeholder">
          {renderMobilePlaceholder(shipChoiceSpec.title, shipChoiceSpec.message)}
        </MobileActionPanelWrapper>
      );
    }
  }

  if (vm.activePanelId === 'ap.idle.blank') {
    return <MobileActionPanelWrapper ariaLabel="Mobile blank action panel" />;
  }

  return (
    <MobileActionPanelWrapper ariaLabel="Mobile bottom panel placeholder">
      {renderMobilePlaceholder('Actions', 'Panel content will be implemented in a later mobile pass.')}
    </MobileActionPanelWrapper>
  );
}
