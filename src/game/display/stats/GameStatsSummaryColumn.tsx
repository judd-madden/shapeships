export interface GameStatsSummaryGroup {
  label: string;
  value: number;
  note: string;
  color: string;
}

interface GameStatsSummaryColumnProps {
  groups: [GameStatsSummaryGroup, GameStatsSummaryGroup];
}

export function GameStatsSummaryColumn({ groups }: GameStatsSummaryColumnProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col justify-center gap-[12px] overflow-hidden pl-[30px] py-[8px]">
      {groups.map((group) => (
        <div key={`${group.label}:${group.note}`} className="min-w-0 overflow-hidden">
          <div
            className="truncate text-[16px] font-normal leading-[1.1]"
            style={{
              color: group.color,
              fontVariationSettings: "'wdth' 100",
            }}
            title={group.label}
          >
            {group.label}
          </div>
          <div className="mt-[2px] flex min-w-0 items-center gap-[4px] overflow-hidden">
            <span
              className="shrink-0 text-[28px] font-black leading-none"
              style={{
                color: group.color,
                fontVariationSettings: "'wdth' 100",
              }}
            >
              {formatSummaryValue(group.value)}
            </span>
            <span
              className="min-w-0 truncate text-[14px] font-normal leading-none"
              style={{
                color: group.color,
                fontVariationSettings: "'wdth' 100",
              }}
            >
              {group.note}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatSummaryValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return String(value);
}
