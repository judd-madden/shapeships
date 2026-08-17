import type { CSSProperties } from 'react';
import { FitSingleLineText } from '../../../components/ui/primitives/layout/FitSingleLineText';
import type { MatchupIntroViewModel } from '../../client/gameSession/matchupIntro';
import { usePrefersReducedMotion } from '../shared/usePrefersReducedMotion';
import {
  MATCHUP_INTRO_MOTION_DURATION_MS,
  MATCHUP_INTRO_SPECIES_STAGGER_MS,
} from './useMatchupIntroPresentation';

type MatchupVariant = 'desktop' | 'mobile';
type MatchupDirection = 'from-right' | 'from-left' | 'from-bottom' | 'from-top';
type MatchupPlayer = MatchupIntroViewModel['localPlayer'];

const SPECIES_PRESENTATION = {
  human: { label: 'HUMAN', color: 'var(--shapeships-pastel-blue)' },
  xenite: { label: 'XENITE', color: 'var(--shapeships-pastel-green)' },
  centaur: { label: 'CENTAUR', color: 'var(--shapeships-pastel-red)' },
  ancient: { label: 'ANCIENT', color: 'var(--shapeships-pastel-purple)' },
} as const;

function animationStyle(): CSSProperties {
  return {
    '--ss-matchup-duration': `${MATCHUP_INTRO_MOTION_DURATION_MS}ms`,
    '--ss-matchup-species-delay': `${MATCHUP_INTRO_SPECIES_STAGGER_MS}ms`,
  } as CSSProperties;
}

function LayeredName({ name, variant }: { name: string; variant: MatchupVariant }) {
  const maxFontSize = variant === 'desktop' ? 100 : 50;
  const sharedClassName = variant === 'desktop'
    ? 'h-[100px] w-full text-[100px] font-black italic leading-none'
    : 'h-[50px] w-full text-[50px] font-black italic leading-none';

  return (
    <div className="ss-matchup-line relative w-full">
      <div aria-hidden="true" className="ss-matchup-shadow ss-matchup-name-shadow absolute inset-0">
        <FitSingleLineText
          text={name}
          maxFontSize={maxFontSize}
          minFontSize={12}
          align="center"
          className={`${sharedClassName} text-[var(--shapeships-grey-50)] opacity-70`}
        />
      </div>
      <FitSingleLineText
        text={name}
        maxFontSize={maxFontSize}
        minFontSize={12}
        align="center"
        className={`${sharedClassName} relative text-white`}
      />
    </div>
  );
}

function LayeredSpecies({ player, variant }: { player: MatchupPlayer; variant: MatchupVariant }) {
  const presentation = SPECIES_PRESENTATION[player.speciesId];
  const className = variant === 'desktop'
    ? 'text-[50px] font-black leading-none'
    : 'text-[25px] font-black leading-none';

  return (
    <div className="ss-matchup-line ss-matchup-species-line relative w-full text-center">
      <span
        aria-hidden="true"
        className={`ss-matchup-shadow ss-matchup-species-shadow absolute inset-0 ${className} text-[var(--shapeships-grey-70)] opacity-70`}
      >
        {presentation.label}
      </span>
      <span className={`relative ${className}`} style={{ color: presentation.color }}>
        {presentation.label}
      </span>
    </div>
  );
}

export function MatchupIntroPlayerOverlay({
  matchupIntro,
  player,
  variant,
  direction,
}: {
  matchupIntro: MatchupIntroViewModel;
  player: MatchupPlayer;
  variant: MatchupVariant;
  direction: MatchupDirection;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const gapClassName = variant === 'desktop' ? 'gap-[8px]' : 'gap-[4px]';
  const nameSpacerClassName = variant === 'desktop' ? 'h-[100px]' : 'h-[50px]';
  const speciesSpacerClassName = variant === 'desktop' ? 'h-[50px]' : 'h-[25px]';

  const sharedPlayerClassName =
    `ss-matchup-player ss-matchup-player--${variant} ss-matchup-player--${direction}`;

  const sharedProps = {
    'aria-hidden': true,
    'data-reduced-motion': prefersReducedMotion ? 'true' : 'false',
    style: animationStyle(),
  } as const;

  return (
    <>
      {/* Name owns the complete 3150ms motion duration. */}
      <div
        key={`${matchupIntro.presentationKey}:${direction}:name`}
        className={`${sharedPlayerClassName} ss-matchup-player--name`}
        {...sharedProps}
      >
        <div className={`ss-matchup-player-stack ${gapClassName}`}>
          <LayeredName name={player.name} variant={variant} />

          {/* Preserve the exact original combined-stack geometry. */}
          <div
            aria-hidden="true"
            className={`w-full shrink-0 ${speciesSpacerClassName}`}
          />
        </div>
      </div>

      {/* Species runs the identical travel, delayed by 150ms. */}
      <div
        key={`${matchupIntro.presentationKey}:${direction}:species`}
        className={`${sharedPlayerClassName} ss-matchup-player--species`}
        {...sharedProps}
      >
        <div className={`ss-matchup-player-stack ${gapClassName}`}>
          {/* Preserve the exact original combined-stack geometry. */}
          <div
            aria-hidden="true"
            className={`w-full shrink-0 ${nameSpacerClassName}`}
          />

          <LayeredSpecies player={player} variant={variant} />
        </div>
      </div>
    </>
  );
}

export function MatchupIntroVersus({
  matchupIntro,
  variant,
}: {
  matchupIntro: MatchupIntroViewModel;
  variant: MatchupVariant;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const className = variant === 'desktop' ? 'text-[100px]' : 'text-[50px]';

  return (
    <div
      key={`${matchupIntro.presentationKey}:vs:${variant}`}
      aria-hidden="true"
      className={`ss-matchup-vs ss-matchup-vs--${variant} relative font-black italic leading-none ${className}`}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      style={animationStyle()}
    >
      <span
        aria-hidden="true"
        className="ss-matchup-shadow ss-matchup-vs-shadow absolute inset-0 text-[var(--shapeships-grey-50)] opacity-70"
      >
        vs
      </span>
      <span className="relative text-white">vs</span>
    </div>
  );
}
