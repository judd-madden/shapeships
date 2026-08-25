/**
 * gameSession/availableActions
 * ----------------------------
 * Phase/panel routing helpers extracted from useGameSession.ts.
 *
 * NOTE: This is UI-only logic. It does not validate rules and is not authoritative.
 * Phase 3 will eventually replace this with server-projected `availableActions`.
 */

import {
  isActionPanelId,
  type ActionPanelId,
} from '../../display/actionPanel/ActionPanelRegistry';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { FirstStrikeActionFamily } from './types';
import type { DrawingStage } from './drawingPrelude';
import { getDefaultCubeDiceChoiceId } from './cubeDiceChoice';

export type PhaseKey = string;
export type RenderableTargetedActionKind = 'destroy_target' | 'paired_destroy_target';
export type BuildDrawingRouteRequest =
  | null
  | 'frigate-demand'
  | 'quantum-mystic-demand'
  | 'evolver-entry'
  | 'evolver-added';

export interface AutoPanelRoutingInput {
  phaseKey: PhaseKey;
  hasActionsAvailable: boolean;
  actionsTargetPanelId: ActionPanelId | null;
  activePanelId: string;
  mySpecies: SpeciesId | null;
  selectedSpecies: SpeciesId | null;
  buildDrawingRouteRequest: BuildDrawingRouteRequest;
  drawingStage?: DrawingStage;
  carrierPreludeActionsValid?: boolean;
}

export type AutoPanelRoutingDecision =
  | { kind: 'none' }
  | { kind: 'setActivePanelId'; nextPanelId: ActionPanelId; log: string };

export interface StaleWorkflowPanelRoutingInput {
  hasActionsAvailable: boolean;
  activePanelId: string;
  mySpecies: SpeciesId | null;
  isPlayerViewer: boolean;
}

export type RenderableServerAction = {
  kind: string;
  actionId: string;
  shipDefId: string;
  sourceInstanceId: string;
  choices: Array<{ choiceId?: string; projectedAmount?: number }>;
  validTargets?: any[];
  validOwnTargets?: any[];
  validOpponentTargets?: any[];
  requiredTargetCount?: number;
};

const FIRST_STRIKE_FAMILIES: readonly FirstStrikeActionFamily[] = [
  'domination',
  'sacrificial_pool',
  'spiral',
  'guardian',
];

export const FIRST_STRIKE_MANDATORY_FAMILIES: readonly FirstStrikeActionFamily[] = [
  'domination',
  'sacrificial_pool',
  'spiral',
];

export type FirstStrikeActionClassification = {
  renderableActions: RenderableServerAction[];
  supportedActionsByFamily: Record<FirstStrikeActionFamily, RenderableServerAction[]>;
  supportedFamilies: FirstStrikeActionFamily[];
  unmappedActions: RenderableServerAction[];
};

export function getFirstStrikeFamilyForAction(
  action: Pick<RenderableServerAction, 'shipDefId'>
): FirstStrikeActionFamily | null {
  switch (action.shipDefId) {
    case 'DOM':
      return 'domination';
    case 'SAC':
      return 'sacrificial_pool';
    case 'SPI':
      return 'spiral';
    case 'GUA':
      return 'guardian';
    default:
      return null;
  }
}

export function getFirstStrikePanelIdForFamily(
  family: FirstStrikeActionFamily
): ActionPanelId {
  switch (family) {
    case 'domination':
      return 'ap.battle.first_strike.centaur';
    case 'sacrificial_pool':
      return 'ap.battle.first_strike.xenite';
    case 'spiral':
      return 'ap.battle.first_strike.ancient';
    case 'guardian':
      return 'ap.battle.first_strike.human';
  }
}

