import type { SpeciesLoreId } from './loreContent';

/** Presentation coordinates on a compressed scale, not astronomical simulation. */
export interface MapSystem {
  id: string;
  name: string;
  distance: string;
  findingId: string;
  core: SpeciesLoreId;
  ring: SpeciesLoreId;
  wide: readonly [number, number];
  compact: readonly [number, number];
  phone: readonly [number, number];
}

export const mapSystems: readonly MapSystem[] = [
  { id: 'sol', name: 'Sol', distance: '0 ly', findingId: 'sol-1', core: 'human', ring: 'human', wide: [463, 290], compact: [315, 336], phone: [217, 183] },
  { id: 'proxima-centauri', name: 'Proxima Centauri', distance: '4 ly', findingId: 'proxima-centauri', core: 'centaur', ring: 'centaur', wide: [501.33, 329.83], compact: [344, 366], phone: [238, 205] },
  { id: 'barnards-star', name: 'Barnard’s Star', distance: '6 ly', findingId: 'barnards-star', core: 'human', ring: 'human', wide: [517.28, 257.39], compact: [356, 311], phone: [247, 165] },
  { id: 'epsilon-eridani', name: 'Epsilon Eridani', distance: '11 ly', findingId: 'ancient-mysteries-centaur', core: 'ancient', ring: 'centaur', wide: [386.6, 311.62], compact: [257, 352], phone: [175, 195] },
  { id: 'groombridge', name: 'Groombridge', distance: '12 ly', findingId: 'groombridge', core: 'human', ring: 'xenite', wide: [425.87, 216.12], compact: [287, 279], phone: [196, 143] },
  { id: 'tau-ceti', name: 'Tau Ceti', distance: '12 ly', findingId: 'tau-ceti', core: 'ancient', ring: 'ancient', wide: [380.12, 279.97], compact: [252, 328], phone: [172, 177] },
  { id: 'gamma-leporis', name: 'Gamma Leporis', distance: '29 ly', findingId: 'gamma-leporis', core: 'xenite', ring: 'centaur', wide: [381.35, 376.95], compact: [253, 402], phone: [172, 231] },
  { id: 'delta-aquarii', name: 'Delta Aquarii', distance: '113 ly', findingId: 'delta-aquarii', core: 'centaur', ring: 'human', wide: [596.12, 133.58], compact: [416, 217], phone: [290, 97] },
  { id: 'betelgeuse', name: 'Betelgeuse', distance: '~550 ly', findingId: 'betelgeuse', core: 'xenite', ring: 'xenite', wide: [99.58, 420.84], compact: [38, 435], phone: [17, 255] },
];

export const systemCardOrder = [
  'sol-1', 'proxima-centauri', 'barnards-star', 'groombridge',
  'tau-ceti', 'gamma-leporis', 'delta-aquarii', 'betelgeuse',
] as const;

export const speciesColors: Record<SpeciesLoreId, string> = {
  human: 'var(--shapeships-pastel-blue)',
  xenite: 'var(--shapeships-pastel-green)',
  centaur: 'var(--shapeships-pastel-red)',
  ancient: 'var(--shapeships-pastel-purple)',
};

export function markerColors(system: MapSystem, completed: ReadonlySet<string>) {
  const unlocked = completed.has(system.findingId);
  return {
    core: unlocked ? speciesColors[system.core] : 'var(--shapeships-grey-70)',
    ring: unlocked ? speciesColors[system.ring] : 'var(--shapeships-grey-50)',
    outer: system.id === 'sol' && completed.has('ancient-mysteries-human')
      ? speciesColors.ancient : 'var(--shapeships-grey-50)',
  };
}

