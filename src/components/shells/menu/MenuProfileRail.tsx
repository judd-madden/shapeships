import { useId, useState, type ComponentType } from 'react';
import { usePlayerPreference } from '../../../game/client/preferences/usePlayerPreference';
import { setPreference } from '../../../game/client/preferences/playerPreferences';
import { BarChartIcon } from '../../ui/primitives/icons/BarChartIcon';
import { ExitToAppIcon } from '../../ui/primitives/icons/ExitToAppIcon';
import { OnlineStatusIcon } from '../../ui/primitives/icons/OnlineStatusIcon';
import { VerifiedUserIcon } from '../../ui/primitives/icons/VerifiedUserIcon';
import { VolumeOffIcon } from '../../ui/primitives/icons/VolumeOffIcon';
import { VolumeUpIcon } from '../../ui/primitives/icons/VolumeUpIcon';
import { FitSingleLineText } from '../../ui/primitives/layout/FitSingleLineText';
import type { MenuIdentity } from './menuIdentity';

interface RailActionProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  color?: string;
  onClick?: () => void;
  pressed?: boolean;
  inactive?: boolean;
  tooltip?: string;
}

function canShowTooltip() {
  return typeof window !== 'undefined' && window.matchMedia(
    '(min-width: 1025px) and (hover: hover) and (pointer: fine)',
  ).matches;
}

function RailAction({
  label, icon: Icon, color = 'text-shapeships-white', onClick, pressed, inactive, tooltip,
}: RailActionProps) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const showTooltip = Boolean(tooltip && (hovered || focused));

  return (
    <div className="relative flex min-w-0 items-center justify-center">
      <button
        type="button"
        aria-pressed={pressed}
        aria-disabled={inactive || undefined}
        aria-describedby={showTooltip ? tooltipId : undefined}
        onClick={inactive ? undefined : onClick}
        onPointerEnter={(event) => {
          if (tooltip && event.pointerType !== 'touch' && canShowTooltip()) setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch') {
            setHovered(false);
            setFocused(false);
          }
        }}
        onFocus={(event) => {
          if (tooltip && canShowTooltip() && event.currentTarget.matches(':focus-visible')) setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setHovered(false);
            setFocused(false);
          }
        }}
        className={`flex w-min flex-col items-center justify-center gap-[4px] text-center text-[14px] font-normal leading-[1.15] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-shapeships-pastel-purple min-[400px]:max-xl:w-auto min-[400px]:max-xl:whitespace-nowrap md:text-[16px] xl:w-auto xl:flex-row xl:gap-[6px] xl:text-[18px] ${inactive ? 'cursor-default' : 'cursor-pointer'} ${color}`}
      >
        <Icon className="size-[20px] shrink-0 md:size-[24px]" />
        <span>{label}</span>
      </button>
      {showTooltip && (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-30 mt-[20px] hidden w-max max-w-[min(460px,calc(100vw-32px))] -translate-x-1/2 rounded-[10px] border border-shapeships-grey-70 bg-shapeships-grey-90 px-[20px] py-[16px] text-[16px] font-normal leading-normal text-shapeships-white min-[1025px]:[@media(hover:hover)_and_(pointer:fine)]:block"
        >
          <span aria-hidden="true" className="absolute left-1/2 top-[-13px] size-[24px] -translate-x-1/2 rotate-45 border-l border-t border-shapeships-grey-70 bg-shapeships-grey-90" />
          <span className="relative">{tooltip}</span>
        </div>
      )}
    </div>
  );
}

interface MenuProfileRailProps {
  identity: MenuIdentity;
  onChangeName: () => void;
  onLogout: () => void;
  onClaimName: () => void;
  claimNameOpen?: boolean;
}

export function MenuProfileRail({ identity, onChangeName, onLogout, onClaimName, claimNameOpen = false }: MenuProfileRailProps) {
  const musicEnabled = usePlayerPreference('musicEnabled');
  const soundEnabled = usePlayerPreference('soundEnabled');
  const claimed = identity.status === 'claimed';

  return (
    <section aria-label="Player profile" className="w-full rounded-[8px] border-2 border-shapeships-grey-70 bg-black">
      <div className="relative flex flex-col rounded-[6px] bg-shapeships-grey-90/40 xl:min-h-[108px] xl:flex-row xl:items-center">
        <div className="relative flex min-h-[54px] min-w-0 items-center gap-[8px] px-[20px] py-[12px] md:min-h-[94px] md:gap-[16px] md:px-[40px] md:py-[24px] xl:self-stretch xl:py-0 xl:pr-[84px]">
          <div aria-hidden="true" className="absolute inset-0 rounded-t-[6px] bg-black xl:rounded-l-[6px] xl:rounded-tr-none xl:[clip-path:polygon(0_0,100%_0,calc(100%_-_60px)_100%,0_100%)]" />
          <div className="relative flex min-w-0 items-center gap-[8px] md:gap-[16px]">
            <OnlineStatusIcon status="online" className="size-[14px]! md:size-[22px]!" />
            <div className="flex min-w-0 items-center gap-[8px] md:gap-[12px]">
              <FitSingleLineText
                text={identity.displayName}
                title={identity.displayName}
                maxFontSize={46}
                minFontSize={12}
                className="text-[26px] font-normal leading-normal text-shapeships-white md:text-[46px]"
              />
              {claimed && <VerifiedUserIcon className="size-[20px] shrink-0 text-shapeships-pastel-purple md:size-[32px]" />}
            </div>
          </div>
        </div>
        <div className="relative flex min-h-[88px] items-center justify-evenly rounded-b-[6px] bg-shapeships-grey-90 py-[16px] min-[400px]:max-xl:min-h-0 min-[400px]:max-xl:py-[18px] xl:ml-auto xl:shrink-0 xl:justify-start xl:rounded-b-none xl:rounded-r-[6px] xl:bg-transparent xl:px-[40px] xl:py-0">
          <div className="flex items-center justify-center gap-[24px] xl:gap-[36px]">
            {claimed ? (
              <>
                <RailAction label="Logout" icon={ExitToAppIcon} onClick={onLogout} />
                <RailAction label="My&nbsp;Stats" icon={BarChartIcon} inactive color="text-shapeships-grey-50" tooltip="Stats coming soon" />
              </>
            ) : (
              <>
                <RailAction label="Change Name" icon={ExitToAppIcon} onClick={onChangeName} />
                <RailAction label="Claim Name" icon={VerifiedUserIcon} color="text-shapeships-pastel-purple" onClick={onClaimName} tooltip={claimNameOpen ? undefined : 'Protect your name with a password. No email required.'} />
              </>
            )}
          </div>
          <div aria-hidden="true" className="h-[54px] w-px bg-shapeships-grey-70 min-[400px]:max-xl:h-[42px] xl:mx-[40px] xl:h-[52px] xl:w-[2px]" />
          <div className="flex items-center justify-center gap-[24px] xl:gap-[36px]">
            <RailAction
              label="Music"
              icon={musicEnabled ? VolumeUpIcon : VolumeOffIcon}
              color={musicEnabled ? 'text-shapeships-white' : 'text-shapeships-grey-50'}
              pressed={musicEnabled}
              onClick={() => setPreference('musicEnabled', !musicEnabled)}
            />
            <RailAction
              label="Sound"
              icon={soundEnabled ? VolumeUpIcon : VolumeOffIcon}
              color={soundEnabled ? 'text-shapeships-white' : 'text-shapeships-grey-50'}
              pressed={soundEnabled}
              onClick={() => setPreference('soundEnabled', !soundEnabled)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
