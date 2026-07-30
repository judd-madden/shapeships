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
      <p>When you press READY, autocast spends all your remaining energy:</p>
      <div className="grid grid-cols-3 items-start gap-[24px]">
        {AUTOCAST_PATHS.map((path) => (
          <div key={path.powerNames[0]} className="flex min-w-0 flex-col gap-[8px]">
            <span
              aria-hidden="true"
              className="size-[14px] shrink-0 rounded-full"
              style={{ backgroundColor: path.color }}
            />
            <div className="flex flex-col items-start">
              {path.powerNames.map((powerName, index) => (
                <div key={powerName} className="flex flex-col items-start">
                  {index > 0 ? <span aria-hidden="true">🡫</span> : null}
                  <span>{powerName}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p>Simulacrum and multicolour Powers must be cast manually.</p>
    </div>
  );
}