interface CardRect { x: number; y: number; width: number; height: number }
interface MapPoint {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  anchor: 'start' | 'middle' | 'end';
  splitName?: boolean;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Keep text at live CSS sizes while interpolating the two desktop compositions. */
export function createMissionMapLayout(
  width: number,
  loreWidth: number,
  cardHeights: Readonly<Record<string, number>> = {},
) {
  const desktop = loreWidth >= 720;
  const compactPhone = loreWidth < 340;
  const t = Math.max(0, Math.min(1, (loreWidth - 720) / 320));
  const cards: Record<string, CardRect> = {};
  const points: Record<string, MapPoint> = {};
  const h = (id: string, compact: number, wide: number) =>
    cardHeights[id] ?? mix(compact, wide, t);
  let height = compactPhone ? 460 : Math.max(372, Math.min(440, width * 372 / 358));
  let unknown = { x: width - 124, y: height - 86, width: 108, height: 36 };
  let gridSize = width / 10;

  if (desktop) {
    const side = mix(160, 224, t) * width / mix(656, 936, t);
    const left = 14;
    const right = width - left - side;
    const addCard = (id: string, x: number, y: number, cardHeight: number) => {
      cards[id] = { x, y, width: side, height: cardHeight };
    };
    let rightY = mix(84, 64, t);
    for (const id of ['delta-aquarii', 'barnards-star', 'sol-1', 'proxima-centauri']) {
      const cardHeight = h(id, id === 'sol-1' ? 80 : 112, ['sol-1', 'proxima-centauri'].includes(id) ? 80 : 96);
      addCard(id, right, rightY, cardHeight);
      rightY += cardHeight + 20;
    }
    const groomY = mix(124, 100, t);
    addCard('groombridge', left, groomY, h('groombridge', 128, 96));
    const tauY = groomY + cards.groombridge.height + mix(16, 40, t);
    addCard('tau-ceti', left, tauY, h('tau-ceti', 144, 112));
    const lowerY = Math.max(mix(488, 456, t), tauY + cards['tau-ceti'].height + mix(76, 108, t));
    addCard('betelgeuse', left, lowerY, h('betelgeuse', 144, 112));
    addCard('gamma-leporis', side + mix(40, 52, t), lowerY, h('gamma-leporis', 112, 96));
    const baseHeight = mix(728, 652, t);
    const unknownY = Math.max(baseHeight - 136, rightY + 12);
    unknown = { x: right, y: unknownY, width: side, height: 64 };
    height = Math.max(baseHeight, unknownY + 136, lowerY + Math.max(cards.betelgeuse.height, cards['gamma-leporis'].height) + mix(96, 84, t));
    gridSize = width / mix(16, 20, t);

    for (const system of mapSystems) {
      const x = mix(system.compact[0], system.wide[0], t) * width / mix(656, 936, t);
      let y = mix(system.compact[1], system.wide[1], t);
      if (system.id === 'betelgeuse') y = lowerY - mix(54, 36, t);
      if (system.id === 'gamma-leporis') y = lowerY - mix(86, 80, t);
      if (system.id === 'tau-ceti') y = tauY + cards['tau-ceti'].height / 2 - 12;
      let point: MapPoint = { x, y, labelX: x + 16, labelY: y - 15, anchor: 'start' };
      if (system.id === 'sol') point = { ...point, labelX: x, labelY: y + 18, anchor: 'middle' };
      if (system.id === 'tau-ceti') point = { ...point, labelX: x, labelY: y - 44, anchor: 'middle' };
      if (system.id === 'epsilon-eridani') point = t < 0.45
        ? { ...point, labelX: x - 10, labelY: y + 11, anchor: 'middle' }
        : { ...point, labelX: x - 16, labelY: y - 16, anchor: 'end' };
      if (system.id === 'delta-aquarii') point.splitName = true;
      if (system.id === 'gamma-leporis') point.labelY = y - 8;
      points[system.id] = point;
    }
  } else {
    // A separate 320px arrangement preserves type sizes and clears long labels.
    const small: Record<string, readonly [number, number]> = {
      sol: [0.56, 247], 'proxima-centauri': [0.63, 294],
      'barnards-star': [0.69, 194], 'epsilon-eridani': [0.465, 272],
      groombridge: [0.54, 145], 'tau-ceti': [0.47, 214],
      'gamma-leporis': [0.46, 337], 'delta-aquarii': [0.825, 86],
      betelgeuse: [0.06, 366],
    };
    for (const system of mapSystems) {
      const x = compactPhone ? small[system.id][0] * width : system.phone[0] * width / 358;
      const y = compactPhone ? small[system.id][1] : system.phone[1] * height / 372;
      let point: MapPoint = { x, y, labelX: x + 13, labelY: y - 13, anchor: 'start' };
      if (system.id === 'sol') point = { ...point, labelX: x, labelY: y + 14, anchor: 'middle' };
      if (system.id === 'groombridge') point = { ...point, labelX: x, labelY: y - 42, anchor: 'middle' };
      if (system.id === 'tau-ceti') point = { ...point, labelX: x - 16, labelY: y - 28, anchor: 'end' };
      if (system.id === 'epsilon-eridani') point = { ...point, labelX: x - 14, labelY: y + (compactPhone ? -12 : 2), anchor: 'end' };
      if (system.id === 'delta-aquarii') point = { ...point, labelX: x - 16, labelY: y - (compactPhone ? 33 : 17), anchor: 'end' };
      if (!compactPhone && system.id === 'gamma-leporis') point.labelY = y - 1;
      if (compactPhone && system.id === 'proxima-centauri') point = { ...point, labelX: width - 10, labelY: y + 13, anchor: 'end' };
      if (compactPhone && system.id === 'barnards-star') point = { ...point, labelX: width - 10, labelY: y - 32, anchor: 'end' };
      points[system.id] = point;
    }
  }

  return { width, height, desktop, points, cards, unknown, gridSize };
}

/** A horizontal/vertical/45-degree route with rounded internal elbows. */
export function connectorPath(x: number, y: number, endX: number, endY: number): string {
  const dx = endX - x;
  const dy = endY - y;
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return 'M ' + x + ' ' + y + ' L ' + endX + ' ' + endY;
  const run = Math.min(Math.abs(dx), Math.abs(dy));
  const bendX = x + Math.sign(dx) * run;
  const bendY = y + Math.sign(dy) * run;
  const r = Math.min(8, run / 3, Math.abs(endX - bendX) / 3);
  return 'M ' + x + ' ' + y + ' L ' + (bendX - Math.sign(dx) * r) + ' ' + (bendY - Math.sign(dy) * r)
    + ' Q ' + bendX + ' ' + bendY + ' ' + (bendX + Math.sign(dx) * r) + ' ' + bendY
    + ' L ' + endX + ' ' + endY;
}
