// Run with: deno test supabase/functions/calculate-points/points.test.ts
//
// Covers every modifier path in points.ts:
//   - Base points for each difficulty
//   - Miss penalty for each difficulty (rejected and expired both reset streak)
//   - Streak boundaries (0/2 → 1×, 3..6 → 1.25×, 7+ → 1.5×)
//   - First-completion bonus alone
//   - Arena speed bonus alone, gated by is_arena
//   - Double points card alone
//   - Pairs: streak+first, streak+arena, first+dp, arena+dp, etc.
//   - All five modifiers stacked (peak award)
//   - Modifiers ignored on rejected / expired
//   - new_total_points clamps at 0 on miss
//   - consume_double_points_card flag

import { assertAlmostEquals, assertEquals } from "jsr:@std/assert";
import {
  BASE_POINTS,
  MISS_PENALTY,
  calculatePoints,
  type CalculationInput,
  type Difficulty,
} from "./points.ts";

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    difficulty: "easy",
    current_streak: 0,
    is_first_in_group_this_month: false,
    is_arena: false,
    arena_speed_bonus: false,
    double_points_active: false,
    current_total_points: 100,
    ...overrides,
  };
}

const ALL_DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "insane"];

// ---------- base + miss ------------------------------------------------------

Deno.test("base points: each difficulty awards its base when no modifiers", () => {
  for (const d of ALL_DIFFICULTIES) {
    const r = calculatePoints(makeInput({ difficulty: d }), "approved");
    assertEquals(r.final_points, BASE_POINTS[d]);
    assertEquals(r.streak_multiplier, 1);
    assertEquals(r.first_completion_multiplier, 1);
    assertEquals(r.arena_speed_multiplier, 1);
    assertEquals(r.double_points_multiplier, 1);
    assertEquals(r.miss_penalty, 0);
  }
});

Deno.test("miss penalty: rejected deducts the per-difficulty penalty", () => {
  for (const d of ALL_DIFFICULTIES) {
    const r = calculatePoints(
      makeInput({ difficulty: d, current_total_points: 1000 }),
      "rejected",
    );
    assertEquals(r.miss_penalty, MISS_PENALTY[d]);
    assertEquals(r.final_points, 0);
    assertEquals(r.new_streak, 0);
    assertEquals(r.new_total_points, 1000 - MISS_PENALTY[d]);
  }
});

Deno.test("miss penalty: expired behaves identically to rejected", () => {
  for (const d of ALL_DIFFICULTIES) {
    const r = calculatePoints(
      makeInput({ difficulty: d, current_total_points: 1000 }),
      "expired",
    );
    assertEquals(r.miss_penalty, MISS_PENALTY[d]);
    assertEquals(r.new_streak, 0);
  }
});

Deno.test("miss penalty: total clamps at 0 when penalty exceeds current total", () => {
  const r1 = calculatePoints(
    makeInput({ difficulty: "easy", current_total_points: 3 }),
    "rejected",
  );
  assertEquals(r1.new_total_points, 0);

  const r2 = calculatePoints(
    makeInput({ difficulty: "insane", current_total_points: 10 }),
    "expired",
  );
  assertEquals(r2.new_total_points, 0);

  const r3 = calculatePoints(
    makeInput({ difficulty: "hard", current_total_points: 0 }),
    "rejected",
  );
  assertEquals(r3.new_total_points, 0);
});

// ---------- streak ----------------------------------------------------------

Deno.test("streak: < 3 yields no bonus", () => {
  for (const s of [0, 1, 2]) {
    const r = calculatePoints(makeInput({ current_streak: s }), "approved");
    assertEquals(r.streak_multiplier, 1);
    assertEquals(r.final_points, 10);
  }
});

Deno.test("streak: 3..6 yields 1.25×", () => {
  for (const s of [3, 4, 5, 6]) {
    const r = calculatePoints(makeInput({ current_streak: s }), "approved");
    assertEquals(r.streak_multiplier, 1.25);
    assertEquals(r.final_points, Math.round(10 * 1.25));
  }
});

