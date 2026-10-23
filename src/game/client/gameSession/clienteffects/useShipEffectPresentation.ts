import { useLayoutEffect, useState } from 'react';
import { SHIP_EFFECT_TIMING } from '../../../display/graphics/ShipEffectAnimation';
import type { BoardFleetSummary, BoardShipEffectVm } from '../types';
import { getResolvedOutcomeIdentity, type ResolvedActivationOutcome, type ShipActivationCueBatch } from '../selectors';
import { retainExactTargetSummary, type RetainedExactTargetPresentation } from '../fleetPresentation';

export type ShipEffectSyncObservation = 'http_response' | 'transport_failure' | 'accepted_full' | 'unchanged_head';
export interface ShipEffectSyncState {
  failures: number;
  recovering: boolean;
  version: number;
  validatedResumeToken: number | null;
}
export function observeShipEffectSync(current: ShipEffectSyncState, event: ShipEffectSyncObservation,
  resumeToken: number): ShipEffectSyncState {
  if (event === 'transport_failure') {
    const failures = Math.min(3, current.failures + 1);
    return { ...current, failures, recovering: current.recovering || failures === 3,
      version: current.version + (!current.recovering && failures === 3 ? 1 : 0) };
  }
  if (event === 'http_response') return current.failures ? { ...current, failures: 0 } : current;
  if (!current.recovering && current.failures === 0 && current.validatedResumeToken === resumeToken) return current;
  return { ...current, failures: 0, recovering: false, validatedResumeToken: resumeToken };
}

type Side = 'my' | 'opponent';
export type ShipEffectFleetFrame = Record<Side, BoardFleetSummary[]>;
interface EffectTarget extends RetainedExactTargetPresentation { destinationSide?: Side }
interface EffectGroup {
  key: string;
  kind: ResolvedActivationOutcome['kind'];
  sourceShipDefId?: string;
  targets: EffectTarget[];
  startedAt: number | null;
  completedIds: string[];
  impacted: boolean;
}
export interface ShipEffectPresentationState {
  context: string;
  initialized: boolean;
  seen: Array<{ key: string; seq: number; identities: string[] }>;
  evictedThrough: number;
  groups: EffectGroup[];
  impactKey: string | null;
}
export function createShipEffectPresentationState(context = ''): ShipEffectPresentationState {
  return { context, initialized: false, seen: [], evictedThrough: -Infinity, groups: [], impactKey: null };
}
interface Input {
  context: string;
  enabled: boolean;
  batches: readonly ShipActivationCueBatch[] | null;
  previous: ShipEffectFleetFrame;
  fleet: ShipEffectFleetFrame;
  voidFleet: ShipEffectFleetFrame;
  leftPlayerId: string | null;
  rightPlayerId: string | null;
}

function startReadyGroups(groups: EffectGroup[], now: number): EffectGroup[] {
  const occupied = new Set<string>();
  return groups.map((group) => {
    const blocked = group.targets.some((target) => occupied.has(target.instanceId));
    group.targets.forEach((target) => occupied.add(target.instanceId));
    return group.startedAt === null && !blocked ? { ...group, startedAt: now } : group;
  });
}

