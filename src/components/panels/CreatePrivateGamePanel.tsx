/**
 * CREATE PRIVATE GAME PANEL
 *
 * Matches "Menu Screen - Multiplayer - Create Game" Figma design
 * Pure UI component with local state and callbacks
 */

import React, { useState } from 'react';
import { MenuButton } from '../ui/primitives/buttons/MenuButton';
import { RadioButton } from '../ui/primitives/controls/RadioButton';

export interface CreatePrivateGameSettings {
  timed: boolean;
  minutes: number | null;
  incrementSeconds: number | null;
  variantKey: '1v1_standard';
}

interface CreatePrivateGamePanelProps {
  onSubmit: (settings: CreatePrivateGameSettings) => Promise<void>;
  onBack?: () => void;
  heading?: string;
  subheading?: string;
  primaryActionLabel?: string;
  primaryActionStyle?: 'private' | 'emphasisWhite';
}

type TimerPresetKey = '5_0' | '10_5' | '15_10' | '30_20';

type TimerPreset = {
  key: TimerPresetKey;
  minutes: number;
  incrementSeconds: number;
  primaryLabel: string;
  secondaryLabel: string;
  tightenSpacing: boolean;
};

const TIMER_PRESETS: TimerPreset[] = [
  { key: '5_0', minutes: 5, incrementSeconds: 0, primaryLabel: '5', secondaryLabel: '0', tightenSpacing: true },
  { key: '10_5', minutes: 10, incrementSeconds: 5, primaryLabel: '10', secondaryLabel: '5', tightenSpacing: true },
  { key: '15_10', minutes: 15, incrementSeconds: 10, primaryLabel: '15', secondaryLabel: '10', tightenSpacing: true },
  { key: '30_20', minutes: 30, incrementSeconds: 20, primaryLabel: '30', secondaryLabel: '20', tightenSpacing: false },
];

const TIMER_PRESET_BY_KEY: Record<TimerPresetKey, { minutes: number; incrementSeconds: number }> = {
  '5_0': { minutes: 5, incrementSeconds: 0 },
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
        'relative flex h-[120px] w-[170px] shrink-0 items-start rounded-[14px] p-[5px]',
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
          'relative flex h-[110px] w-[160px] items-center justify-center rounded-[10px] border-2',
          'transition-colors duration-150 ease-out',
          selected
            ? 'border-shapeships-pastel-green bg-shapeships-pastel-green text-black'
            : 'border-shapeships-grey-70 bg-black text-white hover:border-white',
        ].join(' ')}
      >
        <p
          className="text-center font-['Roboto',sans-serif] text-[34px] leading-[1] text-inherit"
          style={{
            fontVariationSettings: "'wdth' 100",
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
      className="content-stretch flex w-full cursor-pointer select-none gap-[8px] items-center"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <RadioButton selected={selected} className="pointer-events-none" />
      <p
        className="font-['Roboto',sans-serif] font-bold leading-[normal] relative shrink-0 text-[26px] text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
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
}: CreatePrivateGamePanelProps) {
  const [isTimed, setIsTimed] = useState(true);
  const [selectedPresetKey, setSelectedPresetKey] = useState<TimerPresetKey>('15_10');
  const [variantKey] = useState<'1v1_standard'>('1v1_standard');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateGame = async () => {
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
    <div className="content-stretch flex w-full flex-col gap-[50px]">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col items-start gap-[9px] leading-[normal]">
        <p
          className="font-['Roboto',sans-serif] text-[36px] font-black text-nowrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {heading}
        </p>
        <p
          className="font-['Roboto',sans-serif] text-[20px] font-normal"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {subheading}
        </p>
      </div>

      <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] via-[#ffffff] via-50% to-[rgba(255,255,255,0)] h-px w-full shrink-0 opacity-70" />

      <div className="mx-auto flex w-full max-w-[1080px] flex-col items-start gap-[50px]">
        <div className="flex w-full flex-col items-start gap-[36px] overflow-visible md:flex-row md:gap-[64px]">
          <div className="content-stretch flex w-full max-w-[280px] shrink-0 flex-col gap-[16px] items-start md:w-[220px] md:max-w-[220px]">
            <ModeToggleRow label="Timed" selected={isTimed} onSelect={() => setIsTimed(true)} />
            <ModeToggleRow label="Not timed" selected={!isTimed} onSelect={() => setIsTimed(false)} />
          </div>

          <div
            className={[
              'flex w-fit max-w-full flex-col items-center gap-[40px] self-start overflow-visible',
              isTimed ? '' : 'pointer-events-none opacity-[20%]',
            ].join(' ')}
          >
            <div className="flex max-w-full flex-wrap gap-x-[14px] gap-y-[24px] overflow-visible">
              {TIMER_PRESETS.map((preset) => (
                <TimerPresetButton
                  key={preset.key}
                  preset={preset}
                  selected={isTimed && selectedPresetKey === preset.key}
                  disabled={!isTimed}
                  onClick={() => setSelectedPresetKey(preset.key)}
                />
              ))}
            </div>

            <p
              className="text-center font-['Roboto',sans-serif] text-[20px] font-normal leading-[normal]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Minutes per player + increment per turn
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] via-[#ffffff] via-50% to-[rgba(255,255,255,0)] h-px w-full shrink-0 opacity-70" />

      <div className="mx-auto flex w-full max-w-[1080px] flex-col items-start gap-[16px]">
        {error && (
          <div className="w-full rounded-lg border border-red-500/50 bg-red-500/20 p-4">
            {error}
          </div>
        )}

        <MenuButton
          {...primaryActionButtonProps}
          onClick={handleCreateGame}
          disabled={isCreating}
          className="w-full max-w-[320px]"
        >
          {isCreating ? 'CREATING...' : primaryActionLabel}
        </MenuButton>
      </div>

      {/* Variant controls intentionally hidden until a later pass enables them. */}
    </div>
  );
}
