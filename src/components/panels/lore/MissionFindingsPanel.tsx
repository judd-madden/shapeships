import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { readCompletedMissionFindingIds } from '../../../game/client/gameSession/mission/missionChallengeSession';
import { isMissionFindingUnlocked } from '../../../game/client/gameSession/mission/missionFindingUnlocks';
import { missionFindings, type MissionFinding, type SpeciesLoreId } from './loreContent';
import { MissionFindingsMap } from './MissionFindingsMap';

const speciesText: Record<SpeciesLoreId, string> = {
  human: 'text-shapeships-pastel-blue',
  xenite: 'text-shapeships-pastel-green',
  centaur: 'text-shapeships-pastel-red',
  ancient: 'text-shapeships-pastel-purple',
};

function Matchups({ finding }: { finding: MissionFinding }) {
  return <p className="text-[12px] leading-[16px] font-bold text-shapeships-grey-50 @min-[640px]/findings:text-[13px]">
    {finding.matchups.map((species, index) => <Fragment key={index}>
      {index > 0 && ' + '}
      {species.map((id, speciesIndex) => <Fragment key={speciesIndex}>
        {speciesIndex === 1 ? ' v ' : speciesIndex > 1 ? speciesIndex === species.length - 1 ? ' & ' : ', ' : ''}
        <span className={speciesText[id]}>{id.toUpperCase()}</span>
      </Fragment>)}
    </Fragment>)}
  </p>;
}

/** Hidden authored text determines the exact wrapped height in both states. */
function FindingText({ unlocked, children, short = false }: {
  unlocked: boolean; children: ReactNode; short?: boolean;
}) {
  return <div className="relative min-w-0">
    <div className={unlocked ? undefined : 'invisible'} aria-hidden={unlocked ? undefined : true}>{children}</div>
    {!unlocked && <div aria-hidden="true" className={'pointer-events-none absolute inset-0 overflow-hidden ' + (short ? 'max-w-[48%]' : '')}>
      <div className="absolute inset-x-[1px] inset-y-[3px] opacity-60 blur-[3px]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, var(--shapeships-grey-70) 0px, var(--shapeships-grey-70) 5px, transparent 5px, transparent var(--finding-line))' }} />
    </div>}
  </div>;
}

export function MissionFindingCard({ finding, unlocked }: { finding: MissionFinding; unlocked: boolean }) {
  const crossSystem = !!finding.locations;
  return <article data-finding-id={finding.id} data-finding-unlocked={unlocked}
    aria-label={finding.topic + (unlocked ? ', unlocked' : ', locked')}
    className="relative min-w-0 rounded-[12px] border-2 border-shapeships-grey-70 bg-shapeships-black/95 p-[12px] text-shapeships-grey-20 [--finding-line:20px] @min-[340px]/findings:p-[16px] @min-[640px]/findings:[--finding-line:24px] @min-[720px]/findings:rounded-[8px] @min-[720px]/findings:p-[12px] @min-[720px]/findings:[--finding-line:16px]">
    <div className={(crossSystem ? '' : '@min-[720px]/findings:hidden ') + 'mb-[4px]'}>
      <div className="flex items-start justify-between gap-[8px]">
        <div className={'flex min-w-0 flex-wrap items-baseline gap-x-[16px] ' + (crossSystem && !unlocked ? '@min-[720px]/findings:invisible' : '')}>
          <h3 className={'text-[16px] leading-[20px] font-bold text-shapeships-white @min-[340px]/findings:text-[17px] @min-[640px]/findings:text-[18px] @min-[640px]/findings:leading-[24px] ' + (crossSystem ? '@min-[720px]/findings:text-[18px] @min-[720px]/findings:leading-[20px] @min-[720px]/findings:font-black' : '')}>{finding.topic}</h3>
          {finding.distanceLabel && <span className="text-[12px] leading-[16px] font-medium @min-[340px]/findings:text-[13px]">{finding.distanceLabel}</span>}
        </div>
        <span aria-hidden="true" className="h-[20px] w-[64px] shrink-0 @min-[720px]/findings:hidden" />
      </div>
      {crossSystem && <p className={'mt-[4px] text-[11px] leading-[16px] font-medium @min-[340px]/findings:text-[12px] @min-[720px]/findings:text-[11px] @min-[720px]/findings:leading-[12px] @min-[720px]/findings:uppercase ' + (!unlocked ? '@min-[720px]/findings:invisible' : '')}>
        {finding.locations!.map((location, index) => <Fragment key={location.name}>
          {index > 0 && ' / '}{location.name}
          {location.distanceLabel && <span className="@min-[720px]/findings:hidden"> ({location.distanceLabel})</span>}
        </Fragment>)}
      </p>}
    </div>
    {crossSystem && !unlocked && <div aria-hidden="true" className="absolute left-[12px] top-[16px] hidden h-[24px] w-[45%] opacity-60 blur-[3px] @min-[720px]/findings:block" style={{ background: 'repeating-linear-gradient(to bottom, var(--shapeships-grey-70) 0 5px, transparent 5px 16px)' }} />}
    <div className="flex flex-col gap-[4px]">
      <FindingText unlocked={unlocked} short><Matchups finding={finding} /></FindingText>
      <FindingText unlocked={unlocked}><div className="text-[14px] leading-[20px] font-normal [&_p]:[font-size:inherit] [&_p]:[line-height:inherit] @min-[340px]/findings:text-[15px] @min-[640px]/findings:text-[16px] @min-[640px]/findings:leading-[24px] @min-[720px]/findings:text-[14px] @min-[720px]/findings:leading-[16px]">{finding.content}</div></FindingText>
    </div>
    {!unlocked && <span className="absolute right-[12px] top-[12px] inline-flex items-center gap-[4px] rounded-[4px] border border-shapeships-grey-70 bg-shapeships-grey-90 px-[6px] py-[2px] text-[9px] leading-[12px] font-bold text-shapeships-grey-20 @min-[340px]/findings:right-[16px] @min-[340px]/findings:top-[16px] @min-[640px]/findings:text-[10px] @min-[720px]/findings:right-[10px] @min-[720px]/findings:top-[10px] @min-[720px]/findings:text-[9px]">
      <LockKeyhole aria-hidden="true" className="h-[10px] w-[10px]" />LOCKED
    </span>}
  </article>;
}

