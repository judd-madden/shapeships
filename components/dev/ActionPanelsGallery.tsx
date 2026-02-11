/**
 * ActionPanelsGallery - Dev-only preview for all Action Panels
 * 
 * DUMB GALLERY: Shows all action panels with dummy data, no eligibility logic.
 * Pure UI refinement tool for rapid iteration.
 * 
 * ARCHITECTURAL NOTES:
 * - DEV DASHBOARD ONLY (no routes, no menu items)
 * - NO LOGIC/ELIGIBILITY (no phase logic, no engine rules)
 * - USES REAL PANELS (renders via ActionPanelFrame with real registry)
 * - NO CONTROLS (just renders everything in a scroll)
 * - NO SERVER CALLS (stub actions are no-ops)
 */

import { ActionPanelFrame } from '../../game/display/actionPanel/ActionPanelFrame';
import { ACTION_PANEL_IDS, ACTION_PANEL_DISPLAY_NAMES } from '../../game/display/actionPanel/ActionPanelRegistry';
import type { ActionPanelViewModel, GameSessionActions, ActionPanelTabVm } from '../../game/client/useGameSession';
import type { ActionPanelId } from '../../game/display/actionPanel/ActionPanelRegistry';
import {
  getShipChoicePanelSpec,
  type ShipChoiceButtonsPanelSpec,
  type ShipChoiceCountedShipGroupSpec,
  type ShipChoiceNamedShipGroupSpec,
} from '../../game/display/actionPanel/panels/ShipChoiceRegistry';
import type { ShipChoicesPanelGroup } from '../../game/types/ShipChoiceTypes';

// ============================================================================
// DUMMY DATA
// ============================================================================

const DUMMY_TABS: ActionPanelTabVm[] = [
  {
    tabId: 'tab.catalog.my',
    label: 'Human',
    visible: true,
    targetPanelId: 'ap.catalog.ships.human',
  },
  {
    tabId: 'tab.catalog.opponent',
    label: 'Centaur',
    visible: true,
    targetPanelId: 'ap.catalog.ships.centaur',
  },
  {
    tabId: 'tab.actions',
    label: 'Actions',
    visible: true,
    targetPanelId: 'ap.battle.charges.human',
  },
  {
    tabId: 'tab.menu',
    label: 'Menu',
    visible: true,
    targetPanelId: 'ap.menu.root',
  },
];

const DUMMY_ACTIONS: GameSessionActions = {
  onReadyToggle: () => {},
  onUndoActions: () => {},
  onOpenMenu: () => {},
  onActionPanelTabClick: () => {},
  onShipClick: () => {},
  onSendChat: () => {},
  onAcceptDraw: () => {},
  onRefuseDraw: () => {},
  onOpenBattleLogFullscreen: () => {},
  onSelectSpecies: () => {},
  onConfirmSpecies: () => {},
  onOfferDraw: () => {},
  onResignGame: () => {},
  onRematch: () => {},
  onDownloadBattleLog: () => {},
};

// ============================================================================
// HELPER: BUILD DUMMY VM FOR EACH PANEL
// ============================================================================

function buildDummyVm(panelId: ActionPanelId): ActionPanelViewModel {
  // Base VM (always present)
  const base: ActionPanelViewModel = {
    activePanelId: panelId,
    tabs: DUMMY_TABS,
    menu: {
      title: 'Game in progress',
      subtitle: 'Dev preview',
    },
    endOfGame: {
      bannerText: 'Decisive Victory! You are triumphant.',
      bannerBgCssVar: 'var(--shapeships-pastel-blue)',
      metaLeftText: 'Player 1',
      metaRightText: 'Player 2',
    },
  };

  // Conditional: Frigate drawing panel only
  if (panelId === 'ap.build.drawing.human') {
    base.frigateDrawing = { frigateCount: 3 };
  }

  // Conditional: Evolver drawing panel only
  if (panelId === 'ap.build.drawing.xenite') {
    base.evolverDrawing = { evolverCount: 2 };
  }

  // Conditional: Ship choice panels with buttons layout
  const spec = getShipChoicePanelSpec(panelId);
  if (spec?.kind === 'buttons') {
    base.shipChoices = {
      groups: makeDummyGroupsFromSpec(spec, 2), // 2 copies per ship to stress layout
      showOpponentAlsoHasCharges: spec.showOpponentAlsoHasCharges ?? false,
      opponentAlsoHasChargesHeading: 'Your opponent also has charges available.',
      opponentAlsoHasChargesLines: [
        'If you use any charges, they can respond.',
        'If they use any charges, you can respond.',
        'If you both hold all charges, play proceeds.',
      ],
    };
  }

  return base;
}

// ============================================================================
// HELPER: GENERATE DUMMY GROUPS FROM SPEC
// ============================================================================

/**
 * Converts a ship choice panel spec into dummy ShipChoicesPanelGroup[] data.
 * 
 * @param spec - The panel spec from the registry
 * @param copiesPerShip - How many instances of each ship to create (for stress testing)
 * @returns Dummy groups matching the spec's ships and buttons
 */
function makeDummyGroupsFromSpec(
  spec: ShipChoiceButtonsPanelSpec,
  copiesPerShip: number
): ShipChoicesPanelGroup[] {
  return spec.groups.map((group) => {
    if (group.kind === 'counted') {
      const g = group as ShipChoiceCountedShipGroupSpec;

      const ships = Array.from({ length: Math.max(1, copiesPerShip) }, () => ({
        shipDefId: g.shipDefId,
        buttons: g.buttons,
      }));

      const count = ships.length;
      const heading = g.headingTemplate.includes('{count}')
        ? g.headingTemplate.replace('{count}', String(count))
        : g.headingTemplate;

      return { heading, ships };
    }

    // named
    const g = group as ShipChoiceNamedShipGroupSpec;

    const ships = g.ships.flatMap((s) =>
      Array.from({ length: Math.max(1, copiesPerShip) }, () => ({
        shipDefId: s.shipDefId,
        buttons: s.buttons,
      }))
    );

    return { heading: g.heading, ships };
  });
}

// ============================================================================
// GALLERY COMPONENT
// ============================================================================

export function ActionPanelsGallery() {
  return (
    <div className="w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Action Panels Gallery</h2>
        <p className="text-sm text-gray-600 mt-1">
          All action panels rendered with dummy data. No eligibility logic or controls.
        </p>
      </div>

      {/* Render each panel */}
      {ACTION_PANEL_IDS.map((panelId) => {
        const vm = buildDummyVm(panelId);
        
        return (
          <div key={panelId} className="space-y-2">
            {/* Panel Label */}
            <div className="flex items-baseline gap-3">
              <h3 className="text-sm font-mono font-semibold text-gray-700">
                {panelId}
              </h3>
              <span className="text-xs text-gray-500">
                {ACTION_PANEL_DISPLAY_NAMES[panelId]}
              </span>
            </div>

            {/* Panel Content (in black background) */}
            <div className="bg-black p-5 rounded-md w-full">
              <div className="w-full min-h-[300px]">
                <ActionPanelFrame
                  vm={vm}
                  actions={DUMMY_ACTIONS}
                  onReturnToMainMenu={() => {}}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}