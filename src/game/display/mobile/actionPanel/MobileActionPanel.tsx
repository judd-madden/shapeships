import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from '../../../../components/ui/primitives/icons/ChevronDown';
import type { ActionPanelViewModel, GameSessionActions } from '../../../client/useGameSession';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import { EvolverDrawingPanel } from '../../actionPanel/panels/EvolverDrawingPanel';
import { FrigateDrawingPanel } from '../../actionPanel/panels/FrigateDrawingPanel';
import { HealthResolutionPanel } from '../../actionPanel/panels/HealthResolutionPanel';
import { getShipChoicePanelSpec } from '../../actionPanel/panels/ShipChoiceRegistry';
import { LargeStyleChoicePanel } from '../../actionPanel/panels/LargeStyleChoicePanel';
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
  scrollHintResetKey?: string;
}

const SCROLL_HINT_BOTTOM_THRESHOLD_PX = 16;

function isNearScrollBottom(el: HTMLElement) {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_HINT_BOTTOM_THRESHOLD_PX;
}

function MobileActionPanelWrapper({
  children,
  ariaLabel = 'Mobile action panel',
  showScrollHint = false,
  scrollHintResetKey = ariaLabel,
}: MobileActionPanelWrapperProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollHintDismissed, setScrollHintDismissed] = useState(false);

  useEffect(() => {
    if (!showScrollHint) {
      setScrollHintDismissed(false);
      return;
    }

    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) {
      setScrollHintDismissed(false);
      return;
    }

    setScrollHintDismissed(isNearScrollBottom(scrollArea));
  }, [scrollHintResetKey, showScrollHint]);

  function handleScroll() {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea && isNearScrollBottom(scrollArea)) {
      setScrollHintDismissed(true);
    }
  }

  return (
    <div
      aria-label={ariaLabel}
      className="relative h-[204px] w-full shrink-0 border-t border-[var(--shapeships-grey-70)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    >
      <div
        ref={scrollAreaRef}
        className="h-full overflow-y-auto overflow-x-hidden px-[12px] pt-[16px] pb-[48px]"
        onScroll={handleScroll}
      >
        <div className="flex min-h-full w-full flex-col items-center gap-[14px]">
          {children}
        </div>
      </div>
      {showScrollHint && !scrollHintDismissed ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12px] bottom-[0px] size-[30px] animate-bounce"
        >
          <ChevronDown className="!size-[30px]" color="white" />
        </div>
      ) : null}
    </div>
  );
}

export function MobileActionPanel({ vm, actions, onShipInspect }: MobileActionPanelProps) {
  const healthResolutionOverlay = vm.healthResolutionOverlay;
  const phaseLocalFamilySwitch = vm.phaseLocalFamilySwitch;

  function renderWithHealthOverlay(content: ReactNode): ReactNode {
    if (!healthResolutionOverlay) {
      return content;
    }

    return (
      <div className="relative w-full shrink-0">
        {content}
        <div className="pointer-events-auto absolute inset-0 z-[50]">
          <HealthResolutionPanel
            key={healthResolutionOverlay.presentationKey}
            vm={healthResolutionOverlay}
            layout="mobile"
          />
        </div>
      </div>
    );
  }

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
    return renderWithHealthOverlay(
      <div className="h-[204px] w-full shrink-0 overflow-hidden border-t border-[var(--shapeships-grey-70)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <MobileCatalogueScroller vm={vm} actions={actions} onShipInspect={onShipInspect} />
      </div>
    );
  }

  if (vm.activePanelId === 'ap.build.drawing.human') {
    const frigateCount = vm.frigateDrawing?.frigateCount ?? 0;

    return renderWithHealthOverlay(
      <MobileActionPanelWrapper
        ariaLabel="Mobile Frigate drawing panel"
        showScrollHint={frigateCount > 1}
        scrollHintResetKey={`${vm.activePanelId}:${frigateCount}`}
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

    return renderWithHealthOverlay(
      <MobileActionPanelWrapper
        ariaLabel="Mobile Evolver drawing panel"
        showScrollHint={evolverRows.length > 1}
        scrollHintResetKey={`${vm.activePanelId}:${evolverRows.length}`}
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
        return renderWithHealthOverlay(
          <MobileActionPanelWrapper ariaLabel="Mobile action panel empty state">
            {renderNoActionsAvailable()}
          </MobileActionPanelWrapper>
        );
      }

      const shipChoiceRowCount = vm.shipChoices.groups.reduce(
        (sum, group) => sum + group.ships.length,
        0
      );

      return renderWithHealthOverlay(
        <MobileActionPanelWrapper
          ariaLabel="Mobile ship choice action panel"
          showScrollHint={shipChoiceRowCount > 1}
          scrollHintResetKey={`${vm.activePanelId}:${shipChoiceRowCount}`}
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
      return renderWithHealthOverlay(
        <MobileActionPanelWrapper ariaLabel="Mobile large choice action panel">
          {renderMobilePhaseLocalFamilySwitch()}
          <LargeStyleChoicePanel
            shipDefId={shipChoiceSpec.shipDefId}
            title={vm.largeChoicePanel?.title ?? shipChoiceSpec.title}
            instruction={vm.largeChoicePanel?.instruction ?? shipChoiceSpec.instruction}
            helpText={shipChoiceSpec.helpText}
            layout="mobile"
          />
        </MobileActionPanelWrapper>
      );
    }

    if (shipChoiceSpec.kind === 'placeholder') {
      return renderWithHealthOverlay(
        <MobileActionPanelWrapper ariaLabel="Mobile action panel placeholder">
          {renderMobilePlaceholder(shipChoiceSpec.title, shipChoiceSpec.message)}
        </MobileActionPanelWrapper>
      );
    }
  }

  if (vm.activePanelId === 'ap.idle.blank') {
    return renderWithHealthOverlay(<MobileActionPanelWrapper ariaLabel="Mobile blank action panel" />);
  }

  return renderWithHealthOverlay(
    <MobileActionPanelWrapper ariaLabel="Mobile bottom panel placeholder">
      {renderMobilePlaceholder('Actions', 'Panel content will be implemented in a later mobile pass.')}
    </MobileActionPanelWrapper>
  );
}
