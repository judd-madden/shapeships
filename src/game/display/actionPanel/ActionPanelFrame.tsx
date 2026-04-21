/**
 * Action Panel Frame
 * Container for action panels with debug display
 */

import type { ReactNode } from 'react';
import { ACTION_PANEL_DISPLAY_NAMES } from './ActionPanelRegistry';
import type { ActionPanelViewModel, GameSessionActions } from '../../client/useGameSession';
import { HumanShipCataloguePanel } from './panels/catalogue/human/HumanShipCataloguePanel';
import { XeniteShipCataloguePanel } from './panels/catalogue/xenite/XeniteShipCataloguePanel';
import { CentaurShipCataloguePanel } from './panels/catalogue/centaur/CentaurShipCataloguePanel';
import { AncientShipCataloguePanel } from './panels/catalogue/ancient/AncientShipCataloguePanel';
import { MenuActionPanel } from './panels/MenuActionPanel';
import { EndOfGameActionPanel } from './panels/EndOfGameActionPanel';
import { getShipChoicePanelSpec } from './panels/ShipChoiceRegistry';
import { ShipChoicesPanel } from './panels/ShipChoicesPanel';
import { LargeStyleChoicePanel } from './panels/LargeStyleChoicePanel';
import { FrigateDrawingPanel } from './panels/FrigateDrawingPanel';
import { EvolverDrawingPanel } from './panels/EvolverDrawingPanel';
import { HealthResolutionPanel } from './panels/HealthResolutionPanel';
import { ActionPanelScrollArea } from './primitives/ActionPanelScrollArea';

interface ActionPanelFrameProps {
  vm: ActionPanelViewModel;
  actions: GameSessionActions;
  onReturnToMainMenu: () => void;
}

