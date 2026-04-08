import type { SpeciesId } from '../../components/ui/primitives/buttons/SpeciesCardButton';
import type { BattleLogTurnPlayerSummary } from './gameSession/types';

type RuntimePlayerInfo = {
  identityKey: string | null;
  name: string | null | undefined;
  species: SpeciesId | null;
};

type DownloadBattleLogArgs = {
  battleLogHistory: unknown;
  gameId: string;
  me: RuntimePlayerInfo;
  opponent: RuntimePlayerInfo;
  winnerPlayerId: string | null;
  resultReason: string | null;
};

type ValidatedBattleLogTurn = {
  turnNumber: number;
  diceValue: number | null;
  players: BattleLogTurnPlayerSummary[];
  buildLinesByPlayerId: Record<string, unknown>;
  battleLinesByPlayerId: Record<string, unknown>;
};

type ValidatedBattleLogHistory = {
  gameId: string | null;
  completedTurnCount: number | null;
  turns: ValidatedBattleLogTurn[];
};

type CanonicalPlayer = {
  playerId: string | null;
  name: string;
  species: SpeciesId | null;
};

type NormalizedRuntimePlayer = {
  playerId: string | null;
  name: string | null;
  species: SpeciesId | null;
};

const FILE_NAME_PLAYER_MAX_LENGTH = 32;
const FILE_NAME_INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
const COLLAPSE_WHITESPACE_PATTERN = /\s+/g;

export function downloadBattleLog(args: DownloadBattleLogArgs): void {
  const history = validateBattleLogHistory(args.battleLogHistory);
  if (!history) {
    console.warn('[downloadBattleLog] Battle log history missing or invalid');
    return;
  }

  if (history.gameId && history.gameId !== args.gameId) {
    console.warn('[downloadBattleLog] Battle log history gameId mismatch', {
      runtimeGameId: args.gameId,
      historyGameId: history.gameId,
    });
    return;
  }

  const exportedAt = new Date();
  const canonicalPlayers = resolveCanonicalPlayers(history, args.me, args.opponent);
  const text = buildBattleLogText({
    history,
    gameId: args.gameId,
    canonicalPlayers,
    winnerPlayerId: args.winnerPlayerId,
    resultReason: args.resultReason,
    exportedAt,
  });
  const filename = buildBattleLogFilename(canonicalPlayers, exportedAt);

  triggerTextFileDownload(filename, text);
}

function validateBattleLogHistory(value: unknown): ValidatedBattleLogHistory | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.turns)) {
    return null;
  }

  const turns: ValidatedBattleLogTurn[] = [];
  for (const rawTurn of record.turns) {
    const validatedTurn = validateBattleLogTurn(rawTurn);
    if (!validatedTurn) {
      return null;
    }
    turns.push(validatedTurn);
  }

  return {
    gameId: typeof record.gameId === 'string' ? record.gameId : null,
    completedTurnCount:
      typeof record.completedTurnCount === 'number' && Number.isFinite(record.completedTurnCount)
        ? record.completedTurnCount
        : null,
    turns,
  };
}

function validateBattleLogTurn(value: unknown): ValidatedBattleLogTurn | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.turnNumber !== 'number' ||
    !Number.isFinite(record.turnNumber) ||
    (record.diceValue !== null &&
      record.diceValue !== undefined &&
      (typeof record.diceValue !== 'number' || !Number.isFinite(record.diceValue))) ||
    !Array.isArray(record.players) ||
    !isRecord(record.buildLinesByPlayerId) ||
    !isRecord(record.battleLinesByPlayerId)
  ) {
    return null;
  }

  const players: BattleLogTurnPlayerSummary[] = [];
  for (const rawPlayer of record.players) {
    const validatedPlayer = validateBattleLogTurnPlayer(rawPlayer);
    if (!validatedPlayer) {
      return null;
    }
    players.push(validatedPlayer);
  }

  return {
    turnNumber: record.turnNumber,
    diceValue: typeof record.diceValue === 'number' ? record.diceValue : null,
    players,
    buildLinesByPlayerId: record.buildLinesByPlayerId,
    battleLinesByPlayerId: record.battleLinesByPlayerId,
  };
}

