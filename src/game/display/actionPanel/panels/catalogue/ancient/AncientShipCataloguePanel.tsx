/**
 * Ancient Ship Catalogue Panel
 *
 * LEFT SIDE: Ancient Basic Ships (clickable, full wiring)
 * RIGHT SIDE: Ancient Solar Powers (reference display and declaration controls)
 *
 * Pattern cloned from CentaurShipCataloguePanel.tsx
 * NO backend calls, NO rules validation, NO engine imports
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react';
import * as ReactDOM from 'react-dom';
import type { ActionPanelViewModel, GameSessionActions } from "../../../../../client/useGameSession";
import type { SpeciesId } from '../../../../../../components/ui/primitives/buttons/SpeciesCardButton';
import { InfoIcon } from '../../../../../../components/ui/primitives';
import { ActionPanelScrollArea } from "../../../primitives/ActionPanelScrollArea";
import { CatalogueShipSlot } from "../shared/CatalogueShipSlot";
import { CatalogueCostNumber } from "../shared/CatalogueCostNumber";
import {
  ShipHoverCard,
  type ShipHoverActionHint,
} from "../shared/ShipHoverCard";
import { useShipCatalogueHover } from "../shared/useShipCatalogueHover";
import {
  getShipEligibilityForHover,
  shouldDimCatalogueShip,
  shouldEnableCatalogueGraphicHover,
  type ShipEligibility,
} from "../shared/ShipBuildEligibility";
import type { ShipDefId } from "../../../../../types/ShipTypes.engine";
import {
  Asteroid,
  BlackHole,
  Convert,
  Life,
  MercuryCore,
  PlutoCore,
  QuantumMystic,
  Spiral,
  NeptuneCore,
  SolarReserve4,
  Cube,
  SimulacrumAncient,
  SimulacrumCentaur,
  SimulacrumHuman,
  SimulacrumXenite,
  Siphon,
  StarBirth,
  Supernova,
  Vortex,
} from "../../../../../../graphics/ancient/assets";
import {
  AncientEnergyDisplay,
  type AncientEnergyCostRow,
  type AncientEnergySpendPreview,
} from './AncientEnergyDisplay';
import { AncientSolarPowerSlot } from './AncientSolarPowerSlot';
import { AncientBlackHoleSelector } from './AncientBlackHoleSelector';
import { AncientSimulacrumSelector } from './AncientSimulacrumSelector';
import { AncientSiphonSelector } from './AncientSiphonSelector';
import { AncientAutocastInfoContent } from './AncientAutocastInfoContent';
import { HoverPanelFrame } from '../../../../shared/HoverPanelFrame';
import {
  useHoverPanelPresence,
  type HoverPanelMotionState,
} from '../../../../shared/useHoverPanelPresence';
import {
  isFixedAncientManualSolarPowerId,
  type AncientEnergyPool,
  type AncientSolarSelectorMode,
  type FixedAncientManualSolarPowerId,
  type ImplementedAncientManualSolarPowerId,
} from '../../../../../client/gameSession/ancient/ancientChargeDeclaration';
import { ANCIENT_SIPHON_MINIMUM_SPEND } from '../../../../../data/ancientSiphonRules';

type CatalogueFrame = 'desktop' | 'bare';
type CatalogueLayout = 'standard' | 'long';

export const ANCIENT_CATALOGUE_CANVAS_BY_LAYOUT = {
  standard: { width: 1210, height: 258 },
  long: { width: 1446, height: 258 },
} as const;

export const ANCIENT_CATALOGUE_SECTION_X = {
  basics: 0,
  solar: 427,
} as const;

export const ANCIENT_ENERGY_HEADER_POSITION_BY_LAYOUT = {
  standard: { x: 635, y: 0 },
  long: { x: 682, y: 0 },
} as const;

const ZERO_ANCIENT_ENERGY_POOL: AncientEnergyPool = { green: 0, red: 0, blue: 0 };
const REFERENCE_ANCIENT_CATALOGUE_ENERGY: NonNullable<
  ActionPanelViewModel['ancientCatalogueEnergy']
> = {
  mode: 'reference',
  pool: ZERO_ANCIENT_ENERGY_POOL,
  capacity: ZERO_ANCIENT_ENERGY_POOL,
};

interface SolarPosition {
  x: number;
  y: number;
}

interface SolarPowerSlotConfig {
  id: ShipDefId;
  graphic: ComponentType<{ className?: string }>;
  costRows: readonly AncientEnergyCostRow[];
  costPlacement?: 'right' | 'below';
  showPlus?: boolean;
  position: Record<CatalogueLayout, SolarPosition>;
}

const SOLAR_POWER_SLOTS = [
  {
    id: 'SLIF',
    graphic: Life,
    costRows: [{ color: 'green', count: 1 }],
    position: { standard: { x: 474, y: 69 }, long: { x: 507, y: 69 } },
  },
  {
    id: 'SSTA',
    graphic: StarBirth,
    costRows: [{ color: 'green', count: 3 }],
    position: { standard: { x: 443, y: 166 }, long: { x: 476, y: 166 } },
  },
  {
    id: 'SAST',
    graphic: Asteroid,
    costRows: [{ color: 'red', count: 1 }],
    position: { standard: { x: 640, y: 64 }, long: { x: 703, y: 64 } },
  },
  {
    id: 'SSUP',
    graphic: Supernova,
    costRows: [{ color: 'red', count: 3 }],
    position: { standard: { x: 609, y: 162 }, long: { x: 672, y: 162 } },
  },
  {
    id: 'SCON',
    graphic: Convert,
    costRows: [{ color: 'cyan', count: 1 }],
    position: { standard: { x: 803, y: 64 }, long: { x: 896, y: 64 } },
  },
  {
    id: 'SSIP',
    graphic: Siphon,
    costRows: [
      { color: 'green', count: ANCIENT_SIPHON_MINIMUM_SPEND },
      { color: 'red', count: ANCIENT_SIPHON_MINIMUM_SPEND },
    ],
    showPlus: true,
    position: { standard: { x: 919, y: 52 }, long: { x: 1047, y: 52 } },
  },
  {
    id: 'SSIM',
    graphic: SimulacrumHuman,
    costRows: [{ color: 'cyan', count: 2 }],
    showPlus: true,
    position: { standard: { x: 777, y: 165 }, long: { x: 870, y: 165 } },
  },
  {
    id: 'SVOR',
    graphic: Vortex,
    costRows: [
      { color: 'green', count: 2 },
      { color: 'red', count: 2 },
      { color: 'cyan', count: 2 },
    ],
    position: { standard: { x: 936, y: 164 }, long: { x: 1064, y: 164 } },
  },
  {
    id: 'SBLA',
    graphic: BlackHole,
    costRows: [
      { color: 'green', count: 4 },
      { color: 'red', count: 4 },
      { color: 'cyan', count: 4 },
    ],
    costPlacement: 'below',
    position: { standard: { x: 1098, y: 62 }, long: { x: 1263, y: 62 } },
  },
] as const satisfies readonly SolarPowerSlotConfig[];

const SOLAR_POWER_IDS = new Set<ShipDefId>(SOLAR_POWER_SLOTS.map((slot) => slot.id));
const BLACK_HOLE_SOLAR_SLOT = SOLAR_POWER_SLOTS.find((slot) => slot.id === 'SBLA');

function buildEnergySpendPreview(
  costRows: readonly AncientEnergyCostRow[]
): AncientEnergySpendPreview {
  return costRows.reduce<AncientEnergySpendPreview>(
    (preview, row) => {
      const color = row.color === 'cyan' ? 'blue' : row.color;
      preview[color] += row.count;
      return preview;
    },
    { green: 0, red: 0, blue: 0 }
  );
}

const MANUAL_SOLAR_POWER_LABEL_BY_ID: Record<FixedAncientManualSolarPowerId, string> = {
  SLIF: 'Life',
  SSTA: 'Star Birth',
  SAST: 'Asteroid',
  SSUP: 'Supernova',
  SCON: 'Convert',
  SVOR: 'Vortex',
};
const SOLAR_POWER_LABEL_BY_ID: Record<ImplementedAncientManualSolarPowerId, string> = {
  ...MANUAL_SOLAR_POWER_LABEL_BY_ID,
  SSIP: 'Siphon',
  SSIM: 'Simulacrum',
  SBLA: 'Black Hole',
};
const SOLAR_HEADER_POSITIONS: Record<
  CatalogueLayout,
  SolarPosition
> = {
  standard: { x: 1079, y: 0 },
  long: { x: 1245, y: 0 },
};

const BLACK_HOLE_SELECTOR_LAYOUT: Record<
  CatalogueLayout,
  { x: number; y: number; gap: number }
> = {
  standard: { x: 436, y: 70, gap: 30 },
  long: { x: 484, y: 70, gap: 40 },
};

const SIPHON_SELECTOR_X: Record<CatalogueLayout, number> = {
  standard: 436,
  long: 450,
};

const SIMULACRUM_GRAPHICS: Record<SpeciesId, ComponentType<{ className?: string }>> = {
  human: SimulacrumHuman,
  xenite: SimulacrumXenite,
  centaur: SimulacrumCentaur,
  ancient: SimulacrumAncient,
};

interface AncientShipCataloguePanelProps {
  actions: GameSessionActions;
  buildCatalogue: ActionPanelViewModel['buildCatalogue'];
  frame?: CatalogueFrame;
  catalogueLayout?: CatalogueLayout;
  hoverDisabled?: boolean;
  interactionDisabled?: boolean;
  onShipInspect?: (shipId: ShipDefId) => void;
  onSolarPowerInspect?: (solarPowerId: ImplementedAncientManualSolarPowerId) => void;
  siphonInspectionOpen?: boolean;
  siphonHorizontalScrollOwner?: 'self' | 'ancestor';
  onOpenSiphonInspection?: () => void;
  onCloseSiphonInspection?: () => void;
  simulacrumSpecies?: SpeciesId;
  presentation?: 'reference' | 'declaration';
  catalogueEnergy?: ActionPanelViewModel['ancientCatalogueEnergy'];
  declarationEnergy?: AncientEnergyPool;
  declarationEnergyCapacity?: AncientEnergyPool;
  declarationStage?: 'charges' | 'powers';
  canCastManualSolarPowerById?: Partial<Record<FixedAncientManualSolarPowerId, boolean>>;
  solarHoverValuesById?: NonNullable<
    ActionPanelViewModel['ancientChargeDeclaration']
  >['solarHoverValuesById'];
  selectorMode?: AncientSolarSelectorMode | null;
  siphonSelector?: {
    maxSpend: number;
    canOpen: boolean;
  };
  simulacrumSelector?: {
    canOpen: boolean;
    blueAvailable: number;
    hoveredPreviewBlueCost: number | null;
  };
  blackHoleSelector?: {
    canOpen: boolean;
    requiredTargetCount: number;
    selectedTargetCount: number;
    damagePreview: number;
  };
  autocastEnabled: boolean;
  autocastDisabled?: boolean;
  autocastPresentation?: 'default' | 'mobile-under-heading';
  autocastInfoPresentation?: 'tooltip' | 'mobile-modal';
  onOpenAutocastInfo?: () => void;
  declarationAttemptUnresolved?: boolean;
  declarationBlocked?: boolean;
}

interface AncientAutocastControlProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
  infoPresentation?: 'tooltip' | 'mobile-modal';
  onOpenInfo?: () => void;
  className?: string;
  style?: CSSProperties;
}

const AUTOCAST_INFO_VIEWPORT_PADDING_PX = 40;
const AUTOCAST_INFO_GAP_PX = 10;
const AUTOCAST_INFO_TAIL_PROTRUSION_PX = 12 / Math.sqrt(2);
const AUTOCAST_INFO_MIN_TAIL_INSET_PX = 12;

function AncientAutocastHoverInfo({
  anchorRect,
  motionState,
  tooltipId,
}: {
  anchorRect: DOMRect;
  motionState: HoverPanelMotionState | null;
  tooltipId: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const anchorCenterX = anchorRect.left + (anchorRect.width / 2);
  const [position, setPosition] = useState<{
    left: number;
    tailOffset: number | string;
    alignRight: boolean;
  }>({ left: anchorRect.right + 10, tailOffset: 'calc(100% - 22px)', alignRight: true });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const card = cardRef.current;
      if (!card) {
        return;
      }

      const cardWidth = card.getBoundingClientRect().width;
      const desiredLeft = anchorRect.right + 10 - cardWidth;
      const maxLeft = Math.max(
        AUTOCAST_INFO_VIEWPORT_PADDING_PX,
        window.innerWidth - AUTOCAST_INFO_VIEWPORT_PADDING_PX - cardWidth
      );
      const cardLeft = Math.min(
        maxLeft,
        Math.max(AUTOCAST_INFO_VIEWPORT_PADDING_PX, desiredLeft)
      );
      const maxTailOffset = Math.max(
        AUTOCAST_INFO_MIN_TAIL_INSET_PX,
        cardWidth - AUTOCAST_INFO_MIN_TAIL_INSET_PX
      );
      const tailOffset = Math.min(
        maxTailOffset,
        Math.max(AUTOCAST_INFO_MIN_TAIL_INSET_PX, anchorCenterX - cardLeft)
      );

      setPosition({ left: cardLeft, tailOffset, alignRight: false });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [anchorCenterX, anchorRect.right]);

  const portalTarget = document.getElementById('ship-hover-layer');
  if (!portalTarget) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${position.left}px`,
        top: `${anchorRect.top - AUTOCAST_INFO_GAP_PX - AUTOCAST_INFO_TAIL_PROTRUSION_PX}px`,
        transform: position.alignRight ? 'translate(-100%, -100%)' : 'translateY(-100%)',
      }}
    >
      <HoverPanelFrame
        ref={cardRef}
        id={tooltipId}
        role="tooltip"
        placement="top"
        motionDirection="top"
        motionState={motionState}
        tailOffset={position.tailOffset}
        className="box-content w-[300px] max-w-[calc(100vw-80px)] px-[24px] pb-[32px] pt-[24px] text-[16px] font-normal leading-[19px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      >
        <AncientAutocastInfoContent />
      </HoverPanelFrame>
    </div>,
    portalTarget
  );
}

export function AncientAutocastControl({
  checked,
  disabled = false,
  onChange,
  infoPresentation = 'tooltip',
  onOpenInfo,
  className = '',
  style,
}: AncientAutocastControlProps) {
  const isMobileModalInfo = infoPresentation === 'mobile-modal';
  const isInfoHoveredRef = useRef(false);
  const isInfoFocusedRef = useRef(false);
  const infoTooltipId = useId();
  const [activeInfoAnchor, setActiveInfoAnchor] = useState<DOMRect | null>(null);
  const { presentValue: presentInfoAnchor, motionState: infoMotionState } =
    useHoverPanelPresence(activeInfoAnchor);
  const infoButton = (
    <button
      type="button"
      aria-label="About Autocast"
      aria-describedby={!isMobileModalInfo && presentInfoAnchor ? infoTooltipId : undefined}
      onClick={isMobileModalInfo ? onOpenInfo : undefined}
      onPointerEnter={
        isMobileModalInfo
          ? undefined
          : (event) => {
              isInfoHoveredRef.current = true;
              setActiveInfoAnchor(event.currentTarget.getBoundingClientRect());
            }
      }
      onPointerLeave={
        isMobileModalInfo
          ? undefined
          : () => {
              isInfoHoveredRef.current = false;
              if (!isInfoFocusedRef.current) {
                setActiveInfoAnchor(null);
              }
            }
      }
      onFocus={
        isMobileModalInfo
          ? undefined
          : (event) => {
              isInfoFocusedRef.current = true;
              setActiveInfoAnchor(event.currentTarget.getBoundingClientRect());
            }
      }
      onBlur={
        isMobileModalInfo
          ? undefined
          : () => {
              isInfoFocusedRef.current = false;
              if (!isInfoHoveredRef.current) {
                setActiveInfoAnchor(null);
              }
            }
      }
      className={`flex shrink-0 items-center justify-center opacity-50 transition-opacity duration-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        isMobileModalInfo ? 'size-[40px]' : 'size-[32px]'
      }`}
    >
      <InfoIcon className="size-[32px]" />
    </button>
  );

  return (
    <div
      className={`flex items-center ${isMobileModalInfo ? 'gap-[4px]' : 'gap-[2px]'} ${className}`}
      style={style}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex items-center gap-[2px] text-[18px] font-bold leading-none text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-default disabled:opacity-40 ${
          isMobileModalInfo ? 'h-[40px]' : 'h-[24px]'
        }`}
      >
        <svg
          aria-hidden="true"
          className="size-[24px] shrink-0"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 30 30"
        >
          {checked ? (
            <path
              d="M23.75 3.41675H6.25C4.8625 3.41675 3.75 4.54175 3.75 5.91675V23.4167C3.75 24.7917 4.8625 25.9167 6.25 25.9167H23.75C25.1375 25.9167 26.25 24.7917 26.25 23.4167V5.91675C26.25 4.54175 25.1375 3.41675 23.75 3.41675ZM12.5 20.9167L6.25 14.6667L8.0125 12.9042L12.5 17.3792L21.9875 7.89175L23.75 9.66675L12.5 20.9167Z"
              fill="white"
            />
          ) : (
            <path
              d="M23.75 6.25V23.75H6.25V6.25H23.75ZM23.75 3.75H6.25C4.875 3.75 3.75 4.875 3.75 6.25V23.75C3.75 25.125 4.875 26.25 6.25 26.25H23.75C25.125 26.25 26.25 25.125 26.25 23.75V6.25C26.25 4.875 25.125 3.75 23.75 3.75Z"
              fill="white"
            />
          )}
        </svg>
        <span>Autocast</span>
      </button>
      {infoButton}
      {!isMobileModalInfo && presentInfoAnchor ? (
        <AncientAutocastHoverInfo
          anchorRect={presentInfoAnchor}
          motionState={infoMotionState}
          tooltipId={infoTooltipId}
        />
      ) : null}
    </div>
  );
}

export function AncientShipCataloguePanel({
  actions,
  buildCatalogue,
  frame = 'desktop',
  catalogueLayout = 'standard',
  hoverDisabled,
  interactionDisabled = false,
  onShipInspect,
  onSolarPowerInspect,
  siphonInspectionOpen = false,
  siphonHorizontalScrollOwner = 'self',
  onOpenSiphonInspection,
  onCloseSiphonInspection,
  simulacrumSpecies = 'human',
  presentation = 'reference',
  catalogueEnergy,
  declarationEnergy,
  declarationEnergyCapacity,
  declarationStage,
  canCastManualSolarPowerById,
  solarHoverValuesById,
  selectorMode = null,
  siphonSelector,
  simulacrumSelector,
  blackHoleSelector,
  autocastEnabled,
  autocastDisabled = false,
  autocastPresentation = 'default',
  autocastInfoPresentation = 'tooltip',
  onOpenAutocastInfo,
  declarationAttemptUnresolved = false,
  declarationBlocked = false,
}: AncientShipCataloguePanelProps) {
  const hover = useShipCatalogueHover(hoverDisabled);
  const [hoveredSiphonSpend, setHoveredSiphonSpend] = useState<number | null>(null);
  const isBuildableContext = buildCatalogue.context === 'buildable';
  const canvas = ANCIENT_CATALOGUE_CANVAS_BY_LAYOUT[catalogueLayout];
  const solarHeaderPositions = SOLAR_HEADER_POSITIONS[catalogueLayout];
  const energyHeaderPosition = ANCIENT_ENERGY_HEADER_POSITION_BY_LAYOUT[catalogueLayout];
  const SimulacrumGraphic = SIMULACRUM_GRAPHICS[simulacrumSpecies] ?? SimulacrumHuman;
  const isDeclarationPresentation = presentation === 'declaration';
  const isLiveCatalogue =
    isDeclarationPresentation || buildCatalogue.context !== 'reference_only';
  const isDeclarationBlocked =
    declarationAttemptUnresolved || declarationBlocked;
  const isActiveResolvedPowersStage =
    isDeclarationPresentation &&
    declarationStage === 'powers' &&
    !isDeclarationBlocked;
  const effectiveSelectorMode =
    selectorMode ?? (siphonInspectionOpen ? 'siphon' : null);
  const selectorOpen = effectiveSelectorMode !== null;
  const isSiphonInspection =
    selectorMode == null && siphonInspectionOpen;
  const showReferenceSiphonBack =
    effectiveSelectorMode === 'siphon' &&
    selectorMode !== 'siphon' &&
    isSiphonInspection &&
    presentation === 'reference' &&
    onCloseSiphonInspection != null;
  const showBlackHoleBack =
    effectiveSelectorMode === 'blackHole' &&
    selectorMode === 'blackHole' &&
    presentation === 'declaration';
  const siphonInstructionLeft = showReferenceSiphonBack
    ? 510
    : ANCIENT_CATALOGUE_SECTION_X.solar;
  const siphonInstruction =
    effectiveSelectorMode !== 'siphon'
      ? null
      : selectorMode === 'siphon'
        ? {
            text: 'Choose the amount of Energy you want to spend on Siphon:',
            muted: false,
          }
        : isDeclarationPresentation &&
            isSiphonInspection &&
            !isDeclarationBlocked &&
            siphonSelector?.canOpen !== true &&
            declarationEnergy != null &&
            Math.min(declarationEnergy.green, declarationEnergy.red) <
              ANCIENT_SIPHON_MINIMUM_SPEND
          ? {
              text: 'Siphon scales with Energy used. Not enough Energy to cast.',
              muted: true,
            }
          : {
              text: 'Siphon scales with Energy used.',
              muted: false,
            };
  const canOpenSiphonSelector =
    isActiveResolvedPowersStage &&
    siphonSelector?.canOpen === true;
  const canOpenBlackHoleSelector =
    isActiveResolvedPowersStage &&
    blackHoleSelector?.canOpen === true;
  const canOpenSimulacrumSelector =
    isActiveResolvedPowersStage &&
    simulacrumSelector?.canOpen === true &&
    !selectorOpen;
  const isAutocastDisabled = autocastDisabled;
  const shouldShowAutocast =
    autocastPresentation !== 'mobile-under-heading' || !selectorOpen;
  const autocastPosition =
    autocastPresentation === 'mobile-under-heading'
      ? { x: ANCIENT_CATALOGUE_SECTION_X.solar, y: 25 }
      : solarHeaderPositions;
  const siphonSelectorX = SIPHON_SELECTOR_X[catalogueLayout];
  const blackHoleSelectorLayout = BLACK_HOLE_SELECTOR_LAYOUT[catalogueLayout];
  const handleHoveredSiphonSpendChange = useCallback((spend: number | null) => {
    setHoveredSiphonSpend(spend);
  }, []);

  useEffect(() => {
    if (
      selectorMode !== 'siphon' ||
      declarationStage !== 'powers' ||
      isDeclarationBlocked
    ) {
      setHoveredSiphonSpend(null);
    }
  }, [isDeclarationBlocked, declarationStage, selectorMode]);

  useEffect(
    () => () => setHoveredSiphonSpend(null),
    []
  );

  function getSlotProps(shipId: ShipDefId) {
    const canAddShip = buildCatalogue.canAddShipById[shipId] === true;
    const isDimmed =
      isDeclarationPresentation ||
      shouldDimCatalogueShip({
        context: buildCatalogue.context,
        canAddShip,
      });
    const enableGraphicHover = shouldEnableCatalogueGraphicHover({
      context: buildCatalogue.context,
      canAddShip,
      hoverDisabled,
    });

    if (onShipInspect) {
      return {
        isDimmed,
        isClickable: true,
        enableGraphicHover,
        catalogueChallengeIndicator: buildCatalogue.catalogueChallengeIndicator,
        onClick: () => onShipInspect(shipId),
      };
    }

    if (interactionDisabled) {
      return {
        isDimmed,
        isClickable: false,
        enableGraphicHover,
        catalogueChallengeIndicator: buildCatalogue.catalogueChallengeIndicator,
      };
    }

    return {
      isDimmed,
      isClickable: isBuildableContext && canAddShip,
      enableGraphicHover,
      catalogueChallengeIndicator: buildCatalogue.catalogueChallengeIndicator,
      onClick: () => actions.onBuildShip(shipId),
    };
  }

  function getDisplayCost(shipId: ShipDefId, fallbackCost: number): number {
    return isBuildableContext
      ? (buildCatalogue.displayCostByShipId[shipId] ?? fallbackCost)
      : fallbackCost;
  }

  const hoveredShipIsSolar = hover.presentState.activeShipId
    ? SOLAR_POWER_IDS.has(hover.presentState.activeShipId)
    : false;
  const hoveredShipEligibility: ShipEligibility | null = hover.presentState.activeShipId
    ? hoveredShipIsSolar
      ? { state: 'REFERENCE_ONLY' }
      : getShipEligibilityForHover({
          shipId: hover.presentState.activeShipId,
          buildCatalogue,
        })
    : null;
  const hoveredSolarHeadingValue =
    hover.presentState.activeShipId && hoveredShipIsSolar
      ? solarHoverValuesById?.[hover.presentState.activeShipId]
      : undefined;
  const hoveredSolarPowerId =
    hover.presentState.activeShipId && hoveredShipIsSolar
      ? hover.presentState.activeShipId
      : null;
  const hoveredSolarActionHint: Exclude<ShipHoverActionHint, 'build'> | undefined = (() => {
    if (!hoveredSolarPowerId || selectorOpen || isDeclarationBlocked) {
      return undefined;
    }

    if (isFixedAncientManualSolarPowerId(hoveredSolarPowerId)) {
      return isActiveResolvedPowersStage &&
        canCastManualSolarPowerById?.[hoveredSolarPowerId] === true
        ? 'cast'
        : undefined;
    }

    if (hoveredSolarPowerId === 'SSIP') {
      const canInspectSiphon =
        onOpenSiphonInspection != null &&
        (isActiveResolvedPowersStage || !isDeclarationPresentation);

      return canOpenSiphonSelector || canInspectSiphon
        ? 'view'
        : undefined;
    }

    if (hoveredSolarPowerId === 'SSIM') {
      return isActiveResolvedPowersStage && canOpenSimulacrumSelector
        ? 'view'
        : undefined;
    }

    if (hoveredSolarPowerId === 'SBLA') {
      return isActiveResolvedPowersStage && canOpenBlackHoleSelector
        ? 'view'
        : undefined;
    }

    return undefined;
  })();
  const hoveredSolarSlot = hover.state.activeShipId
    ? SOLAR_POWER_SLOTS.find((slot) => slot.id === hover.state.activeShipId)
    : undefined;
  let mainIconSpendPreview: AncientEnergySpendPreview | null = null;

  if (
    !selectorOpen &&
    isActiveResolvedPowersStage &&
    hoveredSolarSlot
  ) {
    if (hoveredSolarSlot.id === 'SSIP') {
      if (canOpenSiphonSelector && siphonSelector) {
        mainIconSpendPreview = {
          green: siphonSelector.maxSpend,
          red: siphonSelector.maxSpend,
          blue: 0,
        };
      }
    } else if (hoveredSolarSlot.id === 'SSIM') {
      mainIconSpendPreview = null;
    } else if (hoveredSolarSlot.id === 'SBLA') {
      if (canOpenBlackHoleSelector) {
        mainIconSpendPreview = buildEnergySpendPreview(hoveredSolarSlot.costRows);
      }
    } else if (
      isFixedAncientManualSolarPowerId(hoveredSolarSlot.id) &&
      canCastManualSolarPowerById?.[hoveredSolarSlot.id] === true
    ) {
      mainIconSpendPreview = buildEnergySpendPreview(hoveredSolarSlot.costRows);
    }
  }

  const spendPreview: AncientEnergySpendPreview | null =
    selectorMode === 'siphon'
      ? declarationStage !== 'powers' ||
        isDeclarationBlocked ||
        hoveredSiphonSpend === null
        ? null
        : {
            green: hoveredSiphonSpend,
            red: hoveredSiphonSpend,
            blue: 0,
          }
      : selectorMode === 'simulacrum'
        ? declarationStage !== 'powers' ||
          isDeclarationBlocked ||
          simulacrumSelector?.hoveredPreviewBlueCost == null
          ? null
          : {
              green: 0,
              red: 0,
              blue: simulacrumSelector.hoveredPreviewBlueCost,
            }
        : selectorMode === 'blackHole'
          ? !isActiveResolvedPowersStage ||
            (blackHoleSelector?.selectedTargetCount ?? 0) <= 0 ||
            BLACK_HOLE_SOLAR_SLOT == null
            ? null
            : buildEnergySpendPreview(BLACK_HOLE_SOLAR_SLOT.costRows)
        : selectorOpen
          ? null
          : mainIconSpendPreview;

  const content = (
    /* Container with exact width matching design */
    <div
      className="relative"
      style={{
        width: `${canvas.width}px`,
        minHeight: `${canvas.height}px`,
        ...(frame === 'bare' ? { height: `${canvas.height}px` } : {}),
      }}
    >

          {/* Section Titles */}
          <p
            className="absolute font-bold leading-[normal] text-[18px] text-white"
            style={{
              left: `${ANCIENT_CATALOGUE_SECTION_X.basics}px`,
              top: "0",
            }}
          >
            Ancient Basic Ships
          </p>

          <p
            className="absolute font-bold leading-[normal] text-[18px] text-white"
            style={{
              left: `${ANCIENT_CATALOGUE_SECTION_X.solar}px`,
              top: "0",
            }}
          >
            Ancient Solar Powers
          </p>

          {siphonInstruction ? (
            <p
              className={`absolute whitespace-nowrap text-[16px] font-bold leading-normal ${
                siphonInstruction.muted
                  ? 'text-[var(--shapeships-grey-50)]'
                  : 'text-white'
              }`}
              style={{
                left: `${siphonInstructionLeft}px`,
                top: '34px',
              }}
            >
              {siphonInstruction.text}
            </p>
          ) : null}

          {/* Vertical Divider */}
          <div
            className="absolute bg-[var(--shapeships-grey-70)]"
            style={{
              left: "407px",
              top: "0",
              width: "1px",
              height: `${canvas.height}px`,
            }}
          />

          {/* ================ LEFT HALF: BASIC SHIPS (CLICKABLE) ================ */}

          {/* Basic Ships Row 1 */}
          <div
            className="absolute content-stretch flex items-end justify-between"
            style={{ left: "0px", top: "25px", width: "386px" }}
          >
            {/* Pluto Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "44px" }}
              onMouseEnter={(e) =>
                hover.onEnter("PLU", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("PLU")}
            >
              <CatalogueShipSlot
                shipId="PLU"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "70px", width: "44px" }}
                  >
                    <PlutoCore />
                  </div>
                }
                {...getSlotProps("PLU")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("PLU", 3)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Mercury Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "44px" }}
              onMouseEnter={(e) =>
                hover.onEnter("MER", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("MER")}
            >
              <CatalogueShipSlot
                shipId="MER"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "85px", width: "44px" }}
                  >
                    <MercuryCore />
                  </div>
                }
                {...getSlotProps("MER")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("MER", 4)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Quantum Mystic */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "90px" }}
              onMouseEnter={(e) =>
                hover.onEnter("QUA", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("QUA")}
            >
              <CatalogueShipSlot
                shipId="QUA"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "57px", width: "90px" }}
                  >
                    <QuantumMystic />
                  </div>
                }
                {...getSlotProps("QUA")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("QUA", 5)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Spiral */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "64px" }}
              onMouseEnter={(e) =>
                hover.onEnter("SPI", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("SPI")}
            >
              <CatalogueShipSlot
                shipId="SPI"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "60px", width: "64px" }}
                  >
                    <Spiral />
                  </div>
                }
                {...getSlotProps("SPI")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("SPI", 6)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* Basic Ships Row 2 */}
          <div
            className="absolute content-stretch flex items-center justify-between px-[16px]"
            style={{
              left: "-5px",
              top: "151px",
              width: "396px",
            }}
          >
            {/* Neptune Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "70px" }}
              onMouseEnter={(e) =>
                hover.onEnter("NEP", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("NEP")}
            >
              <CatalogueShipSlot
                shipId="NEP"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "70px", width: "70px" }}
                  >
                    <NeptuneCore />
                  </div>
                }
                {...getSlotProps("NEP")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("NEP", 7)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Solar Reserve (use SolarReserve4 as default) */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "88px" }}
              onMouseEnter={(e) =>
                hover.onEnter("SOL", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("SOL")}
            >
              <CatalogueShipSlot
                shipId="SOL"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "85px", width: "88px" }}
                  >
                    <SolarReserve4 />
                  </div>
                }
                {...getSlotProps("SOL")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("SOL", 8)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Cube */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "74px" }}
              onMouseEnter={(e) =>
                hover.onEnter("CUB", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("CUB")}
            >
              <CatalogueShipSlot
                shipId="CUB"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "70px", width: "74px" }}
                  >
                    <Cube />
                  </div>
                }
                {...getSlotProps("CUB")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("CUB", 9)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* ================ RIGHT HALF: SOLAR POWERS ================ */}

          <div
            className="absolute"
            style={{
              left: energyHeaderPosition.x,
              top: energyHeaderPosition.y,
            }}
          >
            {isDeclarationPresentation ? (
              <AncientEnergyDisplay
                mode="active"
                pool={declarationEnergy ?? ZERO_ANCIENT_ENERGY_POOL}
                capacity={declarationEnergyCapacity ?? ZERO_ANCIENT_ENERGY_POOL}
                spendPreview={spendPreview}
              />
            ) : (
              <AncientEnergyDisplay {...(catalogueEnergy ?? REFERENCE_ANCIENT_CATALOGUE_ENERGY)} />
            )}
          </div>

          {shouldShowAutocast ? (
            <AncientAutocastControl
              className="absolute"
              style={{
                left: autocastPosition.x,
                top: autocastPosition.y,
              }}
              checked={autocastEnabled}
              disabled={isAutocastDisabled}
              onChange={actions.onSetAncientAutocastEnabled}
              infoPresentation={autocastInfoPresentation}
              onOpenInfo={onOpenAutocastInfo}
            />
          ) : null}

          {selectorOpen ? (
            <>
              {showReferenceSiphonBack ? (
                <button
                  type="button"
                  className="absolute cursor-pointer rounded-[10px] border-0 bg-[var(--shapeships-grey-90)] px-[16px] py-[6px] text-[16px] font-normal leading-normal text-white hover:bg-[var(--shapeships-grey-70)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                  style={{
                    left: '426px',
                    top: '30px',
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setHoveredSiphonSpend(null);
                    onCloseSiphonInspection();
                  }}
                >
                  Back
                </button>
              ) : null}
              {showBlackHoleBack ? (
                <button
                  type="button"
                  className={`absolute cursor-pointer rounded-[10px] border-0 bg-[var(--shapeships-grey-90)] px-[16px] py-[6px] text-[16px] font-normal leading-normal text-white hover:bg-[var(--shapeships-grey-70)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${
                    autocastPresentation === 'mobile-under-heading'
                      ? 'min-h-[62px] min-w-[90px]'
                      : ''
                  }`}
                  style={{
                    left: `${ANCIENT_CATALOGUE_SECTION_X.solar}px`,
                    top: autocastPresentation === 'mobile-under-heading' ? '4px' : '24px',
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.onCancelAncientSolarSelector();
                  }}
                >
                  Back
                </button>
              ) : null}
              {effectiveSelectorMode === 'siphon' ? (
                <AncientSiphonSelector
                  maxSpend={isSiphonInspection ? 0 : (siphonSelector?.maxSpend ?? 0)}
                  availableWidth={canvas.width - siphonSelectorX}
                  x={siphonSelectorX}
                  horizontalScrollOwner={siphonHorizontalScrollOwner}
                  onSelect={isSiphonInspection ? () => {} : actions.onCastAncientSiphon}
                  onHoveredSpendChange={handleHoveredSiphonSpendChange}
                />
              ) : effectiveSelectorMode === 'blackHole' ? (
                <AncientBlackHoleSelector
                  damagePreview={blackHoleSelector?.damagePreview ?? 0}
                  {...blackHoleSelectorLayout}
                />
              ) : effectiveSelectorMode === 'simulacrum' ? (
                <AncientSimulacrumSelector
                  graphic={SimulacrumGraphic}
                  blueAvailable={simulacrumSelector?.blueAvailable ?? 0}
                  layout={catalogueLayout}
                />
              ) : null}
            </>
          ) : SOLAR_POWER_SLOTS.map((slot) => {
            const position = slot.position[catalogueLayout];
            const Graphic = slot.id === 'SSIM' ? SimulacrumGraphic : slot.graphic;
            const manualSolarPowerId = isFixedAncientManualSolarPowerId(slot.id)
              ? slot.id
              : null;
            const isManualCastButton =
              isDeclarationPresentation &&
              declarationStage === 'powers' &&
              manualSolarPowerId != null;
            const canCast =
              manualSolarPowerId != null &&
              canCastManualSolarPowerById?.[manualSolarPowerId] === true;
            const isSolarUsable =
              manualSolarPowerId != null
                ? canCast
                : slot.id === 'SSIP'
                  ? canOpenSiphonSelector
                  : slot.id === 'SSIM'
                    ? canOpenSimulacrumSelector
                    : slot.id === 'SBLA'
                      ? canOpenBlackHoleSelector
                      : false;
            const isSolarDimmed =
              isLiveCatalogue &&
              (!isActiveResolvedPowersStage || !isSolarUsable);

            return (
              <div
                key={slot.id}
                className="ss-catalogueShipSlot absolute"
                data-solar-power-id={slot.id}
                data-catalogue-graphic-hover={
                  !hoverDisabled &&
                  (presentation === 'reference' ||
                    (isActiveResolvedPowersStage && isSolarUsable))
                    ? '1'
                    : undefined
                }
                style={{
                  left: position.x,
                  top: position.y,
                }}
              >
                <AncientSolarPowerSlot
                  graphic={Graphic}
                  isDimmed={isSolarDimmed}
                  costRows={slot.costRows}
                  costPlacement={
                    'costPlacement' in slot ? slot.costPlacement : undefined
                  }
                  showPlus={'showPlus' in slot && slot.showPlus}
                  onClick={
                    onSolarPowerInspect
                      ? () => {
                          hover.onLeave(slot.id);
                          onSolarPowerInspect(slot.id);
                        }
                    : isManualCastButton && manualSolarPowerId && canCast && !isDeclarationBlocked
                      ? () => actions.onCastAncientSolarPower(manualSolarPowerId)
                      : slot.id === 'SSIP'
                        ? () => {
                            hover.onLeave(slot.id);
                            if (canOpenSiphonSelector) {
                              actions.onOpenAncientSolarSelector('siphon');
                            } else {
                              onOpenSiphonInspection?.();
                            }
                          }
                      : slot.id === 'SBLA' && canOpenBlackHoleSelector
                        ? () => {
                            hover.onLeave(slot.id);
                            actions.onOpenAncientSolarSelector('blackHole');
                          }
                      : slot.id === 'SSIM' && canOpenSimulacrumSelector
                        ? () => {
                            hover.onLeave(slot.id);
                            actions.onOpenAncientSolarSelector('simulacrum');
                          }
                      : undefined
                  }
                  ariaLabel={
                    onSolarPowerInspect
                      ? `Inspect ${SOLAR_POWER_LABEL_BY_ID[slot.id]}`
                    : isManualCastButton && manualSolarPowerId
                      ? `Cast ${MANUAL_SOLAR_POWER_LABEL_BY_ID[manualSolarPowerId]}`
                      : slot.id === 'SSIP'
                        ? canOpenSiphonSelector
                          ? 'Choose Siphon Energy spend'
                          : 'Inspect Siphon damage'
                      : slot.id === 'SBLA' && canOpenBlackHoleSelector
                        ? 'Cast Black Hole'
                      : slot.id === 'SSIM' && canOpenSimulacrumSelector
                        ? 'Choose Simulacrum target'
                      : undefined
                  }
                  onMouseEnter={
                    hoverDisabled
                      ? undefined
                      : (event) => hover.onEnter(slot.id, event.currentTarget)
                  }
                  onMouseLeave={
                    hoverDisabled
                      ? undefined
                      : () => hover.onLeave(slot.id)
                  }
                />
              </div>
            );
          })}
        </div>
      );

  return (
    <>
      {frame === 'desktop' ? <ActionPanelScrollArea>{content}</ActionPanelScrollArea> : content}

      {/* Single hover card rendered via the existing shared catalogue hover path */}
      {!hoverDisabled &&
        hover.presentState.activeShipId &&
        hover.presentState.anchorRect &&
        hoveredShipEligibility && (
          <ShipHoverCard
            shipId={hover.presentState.activeShipId}
            anchorRect={hover.presentState.anchorRect}
            eligibility={hoveredShipEligibility}
            actionHint={hoveredSolarActionHint}
            motionState={hover.motionState}
            showCost={!hoveredShipIsSolar}
            headingValue={hoveredSolarHeadingValue}
            showPhaseLabel={!hoveredShipIsSolar}
            catalogueChallengeIndicator={buildCatalogue.catalogueChallengeIndicator}
          />
        )}
    </>
  );
}
