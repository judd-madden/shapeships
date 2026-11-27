import { VolumeUpIcon } from '../icons/VolumeUpIcon';
import { VolumeOffIcon } from '../icons/VolumeOffIcon';

interface AudioToggleProps {
  enabled: boolean;
  label: string;
  onToggle: () => void;
  gapClassName: string;
  labelClassName: string;
}

export function AudioToggle({ enabled, label, onToggle, gapClassName, labelClassName }: AudioToggleProps) {
  const Icon = enabled ? VolumeUpIcon : VolumeOffIcon;

  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className={`inline-flex cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-shapeships-pastel-purple ${gapClassName} ${enabled ? 'text-shapeships-white' : 'text-shapeships-grey-50'}`}
    >
      <Icon className="size-[30px] shrink-0" />
      <span className={labelClassName}>{label}</span>
    </button>
  );
}
