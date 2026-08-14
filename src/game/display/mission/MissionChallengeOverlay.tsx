import { Checkbox } from '../../../components/ui/primitives';
import { ChallengeIcon } from '../../../components/ui/primitives/icons/ChallengeIcon';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { MissionChallengeViewModel } from '../../client/gameSession/types';
import { pluralizeShipName } from '../../data/ShipDefinitionNames';
import { SHIP_DEFINITIONS_MAP } from '../../data/ShipDefinitionsUI';
import type { ShipDefId } from '../../types/ShipTypes.engine';
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
  onChallengeShipInspect?: (shipDefId: ShipDefId) => void;
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
  onChallengeShipInspect,
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
  const challengeShipGraphicContent = ChallengeShipGraphic ? (
    <ChallengeShipGraphic className="max-h-[92px] max-w-full min-[768px]:max-w-[108px]" />
  ) : null;

  return (
    <div
      aria-labelledby="mission-challenge-title"
      aria-modal="true"
      className="pointer-events-auto flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[10px] bg-[var(--shapeships-grey-90)] text-white shadow-[0_0_250px_rgba(0,0,0,1.0)] min-[768px]:max-h-full min-[768px]:w-[900px] min-[768px]:max-w-[calc(100%_-_32px)]"
      role="dialog"
    >
      <div className="flex min-h-0 flex-1 flex-col px-[16px] pb-[24px] pt-[16px] min-[768px]:px-[50px] min-[768px]:pb-[36px] min-[768px]:pt-[40px]">
        <div className="flex shrink-0 flex-col items-start gap-[12px] font-bold leading-none min-[768px]:flex-row min-[768px]:items-center min-[768px]:justify-between min-[768px]:gap-[24px]">
          <p className="text-[14px] min-[768px]:text-[18px]">YOUR MISSION</p>
          <p className="flex items-center gap-[8px] whitespace-nowrap text-[14px] min-[768px]:text-[18px]">
            <span className={playerSpeciesPresentation.className}>
              {playerSpeciesPresentation.label}
            </span>
            <span>vs</span>
            <span className={opponentSpeciesPresentation.className}>
              {opponentSpeciesPresentation.label}
            </span>
          </p>
        </div>

        <div className="mt-[18px] grid w-full shrink-0 grid-cols-2 items-start gap-[16px] text-[12px] leading-[16px] min-[768px]:flex min-[768px]:w-auto min-[768px]:gap-[56px] min-[768px]:text-[14px]">
          <MissionMetadata label="YEAR" value={String(missionChallenge.mission.year)} />
          <MissionMetadata
            label="SYSTEM"
            value={formatMissionSystem(missionChallenge.mission.location).toUpperCase()}
          />
        </div>

        <div className="mt-[20px] min-h-0 overflow-y-auto pr-[4px] min-[768px]:pr-[8px]">
          <h2
            className="text-[26px] font-black italic leading-[30px] min-[768px]:text-[46px] min-[768px]:leading-1"
            id="mission-challenge-title"
          >
            {missionChallenge.mission.title}
          </h2>
          <div className="mt-[16px] space-y-[8px] text-[14px] leading-[20px] min-[768px]:mt-[20px] min-[768px]:space-y-[9px] min-[768px]:text-[22px] min-[768px]:leading-[28px]">
            {missionChallenge.mission.paragraphs.map((paragraph, index) => (
              <p key={index}>
                {interpolateMissionPlayer(paragraph, playerName)}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-[20px] grid shrink-0 grid-cols-[minmax(88px,110px)_minmax(0,1fr)] items-center gap-[18px] min-[768px]:grid-cols-[110px_minmax(0,1fr)_180px]">
          {onChallengeShipInspect && challengeShip ? (
            <button
              aria-label={`Inspect ${challengeShip.name} ship reference`}
              className="flex h-[96px] w-full items-center justify-center rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-white min-[768px]:w-[110px]"
              onClick={() => onChallengeShipInspect(challengeShipId)}
              type="button"
            >
              {challengeShipGraphicContent}
            </button>
          ) : (
            <div
              aria-label={`${challengeShip?.name ?? challengeShipId} ship reference`}
              className="flex h-[96px] w-full items-center justify-center rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-white min-[768px]:w-[110px]"
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
              {challengeShipGraphicContent}
            </div>
          )}

          <div className="min-w-0 self-center">
            <div className="flex items-center gap-[10px]">
              <ChallengeIcon className="h-[22px] w-auto shrink-0 text-white min-[768px]:h-[25px]" />
              <p className="text-[14px] font-bold leading-none min-[768px]:text-[18px]">OPTIONAL CHALLENGE</p>
            </div>
            <p className="mt-[8px] text-[18px] leading-[22px] text-[var(--shapeships-pastel-red)] min-[768px]:text-[26px] min-[768px]:leading-[30px]">
              {challengeCopy}
            </p>
            {explanatoryCopy ? (
              <p className="mt-[6px] text-[12px] leading-[15px] text-[var(--shapeships-grey-20)]">
                {explanatoryCopy}
              </p>
            ) : null}
          </div>

          <button
            className="col-span-2 h-[50px] w-full rounded-[10px] bg-white text-[18px] font-black text-black transition-colors hover:bg-[var(--shapeships-grey-20)] min-[768px]:col-span-1 min-[768px]:w-[180px]"
            onClick={primaryAction}
            type="button"
          >
            {primaryLabel}
          </button>
        </div>
      </div>

      <div className="flex min-h-[54px] shrink-0 flex-col items-center bg-[var(--shapeships-grey-70)] px-[16px] py-[16px] text-[15px] leading-[20px] min-[768px]:flex-row min-[768px]:flex-wrap min-[768px]:justify-between min-[768px]:gap-x-[24px] min-[768px]:gap-y-[10px] min-[768px]:px-[38px] min-[768px]:py-[12px] min-[768px]:leading-none">
        <p className="text-center min-[768px]:text-left">
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
        <div className="mt-[14px] flex w-full justify-center border-t border-white/30 pt-[14px] min-[768px]:mt-0 min-[768px]:w-auto min-[768px]:justify-start min-[768px]:border-0 min-[768px]:pt-0">
          <Checkbox
            checked={missionChallenge.minimizeMissionsThisSession}
            className="shrink-0"
            label="Minimize Missions this session"
            labelClassName="whitespace-nowrap text-[15px] font-medium leading-none text-white"
            onChange={onSetMinimizeMissionsThisSession}
          />
        </div>
      </div>

      {!onChallengeShipInspect && challengeShip && hover.presentState.activeShipId && hover.presentState.anchorRect ? (
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
    <div className="flex flex-col gap-[4px] min-[768px]:flex-row min-[768px]:items-baseline min-[768px]:gap-[12px]">
      <span className="text-[var(--shapeships-grey-50)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
