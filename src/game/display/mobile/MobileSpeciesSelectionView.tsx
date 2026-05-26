import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CopiedToast } from '../../../components/ui/primitives/CopiedToast';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import { BlackCarrierIcon } from '../../../components/ui/primitives/icons/BlackCarrierIcon';
import { BlackMercuryCoreIcon } from '../../../components/ui/primitives/icons/BlackMercuryCoreIcon';
import { BlackShipOfWisdomIcon } from '../../../components/ui/primitives/icons/BlackShipOfWisdomIcon';
import { BlackXeniteIcon } from '../../../components/ui/primitives/icons/BlackXeniteIcon';
import { CopyIcon } from '../../../components/ui/primitives/icons/CopyIcon';
import type {
  BoardViewModel,
  BottomActionRailViewModel,
  GameSessionActions,
  HudStatusTone,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';
import { MobileStatusRailFrame, type MobileStatusRailRowData } from './MobileStatusRail';

type MobileChooseSpeciesViewModel = Extract<BoardViewModel, { mode: 'choose_species' }>;

interface MobileSpeciesSelectionViewProps {
  hudVm: HudViewModel;
  boardVm: MobileChooseSpeciesViewModel;
  leftRailVm: LeftRailViewModel;
  actions: Pick<GameSessionActions, 'onSelectSpecies' | 'onCopyGameUrl'>;
}

interface MobileSpeciesConfirmPhaseProps {
  boardVm: MobileChooseSpeciesViewModel;
  bottomActionRailVm: BottomActionRailViewModel;
  actions: Pick<GameSessionActions, 'onConfirmSpecies'>;
}

interface MobileSpeciesOption {
  speciesId: SpeciesId;
  title: string;
  blurb: string;
  backgroundClassName: string;
  icon: ReactNode;
}

const MOBILE_SPECIES_OPTIONS: MobileSpeciesOption[] = [
  {
    speciesId: 'human',
    title: 'HUMAN',
    blurb: 'Metal. Explosions. Expansion.',
    backgroundClassName: 'bg-[var(--shapeships-pastel-blue)]',
    icon: <BlackCarrierIcon className="h-[28px] w-[34px]" color="black" />,
  },
  {
    speciesId: 'xenite',
    title: 'XENITE',
    blurb: 'Swarm. Queen. Hive.',
    backgroundClassName: 'bg-[var(--shapeships-pastel-green)]',
    icon: <BlackXeniteIcon className="h-[30px] w-[30px]" color="black" />,
  },
  {
    speciesId: 'centaur',
    title: 'CENTAUR',
    blurb: 'Power. Timing. Domination.',
    backgroundClassName: 'bg-[var(--shapeships-pastel-red)]',
    icon: <BlackShipOfWisdomIcon className="h-[34px] w-[34px]" color="black" />,
  },
  {
    speciesId: 'ancient',
    title: 'ANCIENT',
    blurb: 'Energy. Solar Powers.',
    backgroundClassName: 'bg-[var(--shapeships-pastel-purple)]',
    icon: <BlackMercuryCoreIcon className="h-[38px] w-[22px]" color="black" />,
  },
];

export function MobileSpeciesSelectionView({
  hudVm,
  boardVm,
  leftRailVm,
  actions,
}: MobileSpeciesSelectionViewProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col w-full">
      <MobileShareGameUrlRegion gameUrl={boardVm.gameUrl} onCopyGameUrl={actions.onCopyGameUrl} />
      <MobileSpeciesStatusRail hudVm={hudVm} boardVm={boardVm} leftRailVm={leftRailVm} />
      <MobileChooseSpeciesRegion boardVm={boardVm} onSelectSpecies={actions.onSelectSpecies} />
    </div>
  );
}

export function MobileSpeciesConfirmPhase({
  boardVm,
  bottomActionRailVm,
  actions,
}: MobileSpeciesConfirmPhaseProps) {
  const selectedSpeciesName = boardVm.selectedSpecies.toUpperCase();
  const isAncientSelected = boardVm.selectedSpecies === 'ancient';
  const confirmButtonPrefix = boardVm.isSpeciesSelectionComplete
    ? 'CONFIRMED'
    : isAncientSelected
      ? 'DISABLED'
      : 'CONFIRM';
  const confirmDisabled = !boardVm.canConfirmSpecies;
  const confirmDisabledReason =
    !boardVm.isSpectator && !boardVm.isSpeciesSelectionComplete && confirmDisabled
      ? boardVm.confirmDisabledReason ?? null
      : null;

  return (
    <div className="shrink-0 w-full flex flex-col items-center gap-[9px] px-[14px]">

      {boardVm.isSpectator ? (
        <div className="h-[44px] w-full" aria-hidden="true" />
      ) : (
        <button
          type="button"
          disabled={confirmDisabled}
          onClick={actions.onConfirmSpecies}
          className={`flex h-[44px] w-full items-center justify-center gap-[5px] rounded-[5px] px-[14px] text-black transition-transform ${
            confirmDisabled
              ? 'bg-[var(--shapeships-grey-50)] cursor-not-allowed'
              : 'bg-white cursor-pointer active:scale-[0.99]'
          }`}
        >
          <span
            className="min-w-0 truncate text-[16px] font-black leading-none"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {confirmButtonPrefix}
          </span>
          <span
            className="min-w-0 truncate text-[15px] font-normal leading-none"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            - {selectedSpeciesName}
          </span>
        </button>
      )}

      {confirmDisabledReason ? (
        <p
          className="mt-[-4px] w-full truncate text-center text-[11px] text-[var(--shapeships-grey-50)]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {confirmDisabledReason}
        </p>
      ) : null}
    </div>
  );
}

