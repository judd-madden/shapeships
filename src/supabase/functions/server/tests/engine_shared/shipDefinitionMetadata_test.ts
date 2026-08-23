import assert from 'node:assert/strict';
import {
  getAggregatedShipPowerTags,
  getShipByIdOrThrow,
  getShipPowerMetadataRows,
  SHIP_DEFINITIONS_CORE_SERVER,
  SHIP_DEFS_VERSION_SERVER,
  type ShipPowerTag,
} from '../../engine_shared/defs/ShipDefinitions.core.ts';
import { getShipDefinitionOrThrow } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import { getShipPowerTagLabels } from '../../../../../game/data/ShipPowerTags.ts';

interface ParsedClientPower {
  readonly tags?: readonly string[];
  readonly activationTiming?: string;
}

interface ParsedClientShip {
  readonly id: string;
  readonly powers: readonly ParsedClientPower[];
}

interface ComparableMetadataRow {
  readonly shipDefId: string;
  readonly rawPowerIndex: number;
  readonly tags: readonly string[];
  readonly activationTiming: string | null;
}

const CLIENT_DEFINITIONS_URL = new URL(
  '../../../../../game/data/ShipDefinitions.json.ts',
  import.meta.url,
);

const ARRAY_ASSIGNMENT_MARKER = 'export const SHIP_DEFINITIONS_JSON = ';
const ARRAY_END_MARKER = '] as const;';

function parseClientDefinitions(source: string): ParsedClientShip[] {
  const assignmentIndex = source.indexOf(ARRAY_ASSIGNMENT_MARKER);
  assert.notEqual(assignmentIndex, -1, 'client definition array assignment is present');

  const arrayStart = assignmentIndex + ARRAY_ASSIGNMENT_MARKER.length;
  const arrayEndMarkerIndex = source.indexOf(ARRAY_END_MARKER, arrayStart);
  assert.notEqual(arrayEndMarkerIndex, -1, 'client definition array terminator is present');

  const jsonArray = source.slice(arrayStart, arrayEndMarkerIndex + 1);
  return JSON.parse(jsonArray) as ParsedClientShip[];
}

function parseClientVersion(source: string): string {
  const match = source.match(
    /export const SHIP_DEFS_VERSION = ['"]([^'"]+)['"];/,
  );
  assert.ok(match, 'client definition version is present');
  return match[1];
}

function normalizeClientRows(
  definitions: readonly ParsedClientShip[],
): ComparableMetadataRow[] {
  return definitions.flatMap((ship) =>
    ship.powers.map((power, rawPowerIndex) => ({
      shipDefId: ship.id,
      rawPowerIndex,
      tags: power.tags ? [...power.tags] : [],
      activationTiming: power.activationTiming ?? null,
    }))
  );
}

function getClientShip(
  definitions: readonly ParsedClientShip[],
  shipDefId: string,
): ParsedClientShip {
  const ship = definitions.find((definition) => definition.id === shipDefId);
  assert.ok(ship, `client definition exists for ${shipDefId}`);
  return ship;
}

const clientSource = await Deno.readTextFile(CLIENT_DEFINITIONS_URL);
const clientDefinitions = parseClientDefinitions(clientSource);
const serverRows: ComparableMetadataRow[] = getShipPowerMetadataRows();
const clientRows = normalizeClientRows(clientDefinitions);

// @ts-expect-error Phase 14BC intentionally rejects free-form power tags.
const invalidFreeFormTag: ShipPowerTag = 'free_form_tag';
void invalidFreeFormTag;

Deno.test('server and client raw definitions, metadata, and versions have exact parity', () => {
  assert.equal(SHIP_DEFS_VERSION_SERVER, parseClientVersion(clientSource));
  assert.deepEqual(clientDefinitions, SHIP_DEFINITIONS_CORE_SERVER);
  assert.deepEqual(clientRows, serverRows);
});