export function classifyRenderableFirstStrikeActions(
  availableActions: any[] | null | undefined
): FirstStrikeActionClassification {
  const renderableActions = getRenderableServerChoiceActions(
    'battle.first_strike',
    availableActions
  );
  const supportedActionsByFamily: Record<FirstStrikeActionFamily, RenderableServerAction[]> = {
    domination: [],
    sacrificial_pool: [],
    spiral: [],
    guardian: [],
  };
  const unmappedActions: RenderableServerAction[] = [];

  for (const action of renderableActions) {
    const family = getFirstStrikeFamilyForAction(action);
    if (family == null) {
      unmappedActions.push(action);
      continue;
    }

    supportedActionsByFamily[family].push(action);
  }

  return {
    renderableActions,
    supportedActionsByFamily,
    supportedFamilies: FIRST_STRIKE_FAMILIES.filter(
      (family) => supportedActionsByFamily[family].length > 0
    ),
    unmappedActions,
  };
}

type FirstStrikeFamilyOrderTuple = {
  hasKnownFleetPosition: boolean;
  fleetPosition: number;
  actionId: string;
  sourceInstanceId: string;
};

function compareFirstStrikeFamilyOrderTuple(
  a: FirstStrikeFamilyOrderTuple,
  b: FirstStrikeFamilyOrderTuple
): number {
  if (a.hasKnownFleetPosition !== b.hasKnownFleetPosition) {
    return a.hasKnownFleetPosition ? -1 : 1;
  }

  if (a.fleetPosition !== b.fleetPosition) {
    return a.fleetPosition - b.fleetPosition;
  }

  const actionIdDelta = a.actionId.localeCompare(b.actionId);
  if (actionIdDelta !== 0) {
    return actionIdDelta;
  }

  return a.sourceInstanceId.localeCompare(b.sourceInstanceId);
}

export function orderFirstStrikeFamilies(
  classification: FirstStrikeActionClassification,
  controlledFleet: readonly any[]
): FirstStrikeActionFamily[] {
  const fleetPositionBySourceInstanceId = new Map<string, number>();
  controlledFleet.forEach((ship, index) => {
    const sourceInstanceId = ship?.instanceId ?? ship?.id;
    if (
      typeof sourceInstanceId === 'string' &&
      !fleetPositionBySourceInstanceId.has(sourceInstanceId)
    ) {
      fleetPositionBySourceInstanceId.set(sourceInstanceId, index);
    }
  });

  const mandatoryFamilies = FIRST_STRIKE_MANDATORY_FAMILIES
    .filter((family) => classification.supportedActionsByFamily[family].length > 0)
    .map((family) => {
      const earliestSource = classification.supportedActionsByFamily[family]
        .map((action): FirstStrikeFamilyOrderTuple => {
          const fleetPosition = fleetPositionBySourceInstanceId.get(action.sourceInstanceId);
          return {
            hasKnownFleetPosition: fleetPosition != null,
            fleetPosition: fleetPosition ?? Number.POSITIVE_INFINITY,
            actionId: action.actionId,
            sourceInstanceId: action.sourceInstanceId,
          };
        })
        .sort(compareFirstStrikeFamilyOrderTuple)[0];

      return { family, earliestSource };
    })
    .sort((a, b) => {
      const tupleDelta = compareFirstStrikeFamilyOrderTuple(
        a.earliestSource,
        b.earliestSource
      );
      return tupleDelta !== 0 ? tupleDelta : a.family.localeCompare(b.family);
    })
    .map(({ family }) => family);

  if (classification.supportedActionsByFamily.guardian.length > 0) {
    mandatoryFamilies.push('guardian');
  }

  return mandatoryFamilies;
}

export function isRenderableTargetedActionKind(kind: string): kind is RenderableTargetedActionKind {
  return kind === 'destroy_target' || kind === 'paired_destroy_target';
}

export function isRenderableTargetedAction(action: { kind?: string } | null | undefined): action is RenderableServerAction {
  return isRenderableTargetedActionKind(String(action?.kind ?? ''));
}

export interface RenderableActionShipPresence {
  hasCentaurNonEquChargeAction: boolean;
  hasCentaurEquChargeAction: boolean;
  hasGuardianFirstStrikeAction: boolean;
  hasSacrificialPoolFirstStrikeAction: boolean;
  hasSpiralFirstStrikeAction: boolean;
}

