import { Fragment } from 'react';
import {
  AI_AUTHOR,
  AI_WARNING,
  aiAnalysisRows,
  speciesLore,
  type SpeciesLoreId,
} from './loreContent';

const metadataGridClass = 'md:grid md:grid-cols-[minmax(0,1fr)_120px] md:gap-x-[30px]';
const analysisGridClass = 'md:grid md:grid-cols-[164px_minmax(0,1fr)] md:gap-x-[30px]';

function LoreDivider() {
  return (
    <div className="relative h-px w-full shrink-0">
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(255,255,255,0)] via-50% via-[var(--shapeships-white)] to-[rgba(255,255,255,0)] opacity-70" />
    </div>
  );
}

export function SpeciesLorePanel({ speciesId }: { speciesId: SpeciesLoreId }) {
  const lore = speciesLore[speciesId];

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-[48px] sm:gap-[64px] px-[16px] pt-[12px] pb-[24px]  sm:px-[50px] sm:pt-[32px] sm:pb-[50px] bg-black/60 rounded-[10px]">
      <article className="flex w-full min-w-0 flex-col items-start">
        <div className={`${metadataGridClass} w-full items-end`}>
          <h2 className="font-black leading-[normal] text-[24px] sm:text-[36px]">{lore.title}</h2>
          <p className="hidden text-[16px] leading-[24px] md:block">AUTHOR</p>
        </div>
        <div className="mt-[16px] w-full sm:mt-[24px]">
          <LoreDivider />
        </div>
        <div className={`${metadataGridClass} w-full min-w-0 pt-[16px] sm:pt-[30px]`}>
          <div className="flex min-w-0 flex-col gap-[18px] text-[16.5px] leading-[24px] sm:gap-[22px] sm:text-[20px] sm:leading-[32px]">
            {lore.content}
          </div>
          <p className="hidden text-[15px] leading-[22px] text-[var(--shapeships-grey-50)] sm:text-[18px] sm:leading-[28px] md:block">
            {lore.author}
          </p>
        </div>
        <p className="mt-[20px] text-[15px] leading-[22px] text-[var(--shapeships-grey-50)] sm:text-[18px] sm:leading-[28px] md:hidden">
          {lore.author}
        </p>
        <div className="mt-[16px] w-full sm:mt-[24px]">
          <LoreDivider />
        </div>
      </article>

      {Object.values(speciesLore).map((species) => {
        if (!species.imageSrc) return null;

        const isActive = species.id === speciesId;

        return (
          <img
            key={species.id}
            className={isActive ? 'h-auto w-full' : 'hidden h-auto w-full'}
            src={species.imageSrc}
            alt={isActive ? (species.imageAlt ?? `${species.name} fleet shapes`) : ''}
            aria-hidden={!isActive}
          />
        );
      })}

      <section className="flex w-full min-w-0 flex-col items-start">
        <div className="w-full md:hidden">
          <h2 className="font-black leading-[normal] text-[24px] sm:text-[36px]">
            An AI Analysis of the {lore.name} Species
          </h2>
          <p className="mt-[16px] text-[15px] leading-[22px] sm:text-[18px] sm:leading-[28px]">{AI_AUTHOR}</p>
          <p className="mt-[8px] text-[16.5px] italic leading-[24px] sm:text-[20px] sm:leading-[32px]">{AI_WARNING}</p>
        </div>

        <div className={`${metadataGridClass} hidden w-full items-start md:grid`}>
          <div>
            <h2 className="font-black leading-[normal] text-[24px] sm:text-[36px]">
              An AI Analysis of the {lore.name} Species
            </h2>
            <p className="mt-[16px] text-[16.5px] italic leading-[24px] sm:text-[20px] sm:leading-[32px]">{AI_WARNING}</p>
          </div>
          <div className="flex flex-col gap-[16px]">
            <p className="text-[16px] leading-[24px]">AUTHOR</p>
            <p className="text-[18px] leading-[28px] text-[var(--shapeships-grey-50)]">{AI_AUTHOR}</p>
          </div>
        </div>

        <div className="mt-[24px] w-full sm:mt-[30px]">
          <LoreDivider />
        </div>

        {aiAnalysisRows.map((row) => (
          <Fragment key={row.question}>
            <div className={`${analysisGridClass} flex w-full min-w-0 flex-col gap-[16px] py-[16px] sm:py-[30px]`}>
              <h3 className="font-bold leading-[24px] text-[16.5px] sm:text-[22px] sm:leading-[28px]">{row.question}</h3>
              <p className="min-w-0 text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
                {row.answers[speciesId]}
              </p>
            </div>
            <LoreDivider />
          </Fragment>
        ))}
      </section>
    </div>
  );
}
