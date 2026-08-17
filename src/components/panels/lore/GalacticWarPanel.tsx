import { Fragment } from 'react';
import { generalLoreRows } from './loreContent';

const overviewGridClass = 'md:grid md:grid-cols-[130px_minmax(0,1fr)] md:gap-x-[20px]';

function LoreDivider() {
  return (
    <div className="relative h-px w-full shrink-0">
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(255,255,255,0)] via-50% via-[var(--shapeships-white)] to-[rgba(255,255,255,0)] opacity-70" />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <>
      <div className={`${overviewGridClass} w-full items-end mb-[16px] sm:mb-[24px]`}>
        <h2 className="min-w-0 font-black leading-[normal] text-[24px] sm:text-[36px] md:col-span-2">
          {title}
        </h2>
        {/* <p className="hidden text-[16px] leading-[24px] md:block">AUTHOR</p> */}
      </div>
      <LoreDivider />
    </>
  );
}

export function GalacticWarPanel() {
  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-[50px] sm:gap-[72px] px-[16px] pt-[12px] pb-[24px]  sm:px-[50px] sm:pt-[32px] sm:pb-[50px] bg-black/60 rounded-[10px]">
      <section className="flex w-full min-w-0 flex-col items-start">
        <SectionHeader title="The Galactic War" />
        {generalLoreRows.map((row, index) => {
          const debatedClass = row.status === 'debated' ? 'text-[var(--shapeships-grey-50)]' : 'text-white';

          return (
            <Fragment key={`${row.status}-${index}`}>
              <div className={`${overviewGridClass} ${debatedClass} flex w-full min-w-0 flex-col gap-[4px] py-[12px] sm:py-[20px]`}>
                <p className="font-bold leading-[22px] text-[16px] sm:text-[22px] sm:leading-[26px]">
                  {row.status === 'fact' ? 'Fact' : 'Debated'}
                </p>
                <div className="min-w-0 text-[16px] leading-[22px] sm:text-[20px] sm:leading-[26px]">
                  {row.content}
                </div>

                {/* <p className="text-[15px] leading-[22px] text-[var(--shapeships-grey-50)] sm:text-[18px] sm:leading-[28px]">
                  {row.author}
                </p> */}
              </div>
              <LoreDivider />
            </Fragment>
          );
        })}
      </section>
    </div>
  );
}
