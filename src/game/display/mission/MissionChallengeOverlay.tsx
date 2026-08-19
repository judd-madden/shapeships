import { Checkbox } from '../../../components/ui/primitives';
import { AnimatedEllipsisText } from '../../../components/ui/primitives/AnimatedEllipsisText';
import { ChallengeIcon } from '../../../components/ui/primitives/icons/ChallengeIcon';
import { CloseIcon } from '../../../components/ui/primitives/icons/CloseIcon';
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
  getChallengePresentationCopy,
  getMissionChallengeResultPresentation,
  interpolateMissionPlayer,
  type MissionOverlayMode,
} from './missionChallengePresentation';

const DISCORD_URL = 'https://discord.gg/MjPtf4G6Gt';

interface MissionChallengeOverlayProps {
  missionChallenge: MissionChallengeViewModel;
  loreUnlocked: boolean;
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
  loreUnlocked,
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
  const challengePresentation = challengeShip
    ? getChallengePresentationCopy({
        condition: missionChallenge.challenge.condition,
        playerSpecies,
        targetSpecies: challengeShip.species,
        targetShipType: challengeShip.shipType,
        targetShipName: challengeShip.name,
        targetPluralShipName: pluralizeShipName(challengeShip.name),
      })
    : {
        heading: `Win ${missionChallenge.challenge.condition} ${challengeShipId}`,
        explanatoryCopy: null,
      };
  const challengeInstructionClassName =
    missionChallenge.challenge.condition === 'with'
      ? 'text-[var(--shapeships-pastel-green)]'
      : 'text-[var(--shapeships-pastel-red)]';
  const playerSpeciesPresentation = SPECIES_PRESENTATION[playerSpecies];
  const opponentSpeciesPresentation = SPECIES_PRESENTATION[opponentSpecies];
  const resultPresentation = mode === 'result' && missionChallenge.result
    ? getMissionChallengeResultPresentation(missionChallenge.result)
    : null;
  const handleHeaderClose = mode === 'initial' ? onPlay : onClose;
  const challengeShipGraphicContent = ChallengeShipGraphic ? (
    <ChallengeShipGraphic className="max-h-[92px] max-w-full min-[768px]:max-w-[108px]" />
  ) : null;

