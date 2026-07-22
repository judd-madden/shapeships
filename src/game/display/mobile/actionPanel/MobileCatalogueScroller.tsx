import type { ActionPanelViewModel, GameSessionActions } from '../../../client/useGameSession';
import type { SpeciesId } from '../../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import { AncientShipCataloguePanel } from '../../actionPanel/panels/catalogue/ancient/AncientShipCataloguePanel';
import { CentaurShipCataloguePanel } from '../../actionPanel/panels/catalogue/centaur/CentaurShipCataloguePanel';
import { HumanShipCataloguePanel } from '../../actionPanel/panels/catalogue/human/HumanShipCataloguePanel';
import { XeniteShipCataloguePanel } from '../../actionPanel/panels/catalogue/xenite/XeniteShipCataloguePanel';
import { MobileScaledCatalogueCanvas } from './MobileScaledCatalogueCanvas';

interface MobileCatalogueScrollerProps {
  vm: ActionPanelViewModel;
  actions: GameSessionActions;
  onShipInspect?: (shipId: ShipDefId) => void;
  simulacrumSpecies?: SpeciesId;
}

const MOBILE_CATALOGUE_CANVASES = {
  human: { width: 1446, height: 258 },
  xenite: { width: 1446, height: 258 },
  centaur: { width: 1446, height: 258 },
  ancient: { width: 1446, height: 258 },
} as const;

export function MobileCatalogueScroller({
  vm,
  actions,
  onShipInspect,
  simulacrumSpecies,
}: MobileCatalogueScrollerProps) {
  const commonProps = {
    actions,
    buildCatalogue: vm.buildCatalogue,
    frame: 'bare' as const,
    catalogueLayout: 'long' as const,
    hoverDisabled: true,
    interactionDisabled: true,
    onShipInspect,
  };

  const catalogue =
    vm.activePanelId === 'ap.catalog.ships.human' ? (
      <MobileScaledCatalogueCanvas {...MOBILE_CATALOGUE_CANVASES.human}>
        <HumanShipCataloguePanel {...commonProps} />
      </MobileScaledCatalogueCanvas>
    ) : vm.activePanelId === 'ap.catalog.ships.xenite' ? (
      <MobileScaledCatalogueCanvas {...MOBILE_CATALOGUE_CANVASES.xenite}>
        <XeniteShipCataloguePanel {...commonProps} />
      </MobileScaledCatalogueCanvas>
    ) : vm.activePanelId === 'ap.catalog.ships.centaur' ? (
      <MobileScaledCatalogueCanvas {...MOBILE_CATALOGUE_CANVASES.centaur}>
        <CentaurShipCataloguePanel {...commonProps} />
      </MobileScaledCatalogueCanvas>
    ) : (
      vm.activePanelId === 'ap.catalog.ships.ancient' ||
      vm.activePanelId === 'ap.battle.solar_powers.ancient'
    ) ? (
      <MobileScaledCatalogueCanvas {...MOBILE_CATALOGUE_CANVASES.ancient}>
        <AncientShipCataloguePanel
          {...commonProps}
          simulacrumSpecies={simulacrumSpecies}
          presentation={
            vm.activePanelId === 'ap.battle.solar_powers.ancient'
              ? 'declaration'
              : 'reference'
          }
          catalogueEnergy={vm.ancientCatalogueEnergy}
          declarationEnergy={vm.ancientChargeDeclaration?.provisionalEnergy}
          declarationStage={vm.ancientChargeDeclaration?.stage}
          canCastManualSolarPowerById={vm.ancientChargeDeclaration?.canCastManualSolarPowerById}
          autocastEnabled={
            vm.ancientChargeDeclaration?.autocastEnabled ?? vm.ancientAutocastEnabled
          }
          autocastDisabled={vm.ancientChargeDeclaration?.attemptUnresolved === true}
          declarationAttemptUnresolved={vm.ancientChargeDeclaration?.attemptUnresolved === true}
        />
      </MobileScaledCatalogueCanvas>
    ) : null;

  return (
    <div className="h-full w-full overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x">
      <div className="flex h-full min-w-max items-start px-[14px] pt-[9px]">
        <div>{catalogue}</div>
      </div>
    </div>
  );
}
