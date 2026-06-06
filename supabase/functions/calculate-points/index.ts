// Supabase Edge Function: calculate-points
//
// Server-side only. Computes the final points for a resolved dare and writes
// the outcome to the database. The pure calculation logic lives in points.ts
// for unit testability; this file owns I/O.
//
// Auth model:
//   This function is locked to callers presenting the project's service role
//   key as a Bearer token. Clients never have that key, so only Postgres
//   functions (via pg_net), cron jobs, or server processes can invoke. The
//   function then uses a service-role Supabase client internally to bypass
//   RLS for the score updates.
//
// Deploy:
//   supabase functions deploy calculate-points
// (no secrets to set — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
//  populated by Supabase automatically at deploy time)
//
// Invoke (server-side):
//   POST /functions/v1/calculate-points
//   Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}
//   { "dare_id": "uuid", "outcome": "approved" | "rejected" | "expired" }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import {
  calculatePoints,
  type CalculationInput,
  type Difficulty,
  type Outcome,
} from "./points.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function firstOfMonthUTC(d: Date = new Date()): string {
  const month = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return month.toISOString().slice(0, 10); // YYYY-MM-DD
}

function startOfMonthUTC(d: Date = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceRoleKey || !supabaseUrl) {
    return jsonResponse(
      { error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured." },
      500,
    );
  }

  // Server-side-only gate: caller must present the service role key.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse(
      { error: "Forbidden: this function is server-side only." },
      403,
    );
  }

  let body: { dare_id?: unknown; outcome?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const dareId = typeof body.dare_id === "string" ? body.dare_id : "";
  const outcome = body.outcome as Outcome;
  if (!dareId) return jsonResponse({ error: "dare_id is required" }, 400);
  if (outcome !== "approved" && outcome !== "rejected" && outcome !== "expired") {
    return jsonResponse(
      { error: "outcome must be approved, rejected, or expired" },
      400,
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // ---------- Load dare ---------------------------------------------------
    const { data: dare, error: dareErr } = await admin
      .from("dares")
      .select(
        "id, target_user_id, group_id, difficulty, is_arena, time_window_hours, created_at",
      )
      .eq("id", dareId)
      .single();
    if (dareErr) throw dareErr;
    if (!dare) throw new Error("dare_not_found");

    const userId: string | null = dare.target_user_id ?? null;
    if (!userId) throw new Error("dare has no target_user_id");

    // ---------- Load user ---------------------------------------------------
    const { data: user, error: userErr } = await admin
      .from("users")
      .select("id, total_points, current_streak")
      .eq("id", userId)
      .single();
    if (userErr) throw userErr;
    if (!user) throw new Error("user_not_found");

    // ---------- Load latest submission (for arena speed bonus) -------------
    let submittedAt: string | null = null;
    if (outcome === "approved" && dare.is_arena) {
      const { data: sub } = await admin
        .from("proof_submissions")
        .select("submitted_at")
        .eq("dare_id", dareId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      submittedAt = sub?.submitted_at ?? null;
    }

    const monthStartIso = startOfMonthUTC();
    const monthDate = firstOfMonthUTC();

    // ---------- First completion in group this month? ----------------------
    let isFirstInGroupThisMonth = false;
    if (outcome === "approved" && dare.group_id) {
      const { count } = await admin
        .from("dares")
        .select("id", { count: "exact", head: true })
        .eq("group_id", dare.group_id)
        .eq("target_user_id", userId)
        .eq("status", "completed")
        .gte("created_at", monthStartIso)
        .neq("id", dareId);
      isFirstInGroupThisMonth = (count ?? 0) === 0;
    }

    // ---------- Arena speed bonus -----------------------------------------
    let arenaSpeedBonus = false;
    if (
      outcome === "approved" &&
      dare.is_arena &&
      submittedAt &&
      dare.created_at &&
      dare.time_window_hours
    ) {
      const createdMs = new Date(dare.created_at).getTime();
      const submittedMs = new Date(submittedAt).getTime();
      const elapsedHours = (submittedMs - createdMs) / (1000 * 60 * 60);
      arenaSpeedBonus = elapsedHours < dare.time_window_hours / 2;
    }

    // ---------- Double points card -----------------------------------------
    let doublePointsActive = false;
    if (outcome === "approved") {
      const { data: card } = await admin
        .from("double_points_card_uses")
        .select("user_id, month, used_at")
        .eq("user_id", userId)
        .eq("month", monthDate)
        .maybeSingle();
      doublePointsActive = card != null && card.used_at == null;
    }

    // ---------- Pure calculation -------------------------------------------
    const calcInput: CalculationInput = {
      difficulty: dare.difficulty as Difficulty,
      current_streak: user.current_streak ?? 0,
      is_first_in_group_this_month: isFirstInGroupThisMonth,
      is_arena: dare.is_arena ?? false,
      arena_speed_bonus: arenaSpeedBonus,
      double_points_active: doublePointsActive,
      current_total_points: user.total_points ?? 0,
    };
    const result = calculatePoints(calcInput, outcome);

    // ---------- Apply DB updates -------------------------------------------
    const { error: userUpdateErr } = await admin
      .from("users")
      .update({
        total_points: result.new_total_points,
        current_streak: result.new_streak,
      })
      .eq("id", userId);
    if (userUpdateErr) throw userUpdateErr;

    if (
      outcome === "approved" &&
      dare.group_id &&
      result.final_points > 0
    ) {
      const { data: gm } = await admin
        .from("group_members")
        .select("id, monthly_points")
        .eq("group_id", dare.group_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (gm) {
        const { error: gmErr } = await admin
          .from("group_members")
          .update({
            monthly_points: (gm.monthly_points ?? 0) + result.final_points,
          })
          .eq("id", gm.id);
        if (gmErr) throw gmErr;
      }
    }

    if (result.consume_double_points_card) {
      const { error: cardErr } = await admin
        .from("double_points_card_uses")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("month", monthDate);
      if (cardErr) throw cardErr;
    }

    return jsonResponse({
      ok: true,
      dare_id: dareId,
      outcome,
      input: calcInput,
      result,
    });
  } catch (err) {
    console.error("calculate-points error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
