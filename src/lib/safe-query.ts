import { supabase } from "@/integrations/supabase/client";

/**
 * Defensive ownership wrapper. Resolves the current authenticated user once
 * and guarantees a userId is present before running an owner-scoped query.
 *
 * RLS already isolates rows server-side, but this helper makes intent
 * explicit at every call site and prevents accidentally issuing a query
 * when the session is missing (which would silently return [] instead of
 * surfacing as "please sign in").
 */
export async function withOwner<T>(
  fn: (userId: string) => Promise<T>,
): Promise<T> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  return fn(data.user.id);
}

/**
 * Assert a row belongs to the current user before mutating / displaying it.
 * Defense-in-depth on top of RLS.
 */
export function assertOwnership(
  row: { user_id?: string | null } | null | undefined,
  userId: string | null | undefined,
): void {
  if (!row || !userId) return;
  if (row.user_id && row.user_id !== userId) {
    throw new Error("This record does not belong to you.");
  }
}
