/**
 * gameSession/powerIntents
 * -----------------------
 * Tiny client-only helpers for building ACTION intent payloads.
 * (Phase 3 will expand these for power actions.)
 */

export function buildMessageAction(content: string): { actionType: 'message'; content: string } {
  return { actionType: 'message', content };
}

export function buildPowerAction(params: {
  actionId: string;
  sourceInstanceId?: string;
  choiceId?: string;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
}): {
  actionType: 'power';
  actionId: string;
  sourceInstanceId?: string;
  choiceId?: string;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
} {
  const { actionId, sourceInstanceId, choiceId, targetInstanceId, targetInstanceIds } = params;
  return { actionType: 'power', actionId, sourceInstanceId, choiceId, targetInstanceId, targetInstanceIds };
}
