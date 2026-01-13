/**
 * Action Panel Frame
 * Container for action panels with debug display
 */

import { ACTION_PANEL_DISPLAY_NAMES } from './ActionPanelRegistry';
import type { ActionPanelViewModel } from '../../client/useGameSession';
import { HumanShipCataloguePanel } from './panels/catalogue/human/HumanShipCataloguePanel';

interface ActionPanelFrameProps {
  vm: ActionPanelViewModel;
}

export function ActionPanelFrame({ vm }: ActionPanelFrameProps) {
  const displayName = ACTION_PANEL_DISPLAY_NAMES[vm.activePanelId];

  // TODO (PASS 2+): Replace this if/else panel selection with a mapping object
  // (ActionPanelId -> component) once multiple panels are implemented.

  // Render the appropriate panel based on activePanelId
  if (vm.activePanelId === 'ap.catalog.ships.human') {
    return (
      <div className="size-full">
        <HumanShipCataloguePanel />
      </div>
    );
  }

  // Fallback debug display for panels not yet implemented
  return (
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