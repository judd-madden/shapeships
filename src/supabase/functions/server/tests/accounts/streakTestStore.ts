import type { FakeStreakRepository } from "./fakeStreakRepository.ts";
import { projectGameStateHead } from "../../routes/game_state_head.ts";

/** The route CAS adapter and RPC fake observe the same canonical rows. */
export class StreakTestStore extends Map<string, any> {
  constructor(readonly repository: FakeStreakRepository) {
    super();
  }
  override get size() {
    return this.repository.rows.size;
  }
  override get(key: string) {
    return this.repository.rows.get(key)?.value;
  }
  override has(key: string) {
    return this.repository.rows.has(key);
  }
  override set(key: string, value: any): this {
    const projected = key.startsWith("game_")
      ? projectGameStateHead(value)
      : null;
    this.repository.rows.set(key, {
      key,
      value,
      ...(projected?.ok ? { game_head: projected.head } : {}),
    });
    return this;
  }
  override delete(key: string) {
    return this.repository.rows.delete(key);
  }
  override clear() {
    this.repository.rows.clear();
  }
  override *entries(): MapIterator<[string, any]> {
    for (const [key, row] of this.repository.rows) yield [key, row.value];
  }
  override [Symbol.iterator]() {
    return this.entries();
  }
  override keys() {
    return this.repository.rows.keys();
  }
  override *values(): MapIterator<any> {
    for (const row of this.repository.rows.values()) yield row.value;
  }
}