export function isCataloguePanel(id: ActionPanelId): boolean {
  return id.startsWith('ap.catalog.ships.');
}

export function speciesToCataloguePanelId(species: SpeciesId): ActionPanelId {
  switch (species) {
    case 'human': return 'ap.catalog.ships.human';
    case 'xenite': return 'ap.catalog.ships.xenite';
    case 'centaur': return 'ap.catalog.ships.centaur';
    case 'ancient': return 'ap.catalog.ships.ancient';
  }
}

export function decideStaleWorkflowPanelRouting(
  input: StaleWorkflowPanelRoutingInput
): AutoPanelRoutingDecision {
  const { hasActionsAvailable, activePanelId, mySpecies, isPlayerViewer } = input;

  if (!isPlayerViewer || hasActionsAvailable || !isActionPanelId(activePanelId)) {
    return { kind: 'none' };
  }

  if (
    isCataloguePanel(activePanelId) ||
    activePanelId === 'ap.menu.root' ||
    activePanelId === 'ap.idle.blank' ||
    activePanelId === 'ap.end_of_game.result'
  ) {
    return { kind: 'none' };
  }

  const selfCatalogue = speciesToCataloguePanelId(mySpecies ?? 'human');
  return {
    kind: 'setActivePanelId',
    nextPanelId: selfCatalogue,
    log: `[useGameSession] Stale workflow has no actions: falling back to self catalogue panel: ${selfCatalogue}`,
  };
}

export function isDeferredAutoPanelHandoffPhase(phaseKey: PhaseKey): boolean {
  return (
    phaseKey === 'build.dice_roll' ||
    phaseKey === 'battle.first_strike' ||
    phaseKey === 'battle.charge_declaration'
  );
}

export function getRenderableServerChoiceActions(
  phaseKey: PhaseKey,
  availableActions: any[] | null | undefined
): RenderableServerAction[] {
  if (!Array.isArray(availableActions)) return [];

  return availableActions.filter((action: any): action is RenderableServerAction => {
    const hasBaseFields =
      typeof action?.sourceInstanceId === 'string' &&
      typeof action?.actionId === 'string' &&
      typeof action?.shipDefId === 'string' &&
      Array.isArray(action?.choices);

    if (!hasBaseFields) return false;

    if (phaseKey === 'battle.first_strike') {
      return action.kind === 'choice' || action.kind === 'destroy_target';
    }

    if (phaseKey === 'battle.charge_declaration') {
      return action.kind === 'choice' || action.kind === 'paired_destroy_target';
    }

    return action.kind === 'choice';
  });
}

export function getRenderableActionShipPresence(
  phaseKey: PhaseKey,
  availableActions: any[] | null | undefined
): RenderableActionShipPresence {
  const renderableActions = getRenderableServerChoiceActions(phaseKey, availableActions);

  return renderableActions.reduce<RenderableActionShipPresence>(
    (presence, action) => {
      if (
        phaseKey === 'battle.first_strike' &&
        action.shipDefId === 'GUA'
      ) {
        presence.hasGuardianFirstStrikeAction = true;
      }

      if (
        phaseKey === 'battle.first_strike' &&
        action.shipDefId === 'SAC'
      ) {
        presence.hasSacrificialPoolFirstStrikeAction = true;
      }

      if (
        phaseKey === 'battle.first_strike' &&
        action.kind === 'destroy_target' &&
        action.shipDefId === 'SPI'
      ) {
        presence.hasSpiralFirstStrikeAction = true;
      }

      if (
        phaseKey === 'battle.charge_declaration' &&
        (action.shipDefId === 'WIS' ||
          action.shipDefId === 'FAM' ||
          action.shipDefId === 'INT' ||
          action.shipDefId === 'ANT')
      ) {
        presence.hasCentaurNonEquChargeAction = true;
      }

      if (
        phaseKey === 'battle.charge_declaration' &&
        action.shipDefId === 'EQU'
      ) {
        presence.hasCentaurEquChargeAction = true;
      }

      return presence;
    },
    {
      hasCentaurNonEquChargeAction: false,
      hasCentaurEquChargeAction: false,
      hasGuardianFirstStrikeAction: false,
      hasSacrificialPoolFirstStrikeAction: false,
      hasSpiralFirstStrikeAction: false,
    }
  );
}