Deno.test('raw power tag membership is exact and authoring invariants hold', () => {
  const expectedMakesShips = [
    'CAR#0',
    'DRE#0',
    'BUG#0',
    'ZEN#0',
    'ZEN#1',
    'ZEN#2',
    'QUE#0',
    'SSIM#0',
  ];
  const expectedTargetsShips = [
    'GUA#0',
    'EVO#0',
    'SAC#0',
    'EQU#0',
    'DOM#1',
    'SPI#2',
    'SSIM#0',
    'SBLA#0',
  ];

  const coordinatesFor = (tag: string) =>
    serverRows
      .filter((row) => row.tags.includes(tag))
      .map((row) => `${row.shipDefId}#${row.rawPowerIndex}`);

  assert.deepEqual(coordinatesFor('makes_ships'), expectedMakesShips);
  assert.deepEqual(coordinatesFor('targets_ships'), expectedTargetsShips);

  for (const row of serverRows) {
    assert.equal(
      new Set(row.tags).size,
      row.tags.length,
      `${row.shipDefId}#${row.rawPowerIndex} has no duplicate tags`,
    );
  }

  const simulacrum = serverRows.find((row) =>
    row.shipDefId === 'SSIM' && row.rawPowerIndex === 0
  );
  assert.deepEqual(simulacrum?.tags, ['makes_ships', 'targets_ships']);
});

Deno.test('exactly eight maker powers have their explicit activation timing', () => {
  const expectedTimings = new Map<string, string>([
    ['CAR#0', 'start_of_drawing'],
    ['DRE#0', 'reveal'],
    ['BUG#0', 'start_of_drawing'],
    ['ZEN#0', 'when_built'],
    ['ZEN#1', 'start_of_drawing'],
    ['ZEN#2', 'on_destruction'],
    ['QUE#0', 'start_of_drawing'],
    ['SSIM#0', 'turn_start_materialisation'],
  ]);
  const timedRows = serverRows.filter((row) => row.activationTiming !== null);
  const makerRows = serverRows.filter((row) => row.tags.includes('makes_ships'));

  assert.equal(timedRows.length, 8);
  assert.equal(makerRows.length, 8);

  for (const row of serverRows) {
    const coordinate = `${row.shipDefId}#${row.rawPowerIndex}`;
    const isMaker = row.tags.includes('makes_ships');

    if (isMaker) {
      assert.equal(typeof row.activationTiming, 'string');
      assert.equal(row.activationTiming, expectedTimings.get(coordinate));
    } else {
      assert.equal(
        row.activationTiming,
        null,
        `${coordinate} is untagged or targets-only and has no timing`,
      );
    }
  }
});

Deno.test('server inspection aggregation is ordered and deduplicated', () => {
  assert.deepEqual(
    getAggregatedShipPowerTags(getShipByIdOrThrow('ZEN')),
    ['makes_ships'],
  );
  assert.deepEqual(
    getAggregatedShipPowerTags(getShipByIdOrThrow('SSIM')),
    ['makes_ships', 'targets_ships'],
  );
  assert.deepEqual(
    getAggregatedShipPowerTags(getShipByIdOrThrow('EVO')),
    ['targets_ships'],
  );
  assert.deepEqual(getAggregatedShipPowerTags(getShipByIdOrThrow('CHR')), []);
});

Deno.test('client presentation helper returns labels without raw power identity', () => {
  const cases: readonly [string, readonly string[]][] = [
    ['ZEN', ['MAKES SHIPS']],
    ['SSIM', ['MAKES SHIPS', 'TARGETS SHIPS']],
    ['EVO', ['TARGETS SHIPS']],
    ['CHR', []],
  ];

  for (const [shipDefId, expectedLabels] of cases) {
    const labels = getShipPowerTagLabels(
      getClientShip(clientDefinitions, shipDefId).powers as readonly {
        readonly tags?: readonly ShipPowerTag[];
      }[],
    );
    assert.deepEqual(labels, expectedLabels);
    assert.equal(labels.some((label) => label.includes('#')), false);
  }
});

Deno.test('metadata remains attached to raw powers rather than flattened structured indexes', () => {
  for (const [shipDefId, rawPowerIndex] of [
    ['DRE', 0],
    ['DOM', 1],
    ['SPI', 2],
  ] as const) {
    const definition = getShipDefinitionOrThrow(shipDefId);
    assert.ok(definition.powers[rawPowerIndex].tags?.length);
    assert.equal(definition.structuredPowers.length > 0, true);
    assert.equal('tags' in definition.structuredPowers[0], false);
    assert.equal('activationTiming' in definition.structuredPowers[0], false);
  }
});
