import { Checkbox } from '../../../components/ui/primitives';
import { ChallengeIcon } from '../../../components/ui/primitives/icons/ChallengeIcon';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { MissionChallengeViewModel } from '../../client/gameSession/types';
import { pluralizeShipName } from '../../data/ShipDefinitionNames';
import { SHIP_DEFINITIONS_MAP } from '../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../graphics/resolveShipGraphic';
import { ShipHoverCard } from '../actionPanel/panels/catalogue/shared/ShipHoverCard';
import { useShipCatalogueHover } from '../actionPanel/panels/catalogue/shared/useShipCatalogueHover';
import {
  formatMissionSystem,
  getChallengeExplanatoryCopy,
  interpolateMissionPlayer,
  type MissionOverlayMode,
} from './missionChallengePresentation';

const DISCORD_URL = 'https://discord.gg/MjPtf4G6Gt';

interface MissionChallengeOverlayProps {
  missionChallenge: MissionChallengeViewModel;
  playerSpecies: SpeciesId;
  opponentSpecies: SpeciesId;
  playerName: string;
  mode: MissionOverlayMode;
  onPlay: () => void;
  onClose: () => void;
  onSetMinimizeMissionsThisSession: (enabled: boolean) => void;
}

const SPECIES_PRESENTATION: Record<SpeciesId, { label: string; className: string }> = {
  human: {
    label: 'HUMAN',
    className: 'text-[var(--shapeships-pastel-blue)]',
  },
  xenite: {
    label: 'XENITE',
    className: 'text-[var(--shapeships-pastel-green)]',
  },
  centaur: {
    label: 'CENTAUR',
    className: 'text-[var(--shapeships-pastel-red)]',
  },
  ancient: {
    label: 'ANCIENT',
    className: 'text-[var(--shapeships-pastel-purple)]',
  },
};