export function getRenderableActionChoiceIds(action: {
  choices?: Array<{ choiceId?: string; projectedAmount?: number }>;
}): string[] {
  return Array.isArray(action?.choices)
    ? action.choices
        .map((choice) => choice?.choiceId)
        .filter((choiceId): choiceId is string => typeof choiceId === 'string')
    : [];
}

export function getDefaultChoiceIdForRenderableAction(action: RenderableServerAction): string | undefined {
  const choiceIds = getRenderableActionChoiceIds(action);
  if (choiceIds.length === 0) return undefined;

  if (action.actionId === 'CUB#0' && action.shipDefId === 'CUB') {
    return getDefaultCubeDiceChoiceId(action);
  }

  if (action.actionId === 'KNO#0') {
    return choiceIds.find((choiceId) => choiceId === 'hold') ?? choiceIds[0];
  }

  if (
    action.actionId === 'GUA#0' &&
    action.shipDefId === 'GUA' &&
    action.kind === 'destroy_target' &&
    Array.isArray(action.validTargets) &&
    action.validTargets.length > 0
  ) {
    return choiceIds.find((choiceId) => choiceId === 'destroy')
      ?? choiceIds.find((choiceId) => choiceId === 'hold')
      ?? choiceIds[0];
  }

  // Targeted destroy actions require an explicit targetInstanceId.
  // Default to hold so destroy-target rows can render without auto-submitting an invalid destroy.
  if (isRenderableTargetedAction(action)) {
    return choiceIds.find((choiceId) => choiceId === 'hold') ?? choiceIds[0];
  }

  return choiceIds[0];
}

export function getRenderableActionRequiredTargetCount(action: RenderableServerAction): number {
  const requiredTargetCount = Number(action?.requiredTargetCount);
  return Number.isInteger(requiredTargetCount) && requiredTargetCount > 0
    ? requiredTargetCount
    : 1;
}

export function getSelectedChoiceIdForRenderableAction(
  action: RenderableServerAction,
  selectedChoiceIdBySourceInstanceId: Record<string, string>
): string | undefined {
  return (
    selectedChoiceIdBySourceInstanceId[action.sourceInstanceId] ??
    getDefaultChoiceIdForRenderableAction(action)
  );
}

export function isRenderableTargetedActionSelected(
  action: RenderableServerAction,
  selectedChoiceIdBySourceInstanceId: Record<string, string>
): boolean {
  if (!isRenderableTargetedAction(action)) return false;

  const selectedChoiceId = getSelectedChoiceIdForRenderableAction(
    action,
    selectedChoiceIdBySourceInstanceId
  );

  return typeof selectedChoiceId === 'string' && selectedChoiceId !== 'hold';
}

export function getAllocatedTargetIdsForRenderableAction(
  action: RenderableServerAction,
  allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]>,
  allocatedDestroyTargetIdBySourceInstanceId: Record<string, string>
): string[] {
  const multi = allocatedDestroyTargetIdsBySourceInstanceId[action.sourceInstanceId];
  if (Array.isArray(multi) && multi.length > 0) {
    return multi.filter((targetInstanceId): targetInstanceId is string => typeof targetInstanceId === 'string');
  }

  const single = allocatedDestroyTargetIdBySourceInstanceId[action.sourceInstanceId];
  return typeof single === 'string' ? [single] : [];
}

