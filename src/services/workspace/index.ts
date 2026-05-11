/**
 * Workspace service layer — typed wrappers around Supabase for
 * checklists, reflections, session notes, journals and process logs.
 *
 * Components should depend on these instead of calling Supabase directly.
 * Centralized error handling, easier testing, future offline queue.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ChecklistResponses } from "@/lib/workspace/constants";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong saving your work.";
  return { ok: false, error: message };
}

/* ───────────────────────── Checklist ───────────────────────── */

export interface ChecklistRecord {
  items: ChecklistResponses;
  readiness_score: number | null;
}

export async function fetchChecklist(
  userId: string,
  date: string,
): Promise<ServiceResult<ChecklistRecord | null>> {
  try {
    const { data, error } = await supabase
      .from("checklist_responses")
      .select("items,readiness_score")
      .eq("user_id", userId)
      .eq("log_date", date)
      .maybeSingle();
    if (error) throw error;
    return {
      ok: true,
      data: data
        ? {
            items: (data.items as ChecklistResponses) ?? {},
            readiness_score: data.readiness_score ?? null,
          }
        : null,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function saveChecklist(
  userId: string,
  date: string,
  items: ChecklistResponses,
  readiness_score: number,
): Promise<ServiceResult<true>> {
  try {
    const { error } = await supabase
      .from("checklist_responses")
      .upsert(
        { user_id: userId, log_date: date, items, readiness_score },
        { onConflict: "user_id,log_date" },
      );
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────── Daily reflection ───────────────────────── */

export interface DailyReview {
  did_well: string;
  mistakes: string;
  emotionally_disciplined: boolean | null;
  followed_plan: boolean | null;
  improve_tomorrow: string;
}

export async function fetchDailyReview(
  userId: string,
  date: string,
): Promise<ServiceResult<DailyReview | null>> {
  try {
    const { data, error } = await supabase
      .from("daily_reviews")
      .select(
        "did_well,mistakes,emotionally_disciplined,followed_plan,improve_tomorrow",
      )
      .eq("user_id", userId)
      .eq("review_date", date)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, data: data ?? null };
  } catch (e) {
    return fail(e);
  }
}

export async function saveDailyReview(
  userId: string,
  date: string,
  review: DailyReview,
): Promise<ServiceResult<true>> {
  try {
    const { error } = await supabase
      .from("daily_reviews")
      .upsert(
        { user_id: userId, review_date: date, ...review },
        { onConflict: "user_id,review_date" },
      );
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────── Daily journal ───────────────────────── */

export interface DailyJournal {
  market_view: string;
  pre_market_notes: string;
}

export async function saveDailyJournal(
  userId: string,
  date: string,
  patch: Partial<DailyJournal>,
): Promise<ServiceResult<true>> {
  try {
    const { error } = await supabase
      .from("daily_journals")
      .upsert(
        { user_id: userId, journal_date: date, ...patch },
        { onConflict: "user_id,journal_date" },
      );
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────── Session notes ───────────────────────── */

export interface SessionNote {
  id: string;
  body: string;
  category: string;
  note_at: string;
}

export async function listTodayNotes(
  userId: string,
  date: string,
): Promise<ServiceResult<SessionNote[]>> {
  try {
    const { data, error } = await supabase
      .from("session_notes")
      .select("id,body,category,note_at")
      .eq("user_id", userId)
      .gte("note_at", `${date}T00:00:00`)
      .order("note_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (e) {
    return fail(e);
  }
}

export async function createNote(
  userId: string,
  body: string,
  category: string,
): Promise<ServiceResult<true>> {
  try {
    const { error } = await supabase
      .from("session_notes")
      .insert({ user_id: userId, body, category });
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNote(id: string): Promise<ServiceResult<true>> {
  try {
    const { error } = await supabase.from("session_notes").delete().eq("id", id);
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────── Process quality logs ───────────────────────── */

export interface ProcessLogPayload {
  checklist: number;
  discipline: number;
  emotional: number;
  journaling: number;
  consistency: number;
  total: number;
}

export async function saveProcessLog(
  userId: string,
  date: string,
  score: ProcessLogPayload,
): Promise<ServiceResult<true>> {
  try {
    const { error } = await supabase.from("process_quality_logs").upsert(
      {
        user_id: userId,
        log_date: date,
        checklist_score: score.checklist,
        discipline_score: score.discipline,
        emotional_score: score.emotional,
        journaling_score: score.journaling,
        consistency_score: score.consistency,
        total_score: score.total,
      },
      { onConflict: "user_id,log_date" },
    );
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────── Continuity (dates only) ───────────────────────── */

export async function fetchJournalDates(
  userId: string,
  sinceDate: string,
): Promise<ServiceResult<string[]>> {
  try {
    const { data, error } = await supabase
      .from("daily_journals")
      .select("journal_date")
      .eq("user_id", userId)
      .gte("journal_date", sinceDate);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => r.journal_date) };
  } catch (e) {
    return fail(e);
  }
}

export async function fetchReviewDates(
  userId: string,
  sinceDate: string,
): Promise<ServiceResult<string[]>> {
  try {
    const { data, error } = await supabase
      .from("daily_reviews")
      .select("review_date")
      .eq("user_id", userId)
      .gte("review_date", sinceDate);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => r.review_date) };
  } catch (e) {
    return fail(e);
  }
}

export async function fetchChecklistDates(
  userId: string,
  sinceDate: string,
): Promise<ServiceResult<string[]>> {
  try {
    const { data, error } = await supabase
      .from("checklist_responses")
      .select("log_date")
      .eq("user_id", userId)
      .gte("log_date", sinceDate);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => r.log_date) };
  } catch (e) {
    return fail(e);
  }
}
