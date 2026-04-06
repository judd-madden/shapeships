import type { BattleLogLineVm, BattleLogTokenVm } from '../../../client/gameSession/types';

interface BattleLogLineProps {
  line: BattleLogLineVm;
  align: 'left' | 'right';
}

function toCssVarFromColourName(colourName?: string | null): string | undefined {
  if (!colourName) {
    return undefined;
  }

  const slug = colourName.trim().toLowerCase().replace(/\s+/g, '-');
  return `var(--shapeships-${slug})`;
}

function getTokenColor(token: BattleLogTokenVm): string {
  if (token.kind === 'multiplier') {
    return 'var(--shapeships-grey-50)';
  }

  if (token.kind === 'ship' && token.allowUpgradeColor && token.upgradeColorName) {
    return toCssVarFromColourName(token.upgradeColorName) ?? 'var(--shapeships-grey-20)';
  }

  return 'var(--shapeships-grey-20)';
}

export function BattleLogLine({ line, align }: BattleLogLineProps) {
  return (
    <p
      className={[
        "font-['Roboto'] text-[14px] leading-[18px] font-normal whitespace-pre-wrap break-words",
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
      style={{ color: 'var(--shapeships-grey-20)' }}
    >
      {line.tokens.map((token, index) => (
        <span key={`${token.kind}-${token.text}-${index}`} style={{ color: getTokenColor(token) }}>
          {token.text}
        </span>
      ))}
    </p>
  );
}