function MobileShareGameUrlRegion({
  gameUrl,
  onCopyGameUrl,
}: {
  gameUrl: string;
  onCopyGameUrl: () => void;
}) {
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  function handleCopyUrl() {
    onCopyGameUrl();
    setShowCopiedToast(true);

    if (copiedTimeoutRef.current !== null) {
      window.clearTimeout(copiedTimeoutRef.current);
    }

    copiedTimeoutRef.current = window.setTimeout(() => {
      copiedTimeoutRef.current = null;
      setShowCopiedToast(false);
    }, 5000);
  }

  return (
    <div className="shrink-0 w-full overflow-visible flex items-center justify-center px-[14px] pb-[4px] pt-[8px]">
      <div className="relative flex w-full max-w-[332px] flex-col items-center justify-center gap-[6px] py-[8px]">
        <p
          className="w-full text-center text-[18px] font-black leading-[18px] text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Share Game URL
        </p>
        <button
          type="button"
          onClick={handleCopyUrl}
          className="flex h-[40px] min-w-0 items-center justify-center gap-[8px] rounded-[7px] bg-white px-[12px] text-black active:scale-[0.99]"
        >
          <span
            className="min-w-0 flex-1 truncate text-center text-[13px] font-normal leading-none"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {gameUrl}
          </span>
          <CopyIcon className="h-[24px] w-[24px] shrink-0" color="black" />
        </button>
        {showCopiedToast ? (
          <CopiedToast className="absolute top-full mt-[8px]" />
        ) : null}
      </div>
    </div>
  );
}

function MobileSpeciesStatusRail({
  hudVm,
  boardVm,
  leftRailVm,
}: {
  hudVm: HudViewModel;
  boardVm: MobileChooseSpeciesViewModel;
  leftRailVm: LeftRailViewModel;
}) {
  const selectedSpeciesLabel = getSpeciesLabel(boardVm.selectedSpecies);
  const currentPlayerStatusText = boardVm.isSpectator
    ? hudVm.p1Species || hudVm.p1StatusText || ''
    : boardVm.isSpeciesSelectionComplete
      ? `Confirmed ${selectedSpeciesLabel}`
      : 'Choosing Species';
  const currentPlayerStatusTone: HudStatusTone =
    boardVm.isSpeciesSelectionComplete && !boardVm.isSpectator ? 'ready' : 'neutral';

  const topRow: MobileStatusRailRowData = {
    name: hudVm.p2Name,
    statusText: hudVm.p2Species || hudVm.p2StatusText || '',
    statusTone: hudVm.p2Species ? 'neutral' : hudVm.p2StatusTone,
    isOnline: hudVm.p2IsOnline,
  };

  const bottomRow: MobileStatusRailRowData = {
    name: hudVm.p1Name,
    statusText: currentPlayerStatusText,
    statusTone: currentPlayerStatusTone,
    isOnline: hudVm.p1IsOnline,
  };

  return (
    <MobileStatusRailFrame
      topRow={topRow}
      bottomRow={bottomRow}
      topClock={hudVm.p2Clock}
      bottomClock={hudVm.p1Clock}
      diceValue={leftRailVm.diceValue}
      diceAnimateKey={leftRailVm.diceAnimateKey}
    />
  );
}

function MobileChooseSpeciesRegion({
  boardVm,
  onSelectSpecies,
}: {
  boardVm: MobileChooseSpeciesViewModel;
  onSelectSpecies: (species: SpeciesId) => void;
}) {
  if (boardVm.isSpectator) {
    return (
      <div className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center px-[14px] py-[12px]">
        <div className="flex max-w-[300px] flex-col items-center gap-[8px] text-center">
          <p
            className="text-[20px] font-black leading-5 text-white"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            You are spectating.
          </p>
          <p
            className="text-[14px] font-normal leading-[18px] text-[var(--shapeships-grey-50)]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Waiting for players to choose species.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 w-full overflow-hidden flex items-start justify-center px-[16px]">
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-[10px]">
        <p
          className="w-full text-center text-[18px] font-black leading-5 text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Choose Your Species
        </p>
        <div className="grid w-full grid-cols-2 gap-[10px]">
          {MOBILE_SPECIES_OPTIONS.map((option) => (
            <MobileSpeciesCard
              key={option.speciesId}
              option={option}
              selected={boardVm.selectedSpecies === option.speciesId}
              onClick={() => onSelectSpecies(option.speciesId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileSpeciesCard({
  option,
  selected,
  onClick,
}: {
  option: MobileSpeciesOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="relative h-[78px] w-full rounded-[11px] p-[4px] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {selected ? (
        <span
          aria-hidden="true"
          className="absolute inset-[-3px] rounded-[14px] border-[4px] border-white"
        />
      ) : null}
      <span
        className={`${option.backgroundClassName} relative flex h-full w-full items-center justify-between overflow-hidden rounded-[8px] px-[10px] py-[8px] text-black`}
      >
        <span className="flex min-w-0 flex-1 flex-col items-start gap-[3px] text-left">
          <span
            className="w-full truncate text-[15px] font-black leading-[17px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {option.title}
          </span>
          <span
            className="line-clamp-2 text-[10px] font-medium leading-[12px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {option.blurb}
          </span>
        </span>
        <span className="ml-[6px] flex shrink-0 items-center justify-center">
          {option.icon}
        </span>
      </span>
    </button>
  );
}

function getSpeciesLabel(species: SpeciesId): string {
  switch (species) {
    case 'human':
      return 'Human';
    case 'xenite':
      return 'Xenite';
    case 'centaur':
      return 'Centaur';
    case 'ancient':
      return 'Ancient';
  }
}