export function MissionChallengeOverlay({
  missionChallenge,
  playerSpecies,
  opponentSpecies,
  playerName,
  mode,
  onPlay,
  onClose,
  onSetMinimizeMissionsThisSession,
}: MissionChallengeOverlayProps) {
  const hover = useShipCatalogueHover();
  const challengeShipId = missionChallenge.challenge.shipDefId;
  const challengeShip = SHIP_DEFINITIONS_MAP[challengeShipId];
  const challengeGraphic = challengeShip
    ? resolveShipGraphic(challengeShip, { context: 'default' })
    : null;
  const ChallengeShipGraphic = challengeGraphic?.component;
  const pluralShipName = challengeShip
    ? pluralizeShipName(challengeShip.name)
    : challengeShipId;
  const challengeCopy = `Win ${missionChallenge.challenge.condition} ${pluralShipName}`;
  const explanatoryCopy = challengeShip
    ? getChallengeExplanatoryCopy({
        playerSpecies,
        targetSpecies: challengeShip.species,
        targetShipType: challengeShip.shipType,
      })
    : null;
  const playerSpeciesPresentation = SPECIES_PRESENTATION[playerSpecies];
  const opponentSpeciesPresentation = SPECIES_PRESENTATION[opponentSpecies];
  const primaryLabel = mode === 'initial' ? 'PLAY' : 'CLOSE';
  const primaryAction = mode === 'initial' ? onPlay : onClose;

  return (
    <div
      aria-labelledby="mission-challenge-title"
      aria-modal="true"
      className="pointer-events-auto flex max-h-full w-[900px] max-w-[calc(100%_-_32px)] flex-col overflow-hidden rounded-[10px] bg-[var(--shapeships-grey-90)] text-white shadow-[0_0_250px_rgba(0,0,0,1.0)]"
      role="dialog"
    >
      <div className="flex min-h-0 flex-1 flex-col px-[50px] pb-[36px] pt-[40px]">
        <div className="flex shrink-0 items-center justify-between gap-[24px] font-bold leading-none">
          <p className="text-[18px]">YOUR MISSION</p>
          <p className="flex items-center text-[18px] gap-[8px] whitespace-nowrap">
            <span className={playerSpeciesPresentation.className}>
              {playerSpeciesPresentation.label}
            </span>
            <span>vs</span>
            <span className={opponentSpeciesPresentation.className}>
              {opponentSpeciesPresentation.label}
            </span>
          </p>
        </div>

        <div className="mt-[18px] flex shrink-0 items-start gap-[56px] text-[14px] leading-[16px]">
          <MissionMetadata label="YEAR" value={String(missionChallenge.mission.year)} />
          <MissionMetadata
            label="SYSTEM"
            value={formatMissionSystem(missionChallenge.mission.location).toUpperCase()}
          />
        </div>

        <div className="mt-[20px] min-h-0 overflow-y-auto pr-[8px]">
          <h2
            className="text-[46px] font-black italic leading-1"
            id="mission-challenge-title"
          >
            {missionChallenge.mission.title}
          </h2>
          <div className="mt-[20px] space-y-[9px] text-[22px] leading-[28px]">
            {missionChallenge.mission.paragraphs.map((paragraph, index) => (
              <p key={index}>
                {interpolateMissionPlayer(paragraph, playerName)}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-[20px] grid shrink-0 grid-cols-[110px_minmax(0,1fr)_180px] items-center gap-[18px]">
          <div
            aria-label={`${challengeShip?.name ?? challengeShipId} ship reference`}
            className="flex h-[96px] w-[110px] items-center justify-center rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-white"
            onBlur={() => hover.onLeave(challengeShipId)}
            onFocus={(event) => {
              if (challengeShip) hover.onEnter(challengeShipId, event.currentTarget);
            }}
            onMouseEnter={(event) => {
              if (challengeShip) hover.onEnter(challengeShipId, event.currentTarget);
            }}
            onMouseLeave={() => hover.onLeave(challengeShipId)}
            role="img"
            tabIndex={challengeShip ? 0 : -1}
          >
            {ChallengeShipGraphic ? (
              <ChallengeShipGraphic className="max-h-[92px] max-w-[108px]" />
            ) : null}
          </div>

          <div className="min-w-0 self-center">
            <div className="flex items-center gap-[10px]">
              <ChallengeIcon className="h-[25px] w-auto shrink-0 text-white" />
              <p className="text-[18px] font-bold leading-none">OPTIONAL CHALLENGE</p>
            </div>
            <p className="mt-[8px] text-[26px] leading-[30px] text-[var(--shapeships-pastel-red)]">
              {challengeCopy}
            </p>
            {explanatoryCopy ? (
              <p className="mt-[6px] text-[12px] leading-[15px] text-[var(--shapeships-grey-20)]">
                {explanatoryCopy}
              </p>
            ) : null}
          </div>

          <button
            className="h-[50px] w-[180px] rounded-[10px] bg-white text-[18px] font-black text-black transition-colors hover:bg-[var(--shapeships-grey-20)]"
            onClick={primaryAction}
            type="button"
          >
            {primaryLabel}
          </button>
        </div>
      </div>

      <div className="flex min-h-[54px] shrink-0 flex-wrap items-center justify-between gap-x-[24px] gap-y-[10px] bg-[var(--shapeships-grey-70)] px-[38px] py-[12px] text-[15px] leading-none ">
        <p>
          Have a mission idea?{' '}
          <a
            className="underline hover:opacity-80"
            href={DISCORD_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Share it on Discord #shapeships
          </a>{' '}
          or DM juddly
        </p>
        <Checkbox
          checked={missionChallenge.minimizeMissionsThisSession}
          className="shrink-0"
          label="Minimize Missions this session"
          labelClassName="whitespace-nowrap text-[15px] font-medium leading-none text-white"
          onChange={onSetMinimizeMissionsThisSession}
        />
      </div>

      {challengeShip && hover.presentState.activeShipId && hover.presentState.anchorRect ? (
        <ShipHoverCard
          anchorRect={hover.presentState.anchorRect}
          eligibility={{ state: 'REFERENCE_ONLY' }}
          motionState={hover.motionState}
          shipId={hover.presentState.activeShipId}
        />
      ) : null}
    </div>
  );
}

function MissionMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-[12px]">
      <span className="text-[var(--shapeships-grey-50)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
