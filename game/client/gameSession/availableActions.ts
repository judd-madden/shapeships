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

export interface AutoPanelRoutingInput {
  phaseKey: PhaseKey;
  hasActionsAvailable: boolean;
  actionsTargetPanelId: ActionPanelId | null;
  activePanelId: ActionPanelId;
  mySpecies: SpeciesId | null;
}

export type AutoPanelRoutingDecision =
  | { kind: 'none' }
  | { kind: 'setActivePanelId'; nextPanelId: ActionPanelId; log: string };

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

/**
 * Mirrors the 3 routing effects that previously lived inline in useGameSession.ts.
 * We keep the decisions separated by returning a single highest-priority action.
 *
 * Priority:
 * 1) Force self catalogue during build.drawing
 * 2) Auto-select Actions tab when it becomes available (except during build.drawing)
 * 3) Fallback to self catalogue when no actions are available
 */
export function decideAutoPanelRouting(input: AutoPanelRoutingInput): AutoPanelRoutingDecision {
  const { phaseKey, hasActionsAvailable, actionsTargetPanelId, activePanelId, mySpecies } = input;

  const selfCatalogue = speciesToCataloguePanelId(mySpecies ?? 'human');

  // 1) FORCE SELF CATALOGUE DURING BUILD.DRAWING
  // Default panel should be self catalogue, BUT do not override explicit user navigation
  // to Menu (and to Actions if it’s available/visible in this phase).
  if (phaseKey === 'build.drawing') {
    // Allow Menu tab during build.drawing
    if (activePanelId === 'ap.menu.root') return { kind: 'none' };

    // Allow Actions tab if it exists / is currently available
    if (hasActionsAvailable && actionsTargetPanelId && activePanelId === actionsTargetPanelId) {
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


  // 2) DEFAULT TO ACTIONS ON PHASE ENTRY (if available)
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

  // 3) FALLBACK TO SELF CATALOGUE WHEN NO ACTIONS AVAILABLE
  if (!hasActionsAvailable) {
    if (isCataloguePanel(activePanelId)) return { kind: 'none' };
    if (activePanelId === 'ap.menu.root') return { kind: 'none' };
    return {
      kind: 'setActivePanelId',
      nextPanelId: selfCatalogue,
      log: `[useGameSession] No actions available: falling back to self catalogue: ${selfCatalogue}`,
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
