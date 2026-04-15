/**
 * gameSession/availableActions
 * ----------------------------
 * Phase/panel routing helpers extracted from useGameSession.ts.
 *
 * NOTE: This is UI-only logic. It does not validate rules and is not authoritative.
 * Phase 3 will eventually replace this with server-projected `availableActions`.
 */

import type { ActionPanelId } from '../../display/actionPanel/ActionPanelRegistry';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';

export type PhaseKey = string;
export type RenderableTargetedActionKind = 'destroy_target' | 'paired_destroy_target';
export type BuildDrawingRouteRequest =
  | null
  | 'frigate-demand'
  | 'evolver-entry'
  | 'evolver-added';

export interface AutoPanelRoutingInput {
  phaseKey: PhaseKey;
  hasActionsAvailable: boolean;
  actionsTargetPanelId: ActionPanelId | null;
  activePanelId: ActionPanelId;
  mySpecies: SpeciesId | null;
  selectedSpecies: SpeciesId | null;
  buildDrawingRouteRequest: BuildDrawingRouteRequest;
}

export type AutoPanelRoutingDecision =
  | { kind: 'none' }
  | { kind: 'setActivePanelId'; nextPanelId: ActionPanelId; log: string };

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

export function isRenderableTargetedActionKind(kind: string): kind is RenderableTargetedActionKind {
  return kind === 'destroy_target' || kind === 'paired_destroy_target';
}

export function isRenderableTargetedAction(action: { kind?: string } | null | undefined): action is RenderableServerAction {
  return isRenderableTargetedActionKind(String(action?.kind ?? ''));
}

export interface RenderableActionShipPresence {
  hasCarBuildAction: boolean;
  hasCentaurNonEquChargeAction: boolean;
  hasCentaurEquChargeAction: boolean;
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

    if (phaseKey === 'battle.first_strike' || phaseKey === 'build.ships_that_build') {
      return action.kind === 'choice' || action.kind === 'destroy_target';
    }

    if (phaseKey === 'battle.charge_declaration' || phaseKey === 'battle.charge_response') {
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
      if (phaseKey === 'build.ships_that_build' && action.shipDefId === 'CAR') {
        presence.hasCarBuildAction = true;
      }

      if (
        (phaseKey === 'battle.charge_declaration' || phaseKey === 'battle.charge_response') &&
        (action.shipDefId === 'WIS' ||
          action.shipDefId === 'FAM' ||
          action.shipDefId === 'INT' ||
          action.shipDefId === 'ANT')
      ) {
        presence.hasCentaurNonEquChargeAction = true;
      }

      if (
        (phaseKey === 'battle.charge_declaration' || phaseKey === 'battle.charge_response') &&
        action.shipDefId === 'EQU'
      ) {
        presence.hasCentaurEquChargeAction = true;
      }

      return presence;
    },
    {
      hasCarBuildAction: false,
      hasCentaurNonEquChargeAction: false,
      hasCentaurEquChargeAction: false,
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

  if (action.actionId === 'KNO#0') {
    return choiceIds.find((choiceId) => choiceId === 'hold') ?? choiceIds[0];
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

// TODO(BETA): Early-drawing during build.ships_that_build
// If phaseKey === 'build.ships_that_build' AND I have zero actions available in that phase,
// route me to the same panel used for build.drawing (catalogue/drawing UI) BUT keep it draft-only:
// - do not submit intents
// - revalidate draft when phaseKey becomes 'build.drawing'


/**
 * Mirrors the routing effects that previously lived inline in useGameSession.ts.
 * We keep the decisions separated by returning a single highest-priority action.
 *
 * Priority:
 * 1) Force the selected-species catalogue during setup.species_selection
 * 2) Force self catalogue during build.drawing
 * 3) Auto-select Actions tab when it becomes available (except during build.drawing)
 * 4) Fallback to idle blank when no actions are available outside species selection
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
  } = input;

  const selfCatalogue = speciesToCataloguePanelId(mySpecies ?? 'human');
  const selectedSpeciesCatalogue = speciesToCataloguePanelId(selectedSpecies ?? 'human');

  // 1) FORCE SELECTED-SPECIES CATALOGUE DURING SETUP.SPECIES_SELECTION
  if (phaseKey === 'setup.species_selection') {
    if (activePanelId === 'ap.menu.root') return { kind: 'none' };
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
    // Allow Menu tab during build.drawing
    if (activePanelId === 'ap.menu.root') return { kind: 'none' };

    // Allow Actions tab if it exists / is currently available
    if (hasActionsAvailable && actionsTargetPanelId && activePanelId === actionsTargetPanelId) {
      return { kind: 'none' };
    }

    if (
      hasActionsAvailable &&
      actionsTargetPanelId &&
      (
        (mySpecies === 'human' && buildDrawingRouteRequest === 'frigate-demand') ||
        (mySpecies === 'xenite' &&
          (buildDrawingRouteRequest === 'evolver-entry' ||
            buildDrawingRouteRequest === 'evolver-added'))
      )
    ) {
      const logReason =
        buildDrawingRouteRequest === 'frigate-demand'
          ? 'new Frigate demand'
          : buildDrawingRouteRequest === 'evolver-entry'
            ? 'phase entry with Evolver rows available'
            : 'new Evolver row ids added';

      return {
        kind: 'setActivePanelId',
        nextPanelId: actionsTargetPanelId,
        log: `[useGameSession] build.drawing: ${logReason}; switching to Actions: ${actionsTargetPanelId}`,
      };
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


  // 3) DEFAULT TO ACTIONS ON PHASE ENTRY (if available)
  // Only applies on phase transition (caller controls effect trigger).
  if (hasActionsAvailable && actionsTargetPanelId) {
    // Respect Menu — do not auto-route away from Menu
    if (activePanelId === 'ap.menu.root') {
      return { kind: 'none' };
    }
  
    return {
      kind: 'setActivePanelId',
      nextPanelId: actionsTargetPanelId,
      log: `[useGameSession] Phase entry: defaulting to Actions: ${actionsTargetPanelId}`,
    };
  }

  // 4) FALLBACK TO IDLE BLANK WHEN NO ACTIONS AVAILABLE
  if (!hasActionsAvailable) {
    if (activePanelId === 'ap.idle.blank') return { kind: 'none' };
    if (activePanelId === 'ap.menu.root') return { kind: 'none' };
    return {
      kind: 'setActivePanelId',
      nextPanelId: 'ap.idle.blank',
      log: '[useGameSession] No actions available: falling back to idle blank panel: ap.idle.blank',
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