function validateBattleLogTurnPlayer(value: unknown): BattleLogTurnPlayerSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.playerId !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.healthEnd !== 'number' ||
    !Number.isFinite(record.healthEnd) ||
    typeof record.healthDelta !== 'number' ||
    !Number.isFinite(record.healthDelta)
  ) {
    return null;
  }

  return {
    playerId: record.playerId,
    name: record.name,
    healthEnd: record.healthEnd,
    healthDelta: record.healthDelta,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function resolveCanonicalPlayers(
  history: ValidatedBattleLogHistory,
  me: RuntimePlayerInfo,
  opponent: RuntimePlayerInfo
): CanonicalPlayer[] {
  const runtimePlayers = [normalizeRuntimePlayer(me), normalizeRuntimePlayer(opponent)];

  if (hasUsableRuntimeOrder(runtimePlayers)) {
    return fillCanonicalPlayerSlots(
      runtimePlayers.map((player, index) => ({
        playerId: player.playerId,
        name: player.name ?? getDefaultPlayerName(index),
        species: player.species,
      }))
    );
  }

  const firstTurnPlayers = [...history.turns]
    .sort((left, right) => left.turnNumber - right.turnNumber)[0]?.players ?? [];
  const remainingRuntimePlayers = [...runtimePlayers];
  const canonicalPlayers: CanonicalPlayer[] = firstTurnPlayers.slice(0, 2).map((historyPlayer, index) => {
    const runtimeMatchIndex = remainingRuntimePlayers.findIndex((runtimePlayer) =>
      runtimeMatchesHistoryPlayer(runtimePlayer, historyPlayer)
    );
    const runtimeMatch =
      runtimeMatchIndex >= 0 ? remainingRuntimePlayers.splice(runtimeMatchIndex, 1)[0] : null;

    return {
      playerId: historyPlayer.playerId,
      name: normalizeDisplayName(historyPlayer.name, getDefaultPlayerName(index)),
      species: runtimeMatch?.species ?? null,
    };
  });

  for (const runtimePlayer of remainingRuntimePlayers) {
    canonicalPlayers.push({
      playerId: runtimePlayer.playerId,
      name:
        runtimePlayer.name ??
        getDefaultPlayerName(canonicalPlayers.length),
      species: runtimePlayer.species,
    });
  }

  return fillCanonicalPlayerSlots(canonicalPlayers);
}

function normalizeRuntimePlayer(player: RuntimePlayerInfo): NormalizedRuntimePlayer {
  return {
    playerId: typeof player.identityKey === 'string' && player.identityKey.trim()
      ? player.identityKey.trim()
      : null,
    name: normalizeOptionalName(player.name),
    species: normalizeSpecies(player.species),
  };
}

function hasUsableRuntimeOrder(players: NormalizedRuntimePlayer[]): boolean {
  return players.every((player) => player.playerId !== null || player.name !== null);
}

function runtimeMatchesHistoryPlayer(
  runtimePlayer: NormalizedRuntimePlayer,
  historyPlayer: BattleLogTurnPlayerSummary
): boolean {
  if (runtimePlayer.playerId && runtimePlayer.playerId === historyPlayer.playerId) {
    return true;
  }

  if (runtimePlayer.name && normalizeComparableName(runtimePlayer.name) === normalizeComparableName(historyPlayer.name)) {
    return true;
  }

  return false;
}

function fillCanonicalPlayerSlots(players: CanonicalPlayer[]): CanonicalPlayer[] {
  const nextPlayers = [...players].slice(0, 2);

  while (nextPlayers.length < 2) {
    nextPlayers.push({
      playerId: null,
      name: getDefaultPlayerName(nextPlayers.length),
      species: null,
    });
  }

  return nextPlayers.map((player, index) => ({
    playerId: player.playerId,
    name: normalizeDisplayName(player.name, getDefaultPlayerName(index)),
    species: normalizeSpecies(player.species),
  }));
}

function normalizeDisplayName(name: string | null | undefined, fallback: string): string {
  const normalized = normalizeOptionalName(name);
  return normalized ?? fallback;
}

function normalizeOptionalName(name: string | null | undefined): string | null {
  if (typeof name !== 'string') {
    return null;
  }

  const normalized = name.replace(COLLAPSE_WHITESPACE_PATTERN, ' ').trim();
  return normalized || null;
}

function normalizeComparableName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeSpecies(species: SpeciesId | null | undefined): SpeciesId | null {
  switch (species) {
    case 'human':
    case 'xenite':
    case 'centaur':
    case 'ancient':
      return species;
    default:
      return null;
  }
}

function getDefaultPlayerName(index: number): string {
  return index === 0 ? 'Player 1' : 'Player 2';
}

function buildBattleLogText(args: {
  history: ValidatedBattleLogHistory;
  gameId: string;
  canonicalPlayers: CanonicalPlayer[];
  winnerPlayerId: string | null;
  resultReason: string | null;
  exportedAt: Date;
}): string {
  const { history, gameId, canonicalPlayers, winnerPlayerId, resultReason, exportedAt } = args;
  const sortedTurns = [...history.turns].sort((left, right) => left.turnNumber - right.turnNumber);
  const completedTurnCount =
    typeof history.completedTurnCount === 'number' && Number.isFinite(history.completedTurnCount)
      ? history.completedTurnCount
      : sortedTurns.length;
  const headerLines = [
    'SHAPESHIPS BATTLE LOG',
    `Game: ${canonicalPlayers[0].name} (${getSpeciesDisplayName(canonicalPlayers[0].species)}) vs ${canonicalPlayers[1].name} (${getSpeciesDisplayName(canonicalPlayers[1].species)})`,
    `Game ID: ${gameId}`,
    `Result: ${formatResultLine(resultReason, winnerPlayerId, canonicalPlayers)}`,
    `Turns: ${completedTurnCount}`,
    `Exported: ${formatLocalTimestamp(exportedAt, ':')}`,
  ];

  const turnBlocks = sortedTurns.map((turn) => formatTurnBlock(turn, canonicalPlayers));
  return [...headerLines, ...turnBlocks.flatMap((block) => ['', block])].join('\r\n');
}

function formatTurnBlock(turn: ValidatedBattleLogTurn, canonicalPlayers: CanonicalPlayer[]): string {
  const matchedPlayers = matchTurnPlayersToCanonicalOrder(turn.players, canonicalPlayers);

  return [
    `TURN ${turn.turnNumber} \u2014 Dice ${formatDiceValue(turn.diceValue)}`,
    '',
    'Build',
    ...formatSectionLines(matchedPlayers, canonicalPlayers, turn.buildLinesByPlayerId),
    '',
    'Battle',
    ...formatSectionLines(matchedPlayers, canonicalPlayers, turn.battleLinesByPlayerId),
    '',
    'End',
    ...formatEndLines(matchedPlayers, canonicalPlayers),
  ].join('\r\n');
}

function matchTurnPlayersToCanonicalOrder(
  turnPlayers: BattleLogTurnPlayerSummary[],
  canonicalPlayers: CanonicalPlayer[]
): Array<BattleLogTurnPlayerSummary | null> {
  const remainingPlayers = [...turnPlayers];

  return canonicalPlayers.map((canonicalPlayer) => {
    const playerIdMatchIndex =
      canonicalPlayer.playerId == null
        ? -1
        : remainingPlayers.findIndex((player) => player.playerId === canonicalPlayer.playerId);
    if (playerIdMatchIndex >= 0) {
      return remainingPlayers.splice(playerIdMatchIndex, 1)[0] ?? null;
    }

    const nameMatchIndex = remainingPlayers.findIndex(
      (player) => normalizeComparableName(player.name) === normalizeComparableName(canonicalPlayer.name)
    );
    if (nameMatchIndex >= 0) {
      return remainingPlayers.splice(nameMatchIndex, 1)[0] ?? null;
    }

    return remainingPlayers.shift() ?? null;
  });
}

function formatSectionLines(
  matchedPlayers: Array<BattleLogTurnPlayerSummary | null>,
  canonicalPlayers: CanonicalPlayer[],
  linesByPlayerId: Record<string, unknown>
): string[] {
  return matchedPlayers.flatMap((matchedPlayer, index) => {
    const playerLabel = canonicalPlayers[index]?.name ?? getDefaultPlayerName(index);
    const lines = matchedPlayer ? getOrderedLinesForPlayer(linesByPlayerId, matchedPlayer.playerId) : [];

    if (lines.length === 0) {
      return [`${playerLabel}: \u2014`];
    }

    return lines.map((line) => `${playerLabel}: ${line}`);
  });
}

function getOrderedLinesForPlayer(linesByPlayerId: Record<string, unknown>, playerId: string): string[] {
  const rawLines = linesByPlayerId[playerId];
  if (!Array.isArray(rawLines)) {
    return [];
  }

  return rawLines.filter((line): line is string => typeof line === 'string');
}

function formatEndLines(
  matchedPlayers: Array<BattleLogTurnPlayerSummary | null>,
  canonicalPlayers: CanonicalPlayer[]
): string[] {
  return matchedPlayers.map((matchedPlayer, index) => {
    const playerLabel = canonicalPlayers[index]?.name ?? getDefaultPlayerName(index);
    const healthEnd = matchedPlayer?.healthEnd ?? 0;
    const healthDelta = matchedPlayer?.healthDelta ?? 0;
    return `${playerLabel}: ${healthEnd} ${formatHealthDelta(healthDelta)}`;
  });
}

function formatDiceValue(diceValue: number | null): string {
  return typeof diceValue === 'number' ? String(diceValue) : '\u2014';
}

function formatHealthDelta(delta: number): string {
  if (delta >= 0) {
    return `(+${delta})`;
  }

  return `(${delta})`;
}

function formatResultLine(
  resultReason: string | null,
  winnerPlayerId: string | null,
  canonicalPlayers: CanonicalPlayer[]
): string {
  const winnerName = resolveWinnerName(winnerPlayerId, canonicalPlayers);

  switch (resultReason) {
    case 'decisive':
      return winnerName ? `Decisive Victory \u2014 ${winnerName} wins` : 'Decisive Victory';
    case 'narrow':
      return winnerName ? `Narrow Victory \u2014 ${winnerName} wins` : 'Narrow Victory';
    case 'timeout':
      return winnerName ? `Time Victory \u2014 ${winnerName} wins` : 'Time Victory';
    case 'resignation':
      return winnerName ? `Victory \u2014 ${winnerName} wins` : 'Victory';
    case 'agreement':
      return 'Draw by agreement';
    case 'mutual_destruction':
      return 'Draw \u2014 Mutual destruction';
    case 'timeout_draw':
      return 'Draw \u2014 Time expired';
    default:
      return winnerName ? `Victory \u2014 ${winnerName} wins` : 'Draw';
  }
}

function resolveWinnerName(
  winnerPlayerId: string | null,
  canonicalPlayers: CanonicalPlayer[]
): string | null {
  if (!winnerPlayerId) {
    return null;
  }

  const matchingPlayer = canonicalPlayers.find((player) => player.playerId === winnerPlayerId);
  return matchingPlayer?.name ?? 'Unknown player';
}

function buildBattleLogFilename(canonicalPlayers: CanonicalPlayer[], exportedAt: Date): string {
  const leftPlayer = canonicalPlayers[0];
  const rightPlayer = canonicalPlayers[1];

  return [
    'Shapeships',
    '-',
    `${sanitizeFileNameSegment(leftPlayer.name, FILE_NAME_PLAYER_MAX_LENGTH)} (${getSpeciesFileAbbreviation(leftPlayer.species)})`,
    'vs',
    `${sanitizeFileNameSegment(rightPlayer.name, FILE_NAME_PLAYER_MAX_LENGTH)} (${getSpeciesFileAbbreviation(rightPlayer.species)})`,
    '-',
    `${formatLocalTimestamp(exportedAt, '-')}.txt`,
  ].join(' ');
}

function sanitizeFileNameSegment(segment: string, maxLength?: number): string {
  const sanitized = segment
    .replace(FILE_NAME_INVALID_CHARS, ' ')
    .replace(COLLAPSE_WHITESPACE_PATTERN, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');

  const fallback = sanitized || 'Unknown';
  if (typeof maxLength === 'number' && maxLength > 0) {
    return fallback.slice(0, maxLength).trim() || 'Unknown';
  }

  return fallback;
}

function getSpeciesFileAbbreviation(species: SpeciesId | null): string {
  switch (species) {
    case 'human':
      return 'H';
    case 'xenite':
      return 'X';
    case 'centaur':
      return 'C';
    case 'ancient':
      return 'A';
    default:
      return '?';
  }
}

function getSpeciesDisplayName(species: SpeciesId | null): string {
  switch (species) {
    case 'human':
      return 'Human';
    case 'xenite':
      return 'Xenite';
    case 'centaur':
      return 'Centaur';
    case 'ancient':
      return 'Ancient';
    default:
      return 'Unknown';
  }
}

function formatLocalTimestamp(date: Date, timeSeparator: ':' | '-'): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  return `${year}-${month}-${day} ${hours}${timeSeparator}${minutes}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function triggerTextFileDownload(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body?.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}
