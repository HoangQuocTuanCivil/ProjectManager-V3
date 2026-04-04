import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * PostgREST may return a single related record as either an object or a
 * single-element array depending on FK detection timing. This normalizes
 * the result to always return the object (or null).
 */
export function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/**
 * Batch-fetches records from a table by their IDs and returns a Map keyed by ID.
 * Solves the repeated "fetch team/dept/leader names separately" pattern
 * used across use-tasks, use-users, use-teams hooks.
 */
export async function enrichByIds<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  ids: string[],
): Promise<Map<string, T>> {
  const map = new Map<string, T>();
  if (ids.length === 0) return map;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from(table).select(select).in('id', uniqueIds);
  (data || []).forEach((item: any) => map.set(item.id, item as T));
  return map;
}
