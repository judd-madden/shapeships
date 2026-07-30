import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import type { ActionPanelViewModel, GameSessionActions } from '../../../client/useGameSession';
import type { SpeciesId } from '../../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import {
  ANCIENT_CATALOGUE_CANVAS_BY_LAYOUT,
  ANCIENT_CATALOGUE_SECTION_X,
  AncientShipCataloguePanel,
} from '../../actionPanel/panels/catalogue/ancient/AncientShipCataloguePanel';
import { CentaurShipCataloguePanel } from '../../actionPanel/panels/catalogue/centaur/CentaurShipCataloguePanel';
import { HumanShipCataloguePanel } from '../../actionPanel/panels/catalogue/human/HumanShipCataloguePanel';
import { XeniteShipCataloguePanel } from '../../actionPanel/panels/catalogue/xenite/XeniteShipCataloguePanel';
import { usePrefersReducedMotion } from '../../shared/usePrefersReducedMotion';
import {
  MOBILE_CATALOGUE_SCALE,
  MobileScaledCatalogueCanvas,
} from './MobileScaledCatalogueCanvas';

interface MobileCatalogueScrollerProps {
  vm: ActionPanelViewModel;
  actions: GameSessionActions;
  onShipInspect?: (shipId: ShipDefId) => void;
  onOpenAutocastInfo?: () => void;
  simulacrumSpecies?: SpeciesId;
}

const MOBILE_CATALOGUE_CANVASES = {
  human: { width: 1446, height: 258 },
  xenite: { width: 1446, height: 258 },
  centaur: { width: 1446, height: 258 },
} as const;

const ANCHOR_ANIMATION_DURATION_MS = 200;

type AncientPhasePresentation = 'build' | 'battle-build-side' | 'solar-side';

interface PreviousAncientAnchorState {
  isAncientActive: boolean;
  phasePresentation: AncientPhasePresentation;
  declarationStage: 'charges' | 'powers' | undefined;
  hadChargeStage: boolean | undefined;
}

function getAncientPhasePresentation(
  phaseKey: string,
  declarationStage: 'charges' | 'powers' | undefined
): AncientPhasePresentation {
  if (!phaseKey.startsWith('battle.')) {
    return 'build';
  }

  if (
    phaseKey === 'battle.reveal' ||
    (phaseKey === 'battle.charge_declaration' && declarationStage !== 'powers')
  ) {
    return 'battle-build-side';
  }

  return 'solar-side';
}

