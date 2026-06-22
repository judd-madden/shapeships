/**
 * Choose Species Stage
 * Board mode for species selection screen
 * Pure UI component - receives VM and actions from parent
 */

import { useState } from 'react';
import { type SpeciesId } from '../../../../components/ui/primitives/buttons/SpeciesCardButton';
import { SpeciesCardButton } from '../../../../components/ui/primitives/buttons/SpeciesCardButton';
import { BlackCarrierIcon } from '../../../../components/ui/primitives/icons/BlackCarrierIcon';
import { BlackXeniteIcon } from '../../../../components/ui/primitives/icons/BlackXeniteIcon';
import { BlackShipOfWisdomIcon } from '../../../../components/ui/primitives/icons/BlackShipOfWisdomIcon';
import { BlackMercuryCoreIcon } from '../../../../components/ui/primitives/icons/BlackMercuryCoreIcon';
import { ChevronDown } from '../../../../components/ui/primitives/icons/ChevronDown';
import { CopyIcon } from '../../../../components/ui/primitives/icons/CopyIcon';
import { CopiedToast } from '../../../../components/ui/primitives/CopiedToast';
import type { ChooseSpeciesBoardVm, ComputerBotSpeciesId } from '../../../client/useGameSession';

interface ChooseSpeciesStageProps {
  vm: ChooseSpeciesBoardVm;
  onSelectSpecies: (species: SpeciesId) => void;
  onSelectBotSpecies: (species: ComputerBotSpeciesId) => void;
  onConfirmSpecies: () => void;
  onCopyGameUrl: () => void;
}

const COMPUTER_SPECIES_OPTIONS: Array<{ species: ComputerBotSpeciesId; label: string }> = [
  { species: 'human', label: 'HUMAN' },
  { species: 'xenite', label: 'XENITE' },
  { species: 'centaur', label: 'CENTAUR' },
];

function getComputerSpeciesLabel(species: ComputerBotSpeciesId): string {
  return COMPUTER_SPECIES_OPTIONS.find((option) => option.species === species)?.label ?? 'HUMAN';
}