Deno.test("streak: >= 7 yields 1.5×", () => {
  for (const s of [7, 10, 100]) {
    const r = calculatePoints(makeInput({ current_streak: s }), "approved");
    assertEquals(r.streak_multiplier, 1.5);
    assertEquals(r.final_points, Math.round(10 * 1.5));
  }
});

Deno.test("approved: increments streak by 1", () => {
  const r = calculatePoints(makeInput({ current_streak: 5 }), "approved");
  assertEquals(r.new_streak, 6);
});

Deno.test("rejected: resets streak to 0 regardless of prior value", () => {
  const r = calculatePoints(makeInput({ current_streak: 42 }), "rejected");
  assertEquals(r.new_streak, 0);
});

// ---------- first completion ------------------------------------------------

Deno.test("first completion bonus alone: +15%", () => {
  const r = calculatePoints(
    makeInput({ is_first_in_group_this_month: true }),
    "approved",
  );
  assertEquals(r.first_completion_multiplier, 1.15);
  assertEquals(r.final_points, Math.round(10 * 1.15)); // 12
});

// ---------- arena speed ------------------------------------------------------

Deno.test("arena speed bonus: applies only when is_arena AND arena_speed_bonus", () => {
  const both = calculatePoints(
    makeInput({ is_arena: true, arena_speed_bonus: true }),
    "approved",
  );
  assertEquals(both.arena_speed_multiplier, 1.2);
  assertEquals(both.final_points, Math.round(10 * 1.2)); // 12
});

Deno.test("arena speed bonus: ignored when is_arena is false", () => {
  const r = calculatePoints(
    makeInput({ is_arena: false, arena_speed_bonus: true }),
    "approved",
  );
  assertEquals(r.arena_speed_multiplier, 1);
  assertEquals(r.final_points, 10);
});

Deno.test("arena speed bonus: ignored when arena but not fast enough", () => {
  const r = calculatePoints(
    makeInput({ is_arena: true, arena_speed_bonus: false }),
    "approved",
  );
  assertEquals(r.arena_speed_multiplier, 1);
  assertEquals(r.final_points, 10);
});

// ---------- double points ----------------------------------------------------

Deno.test("double points alone: ×2 and consumes the card", () => {
  const r = calculatePoints(
    makeInput({ double_points_active: true }),
    "approved",
  );
  assertEquals(r.double_points_multiplier, 2);
  assertEquals(r.final_points, 20);
  assertEquals(r.consume_double_points_card, true);
});

Deno.test("double points: card not consumed on rejected / expired", () => {
  const r1 = calculatePoints(
    makeInput({ double_points_active: true }),
    "rejected",
  );
  assertEquals(r1.consume_double_points_card, false);

  const r2 = calculatePoints(
    makeInput({ double_points_active: true }),
    "expired",
  );
  assertEquals(r2.consume_double_points_card, false);
});

// ---------- pairs ------------------------------------------------------------

Deno.test("pair: streak + first completion (medium)", () => {
  const r = calculatePoints(
    makeInput({
      difficulty: "medium",
      current_streak: 3,
      is_first_in_group_this_month: true,
    }),
    "approved",
  );
  // 25 × 1.25 × 1.15 = 35.9375 → 36
  assertEquals(r.final_points, Math.round(25 * 1.25 * 1.15));
});

Deno.test("pair: streak + double points (hard)", () => {
  const r = calculatePoints(
    makeInput({
      difficulty: "hard",
      current_streak: 7,
      double_points_active: true,
    }),
    "approved",
  );
  // 50 × 1.5 × 2 = 150
  assertEquals(r.final_points, 150);
});

Deno.test("pair: first + arena+speed (insane)", () => {
  const r = calculatePoints(
    makeInput({
      difficulty: "insane",
      is_first_in_group_this_month: true,
      is_arena: true,
      arena_speed_bonus: true,
    }),
    "approved",
  );
  // 100 × 1.15 × 1.2 = 138
  assertEquals(r.final_points, Math.round(100 * 1.15 * 1.2));
});

