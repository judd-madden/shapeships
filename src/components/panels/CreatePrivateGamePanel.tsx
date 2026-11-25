/**
 * CREATE PRIVATE GAME PANEL
 *
 * Matches "Menu Screen - Multiplayer - Create Game" Figma design
 * Pure UI component with local state and callbacks
 */

import React, { useState, type ReactNode } from 'react';
import { MenuButton } from '../ui/primitives/buttons/MenuButton';
import { RadioButton } from '../ui/primitives/controls/RadioButton';
import type { MenuSetupMemoryRecord, MenuSetupPresetKey as TimerPresetKey } from '../../game/client/preferences/menuSetupMemory';

export interface CreatePrivateGameSettings {
  timed: boolean;
  minutes: number | null;
  incrementSeconds: number | null;
  variantKey: '1v1_standard';
}

interface CreatePrivateGamePanelProps {
  onSubmit: (settings: CreatePrivateGameSettings) => Promise<void>;
  heading?: string;
  subheading?: string;
  primaryActionLabel?: string;
  primaryActionStyle?: 'private' | 'emphasisWhite';
  headingAccessory?: ReactNode;
  primaryActionNotice?: ReactNode;
  primaryActionDisabled?: boolean;
  externalError?: string | null;
  errorAfterPrimaryAction?: boolean;
  secondaryAction?: ReactNode;
  initialTimed?: boolean;
  initialPresetKey?: TimerPresetKey;
  onSetupChange?: (setup: MenuSetupMemoryRecord) => void;
  footer?: ReactNode;
}

type TimerPreset = {
  key: TimerPresetKey;
  minutes: number;
  incrementSeconds: number;
  primaryLabel: string;
  secondaryLabel: string;
  tightenSpacing: boolean;
};

const TIMER_PRESETS: TimerPreset[] = [
  { key: '5_3', minutes: 5, incrementSeconds: 3, primaryLabel: '5', secondaryLabel: '3', tightenSpacing: true },
  { key: '10_5', minutes: 10, incrementSeconds: 5, primaryLabel: '10', secondaryLabel: '5', tightenSpacing: true },
  { key: '15_10', minutes: 15, incrementSeconds: 10, primaryLabel: '15', secondaryLabel: '10', tightenSpacing: true },
  { key: '30_20', minutes: 30, incrementSeconds: 20, primaryLabel: '30', secondaryLabel: '20', tightenSpacing: false },
];

const TIMER_PRESET_BY_KEY: Record<TimerPresetKey, { minutes: number; incrementSeconds: number }> = {
  '5_3': { minutes: 5, incrementSeconds: 3 },
  '10_5': { minutes: 10, incrementSeconds: 5 },
  '15_10': { minutes: 15, incrementSeconds: 10 },
  '30_20': { minutes: 30, incrementSeconds: 20 },
};

interface TimerPresetButtonProps {
  preset: TimerPreset;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

function TimerPresetButton({
  preset,
  selected,
  disabled,
  onClick,
}: TimerPresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative flex h-[80px] sm:h-[120px] w-full min-w-0 items-start rounded-[14px] p-[5px]',
        'transition-transform duration-150 ease-out',
        disabled ? 'cursor-default' : 'cursor-pointer hover:scale-105',
      ].join(' ')}
    >
      {selected && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-6px] rounded-[20px] border-[6px] border-solid border-white"
        />
      )}

      <div
        className={[
          'relative flex h-[70px] sm:h-[110px] w-full items-center justify-center rounded-[10px] border-2',
          'transition-colors duration-150 ease-out',
          selected
            ? 'border-shapeships-pastel-green bg-shapeships-pastel-green text-black'
            : 'border-shapeships-grey-70 bg-black text-white hover:border-white',
        ].join(' ')}
      >
        <p
          className="text-center text-[25.5px] leading-[1] text-inherit sm:text-[34px]"
          style={{
            letterSpacing: preset.tightenSpacing ? '-0.05em' : undefined,
          }}
        >
          <span className="font-black">{preset.primaryLabel}</span>
          <span className="font-normal">{' + '}</span>
          <span className="font-normal">{preset.secondaryLabel}</span>
        </p>
      </div>
    </button>
  );
}

interface ModeToggleRowProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

function ModeToggleRow({ label, selected, onSelect }: ModeToggleRowProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      className="content-stretch flex shrink-0 cursor-pointer select-none gap-[8px] items-center"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <RadioButton selected={selected} className="pointer-events-none shrink-0" />
      <p
        className="font-bold leading-[normal] relative shrink-0 text-[19.5px] text-nowrap sm:text-[26px]"
      >
        {label}
      </p>
    </div>
  );
}

