/**
 * Board Stage
 * Main game board with 3 columns: P1 Fleet | Health/Stats | P2 Fleet
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BoardViewModel, GameSessionActions } from '../../client/useGameSession';
import { ChooseSpeciesStage } from './boardModes/ChooseSpeciesStage';
import { getShipDefinitionUI } from '../../data/ShipDefinitionsUI';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { FitToBox } from './boardStage/FitToBox';
import {
  ShipAnimationWrapper,
  type ShipAnimToken,
  type TurnIncrementPulseState,
  getTargetingGlowClassName,
  getTargetingGlowStyle,
  getTargetingPreviewStyle,
  getTargetingVisualState,
  usePhaseEntryPulse,
} from '../graphics/animation';
import { useFlipLayout } from '../graphics/useFlipLayout';
import { resolveShipGraphic } from '../graphics/resolveShipGraphic';
import { FleetShipHoverCard } from './boardStage/FleetShipHoverCard';
import { useFleetShipHover } from './boardStage/useFleetShipHover';
import { BoardStatBreakdownHoverCard } from './boardStage/BoardStatBreakdownHoverCard';
import { useBoardStatHover, type BoardStatHoverKey } from './boardStage/useBoardStatHover';

interface BoardStageProps {
  vm: BoardViewModel;
  actions: GameSessionActions;
  phaseKey: string;
}

const INACTIVE_TURN_PULSE_STATE: TurnIncrementPulseState = {
  isActive: false,
  runKey: 0,
  onAnimationEnd: () => {},
};

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

function useAnimatedHealth(targetValue: number): number {
  const [displayedValue, setDisplayedValue] = useState(targetValue);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setDisplayedValue(targetValue);
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setDisplayedValue((currentValue) => {
      if (currentValue === targetValue) return currentValue;

      const direction = targetValue > currentValue ? 1 : -1;
      const distance = Math.abs(targetValue - currentValue);
      const totalDurationMs = Math.min(300, Math.max(180, distance * 36));
      const stepDurationMs = totalDurationMs / distance;
      const animationStart = performance.now();

      const tick = (now: number) => {
        const elapsed = now - animationStart;
        const stepsCompleted = Math.min(distance, Math.max(1, Math.floor(elapsed / stepDurationMs)));
        const nextValue = currentValue + (stepsCompleted * direction);

        setDisplayedValue(nextValue);

        if (nextValue !== targetValue) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return currentValue;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [targetValue]);

  return displayedValue;
}

function toCssVarFromColourName(colour?: string): string | undefined {
  if (!colour) return undefined;
  const slug = colour.trim().toLowerCase().replace(/\s+/g, '-');
  return `var(--shapeships-${slug})`;
}

// ============================================================================
// FLEET ROW MAPPING (Set-based, All Species)
// ============================================================================

type FleetRow = 1 | 2 | 3 | 4;
type SpeciesKey = 'human' | 'xenite' | 'centaur' | 'ancient';
type RowSets = Record<FleetRow, Set<ShipDefId>>;

const HUMAN_ROW_SETS: RowSets = {
  1: new Set<ShipDefId>(['ORB', 'STA', 'BAT', 'SCI']),
  2: new Set<ShipDefId>(['CAR']),
  3: new Set<ShipDefId>(['DEF', 'FIG', 'COM', 'INT']),
  4: new Set<ShipDefId>(['FRI', 'TAC', 'GUA', 'EAR', 'DRE', 'LEV']),
};

const XENITE_ROW_SETS: RowSets = {
  1: new Set<ShipDefId>(['ZEN', 'BUG', 'QUE']),
  2: new Set<ShipDefId>(['XEN', 'ANT', 'EVO', 'AST', 'OXI']),
  3: new Set<ShipDefId>(['MAN', 'HEL', 'DSW', 'AAR']),
  4: new Set<ShipDefId>(['OXF', 'ASF', 'SAC', 'CHR', 'HVE']),
};

const CENTAUR_ROW_SETS: RowSets = {
  1: new Set<ShipDefId>(['VIG', 'POW', 'RED', 'KNO']),
  2: new Set<ShipDefId>(['LEG', 'FEA', 'ANG', 'TER', 'FUR', 'ENT']),
  3: new Set<ShipDefId>(['WIS', 'FAM']),
  4: new Set<ShipDefId>(['EQU', 'DES', 'DOM']),
};

const ANCIENT_ROW_SETS: RowSets = {
  1: new Set<ShipDefId>(['MER', 'PLU', 'QUA', 'URA']),
  2: new Set<ShipDefId>(['SOL']),
  3: new Set<ShipDefId>(['SPI', 'CUB']),
  4: new Set<ShipDefId>([]), // Reserved for later text-only powers
};

const ROW_SETS_BY_SPECIES: Record<SpeciesKey, RowSets> = {
  human: HUMAN_ROW_SETS,
  xenite: XENITE_ROW_SETS,
  centaur: CENTAUR_ROW_SETS,
  ancient: ANCIENT_ROW_SETS,
};

function getRowFromSets(shipDefId: ShipDefId, rowSets: RowSets): FleetRow {
  if (rowSets[1].has(shipDefId)) return 1;
  if (rowSets[2].has(shipDefId)) return 2;
  if (rowSets[3].has(shipDefId)) return 3;
  if (rowSets[4].has(shipDefId)) return 4;
  return 4; // fallback for unknown/copied ships
}

function sortByPersistentOrder<T extends { shipDefId: string; renderKey: string }>(
    ships: T[],
    order?: string[]
): T[] {
    const index = new Map<string, number>();
    (order ?? []).forEach((id, i) => index.set(id, i));

    return [...ships].sort((a, b) => {
        const ai = index.has(a.renderKey) ? index.get(a.renderKey)! : Number.POSITIVE_INFINITY;
        const bi = index.has(b.renderKey) ? index.get(b.renderKey)! : Number.POSITIVE_INFINITY;
        if (ai !== bi) return ai - bi;
        return a.renderKey.localeCompare(b.renderKey);
    });
}

function groupShipsIntoRows<T extends { shipDefId: string; renderKey: string }>(
    ships: T[],
    order: string[] | undefined,
    rowSets: RowSets
) {
    const sorted = sortByPersistentOrder(ships, order);

    const row1: T[] = [];
    const row2: T[] = [];
    const row3: T[] = [];
    const row4: T[] = [];

    for (const s of sorted) {
        const id = s.shipDefId as ShipDefId;
        const row = getRowFromSets(id, rowSets);
        if (row === 1) row1.push(s);
        else if (row === 2) row2.push(s);
        else if (row === 3) row3.push(s);
        else row4.push(s);
    }

    return { row1, row2, row3, row4 };
}

type FleetStackVm = {
  shipDefId: string;
  count: number;
  stackKey: string;
  renderKey: string;
  condition?: 'charges_1' | 'charges_0';
  currentCharges?: number | null;
  caption?: string | null;
};

type ShipDisplayMode = 'live' | 'void';

type DestroyTargetStateVm = {
  isTargetable: boolean;
  isHovered: boolean;
  isSelected: boolean;
};

function ShipStack({ 
  ship, 
  animToken, 
  activationIndexMap,
  targetState,
  previewShipDefId,
  displayMode = 'live',
  onFleetHoverEnter,
  onFleetHoverLeave,
}: { 
  ship: FleetStackVm;
  animToken?: ShipAnimToken;
  activationIndexMap?: Record<string, number>;
  targetState?: DestroyTargetStateVm;
  previewShipDefId?: ShipDefId;
  displayMode?: ShipDisplayMode;
  onFleetHoverEnter?: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  onFleetHoverLeave?: (shipId: ShipDefId) => void;
}) {
  const shipDefId = ship.shipDefId as ShipDefId;
  const def = getShipDefinitionUI(shipDefId);
  const isVoid = displayMode === 'void';

  // If this fleet stack has a condition like 'charges_1' or 'charges_0',
  // force that exact charge graphic on the live board via explicitCharges.
  let explicitCharges: number | undefined = undefined;
  if (ship.condition && ship.condition.startsWith('charges_')) {
    const match = ship.condition.match(/^charges_(\d+)$/);
    if (match) {
      explicitCharges = parseInt(match[1], 10);
    }
  }

  const resolvedGraphic = def
    ? resolveShipGraphic(def, {
        context: 'live',
        explicitCharges,
        currentCharges: ship.currentCharges ?? null,
      })
    : null;

  const ShipGraphic = resolvedGraphic?.component;
  const targetingVisualState = isVoid ? null : getTargetingVisualState(targetState);
  const previewDef =
    !isVoid && previewShipDefId ? getShipDefinitionUI(previewShipDefId) : undefined;
  const previewGraphic = previewDef
    ? resolveShipGraphic(previewDef, { context: 'default' })
    : null;
  const PreviewShipGraphic = previewGraphic?.component;
  const numberColour = toCssVarFromColourName(def?.colour);
  
  // Enable hover activation for ships with animation presets (Human + Xenite + Centaur ships)
  const enableHover =
    !isVoid &&
    ['DEF', 'FIG', 'INT', 'COM', 'ORB', 'CAR', 'STA', 'FRI', 'TAC', 'GUA', 'SCI', 'BAT', 'EAR', 'DRE', 'LEV', 'XEN', 'ANT', 'MAN', 'EVO', 'HEL', 'BUG', 'ZEN', 'DSW', 'AAR', 'OXF', 'ASF', 'SAC', 'QUE', 'CHR', 'HVE', 'FEA', 'ANG', 'EQU', 'WIS', 'VIG', 'FAM', 'LEG', 'TER', 'FUR', 'KNO', 'ENT', 'RED', 'POW', 'DES', 'DOM'].includes(ship.shipDefId);

  const showCount = ship.count > 1;

  const activationDelayMs = (activationIndexMap?.[ship.renderKey] ?? 0) * 400;

  return (
    <div className={cx('flex flex-row items-center', isVoid && 'opacity-35')}>
      <div className="flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          {targetingVisualState ? (
            <div
              className={getTargetingGlowClassName(targetingVisualState)}
              style={getTargetingGlowStyle(targetingVisualState)}
            />
          ) : null}

          {PreviewShipGraphic && targetingVisualState && targetingVisualState !== 'available' ? (
            <div
              className="ss-targeting-preview z-20"
              style={getTargetingPreviewStyle(targetingVisualState)}
            >
              <PreviewShipGraphic />
            </div>
          ) : null}

          <div
            className={cx(
              'relative z-10',
              isVoid && '[&_svg]:h-auto [&_svg]:w-auto'
            )}
          >
            <ShipAnimationWrapper 
              shipDefId={shipDefId} 
              token={animToken}
              enableHoverActivation={enableHover}
              activationDelayMs={activationDelayMs}
            >
              <div
                className="inline-block shrink-0 align-top p-0 m-0"
                style={{ lineHeight: 0 }}
                onMouseEnter={
                  !isVoid
                    ? (event) => onFleetHoverEnter?.(shipDefId, event.currentTarget)
                    : undefined
                }
                onMouseLeave={
                  !isVoid
                    ? () => onFleetHoverLeave?.(shipDefId)
                    : undefined
                }
              >
                {ShipGraphic ? (
                  <ShipGraphic />
                ) : (
                  <span className={cx('text-sm text-white')}>{ship.shipDefId}</span>
                )}
              </div>
            </ShipAnimationWrapper>
          </div>
        </div>

        {ship.shipDefId === 'FRI' && ship.caption ? (
          <div
            className={cx(
              "relative z-10 mt-[4px] font-['Roboto'] font-normal leading-none text-center text-[14px]"
            )}
            style={{
              color: numberColour ?? 'white',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {ship.caption}
          </div>
        ) : null}
      </div>

      {/* Count: only render when count > 1 */}
      {showCount ? (
        <div className={cx('relative z-10 ml-[8px]')}>
          <div
            className={cx("font-['Roboto'] font-semibold")}
            style={{
              fontSize: '50px',
              lineHeight: 1,
              fontVariationSettings: "'wdth' 100",
              color: numberColour ?? 'white',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {ship.count}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FleetArea({
  title,
  ships,
  voidShips,
  order,
  species,
  animTokens,
  flipEnabled = false,
  side,
  activationIndexMap,
  targetStatesByStackKey,
  previewShipDefIdByStackKey,
  onDestroyTargetHoverChange,
  onDestroyTargetMouseDown,
  onFleetHoverEnter,
  onFleetHoverLeave,
  turnPulse,
}: {
  title: string;
  ships?: FleetStackVm[];
  voidShips?: FleetStackVm[];
  order?: string[];
  species: SpeciesKey;
  animTokens?: Partial<Record<string, ShipAnimToken>>; // keyed by renderKey
  flipEnabled?: boolean;
  side: 'my' | 'opponent';
  activationIndexMap?: Record<string, number>;
  targetStatesByStackKey?: Record<string, DestroyTargetStateVm>;
  previewShipDefIdByStackKey?: Partial<Record<string, ShipDefId>>;
  onDestroyTargetHoverChange?: (side: 'my' | 'opponent', stackKey: string | null) => void;
  onDestroyTargetMouseDown?: (side: 'my' | 'opponent', stackKey: string) => void;
  onFleetHoverEnter?: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  onFleetHoverLeave?: (shipId: ShipDefId) => void;
  turnPulse: TurnIncrementPulseState;
}) {
  const rowSets = ROW_SETS_BY_SPECIES[species];
  const grouped = ships && ships.length > 0 ? groupShipsIntoRows(ships, order, rowSets) : null;
  const sortedVoidShips = voidShips && voidShips.length > 0 ? sortByPersistentOrder(voidShips, order) : [];

  // FLIP layout animation for smooth repositioning (live fleet only)
  // Derive keys from rendered ships in stable order
  const renderedShips = grouped
    ? [...grouped.row1, ...grouped.row2, ...grouped.row3, ...grouped.row4]
    : [];
  const allRenderKeys = renderedShips.map((s) => s.renderKey);
  const getFlipRef = useFlipLayout(allRenderKeys, flipEnabled, { durationMs: 400, easing: 'ease-in-out' });

  const renderShipCell = (ship: FleetStackVm, displayMode: ShipDisplayMode = 'live') => {
    const targetState = displayMode === 'live' ? targetStatesByStackKey?.[ship.stackKey] : undefined;
    const isTargetable = targetState?.isTargetable === true;

    return (
      <div
        key={ship.renderKey}
        ref={displayMode === 'live' ? getFlipRef(ship.renderKey) : undefined}
        className={cx(
          displayMode === 'void' ? 'relative py-[2px]' : 'relative px-[10px] py-[8px]',
          isTargetable && 'cursor-pointer'
        )}
        onMouseEnter={
          displayMode === 'live' && isTargetable
            ? () => onDestroyTargetHoverChange?.(side, ship.stackKey)
            : undefined
        }
        onMouseLeave={
          displayMode === 'live' && isTargetable
            ? () => onDestroyTargetHoverChange?.(side, null)
            : undefined
        }
        onMouseDown={(event) => {
          if (displayMode === 'live') {
            event.stopPropagation();
          }
          if (displayMode === 'live' && isTargetable) {
            onDestroyTargetMouseDown?.(side, ship.stackKey);
          }
        }}
      >
        <ShipStack 
          ship={ship}
          animToken={displayMode === 'live' ? animTokens?.[ship.renderKey] : undefined}
          activationIndexMap={displayMode === 'live' ? activationIndexMap : undefined}
          targetState={targetState}
          previewShipDefId={displayMode === 'live' ? previewShipDefIdByStackKey?.[ship.stackKey] : undefined}
          displayMode={displayMode}
          onFleetHoverEnter={displayMode === 'live' ? onFleetHoverEnter : undefined}
          onFleetHoverLeave={displayMode === 'live' ? onFleetHoverLeave : undefined}
        />
      </div>
    );
  };

  const hasLiveShips = renderedShips.length > 0;
  const hasVoidShips = sortedVoidShips.length > 0;

  return (
    <div className="basis-0 grow h-full min-h-px min-w-px relative shrink-0 px-[8px] overflow-visible">
      {/* FleetArea: {title} (title intentionally not rendered) */}
      <div className="flex h-full min-h-0 flex-col">
        <div className="grow min-h-0">
          <FitToBox minScale={0.4} className="w-full h-full">
            {hasLiveShips ? (
              <div
                className={cx(
                  'ss-boardTurnPulse flex flex-col items-center gap-[18px]',
                  turnPulse.isActive && 'ss-boardTurnPulse-active'
                )}
                onAnimationEnd={turnPulse.onAnimationEnd}
              >
                {grouped ? (
                  <>
                    <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
                      {grouped.row1.map((ship) => renderShipCell(ship, 'live'))}
                    </div>

                    <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
                      {grouped.row2.map((ship) => renderShipCell(ship, 'live'))}
                    </div>

                    <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
                      {grouped.row3.map((ship) => renderShipCell(ship, 'live'))}
                    </div>

                    <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
                      {grouped.row4.map((ship) => renderShipCell(ship, 'live'))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </FitToBox>
        </div>

         {hasVoidShips ? (
          <div
            className={cx(
              'h-[44px] overflow-visible',
              side === 'opponent' ? 'flex justify-end' : 'flex justify-start'
            )}
          >
            <div
              className={cx(
                'flex flex-row flex-nowrap items-center gap-[20px] scale-60',
                side === 'opponent' ? 'origin-right' : 'origin-left'
              )}
            >
              {sortedVoidShips.map((ship) => renderShipCell(ship, 'void'))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  value,
  label,
  label2,
  align = 'left',
  toneClass = 'text-white',
  className,
}: {
  value: string;
  label?: string;
  label2?: string;
  align?: 'left' | 'right';
  toneClass?: string;
  className?: string;
}) {
  const isRight = align === 'right';
  const hasLabel = Boolean(label || label2);

  return (
    <div
      className={cx(
        'content-stretch flex flex-col relative shrink-0',
        className,
        toneClass,
        isRight && 'items-end text-right'
      )}
    >
      <p
        className="font-['Roboto'] font-semibold leading-[36px] relative shrink-0 text-[36px] w-[50px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {value}
      </p>

      {hasLabel ? (
        <p
          className={cx(
            "font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[11px] text-nowrap uppercase",
            isRight && 'text-right'
          )}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {label}
          {label2 ? (
            <>
              <br aria-hidden="true" />
              {label2}
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function HoverAnchor({
  hoverKey,
  enabled,
  anchorRef,
  className,
  onHoverEnter,
  onHoverLeave,
  children,
}: {
  hoverKey: BoardStatHoverKey;
  enabled: boolean;
  anchorRef?: { current: HTMLElement | null };
  className?: string;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      onMouseEnter={
        enabled
          ? (event) => onHoverEnter(hoverKey, anchorRef?.current ?? event.currentTarget)
          : undefined
      }
      onMouseLeave={enabled ? () => onHoverLeave(hoverKey) : undefined}
    >
      {children}
    </div>
  );
}

function TripletStatValue({
  value,
  align,
  hoverKey,
  hoverEnabled,
  onHoverEnter,
  onHoverLeave,
}: {
  value: string;
  align: 'left' | 'right';
  hoverKey: BoardStatHoverKey;
  hoverEnabled: boolean;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
}) {
  const isRight = align === 'right';

  return (
    <div className={cx('flex w-[80px]', isRight ? 'justify-end text-right' : 'justify-start text-left')}>
      <HoverAnchor
        hoverKey={hoverKey}
        enabled={hoverEnabled}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        className="inline-block"
      >
        <p
          className={cx(
            "font-['Roboto'] font-semibold leading-[36px] relative shrink-0 text-[36px]",
            isRight && 'text-right'
          )}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {value}
        </p>
      </HoverAnchor>
    </div>
  );
}

function StatTripletRow({
  left,
  centerLabel,
  right,
  toneClass,
  className,
  leftHoverKey,
  leftHoverEnabled = false,
  rightHoverKey,
  rightHoverEnabled = false,
  onHoverEnter,
  onHoverLeave,
}: {
  left: string;
  centerLabel: string;
  right: string;
  toneClass?: string;
  className?: string;
  leftHoverKey: BoardStatHoverKey;
  leftHoverEnabled?: boolean;
  rightHoverKey: BoardStatHoverKey;
  rightHoverEnabled?: boolean;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
}) {
  return (
    <div className={cx('content-stretch flex gap-[10px] items-center justify-center relative shrink-0', className, toneClass)}>
      <TripletStatValue
        value={left}
        align="right"
        hoverKey={leftHoverKey}
        hoverEnabled={leftHoverEnabled}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />
      <p
        className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[14px] text-center w-[64px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {centerLabel}
      </p>
      <TripletStatValue
        value={right}
        align="left"
        hoverKey={rightHoverKey}
        hoverEnabled={rightHoverEnabled}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />
    </div>
  );
}

export function BoardStage({ vm, actions, phaseKey }: BoardStageProps) {
  const fleetHover = useFleetShipHover();
  const statHover = useBoardStatHover();
  const myBonusAnchorRef = useRef<HTMLDivElement | null>(null);
  const opponentBonusPrimaryAnchorRef = useRef<HTMLDivElement | null>(null);
  const opponentBonusJoiningAnchorRef = useRef<HTMLDivElement | null>(null);
  const displayedMyHealth = useAnimatedHealth(vm.mode === 'board' ? vm.myHealth : 25);
  const displayedOpponentHealth = useAnimatedHealth(vm.mode === 'board' ? vm.opponentHealth : 25);
  const pulsePhaseKey = phaseKey.startsWith('battle.') ? 'battle' : phaseKey;
  const revealPulse = usePhaseEntryPulse({
    enabled: vm.mode === 'board',
    phaseKey: vm.mode === 'board' ? pulsePhaseKey : null,
    targetPhaseKey: 'battle',
  });

  // Choose species mode
  if (vm.mode === 'choose_species') {
    return (
      <ChooseSpeciesStage
        vm={vm}
        onSelectSpecies={actions.onSelectSpecies}
        onConfirmSpecies={actions.onConfirmSpecies}
        onCopyGameUrl={actions.onCopyGameUrl}
      />
    );
  }

  // Runtime guard: ensure species values are valid SpeciesKey
  function toSpeciesKey(raw: unknown): SpeciesKey {
    const s = String(raw ?? '').trim().toLowerCase();
    if (s === 'human' || s === 'xenite' || s === 'centaur' || s === 'ancient') return s;
    return 'human'; // Safe fallback
  }

  const mySpeciesKey = toSpeciesKey(vm.mySpeciesId);
  const opponentSpeciesKey = toSpeciesKey(vm.opponentSpeciesId);
  const myDisplayedBonusLines =
    mySpeciesKey === 'centaur' ? vm.myBonusLinesOnEven : vm.myBonusLines;
  const opponentDisplayedBonusLines =
    opponentSpeciesKey === 'centaur'
      ? vm.opponentBonusLinesOnEven
      : vm.opponentBonusLines;

  // Hide deltas on turn 1 only
  const showDeltas = vm.turnNumber > 1;
  const myDeltaKey = showDeltas ? `my:${vm.turnNumber}:${vm.myLastTurnNet}` : 'my:hidden';
  const opponentDeltaKey = showDeltas ? `opp:${vm.turnNumber}:${vm.opponentLastTurnNet}` : 'opp:hidden';
  const myDamageHoverEnabled = vm.myLastTurnDamage !== 0 && vm.myLastDamageBreakdownRows.length > 0;
  const opponentDamageHoverEnabled = vm.opponentLastTurnDamage !== 0 && vm.opponentLastDamageBreakdownRows.length > 0;
  const myHealingHoverEnabled = vm.myLastTurnHeal !== 0 && vm.myLastHealingBreakdownRows.length > 0;
  const opponentHealingHoverEnabled = vm.opponentLastTurnHeal !== 0 && vm.opponentLastHealingBreakdownRows.length > 0;
  const myBonusClusterHasVisibleContent =
    myDisplayedBonusLines !== 0 || vm.myJoiningBonusLines > 0;
  const opponentBonusClusterHasVisibleContent =
    opponentDisplayedBonusLines !== 0 || vm.opponentJoiningBonusLines > 0;
  const myBonusHoverEnabled =
    myBonusClusterHasVisibleContent && vm.myBonusBreakdownRows.length > 0;
  const opponentBonusHoverEnabled =
    opponentBonusClusterHasVisibleContent && vm.opponentBonusBreakdownRows.length > 0;
  const opponentBonusAnchorRef =
    vm.opponentJoiningBonusLines > 0 ? opponentBonusJoiningAnchorRef : opponentBonusPrimaryAnchorRef;
  const statHoverRowsByKey: Record<BoardStatHoverKey, { rows: typeof vm.myLastDamageBreakdownRows; side: 'left' | 'right' }> = {
    'my-last-damage': { rows: vm.myLastDamageBreakdownRows, side: 'left' },
    'opponent-last-damage': { rows: vm.opponentLastDamageBreakdownRows, side: 'right' },
    'my-last-healing': { rows: vm.myLastHealingBreakdownRows, side: 'left' },
    'opponent-last-healing': { rows: vm.opponentLastHealingBreakdownRows, side: 'right' },
    'my-bonus': { rows: vm.myBonusBreakdownRows, side: 'left' },
    'opponent-bonus': { rows: vm.opponentBonusBreakdownRows, side: 'right' },
  };
  const activeStatHover =
    statHover.state.activeKey ? statHoverRowsByKey[statHover.state.activeKey] : null;

  // Board mode (existing placeholder layout)
  return (
    <div
      className="content-stretch flex gap-[8px] items-start justify-center px-0 py-[12px] relative size-full"
      data-name="Board Stage"
      onMouseDown={actions.onBoardBackgroundMouseDown}
    >
      <FleetArea 
        title="MY FLEET" 
        ships={vm.myFleet} 
        voidShips={vm.myVoidFleet}
        order={vm.myFleetRenderOrder} 
        species={mySpeciesKey}
        animTokens={vm.fleetAnim.my}
        flipEnabled={vm.mode === 'board'}
        side="my"
        activationIndexMap={vm.activationStaggerPlan?.myIndexByShipId}
        targetStatesByStackKey={vm.destroyTargeting?.targetStatesBySide.my}
        previewShipDefIdByStackKey={vm.destroyTargeting?.previewShipDefIdBySide.my}
        onDestroyTargetHoverChange={actions.onDestroyTargetStackHoverChange}
        onDestroyTargetMouseDown={actions.onDestroyTargetStackMouseDown}
        onFleetHoverEnter={fleetHover.onEnter}
        onFleetHoverLeave={fleetHover.onLeave}
        turnPulse={INACTIVE_TURN_PULSE_STATE}
      />

      <div
        className="content-stretch flex flex-col h-full items-center justify-between relative shrink-0 w-[230px]"
        data-name="Health and Stats"
      >
        {/* Health */}
        <div
          className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full"
          data-name="Health Wrapper"
        >
          <div
            className="content-stretch flex flex-col font-['Roboto'] font-bold gap-px items-end relative shrink-0 text-right w-[100px]"
            data-name="P1 Health Group"
          >
            <p
              className="leading-[64px] relative shrink-0 text-[64px] text-white w-full"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {displayedMyHealth}
            </p>

            {/* Delta (server-authoritative) */}
            <p
              className="font-['Roboto'] font-semibold leading-[28px] relative shrink-0 text-[28px] w-full text-right"
              style={{
                fontVariationSettings: "'wdth' 100",
                color: vm.myLastTurnNet > 0 
                  ? 'var(--shapeships-pastel-green)' 
                  : vm.myLastTurnNet < 0 
                  ? 'var(--shapeships-pastel-red)' 
                  : 'var(--shapeships-grey-50)',
                opacity: showDeltas ? 1 : 0,
                pointerEvents: showDeltas ? 'auto' : 'none',
              }}
            >
              <span key={myDeltaKey} className={showDeltas ? 'ss-health-delta-pop-in' : undefined}>
                {showDeltas ? (vm.myLastTurnNet > 0 ? `+${vm.myLastTurnNet}` : vm.myLastTurnNet === 0 ? '±0' : vm.myLastTurnNet) : ''}
              </span>
            </p>
          </div>

          <div
            className="content-stretch flex items-center justify-center pb-0 pt-[22px] px-0 relative shrink-0"
            data-name="Health Label"
          >
            <div className="flex flex-col items-center justify-start w-[64px] text-center">
              <p
                className="font-['Roboto'] font-normal leading-[1.25] relative shrink-0 text-white text-[15px]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Health
              </p>

              {/* Max Health (UI placeholder) */}
              <p
                className="font-['Roboto'] font-semibold leading-[13px] relative shrink-0 text-[13px]"
                style={{
                  fontVariationSettings: "'wdth' 100",
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                35
              </p>
            </div>
          </div>

          <div
            className="content-stretch flex flex-col font-['Roboto'] font-bold items-start relative shrink-0 w-[100px]"
            data-name="P2 Health Group"
          >
            <p
              className="leading-[64px] relative shrink-0 text-[64px] text-white w-[100px] text-left"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {displayedOpponentHealth}
            </p>

            {/* Delta (server-authoritative) */}
            <p
              className="font-['Roboto'] font-semibold leading-[28px] relative shrink-0 text-[28px] w-[100px] text-left"
              style={{
                fontVariationSettings: "'wdth' 100",
                color: vm.opponentLastTurnNet > 0 
                  ? 'var(--shapeships-pastel-green)' 
                  : vm.opponentLastTurnNet < 0 
                  ? 'var(--shapeships-pastel-red)' 
                  : 'var(--shapeships-grey-50)',
                opacity: showDeltas ? 1 : 0,
                pointerEvents: showDeltas ? 'auto' : 'none',
              }}
            >
              <span key={opponentDeltaKey} className={showDeltas ? 'ss-health-delta-pop-in' : undefined}>
                {showDeltas ? (vm.opponentLastTurnNet > 0 ? `+${vm.opponentLastTurnNet}` : vm.opponentLastTurnNet === 0 ? '±0' : vm.opponentLastTurnNet) : ''}
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0 w-full" data-name="Stats Wrapper">
          {/* Saved Lines */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Saved Lines Group">
            {/* P1 */}
            <div className="content-stretch flex items-start justify-end relative shrink-0 w-[100px]" data-name="P1 Saved Wrapper">
              <div className="content-stretch flex items-start relative shrink-0">
                <Metric value={String(vm.myDisplayedSavedLines)} align="right" toneClass="text-white" />
                {vm.myDisplayedSavedJoiningLines > 0 ? (
                  <Metric
                    value={String(vm.myDisplayedSavedJoiningLines)}
                    label="JOINING"
                    align="right"
                    toneClass="text-white"
                  />
                ) : null}
              </div>
            </div>
          
            <p
              className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[15px] text-center text-white w-[64px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Saved
              <br aria-hidden="true" />
              Lines
            </p>
          
            {/* P2 */}
            <div className="content-stretch flex items-start relative shrink-0 w-[100px]" data-name="P2 Saved Wrapper">
              <div className="content-stretch flex items-start relative shrink-0">
                <Metric value={String(vm.opponentDisplayedSavedLines)} align="left" toneClass="text-white" />
                {vm.opponentDisplayedSavedJoiningLines > 0 ? (
                  <Metric
                    value={String(vm.opponentDisplayedSavedJoiningLines)}
                    label="JOINING"
                    align="left"
                    toneClass="text-white"
                  />
                ) : null}
              </div>
            </div>
          </div>

          <StatTripletRow
            left={String(vm.myLastTurnDamage ?? 0)}
            centerLabel="Last Damage"
            right={String(vm.opponentLastTurnDamage ?? 0)}
            toneClass="text-[#ff8282]"
            leftHoverKey="my-last-damage"
            leftHoverEnabled={myDamageHoverEnabled}
            rightHoverKey="opponent-last-damage"
            rightHoverEnabled={opponentDamageHoverEnabled}
            onHoverEnter={statHover.onEnter}
            onHoverLeave={statHover.onLeave}
          />
          <StatTripletRow
            left={String(vm.myLastTurnHeal ?? 0)}
            centerLabel="Last Healing"
            right={String(vm.opponentLastTurnHeal ?? 0)}
            toneClass="text-[#9cff84]"
            leftHoverKey="my-last-healing"
            leftHoverEnabled={myHealingHoverEnabled}
            rightHoverKey="opponent-last-healing"
            rightHoverEnabled={opponentHealingHoverEnabled}
            onHoverEnter={statHover.onEnter}
            onHoverLeave={statHover.onLeave}
          />

          {/* Bonus */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Bonus Group">
            <div className="content-stretch flex gap-[4px] items-center justify-end relative shrink-0 w-[100px]" data-name="P1 Bonuses">
              <HoverAnchor
                hoverKey="my-bonus"
                enabled={myBonusHoverEnabled}
                anchorRef={myBonusAnchorRef}
                onHoverEnter={statHover.onEnter}
                onHoverLeave={statHover.onLeave}
                className="flex gap-[4px] items-center justify-end"
              >
                <div ref={myBonusAnchorRef} className="shrink-0">
                  <Metric
                    value={String(myDisplayedBonusLines ?? 0)}
                    label="LINES"
                    label2={mySpeciesKey === 'centaur' ? 'ON EVEN' : undefined}
                    align="right"
                    toneClass="text-[#62fff6]"
                  />
                </div>
                {vm.myJoiningBonusLines > 0 ? (
                  <Metric
                    value={String(vm.myJoiningBonusLines)}
                    label="JOINING"
                    label2="LINES"
                    align="right"
                    toneClass="text-[#62fff6]"
                  />
                ) : null}
              </HoverAnchor>
            </div>

            <div className="content-stretch flex items-center justify-center pb-0 pt-[8px] px-0 relative shrink-0">
              <p
                className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[#62fff6] text-[15px] text-center w-[64px]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Bonus
              </p>
            </div>

            <div className="content-stretch flex gap-[4px] items-start relative shrink-0 w-[100px]" data-name="P2 Bonuses">
              <HoverAnchor
                hoverKey="opponent-bonus"
                enabled={opponentBonusHoverEnabled}
                anchorRef={opponentBonusAnchorRef}
                onHoverEnter={statHover.onEnter}
                onHoverLeave={statHover.onLeave}
                className="flex gap-[4px] items-start"
              >
                <div ref={opponentBonusPrimaryAnchorRef} className="shrink-0">
                  <Metric
                    value={String(opponentDisplayedBonusLines ?? 0)}
                    label="LINES"
                    label2={opponentSpeciesKey === 'centaur' ? 'ON EVEN' : undefined}
                    align="left"
                    toneClass="text-[#62fff6]"
                  />
                </div>
                {vm.opponentJoiningBonusLines > 0 ? (
                  <div ref={opponentBonusJoiningAnchorRef} className="shrink-0">
                    <Metric
                      value={String(vm.opponentJoiningBonusLines)}
                      label="JOINING"
                      label2="LINES"
                      align="left"
                      toneClass="text-[#62fff6]"
                    />
                  </div>
                ) : null}
              </HoverAnchor>
            </div>
          </div>
        </div>
      </div>

      <FleetArea 
        title="OPPONENT FLEET" 
        ships={vm.opponentFleet} 
        voidShips={vm.opponentVoidFleet}
        order={vm.opponentFleetRenderOrder} 
        species={opponentSpeciesKey}
        animTokens={vm.fleetAnim.opponent}
        flipEnabled={vm.mode === 'board'}
        side="opponent"
        activationIndexMap={vm.activationStaggerPlan?.opponentIndexByShipId}
        targetStatesByStackKey={vm.destroyTargeting?.targetStatesBySide.opponent}
        previewShipDefIdByStackKey={vm.destroyTargeting?.previewShipDefIdBySide.opponent}
        onDestroyTargetHoverChange={actions.onDestroyTargetStackHoverChange}
        onDestroyTargetMouseDown={actions.onDestroyTargetStackMouseDown}
        onFleetHoverEnter={fleetHover.onEnter}
        onFleetHoverLeave={fleetHover.onLeave}
        turnPulse={revealPulse}
      />

      {fleetHover.state.activeShipId && fleetHover.state.anchorRect ? (
        <FleetShipHoverCard
          shipId={fleetHover.state.activeShipId}
          anchorRect={fleetHover.state.anchorRect}
        />
      ) : null}

      {activeStatHover && statHover.state.anchorRect ? (
        <BoardStatBreakdownHoverCard
          anchorRect={statHover.state.anchorRect}
          side={activeStatHover.side}
          rows={activeStatHover.rows}
        />
      ) : null}
    </div>
  );
}