function ComputerSpeciesDropdown({
  selectedSpecies,
  disabled,
  onSelectSpecies,
}: {
  selectedSpecies: ComputerBotSpeciesId;
  disabled: boolean;
  onSelectSpecies: (species: ComputerBotSpeciesId) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = getComputerSpeciesLabel(selectedSpecies);

  function handleSelect(species: ComputerBotSpeciesId) {
    if (disabled) return;
    onSelectSpecies(species);
    setOpen(false);
  }

  return (
    <div className="relative w-[300px]">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((value) => !value);
          }
        }}
        className={`flex h-[60px] w-full items-center justify-between rounded-[10px] border-[2px] border-[var(--shapeships-grey-70)] bg-black px-[20px] text-white ${
          disabled ? 'cursor-default' : 'cursor-pointer hover:bg-[var(--shapeships-grey-90)]'
        }`}
      >
        <span
          className="font-['Roboto',sans-serif] text-[22px] font-black leading-none"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {selectedLabel}
        </span>
        <ChevronDown className={`transition-transform ${open && !disabled ? 'rotate-180' : ''}`} color="white" />
      </button>

      {open && !disabled ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-[8px] overflow-hidden rounded-[10px] border-[2px] border-[var(--shapeships-grey-70)] bg-black"
        >
          {COMPUTER_SPECIES_OPTIONS.map((option) => (
            <button
              key={option.species}
              type="button"
              role="option"
              aria-selected={option.species === selectedSpecies}
              onClick={() => handleSelect(option.species)}
              className="flex h-[60px] w-full items-center px-[20px] text-left text-white hover:bg-[var(--shapeships-grey-90)]"
            >
              <span
                className="font-['Roboto',sans-serif] text-[22px] font-black leading-none"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {option.label}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ComputerSpeciesPanel({
  selectedSpecies,
  disabled,
  onSelectSpecies,
}: {
  selectedSpecies: ComputerBotSpeciesId;
  disabled: boolean;
  onSelectSpecies: (species: ComputerBotSpeciesId) => void;
}) {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-center pb-0 pt-[130px] px-0 relative shrink-0 w-[657.6px]">
      <p
        className="font-['Roboto',sans-serif] font-black leading-[normal] min-w-full relative shrink-0 text-[30px] text-center text-white w-[min-content]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Choose Computer Species
      </p>
      <ComputerSpeciesDropdown
        selectedSpecies={selectedSpecies}
        disabled={disabled}
        onSelectSpecies={onSelectSpecies}
      />
    </div>
  );
}

export function ChooseSpeciesStage({
  vm,
  onSelectSpecies,
  onSelectBotSpecies,
  onConfirmSpecies,
  onCopyGameUrl,
}: ChooseSpeciesStageProps) {
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const handleCopyUrl = () => {
    onCopyGameUrl();
    setShowCopiedToast(true);
    setTimeout(() => {
      setShowCopiedToast(false);
    }, 5000);
  };

  if (vm.isSpectator) {
    return (
      <div
        className="flex-col lg:flex-row content-stretch flex gap-[8px] item-center lg:items-start justify-center px-0 pt-[240px] lg:py-[12px] relative size-full"
        data-name="Board Stage - Choose Species"
      >
        {/* Left: Spectator Section */}
        <div className="basis-0 content-stretch flex grow h-full items-center justify-center min-h-px min-w-px relative shrink-0">
          <div className="content-stretch flex flex-col gap-[12px] items-center relative shrink-0 w-[641px] text-center">
            <p
              className="font-['Roboto',sans-serif] font-black leading-[normal] relative shrink-0 text-[30px] text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              You are spectating.
            </p>
            <p
              className="font-['Roboto',sans-serif] font-normal leading-[normal] relative shrink-0 text-[18px] text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Waiting for players to choose species.
            </p>
          </div>
        </div>

        {/* Right: Share Game URL Section */}
        <div className="basis-0 content-stretch flex flex-col grow h-full items-center min-h-px min-w-px relative shrink-0 min-[768px]:max-[1599px]:hidden">
          {vm.isComputerGame ? (
            <ComputerSpeciesPanel
              selectedSpecies={vm.selectedBotSpecies}
              disabled={true}
              onSelectSpecies={onSelectBotSpecies}
            />
          ) : (
            <div className="content-stretch flex flex-col gap-[24px] items-center pb-0 pt-[130px] px-0 relative shrink-0 w-[657.6px]">
              <p
                className="font-['Roboto',sans-serif] font-black leading-[normal] min-w-full relative shrink-0 text-[30px] text-center text-white w-[min-content]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Share Game URL
              </p>
              <button
                onClick={handleCopyUrl}
                className="bg-white content-stretch flex gap-[13.3px] items-center px-[21px] py-[7px] relative rounded-[7px] shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
                type="button"
              >
                <p
                  className="font-['Roboto',sans-serif] font-normal leading-[normal] relative shrink-0 text-[16px] text-black text-center text-nowrap"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {vm.gameUrl}
                </p>
                <div className="relative shrink-0 size-[42px]">
                  <CopyIcon className="w-[42px] h-[42px]" color="black" />
                </div>
              </button>
              {showCopiedToast && (
                <div className="relative">
                  <CopiedToast className="absolute top-[100%] left-[50%] transform -translate-x-[50%]" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const isAncientSelected = vm.selectedSpecies === 'ancient';
  const selectedSpeciesName = vm.selectedSpecies.toUpperCase();
  const confirmButtonPrefix = vm.isSpeciesSelectionComplete ? 'CONFIRMED' : isAncientSelected ? 'DISABLED' : 'CONFIRM';

  return (
    <div
      className="flex-col lg:flex-row content-stretch flex gap-[8px] item-center lg:items-start justify-center px-0 pt-[240px] lg:py-[12px] relative size-full"
      data-name="Board Stage - Choose Species"
    >
      {/* Left: Choose Species Section */}
      <div className="basis-0 content-stretch flex grow h-full items-center justify-center min-h-px min-w-px relative shrink-0">
        <div className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0 w-[641px]">
          {/* Heading with Confirm Button */}
          <div className="content-stretch flex flex-col gap-[12px] items-center relative shrink-0 w-full">
            <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
              <p
                className="font-['Roboto',sans-serif] font-black leading-[normal] relative shrink-0 text-[30px] text-nowrap text-white"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Choose Your Species
              </p>
              <div className="content-stretch flex flex-col items-start pl-[4px] pr-0 py-0 relative shrink-0">
                <button
                  onClick={onConfirmSpecies}
                  disabled={!vm.canConfirmSpecies}
                  className={`
                    content-stretch flex gap-[4px] h-[50px] items-center justify-center leading-[normal] 
                    px-[20px] py-[19px] relative rounded-[10px] shrink-0 text-[18px] text-nowrap w-[300px] 
                    ${vm.canConfirmSpecies 
                      ? 'bg-white text-black cursor-pointer hover:bg-gray-100 transition-colors' 
                      : 'bg-(--shapeships-grey-50) text-black cursor-not-allowed'}
                  `}
                  type="button"
                >
                  <p
                    className="font-['Roboto',sans-serif] font-black relative shrink-0"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {confirmButtonPrefix}
                  </p>
                  <p
                    className="font-['Roboto',sans-serif] font-normal relative shrink-0"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    - {selectedSpeciesName}
                  </p>
                </button>
                {/* Show disabled reason if button is disabled */}
                {!vm.isSpeciesSelectionComplete && !vm.canConfirmSpecies && vm.confirmDisabledReason && (
                  <p className="text-gray-400 text-[12px] mt-[4px] pl-[4px]">
                    {vm.confirmDisabledReason}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Species Cards Grid */}
          <div className="content-start flex flex-wrap gap-[28px_20px] items-start relative shrink-0 w-full">
            <SpeciesCardButton
              speciesId="human"
              title="HUMAN"
              blurbLines={['Metal. Explosions. Expansion.', 'Onward and upward.']}
              backgroundClassName="bg-[var(--shapeships-pastel-blue)]"
              icon={<BlackCarrierIcon className="w-[58px] h-[50px]" color="black" />}
              selected={vm.selectedSpecies === 'human'}
              onClick={() => onSelectSpecies('human')}
            />
            <SpeciesCardButton
              speciesId="xenite"
              title="XENITE"
              blurbLines={['Swarm. Queen. Hive.', 'Always growing.']}
              backgroundClassName="bg-[var(--shapeships-pastel-green)]"
              icon={<BlackXeniteIcon className="w-[42px] h-[42px]" color="black" />}
              selected={vm.selectedSpecies === 'xenite'}
              onClick={() => onSelectSpecies('xenite')}
            />
            <SpeciesCardButton
              speciesId="centaur"
              title="CENTAUR"
              blurbLines={['Power. Timing. Domination.', 'Cull the weak.']}
              backgroundClassName="bg-[var(--shapeships-pastel-red)]"
              icon={<BlackShipOfWisdomIcon className="w-[59px] h-[59px]" color="black" />}
              selected={vm.selectedSpecies === 'centaur'}
              onClick={() => onSelectSpecies('centaur')}
            />
            <SpeciesCardButton
              speciesId="ancient"
              title="ANCIENT"
              blurbLines={['Energy. Solar Powers.', 'Ever present.']}
              backgroundClassName="bg-[var(--shapeships-pastel-purple)]"
              icon={<BlackMercuryCoreIcon className="w-[32px] h-[61px]" color="black" />}
              selected={vm.selectedSpecies === 'ancient'}
              onClick={() => onSelectSpecies('ancient')}
            />
          </div>
        </div>
      </div>

      {/* Right: Share Game URL Section */}
      <div className="basis-0 content-stretch flex flex-col grow h-full items-center min-h-px min-w-px relative shrink-0 min-[768px]:max-[1599px]:hidden">
        {vm.isComputerGame ? (
          <ComputerSpeciesPanel
            selectedSpecies={vm.selectedBotSpecies}
            disabled={false}
            onSelectSpecies={onSelectBotSpecies}
          />
        ) : (
          <div className="content-stretch flex flex-col gap-[24px] items-center pb-0 pt-[130px] px-0 relative shrink-0 w-[657.6px]">
            <p
              className="font-['Roboto',sans-serif] font-black leading-[normal] min-w-full relative shrink-0 text-[30px] text-center text-white w-[min-content]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Share Game URL
            </p>
            <button
              onClick={handleCopyUrl}
              className="bg-white content-stretch flex gap-[13.3px] items-center px-[21px] py-[7px] relative rounded-[7px] shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              type="button"
            >
              <p
                className="font-['Roboto',sans-serif] font-normal leading-[normal] relative shrink-0 text-[16px] text-black text-center text-nowrap"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {vm.gameUrl}
              </p>
              <div className="relative shrink-0 size-[42px]">
                <CopyIcon className="w-[42px] h-[42px]" color="black" />
              </div>
              {/*<p
                className="font-['Roboto',sans-serif] font-normal leading-[normal] relative shrink-0 text-[15.4px] text-black text-center text-nowrap"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                COPY URL
              </p>*/}
            </button>
            {showCopiedToast && (
              <div className="relative">
                <CopiedToast className="absolute top-[100%] left-[50%] transform -translate-x-[50%]" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
