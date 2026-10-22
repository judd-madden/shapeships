import type { ResolvedHealthIdentity, ResolvedHealthOutcome } from '../../client/gameSession/types';

export interface HealthBarOutcomeLabel {
  readonly letters: 'V' | 'L' | 'NV' | 'NL' | 'D';
  readonly description: string;
}

export interface HealthBarOutcomePair {
  readonly left: HealthBarOutcomeLabel;
  readonly right: HealthBarOutcomeLabel;
}

export interface HealthBarOutcomePresentation extends HealthBarOutcomePair {
  readonly opacity: number;
}

/** Translate canonical result metadata only. Health is deliberately not an input. */
export function prepareHealthBarOutcome(
  identity: Readonly<ResolvedHealthIdentity>, outcome: Readonly<ResolvedHealthOutcome>,
): HealthBarOutcomePair | null {
  const ids = [identity.gameId, identity.viewerId, identity.leftPlayerId, identity.rightPlayerId];
  if (!outcome.isTerminal || ids.some((id) => typeof id !== 'string' || !id.trim()) ||
      identity.leftPlayerId === identity.rightPlayerId ||
      !['player', 'spectator'].includes(identity.viewerRole)) return null;

  const reason = outcome.resultReason;
  const drawDescription = reason === 'mutual_destruction' ? 'Draw by mutual destruction'
    : reason === 'agreement' ? 'Draw by agreement' : reason === 'timeout_draw' ? 'Draw by timeout' : null;
  if (drawDescription) {
    if (outcome.winnerPlayerId !== null || (outcome.result !== undefined && outcome.result !== 'draw')) return null;
    const label: HealthBarOutcomeLabel = { letters: 'D', description: drawDescription };
    return { left: label, right: label };
  }
  if (!['decisive', 'narrow', 'resignation', 'timeout'].includes(reason ?? '') ||
      ![identity.leftPlayerId, identity.rightPlayerId].includes(outcome.winnerPlayerId ?? '') ||
      (outcome.result !== undefined && outcome.result !== 'win')) return null;

  const narrow = reason === 'narrow';
  const suffix = reason === 'resignation' ? ' by resignation' : reason === 'timeout' ? ' by timeout' : '';
  const winner: HealthBarOutcomeLabel = { letters: narrow ? 'NV' : 'V',
    description: narrow ? 'Narrow victory' : reason === 'decisive' ? 'Decisive victory' : `Victory${suffix}` };
  const loser: HealthBarOutcomeLabel = { letters: narrow ? 'NL' : 'L',
    description: narrow ? 'Narrow loss' : reason === 'decisive' ? 'Decisive loss' : `Loss${suffix}` };
  return outcome.winnerPlayerId === identity.leftPlayerId
    ? { left: winner, right: loser } : { left: loser, right: winner };
}