  return (
    <div
      aria-labelledby="mission-challenge-title"
      aria-modal={mode === 'result' ? undefined : true}
      className="pointer-events-auto flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[10px] bg-[var(--shapeships-grey-90)] text-white shadow-[0_0_250px_160px_rgba(0,0,0,1)] min-[768px]:max-h-full min-[768px]:w-[900px] min-[768px]:max-w-[calc(100%_-_32px)]"
      role="dialog"
    >
      <div className="flex min-h-0 flex-1 flex-col px-[16px] pb-[24px] pt-[16px] min-[768px]:px-[50px] min-[768px]:pb-[36px] min-[768px]:pt-[40px]">
        <div className="hidden shrink-0 items-center justify-between gap-[24px] font-bold leading-none min-[768px]:flex">
          <div className="flex items-center gap-[16px]">
            <p className="text-[18px]">YOUR MISSION</p>
            {resultPresentation ? (
              <ResultStatusBadge
                label={resultPresentation.missionLabel}
                onClick={onClose}
                succeeded={resultPresentation.missionSucceeded}
                compact
              />
            ) : null}
            {resultPresentation && loreUnlocked ? (
              <LoreUnlockedIndicator className="hidden min-[768px]:flex" />
            ) : null}
          </div>
          <div className="flex items-center gap-[16px]">
            <SpeciesMatchup
              opponentSpeciesPresentation={opponentSpeciesPresentation}
              playerSpeciesPresentation={playerSpeciesPresentation}
            />
            <MissionCloseButton onClick={handleHeaderClose} />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-[8px] font-bold leading-none min-[768px]:hidden">
          <p className="shrink-0 text-[14px]">YOUR MISSION</p>
          <div className="flex min-w-0 items-center gap-[4px]">
            <SpeciesMatchup
              opponentSpeciesPresentation={opponentSpeciesPresentation}
              playerSpeciesPresentation={playerSpeciesPresentation}
            />
            <MissionCloseButton onClick={handleHeaderClose} />
          </div>
        </div>

        <div
          className={`mt-[12px] w-full shrink-0 items-start text-[12px] leading-[16px] min-[768px]:hidden ${
            resultPresentation
              ? 'grid grid-cols-[auto_auto_minmax(112px,1fr)] gap-[12px]'
              : 'flex gap-[24px]'
          }`}
        >
          <MissionMetadata label="YEAR" value={String(missionChallenge.mission.year)} />
          <MissionMetadata
            label="SYSTEM"
            value={formatMissionSystem(missionChallenge.mission.location).toUpperCase()}
          />
          {resultPresentation ? (
            <ResultStatusBadge
              label={resultPresentation.missionLabel}
              onClick={onClose}
              succeeded={resultPresentation.missionSucceeded}
              mobileMissionResult
            />
          ) : null}
        </div>

        <div className="mt-[12px] hidden w-auto shrink-0 items-start gap-[56px] text-[14px] leading-[16px] min-[768px]:flex">
          <MissionMetadata label="YEAR" value={String(missionChallenge.mission.year)} />
          <MissionMetadata
            label="SYSTEM"
            value={formatMissionSystem(missionChallenge.mission.location).toUpperCase()}
          />
        </div>

        <div className="mt-[12px] sm:mt-[20px] min-h-0 overflow-y-auto">
          <h2
            className="text-[26px] font-black italic leading-[30px] min-[768px]:text-[46px] min-[768px]:leading-none"
            id="mission-challenge-title"
          >
            {missionChallenge.mission.title}
          </h2>
          <div className="mt-[12px] space-y-[8px] text-[14px] leading-[20px] min-[768px]:mt-[20px] min-[768px]:space-y-[9px] min-[768px]:text-[22px] min-[768px]:leading-[30px]">
            {missionChallenge.mission.paragraphs.map((paragraph, index) => (
              <p key={index}>
                {interpolateMissionPlayer(paragraph, playerName)}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-[12px] sm:mt-[20px] grid shrink-0 grid-cols-[minmax(88px,110px)_minmax(0,1fr)] items-center gap-[18px] min-[768px]:grid-cols-[110px_minmax(0,1fr)_180px]">
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
            <p className={`mt-[8px] text-[18px] leading-[22px] min-[768px]:text-[26px] min-[768px]:leading-[30px] ${challengeInstructionClassName}`}>
              {challengePresentation.heading}
            </p>
            {challengePresentation.explanatoryCopy ? (
              <p className="mt-[4px] text-[12px] sm:text-[14px] sm:mt-[12px] leading-[15px] text-[var(--shapeships-grey-20)]">
                {challengePresentation.explanatoryCopy}
              </p>
            ) : null}
          </div>

          {resultPresentation ? (
            <ResultStatusBadge
              label={resultPresentation.challengeLabel}
              onClick={onClose}
              succeeded={resultPresentation.challengeSucceeded}
            />
          ) : mode === 'initial' ? (
            <button
              aria-busy={missionChallenge.isIntroAcknowledgementPending}
              className={`col-span-2 h-[50px] w-full rounded-[10px] text-[18px] font-black text-black transition-colors min-[768px]:col-span-1 min-[768px]:w-[180px] ${
                missionChallenge.isIntroAcknowledgementPending
                  ? 'cursor-not-allowed bg-[var(--shapeships-grey-50)]'
                  : 'cursor-pointer bg-white hover:bg-[var(--shapeships-grey-20)]'
              }`}
              disabled={missionChallenge.isIntroAcknowledgementPending}
              onClick={onPlay}
              type="button"
            >
              <AnimatedEllipsisText
                text={missionChallenge.isIntroAcknowledgementPending
                  ? 'ENTERING...'
                  : 'PLAY'}
              />
            </button>
          ) : mode === 'reopen' ? (
            <button
              className="col-span-2 h-[50px] w-full rounded-[10px] bg-white text-[18px] font-black text-black transition-colors hover:bg-[var(--shapeships-grey-20)] min-[768px]:col-span-1 min-[768px]:w-[180px]"
              onClick={onClose}
              type="button"
            >
              CLOSE
            </button>
          ) : null}
        </div>

        {resultPresentation && loreUnlocked ? (
          <LoreUnlockedIndicator className="mt-[16px] flex justify-center min-[768px]:hidden" />
        ) : null}
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
            label="Ignore Missions this session"
            labelClassName="whitespace-nowrap text-[15px] leading-none text-white"
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

function LoreUnlockedIndicator({ className }: { className: string }) {
  return (
    <div className={`${className} items-center gap-[8px] text-[16px] font-medium leading-none`}>
      <span
        aria-hidden="true"
        className="size-[12px] shrink-0 rounded-full bg-[var(--shapeships-pastel-purple)]"
      />
      <span className="ss-missionLoreUnlockedText">Lore Unlocked</span>
    </div>
  );
}

function ResultStatusBadge({
  label,
  onClick,
  succeeded,
  compact = false,
  mobileMissionResult = false,
}: {
  label: 'COMPLETE' | 'FAILED' | 'INCOMPLETE';
  onClick: () => void;
  succeeded: boolean;
  compact?: boolean;
  mobileMissionResult?: boolean;
}) {
  return (
    <button
      className={`flex cursor-pointer items-center justify-center rounded-[10px] text-[16px] font-black outline-none transition-transform duration-150 min-[768px]:hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white ${succeeded ? 'text-black' : 'text-white'} ${
        mobileMissionResult
          ? 'h-[50px] min-w-[112px] px-[12px]'
          : compact
            ? 'h-[36px] min-w-[124px] px-[16px] min-[768px]:h-[50px] min-[768px]:w-[180px] min-[768px]:text-[18px]'
            : 'col-span-2 h-[50px] w-full text-[18px] min-[768px]:col-span-1 min-[768px]:w-[180px]'
      }`}
      style={{
        background: succeeded
          ? 'var(--shapeships-green)'
          : 'var(--shapeships-grey-70)',
      }}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function SpeciesMatchup({
  playerSpeciesPresentation,
  opponentSpeciesPresentation,
}: {
  playerSpeciesPresentation: { label: string; className: string };
  opponentSpeciesPresentation: { label: string; className: string };
}) {
  return (
    <p className="flex items-center gap-[6px] whitespace-nowrap text-[14px] min-[768px]:gap-[8px] min-[768px]:text-[18px]">
      <span className={playerSpeciesPresentation.className}>
        {playerSpeciesPresentation.label}
      </span>
      <span>vs</span>
      <span className={opponentSpeciesPresentation.className}>
        {opponentSpeciesPresentation.label}
      </span>
    </p>
  );
}

function MissionCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Close Mission & Challenge"
      className="flex size-[32px] shrink-0 items-center justify-center bg-transparent p-0 text-white outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white"
      onClick={onClick}
      type="button"
    >
      <CloseIcon />
    </button>
  );
}

function MissionMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-baseline min-[768px]:gap-[12px]">
      <span className="text-[var(--shapeships-grey-50)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
