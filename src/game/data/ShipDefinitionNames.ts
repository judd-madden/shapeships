import { getShipById } from './ShipDefinitions.core';

const SHIP_OF_PREFIX = 'Ship of ';
const ARK_OF_PREFIX = 'Ark of ';

// Mirrors src/supabase/functions/server/engine_shared/defs/ShipDefinitionNames.ts.
// Keep these display-only client rules aligned with the server helper.
export function pluralizeShipName(name: string): string {
  if (name.slice(0, SHIP_OF_PREFIX.length).toLowerCase() === SHIP_OF_PREFIX.toLowerCase()) {
    return `Ships of ${name.slice(SHIP_OF_PREFIX.length)}`;
  }

  if (name.slice(0, ARK_OF_PREFIX.length).toLowerCase() === ARK_OF_PREFIX.toLowerCase()) {
    return `Arks of ${name.slice(ARK_OF_PREFIX.length)}`;
  }

  if (/[^aeiou]y$/i.test(name)) {
    return `${name.slice(0, -1)}ies`;
  }

  if (/(s|x|z|ch|sh)$/i.test(name)) {
    return `${name}es`;
  }

  return `${name}s`;
}

export function getShipNameForCount(name: string, count: number): string {
  return count === 1 ? name : pluralizeShipName(name);
}

export function getShipDefinitionNameForCount(shipDefId: string, count: number): string {
  const shipName = getShipById(shipDefId)?.name ?? shipDefId;
  return getShipNameForCount(shipName, count);
}
