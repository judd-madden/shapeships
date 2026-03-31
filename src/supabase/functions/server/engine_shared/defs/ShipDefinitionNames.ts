import { getShipById } from './ShipDefinitions.core.ts';

const SHIP_OF_PREFIX = 'Ship of ';
const ARK_OF_PREFIX = 'Ark of ';

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

export function getCanonicalShipFamilyDisplayName(
  shipDefId: string,
  count: number,
): string {
  const shipName = getShipById(shipDefId)?.name ?? shipDefId;
  return count === 1 ? shipName : pluralizeShipName(shipName);
}
