// Pure point-calculation logic for the calculate-points Edge Function.
// No Supabase or Deno imports — keeps it unit-testable in isolation.
//
// Modifiers (per spec):
//   1. Base points from difficulty
//   2. Streak bonus: streak >= 7 → ×1.5; streak >= 3 → ×1.25
//   3. Group dare first-completion bonus: +15% (×1.15)
//   4. Arena speed bonus: +20% (×1.20) — applies only when is_arena AND
//      arena_speed_bonus (submitted in <50% of the time window)
//   5. Double points card: ×2 if user activated it this month
//
// Multiplicative modifiers commute, but we apply them in the documented order
// so the breakdown returned to callers traces 1-to-1 with the spec.

export type Difficulty = "easy" | "medium" | "hard" | "insane";
export type Outcome = "approved" | "rejected" | "expired";

export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 50,
  insane: 100,
};

export const MISS_PENALTY: Record<Difficulty, number> = {
  easy: 5,
  medium: 12,
  hard: 25,
  insane: 40,
};

export interface CalculationInput {
  difficulty: Difficulty;
  current_streak: number;
  is_first_in_group_this_month: boolean;
  is_arena: boolean;
  /** True iff submitted in under half the time window. Ignored when not arena. */
  arena_speed_bonus: boolean;
  /** True iff the user activated their double points card for the current month and hasn't consumed it. */
  double_points_active: boolean;
  current_total_points: number;
}

export interface CalculationResult {
  outcome: Outcome;
  base_points: number;
  streak_multiplier: number;
  first_completion_multiplier: number;
  arena_speed_multiplier: number;
  double_points_multiplier: number;
  /** Points awarded on approve (0 on miss). */
  final_points: number;
  /** Points deducted on miss (0 on approve). */
  miss_penalty: number;
  /** total_points after applying outcome (clamped at 0). */
  new_total_points: number;
  /** current_streak after applying outcome. */
  new_streak: number;
  /** True iff this run consumed the double points card. */
  consume_double_points_card: boolean;
}

function streakMultiplier(streak: number): number {
  if (streak >= 7) return 1.5;
  if (streak >= 3) return 1.25;
  return 1;
}

export function calculatePoints(
  input: CalculationInput,
  outcome: Outcome,
): CalculationResult {
  const base = BASE_POINTS[input.difficulty];

  if (outcome === "rejected" || outcome === "expired") {
    const penalty = MISS_PENALTY[input.difficulty];
    const newTotal = Math.max(0, input.current_total_points - penalty);
    return {
      outcome,
      base_points: 0,
      streak_multiplier: 1,
      first_completion_multiplier: 1,
      arena_speed_multiplier: 1,
      double_points_multiplier: 1,
      final_points: 0,
      miss_penalty: penalty,
      new_total_points: newTotal,
      new_streak: 0,
      consume_double_points_card: false,
    };
  }

  // outcome === "approved"
  const streakMult = streakMultiplier(input.current_streak);
  const firstMult = input.is_first_in_group_this_month ? 1.15 : 1;
  const arenaMult = input.is_arena && input.arena_speed_bonus ? 1.2 : 1;
  const dpMult = input.double_points_active ? 2 : 1;

  // Apply in documented order. Multiplication commutes, so the math is the
  // same regardless of order — keeping the structure for readability.
  let points = base;
  points = points * streakMult;
  points = points * firstMult;
  points = points * arenaMult;
  points = points * dpMult;

  const final = Math.round(points);

  return {
    outcome,
    base_points: base,
    streak_multiplier: streakMult,
    first_completion_multiplier: firstMult,
    arena_speed_multiplier: arenaMult,
    double_points_multiplier: dpMult,
    final_points: final,
    miss_penalty: 0,
    new_total_points: input.current_total_points + final,
    new_streak: input.current_streak + 1,
    consume_double_points_card: input.double_points_active,
  };
}
