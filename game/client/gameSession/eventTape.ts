/**
 * EVENT TAPE UTILITIES
 * 
 * Client-only event log for dev visibility.
 * Provides append and formatting helpers.
 */

import type { Dispatch, SetStateAction } from 'react';

/**
 * Append events to tape (resilient to null/undefined)
 * Caps to last ~200 entries to prevent unbounded growth
 */
export function appendEventsToTape(
  setEventTape: Dispatch<SetStateAction<any[]>>,
  events: any[],
  meta?: { label?: string; turn?: number; phaseKey?: string }
) {
  const newEntries: any[] = [];
  
  // Optional: Add marker entry if label provided
  if (meta?.label) {
    newEntries.push({
      type: 'client.marker',
      text: meta.label,
      turn: meta.turn,
      phaseKey: meta.phaseKey,
    });
  }
  
  // Append all events (if provided)
  if (events && events.length > 0) {
    newEntries.push(...events);
  }
  
  // Only update if we have something to add
  if (newEntries.length === 0) return;
  
  setEventTape(prev => {
    const updated = [...prev, ...newEntries];
    // Keep last ~200 entries to prevent unbounded growth
    return updated.slice(-200);
  });
}

/**
 * Format a tape entry for display
 */
export function formatTapeEntry(entry: any): string {
  if (!entry) return '(null)';
  
  // Marker entries
  if (entry.type === 'client.marker' && entry.text) {
    return entry.text;
  }
  
  // Build a compact representation
  const parts: string[] = [];
  
  if (entry.type) {
    parts.push(`[${entry.type}]`);
  }
  
  // Common fields
  if (entry.playerId) parts.push(`player=${entry.playerId}`);
  if (entry.from) parts.push(`from=${entry.from}`);
  if (entry.to) parts.push(`to=${entry.to}`);
  if (entry.amount !== undefined) parts.push(`amt=${entry.amount}`);
  if (entry.shipId) parts.push(`ship=${entry.shipId}`);
  if (entry.targetId) parts.push(`target=${entry.targetId}`);
  
  // If we have parts, return them
  if (parts.length > 0) {
    return parts.join(' ');
  }
  
  // Fallback: JSON stringify (compact)
  try {
    return JSON.stringify(entry);
  } catch {
    return String(entry);
  }
}