export function ActionPanelFrame({ vm, actions, onReturnToMainMenu }: ActionPanelFrameProps) {
  const displayName = ACTION_PANEL_DISPLAY_NAMES[vm.activePanelId];
  const healthResolutionOverlay = vm.healthResolutionOverlay;

  function renderWithOverlay(content: ReactNode) {
    return (
      <div className="relative size-full">
        <div className="size-full">{content}</div>
        {healthResolutionOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            <HealthResolutionPanel
              key={healthResolutionOverlay.presentationKey}
              vm={healthResolutionOverlay}
            />
          </div>
        ) : null}
      </div>
    );
  }

  // TODO (PASS 2+): Replace this if/else panel selection with a mapping object
  // (ActionPanelId -> component) once multiple panels are implemented.

  // Render the appropriate panel based on activePanelId
  if (vm.activePanelId === 'ap.catalog.ships.human') {
    return renderWithOverlay(
      <div className="size-full">
        <HumanShipCataloguePanel actions={actions} buildCatalogue={vm.buildCatalogue} />
      </div>
    );
  }

  if (vm.activePanelId === 'ap.catalog.ships.xenite') {
    return renderWithOverlay(
      <div className="size-full">
        <XeniteShipCataloguePanel actions={actions} buildCatalogue={vm.buildCatalogue} />
      </div>
    );
  }

  if (vm.activePanelId === 'ap.catalog.ships.centaur') {
    return renderWithOverlay(
      <div className="size-full">
        <CentaurShipCataloguePanel actions={actions} buildCatalogue={vm.buildCatalogue} />
      </div>
    );
  }

  if (vm.activePanelId === 'ap.catalog.ships.ancient') {
    return renderWithOverlay(
      <div className="size-full">
        <AncientShipCataloguePanel actions={actions} buildCatalogue={vm.buildCatalogue} />
      </div>
    );
  }

  if (vm.activePanelId === 'ap.menu.root') {
    return renderWithOverlay(
      <div className="size-full">
        <MenuActionPanel
          title={vm.menu.title}
          subtitle={vm.menu.subtitle}
          turnNumber={vm.menu.turnNumber}
          phaseKey={vm.menu.phaseKey}
          hasActionsForMe={vm.menu.hasActionsForMe}
          canOfferDraw={vm.menu.canOfferDraw}
          canResign={vm.menu.canResign}
          onOfferDraw={actions.onOfferDraw}
          onResignGame={actions.onResignGame}
        />
      </div>
    );
  }

  if (vm.activePanelId === 'ap.idle.blank') {
    return renderWithOverlay(<div className="size-full" />);
  }

  if (vm.activePanelId === 'ap.end_of_game.result') {
    // Task 2: Safe fallback if endOfGame is missing
    const endOfGame = vm.endOfGame ?? {
      bannerText: 'Game Over',
      bannerBgCssVar: 'var(--shapeships-grey-50)',
      metaLeftText: '',
      metaRightText: '',
      rematchHelperText: 'Link will be posted in chat',
    };

    return renderWithOverlay(
      <div className="size-full">
        <EndOfGameActionPanel
          bannerText={endOfGame.bannerText}
          bannerBgCssVar={endOfGame.bannerBgCssVar}
          metaLeftText={endOfGame.metaLeftText}
          metaRightText={endOfGame.metaRightText}
          rematchHelperText={endOfGame.rematchHelperText}
          onReturnToMainMenu={onReturnToMainMenu}
          onRematch={actions.onRematch}
          onDownloadBattleLog={actions.onDownloadBattleLog}
        />
      </div>
    );
  }

  // ============================================================================
  // SPECIAL DRAWING PANELS (explicit routing before registry)
  // ============================================================================

  if (vm.activePanelId === 'ap.build.drawing.human') {
    return renderWithOverlay(
      <div className="size-full flex justify-center">
        <div className="w-fit">
        <FrigateDrawingPanel
          frigateCount={vm.frigateDrawing?.frigateCount ?? 0}
          selectedTriggers={vm.frigateDrawing?.selectedTriggers ?? []}
          onSelectTrigger={actions.onSelectFrigateTrigger}
        />
        </div>
        <div className="absolute top-[20px] right-[50px] text-[#ff8282]">^ Return to Drawing</div>
      </div>
    );
  }

  if (vm.activePanelId === 'ap.build.drawing.xenite') {
    return renderWithOverlay(
      <div className="size-full flex justify-center">
      <div className="w-fit">
        <EvolverDrawingPanel
          rows={vm.evolverDrawing?.rows ?? []}
          onSelectChoice={actions.onSelectEvolverChoice}
        />
        </div>
        <div className="absolute top-[20px] right-[50px] text-[#ff8282]">^ Return to Drawing</div>
      </div>
    );
  }

  // ============================================================================
  // SHIP CHOICE PANELS (from ShipChoiceRegistry)
  // ============================================================================

  const shipChoiceSpec = getShipChoicePanelSpec(vm.activePanelId);

  if (shipChoiceSpec) {
    // --------------------------------------------------------------------------
    // KIND: BUTTONS (ShipChoicesPanel with groups from VM)
    // --------------------------------------------------------------------------
    if (shipChoiceSpec.kind === 'buttons') {
      // If no groups available, show "No actions available"
      if (!vm.shipChoices?.groups || vm.shipChoices.groups.length === 0) {
        return renderWithOverlay(
          <div className="size-full flex flex-col items-center justify-center">
            <p className="text-[var(--shapeships-grey-50)] text-[18px]">
              No actions available.
            </p>
          </div>
        );
      }

      // Render ShipChoicesPanel with derived groups from VM
      return renderWithOverlay(
        <ActionPanelScrollArea>
          <div className="w-fit">
            <ShipChoicesPanel
              groups={vm.shipChoices.groups}
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
          </div>
        </ActionPanelScrollArea>
      );
    }

    // --------------------------------------------------------------------------
    // KIND: LARGE (LargeStyleChoicePanel)
    // --------------------------------------------------------------------------
    if (shipChoiceSpec.kind === 'large') {
      return renderWithOverlay(
        <ActionPanelScrollArea>
          <div className="w-fit">
            <LargeStyleChoicePanel
              shipDefId={shipChoiceSpec.shipDefId}
              title={vm.largeChoicePanel?.title ?? shipChoiceSpec.title}
              instruction={vm.largeChoicePanel?.instruction ?? shipChoiceSpec.instruction}
              helpText={shipChoiceSpec.helpText}
              className="w-auto h-auto"
            />
          </div>
        </ActionPanelScrollArea>
      );
    }

    // --------------------------------------------------------------------------
    // KIND: PLACEHOLDER
    // --------------------------------------------------------------------------
    if (shipChoiceSpec.kind === 'placeholder') {
      return renderWithOverlay(
        <ActionPanelScrollArea>
          <div className="size-full flex flex-col items-center justify-center gap-4">
            <p className="text-white text-[18px] font-bold">
              {shipChoiceSpec.title}
            </p>
            <p className="text-[var(--shapeships-grey-50)] text-[16px] text-center max-w-[600px]">
              {shipChoiceSpec.message}
            </p>
          </div>
        </ActionPanelScrollArea>
      );
    }
  }

  // ============================================================================
  // FALLBACK DEBUG DISPLAY
  // ============================================================================

  // Fallback debug display for panels not yet implemented
  return renderWithOverlay(
    <div className="size-full flex flex-col items-center justify-center p-6">
      {/* Debug info */}
      <p className="text-white text-sm font-bold mb-2">
        AP: {displayName}
      </p>
      
      {/* Placeholder message */}
      <p className="text-[#888] text-base text-center">
        (Panel content will be implemented in next pass)
      </p>
    </div>
  );
}
