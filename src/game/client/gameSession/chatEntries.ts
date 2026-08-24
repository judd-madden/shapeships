import type {
  GameSessionChatEntry,
  LeftRailChatMessageVm,
} from './types';

function normalizeTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getFallbackRematchText(playerName?: string): string {
  return playerName ? `${playerName} wants to play again` : 'Rematch invite';
}

export function normalizeChatEntry(value: unknown): GameSessionChatEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record.type;
  const id = normalizeOptionalString(record.id);
  const timestamp = normalizeTimestamp(record.timestamp);

  if (type === 'message') {
    return {
      id,
      type: 'message',
      playerId: normalizeOptionalString(record.playerId),
      playerName: normalizeOptionalString(record.playerName),
      content: typeof record.content === 'string' ? record.content : '',
      timestamp,
    };
  }

  if (type === 'system') {
    return {
      id,
      type: 'system',
      content: typeof record.content === 'string' ? record.content : '',
      timestamp,
    };
  }

  if (type === 'rematch_invite') {
    const playerName = normalizeOptionalString(record.playerName);
    const content =
      typeof record.content === 'string' && record.content.length > 0
        ? record.content
        : getFallbackRematchText(playerName);

    return {
      id,
      type: 'rematch_invite',
      playerId: normalizeOptionalString(record.playerId),
      playerName,
      content,
      newGameId: normalizeOptionalString(record.newGameId) ?? null,
      timestamp,
    };
  }

  if (type === 'spectator_presence') {
    const playerId = normalizeOptionalString(record.playerId);
    const playerName = normalizeOptionalString(record.playerName);
    const presence = record.presence;
    if (
      !playerId ||
      !playerName ||
      (presence !== 'joined' && presence !== 'left')
    ) {
      return null;
    }

    return {
      id,
      type: 'spectator_presence',
      presence,
      playerId,
      playerName,
      timestamp,
    };
  }

  return null;
}

export function normalizeChatEntries(entries: unknown[]): GameSessionChatEntry[] {
  return entries.flatMap((entry) => {
    const normalizedEntry = normalizeChatEntry(entry);
    return normalizedEntry ? [normalizedEntry] : [];
  });
}

export function mapChatEntryToLeftRailMessage(
  entry: GameSessionChatEntry,
): LeftRailChatMessageVm {
  if (entry.type === 'system') {
    return {
      type: 'system',
      text: entry.content ?? '',
    };
  }

  if (entry.type === 'rematch_invite') {
    return {
      type: 'rematch_invite',
      text: entry.content ?? getFallbackRematchText(entry.playerName),
      targetGameId: entry.newGameId ?? null,
    };
  }

  if (entry.type === 'spectator_presence') {
    return {
      type: 'spectator_presence',
      presence: entry.presence,
      playerName: entry.playerName,
    };
  }

  return {
    type: 'player',
    playerName: entry.playerName ?? 'Unknown',
    text: entry.content ?? '',
  };
}
