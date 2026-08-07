import { DownArrowIcon } from '../../../../../../components/ui/primitives';

interface AncientAutocastInfoContentProps {
  className?: string;
}

const AUTOCAST_PATHS = [
  {
    color: 'var(--shapeships-green)',
    powerNames: ['Star Birth', 'Life'],
  },
  {
    color: 'var(--shapeships-red)',
    powerNames: ['Supernova', 'Asteroid'],
  },
  {
    color: 'var(--shapeships-cyan)',
    powerNames: ['Convert'],
  },
] as const;

export function AncientAutocastInfoContent({
  className = '',
}: AncientAutocastInfoContentProps) {
  return (
    <div className={`flex flex-col gap-[24px] ${className}`}>
      <p>
        Autocast spends your remaining Energy in this order, then declares READY:
      </p>
      <div className="grid grid-cols-3 items-start gap-[24px]">
        {AUTOCAST_PATHS.map((path) => (
          <div key={path.powerNames[0]} className="flex min-w-0 flex-col gap-[8px]">
            <span
              aria-hidden="true"
              className="size-[14px] shrink-0 rounded-full"
              style={{ backgroundColor: path.color }}
            />
            <div className="flex flex-col items-start gap-[6px]">
              {path.powerNames.map((powerName, index) => (
                <div key={powerName} className="flex flex-col items-start gap-[6px]">
                  {index > 0 ? <DownArrowIcon /> : null}
                  <span>{powerName}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p>
        Autocast pauses if Simulacrum, Siphon, Vortex, or Black Hole are available.
      </p>
    </div>
  );
}
