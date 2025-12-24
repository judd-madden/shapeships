// Ship Types - UI (React-Only Graphics)
// This file contains React-dependent types for ship graphics
// Server/engine should NOT import this file

import type { ComponentType } from 'react';
import type { ShipDefinitionCsv } from './ShipTypes.csv';

// ============================================================================
// GRAPHICS TYPES (UI-ONLY)
// ============================================================================

/**
 * ShipGraphic - React component wrapper for ship SVG graphics
 * UI-only - not used by server/engine
 */
export interface ShipGraphic {
  component: ComponentType<{ className?: string }>;
  condition?: 'default' | 'charges_0' | 'charges_1' | 'charges_2' | 'charges_3' | 'charges_4' | 'charges_5' | 'charges_6' | 'charges_depleted';
}

/**
 * ShipGraphics - Collection of graphics for different ship states
 * UI-only - not used by server/engine
 */
export interface ShipGraphics {
  main: ShipGraphic;
  // Can add more states later: damaged, powered, etc.
}

// ============================================================================
// UI SHIP DEFINITION (Core + Graphics)
// ============================================================================

/**
 * ShipDefinitionUI - Client-side ship definition with graphics
 * Extends core definition with optional graphics for rendering
 */
export interface ShipDefinitionUI extends ShipDefinitionCsv {
  graphics?: ShipGraphic[]; // Can have multiple graphics based on state
}

// Backward compatibility alias
export type ShipDefinition = ShipDefinitionUI;