import type { AncientSolarPowerId } from '../state/GameStateTypes.ts';
import {
  EffectKind,
  EffectTiming,
  SurvivabilityRule,
  type Effect,
} from '../../engine_shared/effects/Effect.ts';

export function requireSolarOpponentPlayerId(
  state: Readonly<any>,
  playerId: string,
): string {
  const activeSeats = Array.isArray(state?.players)
    ? state.players.filter((player: any) => player?.role === 'player')
    : [];
  const casterSeats = activeSeats.filter((player: any) => player?.id === playerId);
  const opponentSeats = activeSeats.filter((player: any) => player?.id !== playerId);
  if (activeSeats.length !== 2 || casterSeats.length !== 1 || opponentSeats.length !== 1) {
    throw new Error(`Solar damage requires exactly two active player seats including caster ${playerId}`);
  }
  const opponentPlayerId = opponentSeats[0]?.id;
  if (typeof opponentPlayerId !== 'string' || opponentPlayerId.length === 0) {
    throw new Error(`Solar damage requires one valid opposing active player for ${playerId}`);
  }
  return opponentPlayerId;
}

export function buildSolarHealthEffect(args: {
  castIdentity: string;
  ownerPlayerId: string;
  powerId: AncientSolarPowerId;
  targetPlayerId: string;
  kind: EffectKind.Heal | EffectKind.Damage;
  amount: number;
  idSuffix: string;
}): Effect {
  return {
    id: `${args.castIdentity}:${args.idSuffix}`,
    ownerPlayerId: args.ownerPlayerId,
    source: { type: 'system', reason: `ancient-solar:${args.powerId}` },
    timing: 'battle.end_of_turn_resolution',
    activationTag: EffectTiming.Charge,
    survivability: SurvivabilityRule.ResolvesIfDestroyed,
    target: { playerId: args.targetPlayerId },
    kind: args.kind,
    amount: args.amount,
  } as Effect;
}