/** Accepts only resolved DTOs. Fleet data supplies appearance, never effect success. */
export function reconcileShipEffects(current: ShipEffectPresentationState, input: Input,
  now: number): ShipEffectPresentationState {
  if (current.context !== input.context || !input.enabled) {
    const empty = createShipEffectPresentationState(input.context);
    if (!input.enabled) return current.context === input.context && !current.initialized &&
      current.groups.length === 0 ? current : empty;
    current = empty;
  }
  if (input.batches === null) return current;
  let changed = !current.initialized;
  let groups = [...current.groups];
  let seen = current.seen.map((batch) => ({ ...batch, identities: [...batch.identities] }));
  let evictedThrough = current.evictedThrough;
  const sideFor = (id: string): Side | undefined => id === input.leftPlayerId ? 'my'
    : id === input.rightPlayerId ? 'opponent' : undefined;
  for (const batch of input.batches) {
    if (batch.seq <= evictedThrough) continue;
    let consumed = seen.find((entry) => entry.key === batch.key);
    if (!consumed) { consumed = { key: batch.key, seq: batch.seq, identities: [] }; seen.push(consumed); changed = true; }
    for (const outcome of batch.resolvedOutcomes ?? []) {
      const identity = getResolvedOutcomeIdentity(outcome);
      if (consumed.identities.includes(identity)) continue;
      consumed.identities.push(identity);
      changed = true;
      if (!current.initialized) continue; // Initial/recovery retained history is a baseline.
      const source = outcome.source;
      const groupIdentity = source.type === 'ship' && source.shipDefId === 'EQU'
        ? ['EQU', source.instanceId] : source.type === 'solar' && source.solarPowerId === 'SBLA'
          ? ['SBLA', source.ledgerEntryId] : [identity];
      let key = JSON.stringify([input.context, batch.key, ...groupIdentity]);
      const targets: EffectTarget[] = [];
      for (const target of outcome.targets) {
        const side = sideFor(target.playerId);
        if (!side) continue;
        const prior = groups.flatMap((group) => group.targets).find((entry) => entry.instanceId === target.shipInstanceId);
        const previousSummary = input.previous[side].find((ship) => ship.memberInstanceIds.includes(target.shipInstanceId));
        const summary = prior?.summary ?? previousSummary ?? [...input.fleet[side], ...input.voidFleet[side],
          ...input.fleet[side === 'my' ? 'opponent' : 'my']].find((ship) => ship.memberInstanceIds.includes(target.shipInstanceId));
        if (!summary) continue;
        const retainedSummary = retainExactTargetSummary(summary, target.shipInstanceId);
        targets.push({ instanceId: target.shipInstanceId, side: prior?.side ?? side,
          summary: retainedSummary,
          order: prior?.order ?? input.previous[side].map((ship) =>
            ship.renderKey === summary.renderKey ? retainedSummary.renderKey : ship.renderKey),
          ...(target.destinationPlayerId ? { destinationSide: sideFor(target.destinationPlayerId) } : {}) });
      }
      if (!targets.length) continue;
      let existingIndex = groups.findIndex((group) => group.key === key);
      // A Cube copy can be interleaved between EQU/SBLA results. Grouping must
      // not pull a later destruction ahead of a copy of that same instance.
      if (existingIndex >= 0 && groups.slice(existingIndex + 1).some((group) =>
        group.targets.some((entry) => targets.some((target) => target.instanceId === entry.instanceId)))) {
        existingIndex = -1;
        key = JSON.stringify([input.context, batch.key, ...groupIdentity, identity]);
      }
      if (existingIndex >= 0) {
        const existing = groups[existingIndex];
        groups[existingIndex] = { ...existing, targets: [...existing.targets,
          ...targets.filter((target) => !existing.targets.some((entry) => entry.instanceId === target.instanceId))] };
      } else groups.push({ key, kind: outcome.kind,
        ...(source.type === 'ship' ? { sourceShipDefId: source.shipDefId }
          : source.solarPowerId === 'SBLA' ? { sourceShipDefId: 'SBLA' } : {}),
        targets, startedAt: null, completedIds: [], impacted: false });
    }
  }
  seen.sort((a, b) => a.seq - b.seq);
  if (seen.length > 8) {
    evictedThrough = Math.max(evictedThrough, ...seen.slice(0, -8).map((batch) => batch.seq));
    seen = seen.slice(-8);
  }
  if (!changed) return current;
  groups = startReadyGroups(groups, now);
  return { ...current, initialized: true, seen, evictedThrough, groups };
}

