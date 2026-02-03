/**
 * Ancient Ship Catalogue Panel
 * 
 * LEFT SIDE: Ancient Basic Ships (clickable, full wiring)
 * RIGHT SIDE: Ancient Solar Powers (static UI placeholder, no logic)
 * 
 * Pattern cloned from CentaurShipCataloguePanel.tsx
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
  MercuryCore,
  PlutoCore,
  QuantumMystic,
  Spiral,
  UranusCore,
  SolarReserve4,
  Cube,
} from '../../../../../../graphics/ancient/assets';

interface AncientShipCataloguePanelProps {
  actions: GameSessionActions;
}

export function AncientShipCataloguePanel({ actions }: AncientShipCataloguePanelProps) {
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
          maxLimitReachedById: {},
          componentShipIds: ship?.componentShips ?? []
        });
      })()
    : null;

  return (
    <>
      <ActionPanelScrollArea>
        {/* Container with exact width matching design */}
        <div className="relative" style={{ width: '1210px', minHeight: '420px' }}>
          
          {/* Section Titles */}
          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{ left: '0', top: '0', fontVariationSettings: "'wdth' 100" }}
          >
            Ancient Basic Ships
          </p>
          
          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{ left: '427px', top: '0', fontVariationSettings: "'wdth' 100" }}
          >
            Ancient Solar Powers
          </p>

          {/* Vertical Divider */}
          <div
            className="absolute bg-[#555555]"
            style={{ left: '407px', top: '0', width: '1px', height: '420px' }}
          />

          {/* ================ LEFT HALF: BASIC SHIPS (CLICKABLE) ================ */}
          
          {/* Basic Ships Row 1 */}
          <div
            className="absolute content-stretch flex items-end justify-between"
            style={{ left: '0px', right: '824px', top: '33px' }}
          >
            {/* Mercury Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: '40px' }}
              onMouseEnter={(e) => hover.onEnter('MER', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('MER')}
            >
              <CatalogueShipSlot
                shipId="MER"
                graphic={
                  <div className="relative shrink-0" style={{ height: '85px', width: '40px' }}>
                    <MercuryCore />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('MER')}
              >
                <CatalogueCostNumber cost={4} className="relative shrink-0 w-full" />
              </CatalogueShipSlot>
            </div>

            {/* Pluto Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: '40px' }}
              onMouseEnter={(e) => hover.onEnter('PLU', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('PLU')}
            >
              <CatalogueShipSlot
                shipId="PLU"
                graphic={
                  <div className="relative shrink-0" style={{ height: '70px', width: '40px' }}>
                    <PlutoCore />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('PLU')}
              >
                <CatalogueCostNumber cost={4} className="relative shrink-0 w-full" />
              </CatalogueShipSlot>
            </div>

            {/* Quantum Mystic */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: '90px' }}
              onMouseEnter={(e) => hover.onEnter('QUA', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('QUA')}
            >
              <CatalogueShipSlot
                shipId="QUA"
                graphic={
                  <div className="relative shrink-0" style={{ height: '57px', width: '90px' }}>
                    <QuantumMystic />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('QUA')}
              >
                <CatalogueCostNumber cost={5} className="relative shrink-0 w-full" />
              </CatalogueShipSlot>
            </div>

            {/* Spiral */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: '60px' }}
              onMouseEnter={(e) => hover.onEnter('SPI', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('SPI')}
            >
              <CatalogueShipSlot
                shipId="SPI"
                graphic={
                  <div className="relative shrink-0" style={{ height: '60px', width: '60px' }}>
                    <Spiral />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('SPI')}
              >
                <CatalogueCostNumber cost={6} className="relative shrink-0 w-full" />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* Basic Ships Row 2 */}
          <div
            className="absolute content-stretch flex items-end justify-between px-[16px]"
            style={{ left: '-5px', right: '819px', top: '165px' }}
          >
            {/* Uranus Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: '70px' }}
              onMouseEnter={(e) => hover.onEnter('URA', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('URA')}
            >
              <CatalogueShipSlot
                shipId="URA"
                graphic={
                  <div className="relative shrink-0" style={{ height: '70px', width: '70px' }}>
                    <UranusCore />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('URA')}
              >
                <CatalogueCostNumber cost={7} className="relative shrink-0 w-full" />
              </CatalogueShipSlot>
            </div>

            {/* Solar Reserve (use SolarReserve4 as default) */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: '80px' }}
              onMouseEnter={(e) => hover.onEnter('SOL', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('SOL')}
            >
              <CatalogueShipSlot
                shipId="SOL"
                graphic={
                  <div className="relative shrink-0" style={{ height: '80px', width: '80px' }}>
                    <SolarReserve4 />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('SOL')}
              >
                <CatalogueCostNumber cost={8} className="relative shrink-0 w-full" />
              </CatalogueShipSlot>
            </div>

            {/* Cube */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: '70px' }}
              onMouseEnter={(e) => hover.onEnter('CUB', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('CUB')}
            >
              <CatalogueShipSlot
                shipId="CUB"
                graphic={
                  <div className="relative shrink-0" style={{ height: '70px', width: '70px' }}>
                    <Cube />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('CUB')}
              >
                <CatalogueCostNumber cost={9} className="relative shrink-0 w-full" />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* ================ RIGHT HALF: SOLAR POWERS (STATIC UI ONLY) ================ */}
          
          {/* Available Energy Header */}
          <div
            className="absolute content-stretch flex gap-[32px] items-center"
            style={{ right: '2px', top: '4px' }}
          >
            <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-white">
              Available Energy:
            </p>
            <div className="content-stretch flex gap-[29px] items-center">
              {/* Red Energy */}
              <div className="content-stretch flex gap-[8px] items-center">
                <div className="relative shrink-0 size-[20px]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20.4028">
                    <circle cx="10" cy="10" fill="#FF8282" r="10" />
                  </svg>
                </div>
                <p className="font-['Roboto'] font-bold leading-[normal] text-[#ff8282] text-[22px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  0 red
                </p>
              </div>
              
              {/* Green Energy */}
              <div className="content-stretch flex gap-[8px] items-center">
                <div className="relative shrink-0 size-[20px]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20.4028">
                    <circle cx="10" cy="10" fill="#9CFF84" r="10" />
                  </svg>
                </div>
                <p className="font-['Roboto'] font-bold leading-[normal] text-[#9cff84] text-[22px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  0 green
                </p>
              </div>
              
              {/* Blue Energy */}
              <div className="content-stretch flex gap-[8px] items-center">
                <div className="relative shrink-0 size-[20px]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20.4028">
                    <circle cx="10" cy="10" fill="#62FFF6" r="10" />
                  </svg>
                </div>
                <p className="font-['Roboto'] font-bold leading-[normal] text-[#62fff6] text-[22px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  0 blue
                </p>
              </div>
            </div>
          </div>

          {/* Solar Powers Wrapper - All buttons in one absolute positioned container */}
          <div
            className="absolute"
            style={{ left: '427px', top: '50px', right: '0' }}
          >
            {/* Solar Powers Grid - Row 1 */}
            <div
              className="absolute content-stretch flex gap-[30px] items-start"
              style={{ left: '0px', top: '0px' }}
            >
              {/* Asteroid (Red) */}
              <div className="content-stretch flex flex-col gap-[10px] items-center w-[169px]">
                <div className="h-[50px] relative rounded-[10px] w-full">
                  <div className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
                  <div className="flex items-center justify-center size-full px-[20px] py-[19px]">
                    <div className="content-stretch flex gap-[10px] items-center justify-center">
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[#ff8282] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Asteroid
                      </p>
                      <div className="relative shrink-0 size-[14.4px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Deal 1 damage
                </p>
              </div>

              {/* Life (Green) */}
              <div className="content-stretch flex flex-col gap-[11px] items-center w-[169px]">
                <div className="h-[50px] relative rounded-[10px] w-full">
                  <div className="absolute border-2 border-[#9cff84] border-solid inset-0 pointer-events-none rounded-[10px]" />
                  <div className="flex items-center justify-center size-full px-[20px] py-[19px]">
                    <div className="content-stretch flex gap-[10px] items-center justify-center">
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[#9cff84] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Life
                      </p>
                      <div className="relative shrink-0 size-[14.4px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Heal 1
                </p>
              </div>

              {/* Convert (Blue) */}
              <div className="content-stretch flex flex-col gap-[11px] items-center w-[169px]">
                <div className="h-[50px] relative rounded-[10px] w-full">
                  <div className="absolute border-2 border-[#62fff6] border-solid inset-0 pointer-events-none rounded-[10px]" />
                  <div className="flex items-center justify-center size-full px-[20px] py-[19px]">
                    <div className="content-stretch flex gap-[10px] items-center justify-center">
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[#62fff6] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Convert
                      </p>
                      <div className="relative shrink-0 size-[14.4px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#62FFF6" strokeWidth="1.848" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  +1 Line
                </p>
              </div>

              {/* Siphon (Multi - Red+Green) */}
              <div className="content-stretch flex flex-col gap-[10px] items-center w-[169px]">
                <div className="h-[50px] relative rounded-[10px] w-full">
                  <div className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
                  <div className="flex items-center justify-center size-full px-[20px] py-[19px]">
                    <div className="content-stretch flex gap-[10px] items-center justify-center">
                      {/* Red circles */}
                      <div className="h-[14.4px] w-[34.8px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.648 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                          <circle cx="28.524" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                        </svg>
                      </div>
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[16px] text-center text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Siphon
                      </p>
                      {/* Green circles */}
                      <div className="h-[14.4px] w-[34.8px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.648 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                          <circle cx="28.524" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Deal X damage, heal X
                </p>
              </div>
            </div>

            {/* Solar Powers Grid - Row 2 */}
            <div
              className="absolute content-stretch flex gap-[30px] items-start"
              style={{ left: '0px', top: '100px' }}
            >
              {/* Supernova (Red) */}
              <div className="content-stretch flex flex-col gap-[10px] items-center w-[169px]">
                <div className="h-[50px] relative rounded-[10px] w-full">
                  <div className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
                  <div className="flex items-center justify-center size-full px-[20px] py-[19px]">
                    <div className="content-stretch flex gap-[10px] items-center justify-center">
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[#ff8282] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Supernova
                      </p>
                      <div className="h-[14.4px] w-[55.2px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 57.048 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                          <circle cx="28.524" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                          <circle cx="48.924" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Deal X damage
                </p>
              </div>

              {/* Star Birth (Green) */}
              <div className="content-stretch flex flex-col gap-[10px] items-center w-[169px]">
                <div className="h-[50px] relative rounded-[10px] w-full">
                  <div className="absolute border-2 border-[#9cff84] border-solid inset-0 pointer-events-none rounded-[10px]" />
                  <div className="flex items-center justify-center size-full px-[20px] py-[19px]">
                    <div className="content-stretch flex gap-[10px] items-center justify-center">
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[#9cff84] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Star Birth
                      </p>
                      <div className="h-[14.4px] w-[55.2px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 57.048 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                          <circle cx="28.524" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                          <circle cx="48.924" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Heal X
                </p>
              </div>

              {/* Simulacrum X (Blue) */}
              <div className="content-stretch flex flex-col gap-[10px] items-center w-[169px]">
                <div className="h-[50px] relative rounded-[10px] w-full">
                  <div className="absolute border-2 border-[#62fff6] border-solid inset-0 pointer-events-none rounded-[10px]" />
                  <div className="flex items-center justify-center size-full px-[20px] py-[19px]">
                    <div className="content-stretch flex gap-[10px] items-center justify-center">
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[#62fff6] text-[16px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Simulacrum X
                      </p>
                      <div className="relative shrink-0 size-[14.4px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#62FFF6" strokeWidth="1.848" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Copy basic enemy ship
                </p>
              </div>

              {/* Vortex (Multi - Red+Green+Blue) */}
              <div className="content-stretch flex flex-col gap-[10px] items-center w-[169px]">
                <div className="h-[50px] relative rounded-[10px] w-full">
                  <div className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
                  <div className="flex items-center justify-center size-full px-[20px] py-[19px]">
                    <div className="content-stretch flex gap-[10px] items-center justify-center">
                      {/* Red circles */}
                      <div className="h-[14.4px] w-[34.8px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.648 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                          <circle cx="28.524" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                        </svg>
                      </div>
                      {/* Green circles */}
                      <div className="h-[14.4px] w-[34.8px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.648 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                          <circle cx="28.524" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                        </svg>
                      </div>
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[16px] text-center text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Vortex
                      </p>
                      {/* Blue circle */}
                      <div className="relative shrink-0 size-[14.4px]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                          <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#62FFF6" strokeWidth="1.848" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Deal X damage
                </p>
              </div>
            </div>

            {/* Black Hole - Large Card */}
            <div
              className="absolute content-stretch flex flex-col gap-[10px] items-center"
              style={{ left: '0px', top: '200px', width: '356px' }}
            >
              <div className="h-[101.8px] relative rounded-[10px] w-full">
                <div className="absolute border-2 border-[#ff8282] border-solid inset-0 pointer-events-none rounded-[10px]" />
                <div className="flex items-center justify-center size-full p-[20px]">
                  <div className="content-stretch flex flex-col gap-[10px] items-center justify-center w-full">
                    {/* Title and energy circles */}
                    <div className="content-stretch flex gap-[15px] items-start justify-between w-full">
                      <p className="font-['Roboto'] font-bold leading-[normal] text-[#ff8282] text-[20px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                        Black Hole
                      </p>
                      <div className="content-stretch flex gap-[10px] items-center">
                        {/* Red column */}
                        <div className="flex flex-col gap-[4px]">
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                            </svg>
                          </div>
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                            </svg>
                          </div>
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#FF8282" strokeWidth="1.848" />
                            </svg>
                          </div>
                        </div>
                        {/* Green column */}
                        <div className="flex flex-col gap-[4px]">
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                            </svg>
                          </div>
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                            </svg>
                          </div>
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#9CFF84" strokeWidth="1.848" />
                            </svg>
                          </div>
                        </div>
                        {/* Blue column */}
                        <div className="flex flex-col gap-[4px]">
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#62FFF6" strokeWidth="1.848" />
                            </svg>
                          </div>
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#62FFF6" strokeWidth="1.848" />
                            </svg>
                          </div>
                          <div className="relative shrink-0 size-[14.4px]">
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.248 16.248">
                              <circle cx="8.124" cy="8.124" fill="black" r="7.2" stroke="#62FFF6" strokeWidth="1.848" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="content-stretch flex flex-col gap-[4px] items-center w-full">
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Destroy TWO of the opponent's basic ships.
                </p>
                <p className="font-['Inter'] font-normal leading-[20px] text-[15px] text-center text-white w-full">
                  Deal 4 damage.
                </p>
              </div>
            </div>
          </div>

        </div>
      </ActionPanelScrollArea>
      
      {/* Single hover card rendered via portal (only for Basic Ships on left) */}
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