export function isRenderableTargetedActionComplete(args: {
  action: RenderableServerAction;
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
  allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]>;
  allocatedDestroyTargetIdBySourceInstanceId: Record<string, string>;
}): boolean {
  const {
    action,
    selectedChoiceIdBySourceInstanceId,
    allocatedDestroyTargetIdsBySourceInstanceId,
    allocatedDestroyTargetIdBySourceInstanceId,
  } = args;

  if (!isRenderableTargetedActionSelected(action, selectedChoiceIdBySourceInstanceId)) {
    return true;
  }

  return getAllocatedTargetIdsForRenderableAction(
    action,
    allocatedDestroyTargetIdsBySourceInstanceId,
    allocatedDestroyTargetIdBySourceInstanceId
  ).length === getRenderableActionRequiredTargetCount(action);
}

/**
 * Mirrors the routing effects that previously lived inline in useGameSession.ts.
 * We keep the decisions separated by returning a single highest-priority action.
 *
 * Priority:
 * 1) Force the selected-species catalogue during setup.species_selection
 * 2) Force self catalogue during build.drawing
 * 3) Auto-select Actions tab when it becomes available (except during build.drawing)
 * 4) Hold safe waiting panels during deferred server-choice handoffs
 * 5) Fallback to self catalogue when no actions are available outside species selection
 */