export function MissionFindingsPanel() {
  const [completedFindingIds] = useState(() => new Set(readCompletedMissionFindingIds()));
  return <MissionFindingsView completedFindingIds={completedFindingIds} />;
}

/** Presentation seam shared by the live session wrapper and focused rendering tests. */
export function MissionFindingsView({ completedFindingIds }: { completedFindingIds: ReadonlySet<string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loreWidth, setLoreWidth] = useState(390);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setLoreWidth(container.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const unlockedCount = missionFindings.filter((finding) => isMissionFindingUnlocked(finding, completedFindingIds)).length;
  const renderCard = (finding: MissionFinding) => <MissionFindingCard finding={finding} unlocked={isMissionFindingUnlocked(finding, completedFindingIds)} />;

  return <div ref={containerRef} className="@container/findings w-full min-w-0">
    
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-[12px] gap-y-[12px] @min-[720px]/findings:gap-y-[16px]">
        <h2 className="text-[24px] leading-[28px] font-black @min-[340px]/findings:text-[28px] @min-[340px]/findings:leading-[32px] @min-[640px]/findings:text-[32px] @min-[640px]/findings:leading-[36px] @min-[720px]/findings:text-[36px] @min-[720px]/findings:leading-[40px]">Mission Findings</h2>
        <p aria-label={unlockedCount + ' of ' + missionFindings.length + ' Mission Findings unlocked'} className="flex shrink-0 flex-col items-end gap-[2px] @min-[720px]/findings:row-span-2 @min-[720px]/findings:gap-[4px]">
          <span className="whitespace-nowrap text-[28px] leading-[32px] font-black tabular-nums @min-[340px]/findings:text-[32px] @min-[340px]/findings:leading-[36px] @min-[640px]/findings:text-[40px] @min-[640px]/findings:leading-[44px] @min-[720px]/findings:text-[52px] @min-[720px]/findings:leading-[56px]">{unlockedCount}/10</span>
          <span className="text-[9px] leading-[12px] font-bold tracking-[1px] text-shapeships-grey-20 @min-[640px]/findings:text-[10px] @min-[720px]/findings:text-[12px] @min-[720px]/findings:leading-[16px]">UNLOCKED</span>
        </p>
        <p className="col-span-2 text-[14px] leading-[20px] font-normal @min-[340px]/findings:text-[15px] @min-[640px]/findings:text-[16px] @min-[640px]/findings:leading-[24px] @min-[720px]/findings:col-span-1 @min-[720px]/findings:text-[20px] @min-[720px]/findings:leading-[28px]">
          Win Single Player games to unlock. <span className="inline-block text-shapeships-grey-50">Mission Findings reset each play session.</span>
        </p>
      </header>
      <div className="mt-[16px] @min-[720px]/findings:mt-[32px] @min-[1040px]/findings:mt-[40px]">
        <MissionFindingsMap findings={missionFindings} completedFindingIds={completedFindingIds} loreWidth={loreWidth} renderCard={renderCard} />
      </div>
      <section className="mt-[24px]">
        <h3 className="text-[11px] leading-[16px] font-bold tracking-[1px] text-shapeships-grey-20 @min-[640px]/findings:text-[12px]">CROSS-SYSTEM FINDINGS</h3>
        <div className="mt-[12px] grid min-w-0 grid-cols-1 items-start gap-[12px] @min-[640px]/findings:mt-[16px] @min-[640px]/findings:gap-[16px] @min-[720px]/findings:grid-cols-2 @min-[720px]/findings:gap-[24px]">
          {missionFindings.filter((finding) => finding.locations).map((finding) => <Fragment key={finding.id}>{renderCard(finding)}</Fragment>)}
        </div>
      </section>
  </div>;
}
