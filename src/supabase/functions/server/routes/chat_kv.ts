export type PlayerChatEntry = {
  type: 'message';
  playerId: string;
  playerName: string;
  content: string;
  timestamp: number;
};

export type SystemChatEntry = {
  type: 'system';
  content: string;
  timestamp: number;
};

export type RematchInviteChatEntry = {
  type: 'rematch_invite';
  playerId: string;
  playerName: string;
  content: string;
  newGameId: string;
  timestamp: number;
};

export type ChatEntry =
  | PlayerChatEntry
  | SystemChatEntry
  | RematchInviteChatEntry;

export type ChatStore = {
  entries: ChatEntry[];
};

export async function appendChatEntry(
  gameId: string,
  entry: ChatEntry,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>
): Promise<void> {
  const chatKey = `game_${gameId}_chat`;
  const rawChatStore = await kvGet(chatKey);
  const chatStore: ChatStore =
    rawChatStore && Array.isArray(rawChatStore.entries)
      ? { entries: [...rawChatStore.entries] }
      : { entries: [] };

  chatStore.entries.push(entry);

  if (chatStore.entries.length > 50) {
    chatStore.entries = chatStore.entries.slice(-50);
  }

  await kvSet(chatKey, chatStore);
}