export function settleShipEffect(current: ShipEffectPresentationState, key: string,
  instanceId: string | null, now: number): ShipEffectPresentationState {
  const index = current.groups.findIndex((group) => group.key === key && group.startedAt !== null);
  if (index < 0) return current;
  const group = current.groups[index];
  if (instanceId !== null && !group.targets.some((target) => target.instanceId === instanceId)) return current;
  const completedIds = instanceId === null ? group.targets.map((target) => target.instanceId)
    : [...new Set([...group.completedIds, instanceId])];
  if (completedIds.length < group.targets.length) {
    return { ...current, groups: current.groups.map((entry, i) => i === index ? { ...entry, completedIds } : entry) };
  }
  const groups = current.groups.filter((_, i) => i !== index).map((entry) => ({ ...entry,
    targets: entry.targets.map((target) => {
      const preceding = group.targets.find((prior) => prior.instanceId === target.instanceId);
      return preceding?.destinationSide ? { ...target, side: preceding.destinationSide } : target;
    }) }));
  return { ...current, groups: startReadyGroups(groups, now) };
}

export function impactShipEffect(current: ShipEffectPresentationState, key: string): ShipEffectPresentationState {
  const group = current.groups.find((entry) => entry.key === key && entry.startedAt !== null);
  if (!group || group.kind !== 'destroy' || group.impacted) return current;
  return { ...current, impactKey: key,
    groups: current.groups.map((entry) => entry === group ? { ...entry, impacted: true } : entry) };
}

export function expireShipEffects(current: ShipEffectPresentationState, now: number): ShipEffectPresentationState {
  for (const group of current.groups) {
    if (group.startedAt !== null && group.startedAt + SHIP_EFFECT_TIMING.durationMs <= now) {
      current = settleShipEffect(current, group.key, null, now);
    }
  }
  return current;
}

export function useShipEffectPresentation(input: Input) {
  const [stored, setStored] = useState(createShipEffectPresentationState);
  const state = reconcileShipEffects(stored, input, Date.now());
  // Publish derived claims in this render, then commit consumption before paint.
  useLayoutEffect(() => { if (state !== stored) setStored(state); }, [state, stored]);
  const deadlines = state.groups.filter((group) => group.startedAt !== null)
    .map((group) => [group.key, group.startedAt] as const);
  const deadlineSignature = JSON.stringify(deadlines);
  useLayoutEffect(() => {
    const timers = deadlines.map(([key, startedAt]) => window.setTimeout(() => {
      setStored((current) => current.groups.some((group) => group.key === key)
        ? expireShipEffects(current, Date.now()) : current);
    }, Math.max(0, startedAt! + SHIP_EFFECT_TIMING.durationMs - Date.now())));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [deadlineSignature]);
  const retainedById = new Map<string, EffectTarget>();
  const effects: Record<Side, Record<string, BoardShipEffectVm>> = { my: {}, opponent: {} };
  for (const group of state.groups) {
    for (const target of group.targets) {
      if (!retainedById.has(target.instanceId)) retainedById.set(target.instanceId, target);
      if (group.startedAt !== null) effects[target.side][target.summary.renderKey] = {
        activationKey: group.key, instanceId: target.instanceId, kind: group.kind, sourceShipDefId: group.sourceShipDefId };
    }
  }
  return {
    retained: [...retainedById.values()], effects, pending: state.groups.length > 0,
    audio: { scopeKey: JSON.stringify([input.context, input.enabled]), impactKey: state.impactKey,
      suppressedVoidInstanceIds: state.groups.filter((group) => group.kind === 'destroy').flatMap((group) => group.targets.map((target) => target.instanceId)),
      authoritativeVoidInstanceIds: [...input.voidFleet.my, ...input.voidFleet.opponent].flatMap((ship) => ship.memberInstanceIds),
      baseline: !input.enabled || !stored.initialized || stored.context !== input.context },
    onImpact: (key: string) => {
      setStored((current) => impactShipEffect(current, key));
    },
    onComplete: (key: string, instanceId: string) => {
      setStored((current) => settleShipEffect(current, key, instanceId, Date.now()));
    },
  };
}
