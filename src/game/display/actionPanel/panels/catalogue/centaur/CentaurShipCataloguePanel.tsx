/**
 * Centaur Ship Catalogue Panel
 * 
 * Cloned from XeniteShipCataloguePanel.tsx
 * - Portal-based hover cards with ship rules from JSON
 * - Build eligibility feedback (UI-only, no backend)
 * - Uses canonical ship IDs from ShipDefinitionsUI
 * - Hand-authored layout matching Figma design exactly
 * 
 * NO backend calls, NO rules validation, NO engine imports
 */

import type { GameSessionActions } from '../../../../../client/useGameSession';
import { ActionPanelScrollArea } from '../../../primitives/ActionPanelScrollArea';
import { CatalogueShipSlot } from '../shared/CatalogueShipSlot';
import { CatalogueCostNumber } from '../shared/CatalogueCostNumber';
import { ShipHoverCard } from '../shared/ShipHoverCard';
import { useShipCatalogueHover } from '../shared/useShipCatalogueHover';
import { computeShipEligibility } from '../shared/ShipBuildEligibility';
import { SHIP_DEFINITIONS_MAP } from '../../../../../data/ShipDefinitionsUI';
import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import {
  ShipOfFearShip,
  ShipOfAngerShip,
  ShipOfEquality2Ship,
  ShipOfWisdom2Ship,
  ShipOfVigorShip,
  ShipOfFamily3Ship,
  ShipOfLegacyShip,
  ArkOfRedemptionShip,
  ArkOfTerrorShip,
  ArkOfFuryShip,
  ArkOfKnowledgeShip,
  ArkOfEntropyShip,
  ArkOfPowerShip,
  ArkOfDestructionShip,
  ArkOfDominationShip,
} from '../../../../../../graphics/centaur/assets';

// PASS 2: Max ship limit stub (TODO: formalize limits in rules/engine)
// Centaur limits per rules:
const MAX_LIMIT_SHIPS: Partial<Record<ShipDefId, boolean>> = {
  VIG: true, // Ship of Vigor
  POW: true, // Ark of Power
  KNO: true, // Ark of Knowledge
};

interface CentaurShipCataloguePanelProps {
  actions: GameSessionActions;
}