export function decideAutoPanelRouting(input: AutoPanelRoutingInput): AutoPanelRoutingDecision {
  const {
    phaseKey,
    hasActionsAvailable,
    actionsTargetPanelId,
    activePanelId,
    mySpecies,
    selectedSpecies,
    buildDrawingRouteRequest,
    drawingStage,
    carrierPreludeActionsValid,
  } = input;

  const selfCatalogue = speciesToCataloguePanelId(mySpecies ?? 'human');
  const selectedSpeciesCatalogue = speciesToCataloguePanelId(selectedSpecies ?? 'human');
  const hasKnownActivePanel = isActionPanelId(activePanelId);

  // Menu is a user-owned desktop surface. Ordinary automatic routing must
  // never replace it; terminal routing is handled separately by the caller.
  if (activePanelId === 'ap.menu.root') {
    return { kind: 'none' };
  }

  // 1) FORCE SELECTED-SPECIES CATALOGUE DURING SETUP.SPECIES_SELECTION
  if (phaseKey === 'setup.species_selection') {
    if (activePanelId !== selectedSpeciesCatalogue) {
      return {
        kind: 'setActivePanelId',
        nextPanelId: selectedSpeciesCatalogue,
        log: `[useGameSession] setup.species_selection: forcing selected-species catalogue panel: ${selectedSpeciesCatalogue}`,
      };
    }
    return { kind: 'none' };
  }

  // 2) FORCE SELF CATALOGUE DURING BUILD.DRAWING
  // Default panel should be self catalogue, BUT do not override explicit user navigation
  // to Menu (and to Actions if it’s available/visible in this phase).
  if (phaseKey === 'build.drawing') {
    if (drawingStage?.kind === 'passive') {
      return hasKnownActivePanel
        ? { kind: 'none' }
        : {
            kind: 'setActivePanelId',
            nextPanelId: 'ap.idle.blank',
            log: '[useGameSession] build.drawing: recovering unknown passive-viewer panel',
          };
    }

    if (drawingStage?.kind === 'blocked') {
      return hasKnownActivePanel
        ? { kind: 'none' }
        : {
            kind: 'setActivePanelId',
            nextPanelId: 'ap.idle.blank',
            log: '[useGameSession] build.drawing: recovering unknown blocked-workflow panel',
          };
    }

    if (drawingStage?.kind === 'prelude') {
      if (carrierPreludeActionsValid !== true) {
        return hasKnownActivePanel
          ? { kind: 'none' }
          : {
              kind: 'setActivePanelId',
              nextPanelId: 'ap.idle.blank',
              log: '[useGameSession] build.drawing: awaiting a valid Carrier projection',
            };
      }

      if (activePanelId !== 'ap.build.drawing.prelude.carrier') {
        return {
          kind: 'setActivePanelId',
          nextPanelId: 'ap.build.drawing.prelude.carrier',
          log: `[useGameSession] build.drawing: opening Carrier prelude pass ${drawingStage.passIndex}`,
        };
      }
      return { kind: 'none' };
    }

    // Allow Actions tab if it exists / is currently available
    if (hasActionsAvailable && actionsTargetPanelId && activePanelId === actionsTargetPanelId) {
      return { kind: 'none' };
    }

    if (
      hasActionsAvailable &&
      actionsTargetPanelId &&
      buildDrawingRouteRequest !== null
    ) {
      const logReason =
        buildDrawingRouteRequest === 'frigate-demand'
          ? 'new Frigate demand'
          : buildDrawingRouteRequest === 'quantum-mystic-demand'
            ? 'new Quantum Mystic demand'
          : buildDrawingRouteRequest === 'evolver-entry'
            ? 'phase entry with Evolver rows available'
            : 'new Evolver row ids added';
      const requestedPanelId =
        buildDrawingRouteRequest === 'frigate-demand'
          ? 'ap.build.drawing.human'
          : buildDrawingRouteRequest === 'quantum-mystic-demand'
            ? 'ap.build.drawing.ancient'
          : 'ap.build.drawing.xenite';

      return {
        kind: 'setActivePanelId',
        nextPanelId: requestedPanelId,
        log: `[useGameSession] build.drawing: ${logReason}; switching to Actions: ${requestedPanelId}`,
      };
    }

    // Allow any catalogue panel once the user has already navigated there.
    if (isActionPanelId(activePanelId) && isCataloguePanel(activePanelId)) {
      return { kind: 'none' };
    }

    // Otherwise, keep defaulting to self catalogue
    if (activePanelId !== selfCatalogue) {
      return {
        kind: 'setActivePanelId',
        nextPanelId: selfCatalogue,
        log: `[useGameSession] build.drawing: forcing self catalogue panel: ${selfCatalogue}`,
      };
    }
    return { kind: 'none' };
  }

  if (!hasKnownActivePanel) {
    return {
      kind: 'setActivePanelId',
      nextPanelId: selfCatalogue,
      log: `[useGameSession] Unknown panel id: falling back to self catalogue panel: ${selfCatalogue}`,
    };
  }


  // 3) DEFAULT TO ACTIONS ON PHASE ENTRY (if available)
  // Only applies on phase transition (caller controls effect trigger).
  if (hasActionsAvailable && actionsTargetPanelId) {
    return {
      kind: 'setActivePanelId',
      nextPanelId: actionsTargetPanelId,
      log: `[useGameSession] Phase entry: defaulting to Actions: ${actionsTargetPanelId}`,
    };
  }

  // 4) HOLD SAFE WAITING PANELS DURING DEFERRED SERVER-CHOICE HANDOFFS
  if (!hasActionsAvailable && isDeferredAutoPanelHandoffPhase(phaseKey)) {
    if (isCataloguePanel(activePanelId)) {
      return { kind: 'none' };
    }
  }

  // 5) FALLBACK TO SELF CATALOGUE WHEN NO ACTIONS AVAILABLE
  if (!hasActionsAvailable) {
    const fallbackPanelId = selfCatalogue;

    if (activePanelId === fallbackPanelId) return { kind: 'none' };
    return {
      kind: 'setActivePanelId',
      nextPanelId: fallbackPanelId,
      log: `[useGameSession] No actions available: falling back to self catalogue panel: ${selfCatalogue}`,
    };
  }

  return { kind: 'none' };
}

/**
 * Phase 3 stub: eventually derive shipChoices / activePanelId from server availableActions.
 * For now, return shipChoices as null and let existing tab logic stand.
 */
export interface DerivePanelInput {
  activePanelId: ActionPanelId;
}

export interface DerivePanelOutput {
  activePanelId: ActionPanelId;
  shipChoices: null;
}

export function derivePanelAndShipChoices(input: DerivePanelInput): DerivePanelOutput {
  return { activePanelId: input.activePanelId, shipChoices: null };
}
