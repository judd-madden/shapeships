import { Fragment, useState } from 'react';
import { readCompletedMissionFindingIds } from '../../../game/client/gameSession/mission/missionChallengeSession';
import { isMissionFindingUnlocked } from '../../../game/client/gameSession/mission/missionFindingUnlocks';
import { missionFindings } from './loreContent';

const overviewGridClass = 'md:grid md:grid-cols-[130px_minmax(0,1fr)] md:gap-x-[20px]';

function LoreDivider() {
  return (
    <div className="relative h-px w-full shrink-0">
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(255,255,255,0)] via-50% via-[var(--shapeships-white)] to-[rgba(255,255,255,0)] opacity-70" />
    </div>
  );
}

function MissionFindingsHeader({ unlockedCount, totalCount }: { unlockedCount: number; totalCount: number }) {
  return (
    <>
      <div className="w-full mb-[16px] sm:mb-[24px]">
        <div className="flex w-full min-w-0 items-baseline gap-[12px] sm:gap-[16px]">
          <h2 className="min-w-0 font-black leading-[normal] text-[24px] sm:text-[36px]">
            Mission Findings
          </h2>
          <p
            aria-label={`${unlockedCount} of ${totalCount} Mission Findings unlocked`}
            className="shrink-0 text-[16px] font-medium leading-[20px] text-[var(--shapeships-grey-50)] sm:text-[20px] sm:leading-[24px]"
          >
            {unlockedCount}/{totalCount}
          </p>
        </div>
        <p className="my-[12px] text-[16px] leading-[22px] text-white sm:my-[20px] sm:text-[20px] sm:leading-[28px]">
          Win Single Player games to unlock. <span style={{ color: 'var(--shapeships-grey-50)' }}>Mission Findings reset each play session.</span>
        </p>
      </div>
      <LoreDivider />
    </>
  );
}

export function MissionFindingsPanel() {
  const [completedFindingIds] = useState(
    () => new Set(readCompletedMissionFindingIds()),
  );
  const unlockedCount = missionFindings.filter((finding) =>
    isMissionFindingUnlocked(finding, completedFindingIds)
  ).length;

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-[50px] sm:gap-[72px] px-[16px] pt-[12px] pb-[24px]  sm:px-[50px] sm:pt-[32px] sm:pb-[50px] bg-black/60 rounded-[10px]">
      <section className="flex w-full min-w-0 flex-col items-start">
        <MissionFindingsHeader unlockedCount={unlockedCount} totalCount={missionFindings.length} />
        {missionFindings.map((finding) => {
          const isUnlocked = isMissionFindingUnlocked(
            finding,
            completedFindingIds,
          );

          return (
            <Fragment key={finding.id}>
              <div className="flex w-full min-w-0 flex-col py-[12px] sm:py-[20px]">
                <div className={`${overviewGridClass} flex w-full min-w-0 flex-col gap-[4px] ${isUnlocked ? '' : 'blur-[14px]'}`}>
                  <p className="min-w-0 uppercase text-[14px] font-medium leading-[18px] text-[var(--shapeships-grey-50)] sm:text-[16px] sm:leading-[20px] sm:mt-[8px]">
                    {finding.topic}
                  </p>
                  <div className="min-w-0 text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
                    {finding.content}
                  </div>
                  {/* <p className="text-[12px] leading-[16px] text-[var(--shapeships-grey-50)] sm:text-[14px] sm:leading-[18px]">
                    {finding.author}
                  </p> */}
                </div>
              </div>
              <LoreDivider />
            </Fragment>
          );
        })}
      </section>
    </div>
  );
}