Deno.test("pair: arena+speed + double points (medium)", () => {
  const r = calculatePoints(
    makeInput({
      difficulty: "medium",
      is_arena: true,
      arena_speed_bonus: true,
      double_points_active: true,
    }),
    "approved",
  );
  // 25 × 1.2 × 2 = 60
  assertEquals(r.final_points, 60);
});

// ---------- everything stacked ----------------------------------------------

Deno.test("all modifiers stacked: hard + streak 7 + first + arena+speed + dp", () => {
  const r = calculatePoints(
    makeInput({
      difficulty: "hard",
      current_streak: 7,
      is_first_in_group_this_month: true,
      is_arena: true,
      arena_speed_bonus: true,
      double_points_active: true,
    }),
    "approved",
  );
  const expected = Math.round(50 * 1.5 * 1.15 * 1.2 * 2); // 207
  assertEquals(r.final_points, expected);
  assertEquals(r.streak_multiplier, 1.5);
  assertEquals(r.first_completion_multiplier, 1.15);
  assertEquals(r.arena_speed_multiplier, 1.2);
  assertEquals(r.double_points_multiplier, 2);
  assertEquals(r.consume_double_points_card, true);
});

Deno.test("all modifiers stacked: insane + streak 12 + first + arena+speed + dp", () => {
  const r = calculatePoints(
    makeInput({
      difficulty: "insane",
      current_streak: 12,
      is_first_in_group_this_month: true,
      is_arena: true,
      arena_speed_bonus: true,
      double_points_active: true,
    }),
    "approved",
  );
  const expected = Math.round(100 * 1.5 * 1.15 * 1.2 * 2); // 414
  assertEquals(r.final_points, expected);
});

Deno.test("modifier order is commutative — same answer applied in either order", () => {
  // Sanity check: spec orders modifiers but they multiply, so the result
  // is identical for any permutation.
  const r = calculatePoints(
    makeInput({
      difficulty: "medium",
      current_streak: 5,
      is_first_in_group_this_month: true,
      is_arena: true,
      arena_speed_bonus: true,
      double_points_active: true,
    }),
    "approved",
  );
  const product = 25 * 1.25 * 1.15 * 1.2 * 2;
  assertAlmostEquals(r.final_points, Math.round(product), 0.0001);
});

// ---------- no-op miss with full modifier set --------------------------------

Deno.test("modifiers ignored on rejected even when all flags are true", () => {
  const r = calculatePoints(
    makeInput({
      difficulty: "easy",
      current_streak: 7,
      is_first_in_group_this_month: true,
      is_arena: true,
      arena_speed_bonus: true,
      double_points_active: true,
    }),
    "rejected",
  );
  assertEquals(r.final_points, 0);
  assertEquals(r.miss_penalty, MISS_PENALTY.easy); // 5
  assertEquals(r.streak_multiplier, 1);
  assertEquals(r.first_completion_multiplier, 1);
  assertEquals(r.arena_speed_multiplier, 1);
  assertEquals(r.double_points_multiplier, 1);
  assertEquals(r.consume_double_points_card, false);
});

// ---------- total accounting -------------------------------------------------

Deno.test("approved: new_total_points = current + final", () => {
  const r = calculatePoints(
    makeInput({ difficulty: "medium", current_total_points: 100 }),
    "approved",
  );
  assertEquals(r.new_total_points, 100 + 25);
});

Deno.test("approved with stacked modifiers: total reflects rounded final", () => {
  const r = calculatePoints(
    makeInput({
      difficulty: "hard",
      current_streak: 7,
      double_points_active: true,
      current_total_points: 500,
    }),
    "approved",
  );
  // 50 × 1.5 × 2 = 150
  assertEquals(r.new_total_points, 500 + 150);
});