export function MobileCatalogueScroller({
  vm,
  actions,
  onShipInspect,
  onOpenAutocastInfo,
  simulacrumSpecies,
}: MobileCatalogueScrollerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTargetRef = useRef<number | null>(null);
  const previousAnchorStateRef = useRef<PreviousAncientAnchorState | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const declarationVm = vm.ancientChargeDeclaration;
  const isAncientCatalogueActive =
    vm.activePanelId === 'ap.catalog.ships.ancient' ||
    vm.activePanelId === 'ap.battle.solar_powers.ancient';
  const isAncientPowersPresentation =
    vm.menu.phaseKey === 'battle.charge_declaration' &&
    declarationVm?.stage === 'powers';
  const declarationBlocked =
    declarationVm?.attemptUnresolved === true ||
    declarationVm?.rejectionRecoveryPending === true;
  const phasePresentation = getAncientPhasePresentation(
    vm.menu.phaseKey,
    declarationVm?.stage
  );
  const basicTarget =
    ANCIENT_CATALOGUE_SECTION_X.basics * MOBILE_CATALOGUE_SCALE;
  const solarTarget =
    ANCIENT_CATALOGUE_SECTION_X.solar * MOBILE_CATALOGUE_SCALE;

  const clampTarget = useCallback((element: HTMLDivElement, target: number) => {
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    return Math.max(0, Math.min(target, maxScrollLeft));
  }, []);

  const cancelAnchorAnimation = useCallback(
    (finishAtTarget = false) => {
      const animationTarget = animationTargetRef.current;

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      animationTargetRef.current = null;

      if (finishAtTarget && animationTarget !== null && scrollAreaRef.current) {
        scrollAreaRef.current.scrollLeft = clampTarget(
          scrollAreaRef.current,
          animationTarget
        );
      }
    },
    [clampTarget]
  );

  const setAnchorImmediately = useCallback(
    (target: number) => {
      cancelAnchorAnimation();

      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollLeft = clampTarget(scrollAreaRef.current, target);
      }
    },
    [cancelAnchorAnimation, clampTarget]
  );

  const animateToAnchor = useCallback(
    (target: number) => {
      const element = scrollAreaRef.current;
      if (!element) {
        return;
      }

      if (prefersReducedMotion) {
        setAnchorImmediately(target);
        return;
      }

      cancelAnchorAnimation();

      const startScrollLeft = element.scrollLeft;
      const clampedTarget = clampTarget(element, target);
      if (startScrollLeft === clampedTarget) {
        element.scrollLeft = clampedTarget;
        return;
      }

      let startTime: number | null = null;
      animationTargetRef.current = target;

      const step = (timestamp: number) => {
        if (startTime === null) {
          startTime = timestamp;
        }

        const progress = Math.min(
          1,
          (timestamp - startTime) / ANCHOR_ANIMATION_DURATION_MS
        );
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        element.scrollLeft =
          startScrollLeft + (clampedTarget - startScrollLeft) * easedProgress;

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
          return;
        }

        element.scrollLeft = clampedTarget;
        animationFrameRef.current = null;
        animationTargetRef.current = null;
      };

      animationFrameRef.current = requestAnimationFrame(step);
    },
    [
      cancelAnchorAnimation,
      clampTarget,
      prefersReducedMotion,
      setAnchorImmediately,
    ]
  );

  useLayoutEffect(() => {
    const previous = previousAnchorStateRef.current;
    const current: PreviousAncientAnchorState = {
      isAncientActive: isAncientCatalogueActive,
      phasePresentation,
      declarationStage: declarationVm?.stage,
      hadChargeStage: declarationVm?.hadChargeStage,
    };

    if (prefersReducedMotion && animationFrameRef.current !== null) {
      cancelAnchorAnimation(true);
    }

    if (!isAncientCatalogueActive) {
      if (previous?.isAncientActive) {
        cancelAnchorAnimation();
      }
      previousAnchorStateRef.current = current;
      return;
    }

    if (!previous?.isAncientActive) {
      setAnchorImmediately(
        phasePresentation === 'solar-side' ? solarTarget : basicTarget
      );
      previousAnchorStateRef.current = current;
      return;
    }

    const isRetainedBattleToBuild =
      phasePresentation === 'build' &&
      previous.phasePresentation !== 'build';
    const isRetainedNoActionsPowersTransition =
      vm.menu.phaseKey === 'battle.charge_declaration' &&
      declarationVm?.stage === 'powers' &&
      declarationVm.hadChargeStage !== true &&
      previous.declarationStage !== 'powers' &&
      previous.phasePresentation !== 'solar-side';

    if (isRetainedBattleToBuild) {
      animateToAnchor(basicTarget);
    } else if (isRetainedNoActionsPowersTransition) {
      animateToAnchor(solarTarget);
    } else if (phasePresentation !== previous.phasePresentation) {
      setAnchorImmediately(
        phasePresentation === 'solar-side' ? solarTarget : basicTarget
      );
    } else if (
      vm.menu.phaseKey === 'battle.charge_declaration' &&
      declarationVm?.stage === 'powers' &&
      declarationVm.hadChargeStage === true &&
      (
        previous.declarationStage !== 'powers' ||
        previous.hadChargeStage !== true
      )
    ) {
      setAnchorImmediately(solarTarget);
    }

    previousAnchorStateRef.current = current;
  }, [
    animateToAnchor,
    basicTarget,
    cancelAnchorAnimation,
    declarationVm?.hadChargeStage,
    declarationVm?.stage,
    isAncientCatalogueActive,
    phasePresentation,
    prefersReducedMotion,
    setAnchorImmediately,
    solarTarget,
    vm.menu.phaseKey,
  ]);

  useEffect(
    () => () => cancelAnchorAnimation(),
    [cancelAnchorAnimation]
  );

  const commonProps = {
    actions,
    buildCatalogue: vm.buildCatalogue,
    frame: 'bare' as const,
    hoverDisabled: true,
    interactionDisabled: true,
    onShipInspect,
  };
  const longCatalogueProps = {
    ...commonProps,
    catalogueLayout: 'long' as const,
  };

  const catalogue =
    vm.activePanelId === 'ap.catalog.ships.human' ? (
      <MobileScaledCatalogueCanvas {...MOBILE_CATALOGUE_CANVASES.human}>
        <HumanShipCataloguePanel {...longCatalogueProps} />
      </MobileScaledCatalogueCanvas>
    ) : vm.activePanelId === 'ap.catalog.ships.xenite' ? (
      <MobileScaledCatalogueCanvas {...MOBILE_CATALOGUE_CANVASES.xenite}>
        <XeniteShipCataloguePanel {...longCatalogueProps} />
      </MobileScaledCatalogueCanvas>
    ) : vm.activePanelId === 'ap.catalog.ships.centaur' ? (
      <MobileScaledCatalogueCanvas {...MOBILE_CATALOGUE_CANVASES.centaur}>
        <CentaurShipCataloguePanel {...longCatalogueProps} />
      </MobileScaledCatalogueCanvas>
    ) : isAncientCatalogueActive ? (
      <MobileScaledCatalogueCanvas {...ANCIENT_CATALOGUE_CANVAS_BY_LAYOUT.standard}>
        <AncientShipCataloguePanel
          {...commonProps}
          catalogueLayout="standard"
          simulacrumSpecies={simulacrumSpecies}
          presentation={isAncientPowersPresentation ? 'declaration' : 'reference'}
          catalogueEnergy={vm.ancientCatalogueEnergy}
          declarationEnergy={declarationVm?.provisionalEnergy}
          declarationEnergyCapacity={declarationVm?.provisionalEnergyCapacity}
          declarationStage={declarationVm?.stage}
          canCastManualSolarPowerById={declarationVm?.canCastManualSolarPowerById}
          solarHoverValuesById={declarationVm?.solarHoverValuesById}
          selectorMode={declarationVm?.selectorMode}
          siphonSelector={declarationVm?.siphonSelector}
          simulacrumSelector={declarationVm?.simulacrumSelector}
          blackHoleSelector={declarationVm?.blackHoleSelector}
          autocastEnabled={declarationVm?.autocastEnabled ?? vm.ancientAutocastEnabled}
          autocastDisabled={declarationBlocked}
          autocastPresentation="mobile-under-heading"
          autocastInfoPresentation="mobile-modal"
          onOpenAutocastInfo={onOpenAutocastInfo}
          declarationAttemptUnresolved={declarationVm?.attemptUnresolved === true}
          declarationBlocked={declarationBlocked}
        />
      </MobileScaledCatalogueCanvas>
    ) : null;

  return (
    <div
      ref={scrollAreaRef}
      className="h-full w-full overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x"
      onPointerDown={() => cancelAnchorAnimation()}
      onTouchStart={() => cancelAnchorAnimation()}
      onWheel={() => cancelAnchorAnimation()}
    >
      <div className="flex h-full min-w-max items-start px-[14px] pt-[9px]">
        <div>{catalogue}</div>
      </div>
    </div>
  );
}