export function CreatePrivateGamePanel({
  onSubmit,
  heading = 'Create Private Game',
  subheading = 'Share the game URL with a friend.',
  primaryActionLabel = 'CREATE PRIVATE GAME',
  primaryActionStyle = 'private',
  headingAccessory,
  primaryActionNotice,
  primaryActionDisabled = false,
  externalError,
  errorAfterPrimaryAction = false,
  secondaryAction,
  initialTimed = true,
  initialPresetKey = '15_10',
  onSetupChange,
  footer,
}: CreatePrivateGamePanelProps) {
  const [isTimed, setIsTimed] = useState(initialTimed);
  const [selectedPresetKey, setSelectedPresetKey] = useState<TimerPresetKey>(initialPresetKey);
  const [variantKey] = useState<'1v1_standard'>('1v1_standard');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const displayedError = externalError === undefined ? error : externalError;

  const handleTimingChange = (timed: boolean) => {
    setIsTimed(timed);
    onSetupChange?.({ timed, presetKey: selectedPresetKey });
  };

  const handlePresetChange = (presetKey: TimerPresetKey) => {
    setSelectedPresetKey(presetKey);
    onSetupChange?.({ timed: isTimed, presetKey });
  };

  const handleCreateGame = async () => {
    if (primaryActionDisabled || isCreating) return;
    const preset = TIMER_PRESET_BY_KEY[selectedPresetKey];

    setIsCreating(true);
    setError('');

    try {
      await onSubmit({
        timed: isTimed,
        minutes: isTimed ? preset.minutes : null,
        incrementSeconds: isTimed ? preset.incrementSeconds : null,
        variantKey,
      });
    } catch (error: any) {
      setError(error.message || 'Failed to create game');
    } finally {
      setIsCreating(false);
    }
  };

  const primaryActionButtonProps =
    primaryActionStyle === 'emphasisWhite'
      ? { variant: 'join' as const, active: !isCreating }
      : { variant: 'private' as const };

  return (
    <div className="content-stretch flex w-full flex-col gap-[20px] sm:gap-[30px] 2xl:gap-[50px]">
      <div className="mx-auto flex w-full max-w-[1080px] items-start justify-between gap-[24px]">
        <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-[16px] text-center leading-[normal] md:items-start md:text-left">
          <div className="flex w-full flex-col items-center gap-[16px] md:h-[42px] md:shrink-0 md:flex-row md:items-center md:justify-between md:gap-[60px]">
            <p
              className="text-[24px] font-black leading-[28px] sm:text-[36px] sm:leading-[42px] md:whitespace-nowrap"
            >
              {heading}
            </p>
            {headingAccessory}
          </div>
          <p
            className="text-[15px] font-normal leading-[18px] sm:text-[20px] sm:leading-[24px]"
          >
            {subheading}
          </p>
        </div>
        {secondaryAction && (
          <div className="hidden shrink-0 xl:block">
            {secondaryAction}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] via-[var(--shapeships-white)] via-50% to-[rgba(255,255,255,0)] h-px w-full shrink-0 opacity-70" />

      <div className="mx-auto flex w-full max-w-[1080px] flex-col items-start">
        <div className="flex w-full items-center justify-center gap-[40px] md:justify-start">
          <div className="content-stretch flex shrink-0 items-center gap-[40px]">
            <ModeToggleRow label="Not timed" selected={!isTimed} onSelect={() => handleTimingChange(false)} />
            <ModeToggleRow label="Timed" selected={isTimed} onSelect={() => handleTimingChange(true)} />
          </div>

          <p
            aria-hidden={!isTimed}
            className={[
              'hidden min-w-0 flex-1 text-right text-[20px] font-normal leading-[normal] md:block',
              'transition-[max-height,opacity] duration-150 ease-out',
              isTimed
                ? 'max-h-[160px] opacity-100'
                : 'pointer-events-none max-h-0 overflow-hidden opacity-0',
            ].join(' ')}
          >
            Minutes per player + increment per turn
          </p>
        </div>

        <div
          aria-hidden={!isTimed}
          className={[
            'w-full min-w-0 transition-[max-height,opacity] duration-150 ease-out',
            isTimed
              ? 'max-h-[420px] overflow-visible opacity-100'
              : 'pointer-events-none max-h-0 overflow-hidden opacity-0',
          ].join(' ')}
        >
          <div className="flex w-full flex-col items-start gap-[20px] pt-[12px] sm:pt-[40px] sm:gap-[40px]">
            <div className="grid w-full max-w-[560px] grid-cols-2 gap-x-[8px] gap-y-[8px] sm:gap-x-[14px] sm:gap-y-[24px] overflow-visible min-[520px]:grid-cols-2 2xl:max-w-full 2xl:grid-cols-4">
              {TIMER_PRESETS.map((preset) => (
                <TimerPresetButton
                  key={preset.key}
                  preset={preset}
                  selected={isTimed && selectedPresetKey === preset.key}
                  disabled={!isTimed}
                  onClick={() => handlePresetChange(preset.key)}
                />
              ))}
            </div>

            <p
              className="w-full text-center text-[15px] font-normal leading-[normal] sm:text-[20px] md:hidden"
            >
              Minutes per player + increment per turn
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] via-[var(--shapeships-white)] via-50% to-[rgba(255,255,255,0)] h-px w-full shrink-0 opacity-70" />

      <div className="mx-auto flex w-full max-w-[1080px] flex-col items-center gap-[16px] md:items-start">
        {primaryActionNotice && (
          <div className="w-full text-center md:text-left">
            {primaryActionNotice}
          </div>
        )}

        {!errorAfterPrimaryAction && displayedError && (
          <div className="w-full rounded-lg border border-red-500/50 bg-red-500/20 p-4">
            {displayedError}
          </div>
        )}

        <MenuButton
          {...primaryActionButtonProps}
          onClick={handleCreateGame}
          disabled={isCreating || primaryActionDisabled}
        >
          {isCreating ? 'CREATING...' : primaryActionLabel}
        </MenuButton>

        {errorAfterPrimaryAction && displayedError && (
          <div className="w-full rounded-lg border border-red-500/50 bg-red-500/20 p-4">
            {displayedError}
          </div>
        )}

        {secondaryAction && (
          <div className="mt-[8px] max-w-full xl:hidden">
            {secondaryAction}
          </div>
        )}

        {footer && (
          <div className="mt-[16px] w-full md:mt-[48px]">
            {footer}
          </div>
        )}
      </div>

      {/* Variant controls intentionally hidden until a later pass enables them. */}
    </div>
  );
}
