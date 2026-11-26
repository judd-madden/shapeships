import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import starfield from '../../../graphics/lore/mission-findings-starfield.webp';
import type { MissionFinding } from './loreContent';
import {
  connectorPath, createMissionMapLayout, mapSystems, markerColors,
  speciesColors, systemCardOrder,
} from './missionFindingsMapLayout';

export function SystemMarker({ x, y, core, ring, outer, desktop = false }: {
  x: number; y: number; core: string; ring: string; outer?: string; desktop?: boolean;
}) {
  const radius = desktop ? 7 : 6;
  return (
    <g>
      {outer && <circle cx={x} cy={y} r={radius + 4} fill="var(--shapeships-black)" stroke={outer} strokeWidth="2" />}
      <circle cx={x} cy={y} r={radius} fill="var(--shapeships-black)" stroke={ring} strokeWidth="2" />
      <circle cx={x} cy={y} r={radius - 3} fill={core} />
    </g>
  );
}

const twinkles = [
  [12, 56, 5, -1], [28, 36, 7, -4], [45, 48, 9, -6],
  [69, 22, 6, -3], [88, 35, 8, -5],
] as const;

export function MissionFindingsMap({ completedFindingIds, loreWidth, renderCard, findings }: {
  completedFindingIds: ReadonlySet<string>;
  loreWidth: number;
  findings: readonly MissionFinding[];
  renderCard: (finding: MissionFinding) => ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [measurements, setMeasurements] = useState<{ width: number; heights: Record<string, number> }>({ width: 358, heights: {} });
  const layout = createMissionMapLayout(measurements.width, loreWidth, measurements.heights);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const cards = cardsRef.current;
    if (!stage || !cards) return;
    const measure = () => {
      const width = stage.clientWidth;
      const heights: Record<string, number> = {};
      cards.querySelectorAll<HTMLElement>('[data-map-card]').forEach((element) => {
        heights[element.dataset.mapCard!] = element.getBoundingClientRect().height;
      });
      setMeasurements((previous) => width > 0 && (
        previous.width !== width || Object.keys(heights).some((id) => previous.heights[id] !== heights[id])
      ) ? { width, heights } : previous);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    cards.querySelectorAll<HTMLElement>('[data-map-card]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [loreWidth]);

  const unknownUnlocked = completedFindingIds.has('ancient-mysteries-xenite');
  return (
    <div className="relative w-full min-w-0" data-mission-map-layout={layout.desktop ? 'desktop' : 'narrow'}>
      <style>{`
        @keyframes mission-finding-twinkle { 0%,100% { opacity:.08 } 50% { opacity:.4 } }
        .mission-finding-twinkle { animation:mission-finding-twinkle var(--twinkle-duration) ease-in-out var(--twinkle-delay) infinite; }
        @media (prefers-reduced-motion:reduce) { .mission-finding-twinkle { animation:none; opacity:.16; } }
      `}</style>
      <div ref={stageRef} data-mission-map-stage className="relative isolate w-full overflow-hidden rounded-[12px] border-2 border-shapeships-grey-70/65 bg-shapeships-black" style={{ height: layout.height }}>
        <img src={starfield} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {twinkles.map(([x, y, duration, delay], index) => <span key={index} className="mission-finding-twinkle absolute h-[2px] w-[2px] rounded-full bg-shapeships-grey-20" style={{ left: x + '%', top: y + '%', '--twinkle-duration': duration + 's', '--twinkle-delay': delay + 's' } as CSSProperties} />)}
        </div>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" width={layout.width} height={layout.height}>
          <defs>
            <pattern id="mission-findings-grid" width={layout.gridSize} height={layout.gridSize} patternUnits="userSpaceOnUse">
              <path d={'M ' + layout.gridSize + ' 0 H 0 V ' + layout.gridSize} fill="none" stroke="var(--shapeships-grey-20)" strokeOpacity=".1" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mission-findings-grid)" />
          {layout.desktop && mapSystems.map((system) => {
            const card = layout.cards[system.findingId];
            if (!card) return null;
            const point = layout.points[system.id];
            const bottomCard = system.id === 'betelgeuse' || system.id === 'gamma-leporis';
            const endX = bottomCard ? point.x : card.x < point.x ? card.x + card.width : card.x;
            const endY = bottomCard ? card.y : system.id === 'tau-ceti' ? point.y : system.id === 'sol' ? card.y + 20 : card.y + card.height / 2;
            const path = system.id === 'sol'
              ? connectorPath(endX, endY, point.x, point.y)
              : connectorPath(point.x, point.y, endX, endY);
            return <path key={system.id} data-connector={system.id} d={path} fill="none" stroke="var(--shapeships-grey-20)" strokeOpacity=".5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />;
          })}
          {mapSystems.map((system) => {
            const point = layout.points[system.id];
            const colors = markerColors(system, completedFindingIds);
            return <g key={system.id} data-system-marker={system.id} data-unlocked={completedFindingIds.has(system.findingId)}>
              <SystemMarker x={point.x} y={point.y} core={colors.core} ring={colors.ring} outer={system.id === 'sol' ? colors.outer : undefined} desktop={layout.desktop} />
            </g>;
          })}
          <rect x={layout.unknown.x} y={layout.unknown.y} width={layout.unknown.width} height={layout.unknown.height} rx="8" fill="none" stroke="var(--shapeships-grey-70)" strokeWidth="2" strokeDasharray="8 4" />
          <g data-system-marker="unknown" data-unlocked={unknownUnlocked}>
            <SystemMarker x={layout.unknown.x + (layout.desktop ? 24 : 14)} y={layout.unknown.y + layout.unknown.height / 2} core={unknownUnlocked ? speciesColors.ancient : 'var(--shapeships-grey-70)'} ring={unknownUnlocked ? speciesColors.xenite : 'var(--shapeships-grey-50)'} desktop={layout.desktop} />
          </g>
        </svg>
        <div className="absolute left-[10px] right-[10px] top-[12px] flex flex-col gap-[4px] @min-[640px]/findings:left-[14px] @min-[640px]/findings:right-[14px] @min-[720px]/findings:top-[20px] @min-[1040px]/findings:flex-row @min-[1040px]/findings:items-center @min-[1040px]/findings:justify-between">
          <h3 className="text-[14px] leading-[16px] font-bold  text-shapeships-white @min-[640px]/findings:text-[16px] @min-[720px]/findings:text-[18px] @min-[720px]/findings:leading-[20px]">MILKY WAY <span className='text-shapeships-grey-70'>/</span> ORION ARM <span className='text-shapeships-grey-70'>/</span> 2814</h3>
          <p className="text-[11px] leading-[16px] text-shapeships-grey-50 @min-[640px]/findings:text-[13px] @min-[720px]/findings:text-right">
            <span className="@min-[720px]/findings:hidden">Light-years from Sol (ly) / compressed scale</span>
            <span className="hidden items-center gap-[8px] @min-[720px]/findings:inline-flex">
              <span>Light-years from Sol (ly)</span><span className="text-shapeships-grey-70">/</span><span>Compressed scale</span>
            </span>
          </p>
        </div>
        {mapSystems.map((system) => {
          const point = layout.points[system.id];
          return <div key={system.id} data-system-label={system.id} className="absolute whitespace-nowrap text-[12px] leading-[16px] text-shapeships-white @min-[640px]/findings:text-[13px] @min-[720px]/findings:text-[14px]" style={{ left: point.labelX, top: point.labelY, transform: point.anchor === 'end' ? 'translateX(-100%)' : point.anchor === 'middle' ? 'translateX(-50%)' : undefined, textAlign: point.anchor === 'middle' ? 'center' : point.anchor === 'end' ? 'right' : 'left' }}>
            <p className="text-[12px] leading-[16px] font-bold @min-[640px]/findings:text-[13px] @min-[720px]/findings:text-[14px]">{point.splitName ? <>Delta<br />Aquarii</> : system.name}</p>
            <p className="mt-[2px] text-[11px] leading-[12px] font-medium text-shapeships-grey-20 @min-[640px]/findings:text-[12px] @min-[640px]/findings:leading-[16px]">{system.distance}</p>
          </div>;
        })}
        <p className="absolute text-[12px] leading-[16px] font-bold text-shapeships-white @min-[640px]/findings:text-[13px] @min-[720px]/findings:text-[14px]" style={{ left: layout.unknown.x + (layout.desktop ? 44 : 28), top: layout.unknown.y + layout.unknown.height / 2 - 8 }}>Unknown</p>
        <div className="absolute bottom-[14px] right-[12px] flex items-center gap-[4px] text-[10px] leading-[12px] font-regular text-shapeships-grey-50 @min-[640px]/findings:gap-[6px] @min-[640px]/findings:text-[12px] @min-[640px]/findings:leading-[16px] @min-[720px]/findings:text-[14px] @min-[720px]/findings:leading-[20px]">
          <span>Toward Galactic Center</span><ChevronRight aria-hidden="true" className="h-[16px] w-[16px] @min-[720px]/findings:h-[24px] @min-[720px]/findings:w-[24px]" />
        </div>
      </div>
      <div ref={cardsRef} className="mt-[16px] flex flex-col gap-[12px] @min-[640px]/findings:mt-[20px] @min-[640px]/findings:gap-[16px] @min-[720px]/findings:absolute @min-[720px]/findings:inset-0 @min-[720px]/findings:mt-0 @min-[720px]/findings:block">
        {systemCardOrder.map((id) => {
          const finding = findings.find((item) => item.id === id)!;
          const card = layout.desktop ? layout.cards[id] : undefined;
          return <div key={id} data-map-card={id} className="@min-[720px]/findings:absolute" style={card ? { left: card.x + 2, top: card.y + 2, width: card.width } : undefined}>{renderCard(finding)}</div>;
        })}
      </div>
    </div>
  );
}
