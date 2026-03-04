/**
 * DEPRECATED — LEGACY CLIENT ENGINE
 *
 * This file is part of an old client-authoritative engine.
 * It must not be used for authoritative gameplay.
 *
 * Canonical shared engine code lives in /engine.
 * This file is retained for reference only.
 */

/**
 * Phase Label Utilities
 */

export function formatPhaseLabel(major?: string, sub?: string): string {
  const m = major ?? 'unknown';
  const s = sub ?? 'unknown';
  return `${m} / ${s}`;
}