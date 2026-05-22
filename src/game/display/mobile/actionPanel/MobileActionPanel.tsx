import type { ActionPanelViewModel, GameSessionActions } from '../../../client/useGameSession';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
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

export function MobileActionPanel({ vm, actions, onShipInspect }: MobileActionPanelProps) {
  if (CATALOGUE_PANEL_IDS.has(vm.activePanelId)) {
    return (
      <div className="h-[204px] w-full shrink-0 overflow-hidden border-t border-[var(--shapeships-grey-70)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <MobileCatalogueScroller vm={vm} actions={actions} onShipInspect={onShipInspect} />
      </div>
    );
  }

  return (
    <div
      aria-label="Mobile bottom panel placeholder"
      className="h-[204px] w-full shrink-0 border-t border-[var(--shapeships-grey-70)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    />
  );
}