export function CentaurShipCataloguePanel({ actions }: CentaurShipCataloguePanelProps) {
  // Hover state controller
  const hover = useShipCatalogueHover();
  
  // Stubs: Replace with VM data in future passes
  const isOpponentView = false; // TODO: Get from VM
  const ownedShipsById: Record<ShipDefId, number> = {}; // TODO: Get from VM
  const availableLines = 999; // TODO: Get from VM
  const availableJoiningLines = 999; // TODO: Get from VM
  
  // Hardcoded affordability for visual validation (will be replaced by eligibility)
  const canAfford = true;
  
  // Compute eligibility for hovered ship
  const hoveredShipEligibility = hover.state.activeShipId
    ? (() => {
        const ship = SHIP_DEFINITIONS_MAP[hover.state.activeShipId];
        return computeShipEligibility({
          shipId: hover.state.activeShipId,
          isOpponentView,
          ownedShipsById,
          totalLineCost: ship?.totalLineCost ?? 0,
          joiningLineCost: ship?.joiningLineCost ?? 0,
          availableLines,
          availableJoiningLines,
          maxLimitReachedById: MAX_LIMIT_SHIPS,
          componentShipIds: ship?.componentShips ?? []
        });
      })()
    : null;

  return (
    <>
      <ActionPanelScrollArea>
        {/* Container with exact width from Figma */}
        <div className="relative" style={{ width: '1210px', minHeight: '290px' }}>
          
          {/* Section Titles */}
          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{ left: '0', top: '0', fontVariationSettings: "'wdth' 100" }}
          >
            Centaur Basic Ships
          </p>
          
          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{ left: '427px', top: '0', fontVariationSettings: "'wdth' 100" }}
          >
            Centaur Upgraded Ships
          </p>

          {/* Vertical Divider */}
          <div
            className="absolute bg-[#555555]"
            style={{ left: '406px', top: '0', width: '1px', height: '290px' }}
          />

          {/* ================ BASIC SHIPS ================ */}
          
          {/* Basic Row 1: FEA, ANG, EQU, WIS */}
          <div
            className="absolute content-stretch flex items-center justify-between"
            style={{ left: '0', top: '30px', width: '386px' }}
          >
            {/* Ship of Fear */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '36px' }}
              onMouseEnter={(e) => hover.onEnter('FEA', e.currentTarget)}              
              onMouseLeave={() => hover.onLeave('FEA')}
            >
              <CatalogueShipSlot
                shipId="FEA"
                graphic={
                  <div className="relative shrink-0" style={{ height: '36px', width: '36px' }}>
                    <ShipOfFearShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('FEA')}
              >
                <CatalogueCostNumber cost={2} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Ship of Anger */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '69.3px' }}
              onMouseEnter={(e) => hover.onEnter('ANG', e.currentTarget)}              
              onMouseLeave={() => hover.onLeave('ANG')}
            >
              <CatalogueShipSlot
                shipId="ANG"
                graphic={
                  <div className="relative shrink-0" style={{ height: '36px', width: '69.3px' }}>
                    <ShipOfAngerShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('ANG')}
              >
                <CatalogueCostNumber cost={3} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Ship of Equality (max-charge variant) */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '86.4px' }}
              onMouseEnter={(e) => hover.onEnter('EQU', e.currentTarget)}              
              onMouseLeave={() => hover.onLeave('EQU')}
            >
              <CatalogueShipSlot
                shipId="EQU"
                graphic={
                  <div className="relative shrink-0" style={{ height: '45px', width: '86.4px' }}>
                    <ShipOfEquality2Ship />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('EQU')}
              >
                <CatalogueCostNumber cost={4} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Ship of Wisdom (max-charge variant) */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '81px' }}
              onMouseEnter={(e) => hover.onEnter('WIS', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('WIS')}
            >
              <CatalogueShipSlot
                shipId="WIS"
                graphic={
                  <div className="relative shrink-0" style={{ height: '81px', width: '81px' }}>
                    <ShipOfWisdom2Ship />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('WIS')}
              >
                <CatalogueCostNumber cost={4} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* Basic Row 2: VIG, FAM, LEG */}
          <div
            className="absolute content-stretch flex items-end justify-between"
            style={{ left: '0', top: '138px', width: '386px', paddingLeft: '16px', paddingRight: '16px' }}
          >
            {/* Ship of Vigor */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '86px' }}
              onMouseEnter={(e) => hover.onEnter('VIG', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('VIG')}
            >
              <CatalogueShipSlot
                shipId="VIG"
                graphic={
                  <div className="relative shrink-0" style={{ height: '76px', width: '86px' }}>
                    <ShipOfVigorShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('VIG')}
              >
                <CatalogueCostNumber cost={6} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Ship of Family (max-charge variant) */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '96px' }}
              onMouseEnter={(e) => hover.onEnter('FAM', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('FAM')}
            >
              <CatalogueShipSlot
                shipId="FAM"
                graphic={
                  <div className="relative shrink-0" style={{ height: '96px', width: '96px' }}>
                    <ShipOfFamily3Ship />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('FAM')}
              >
                <CatalogueCostNumber cost={6} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Ship of Legacy */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '100.8px' }}
              onMouseEnter={(e) => hover.onEnter('LEG', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('LEG')}
            >
              <CatalogueShipSlot
                shipId="LEG"
                graphic={
                  <div className="relative shrink-0" style={{ height: '68.4px', width: '100.8px' }}>
                    <ShipOfLegacyShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('LEG')}
              >
                <CatalogueCostNumber cost={8} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* ================ UPGRADED SHIPS ================ */}

          {/* Ark of Terror */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '427px', top: '54px', width: '112px' }}
            onMouseEnter={(e) => hover.onEnter('TER', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('TER')}
          >
            <CatalogueShipSlot
              shipId="TER"
              graphic={
                <div className="relative shrink-0" style={{ height: '33px', width: '112px' }}>
                  <ArkOfTerrorShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('TER')}
            >
              <CatalogueCostNumber cost={10} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Ark of Fury */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '427px', top: '135px', width: '69.3px' }}
            onMouseEnter={(e) => hover.onEnter('FUR', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('FUR')}
          >
            <CatalogueShipSlot
              shipId="FUR"
              graphic={
                <div className="relative shrink-0" style={{ height: '95.4px', width: '69.3px' }}>
                  <ArkOfFuryShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('FUR')}
            >
              <CatalogueCostNumber cost={12} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Ark of Entropy */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '512px', top: '123px', width: '86.4px' }}
            onMouseEnter={(e) => hover.onEnter('ENT', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('ENT')}
          >
            <CatalogueShipSlot
              shipId="ENT"
              graphic={
                <div className="relative shrink-0" style={{ height: '107.1px', width: '86.4px' }}>
                  <ArkOfEntropyShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('ENT')}
            >
              <CatalogueCostNumber cost={12} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Ark of Knowledge */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '612px', top: '52px', width: '85.05px' }}
            onMouseEnter={(e) => hover.onEnter('KNO', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('KNO')}
          >
            <CatalogueShipSlot
              shipId="KNO"
              graphic={
                <div className="relative shrink-0" style={{ height: '175.2', width: '85.05px' }}>
                  <div className="w-full h-full catalogue-ship-fit">
                  <ArkOfKnowledgeShip />
                    </div>
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('KNO')}
            >
              <CatalogueCostNumber cost={12} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>


          {/* Ark of Redemption */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '710px', top: '24.97px', width: '165.564px' }}
            onMouseEnter={(e) => hover.onEnter('RED', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('RED')}
          >
            <CatalogueShipSlot
              shipId="RED"
              graphic={
                <div className="relative shrink-0" style={{ height: '151.2px', width: '165.564px' }}>
                  <div className="w-full h-full catalogue-ship-fit">
                  <ArkOfRedemptionShip />
                  </div>
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('RED')}
            >
              <CatalogueCostNumber cost={15} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>
          
          {/* Ark of Power */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '852px', top: '0', width: '220.57px' }}
            onMouseEnter={(e) => hover.onEnter('POW', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('POW')}
          >
            <CatalogueShipSlot
              shipId="POW"
              graphic={
                <div className="relative shrink-0" style={{ height: '132.76px', width: '220.57px' }}>
                  <div className="w-full h-full catalogue-ship-fit">
                  <ArkOfPowerShip />
                  </div>
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('POW')}
            >
              <CatalogueCostNumber cost={20} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Ark of Destruction */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '1022px', top: '47px', width: '196.02px' }}
            onMouseEnter={(e) => hover.onEnter('DES', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('DES')}
          >
            <CatalogueShipSlot
              shipId="DES"
              graphic={
                <div className="relative shrink-0" style={{ height: '166.62px', width: '196.02px' }}>
                  <div className="w-full h-full catalogue-ship-fit">
                  <ArkOfDestructionShip />
                  </div>
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('DES')}
            >
              <CatalogueCostNumber cost={31} className="relative shrink-0" />
            </CatalogueShipSlot>
          </div>

          {/* Ark of Domination */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '755px', top: '150px', width: '312.57px' }}
            onMouseEnter={(e) => hover.onEnter('DOM', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('DOM')}
          >
            <CatalogueShipSlot
              shipId="DOM"
              graphic={
                <div className="relative shrink-0" style={{ height: '214.95px', width: '312.57px' }}>
                  <div className="w-full h-full catalogue-ship-fit">
                  <ArkOfDominationShip />
                  </div>
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('DOM')}
            >
              <CatalogueCostNumber cost={40} className="relative shrink-0" />
            </CatalogueShipSlot>
          </div>

        </div>
      </ActionPanelScrollArea>
      
      {/* Single hover card rendered via portal */}
      {hover.state.activeShipId && hover.state.anchorRect && hoveredShipEligibility && (
        <ShipHoverCard
          shipId={hover.state.activeShipId}
          anchorRect={hover.state.anchorRect}
          isOpponentView={isOpponentView}
          eligibility={hoveredShipEligibility}
        />
      )}
    </>
  );
}
