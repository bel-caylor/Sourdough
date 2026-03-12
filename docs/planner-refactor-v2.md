# Planner Refactor v2 — Implementation Plan

## What's being changed

### Problem
The planner uses the same scheduling logic for recovery feeds and levain builds,
and reaches for refrigeration too eagerly. This produces biologically poor patterns
like: feed at 10pm → refrigerate immediately → remove in morning.

### Root cause
`needsRefrigerationHold` fires whenever a peak lands during sleep or leads > 4h,
regardless of how little warm fermentation occurred. There is no preference for
daytime builds and no minimum warm-fermentation constraint.

---

## Changes

### constants.js
- Add `MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD = 3`

### buildChain.js (additive)
- Add `planBuildPlacement(nextActionAt, tempF, ctx, mode)` — scored multi-candidate placement
  - Generates up to 84 candidates: 3 days × 4 time slots × 7 ratios
  - Time slots per day: wake, +2h, +4h, sleep−MIN_ROOM_TEMP_HOURS
  - Filters out: builds during sleep, haven't peaked by nextActionAt, < MIN_ROOM_TEMP_HOURS warm ferment before cold
  - Scores candidates separately for mode='recovery' vs mode='levain'
  - Returns best placement + optional refrigeration info
- Add `_setTimeOnDate`, `_nextSleepStart` internal helpers
- Keep all existing exports (`needsRefrigerationHold`, `selectRatioForWindow`, etc.) unchanged

### Scoring model

**Recovery mode** — prefers warm daytime fermentation, penalizes refrigeration:
- No refrigeration needed: +40
- Fridge with ≥6h warm ferment first: +15
- Fridge with 3–6h warm ferment: +5
- Effective lead (post-fridge time to use): 0–3h +20, 3–6h +10
- Daytime peak + no fridge: +8
- Morning build: +5

**Levain mode** — prioritizes peak timing before mix:
- Effective lead 0.5–2h: +30, 0–3h: +20, 3–4h: +10
- No fridge: +15
- Fridge with ≥5h warm: +5

### generateBakePlan.js
- Phase 4 (levain): replace midpoint targeting + `needsRefrigerationHold` with `planBuildPlacement(mixAt, ..., 'levain')`
- Phase 5 (recovery feeds): replace uniform backward loop with per-feed `planBuildPlacement(cursor, ..., 'recovery')`
- Decouple timing (from placement) from gram calculation (per-placement ratio)
- Improve step notes to plain-language copy

### buildChain.test.js
- Add tests: recovery feed avoids immediate refrigeration, MIN_ROOM_TEMP_HOURS enforced,
  levain can refrigerate after substantial warm ferment

---

## Preserved
- Backward planning from bake time
- Cold proof and shape anchoring
- Chained mass-flow (seedStarterGrams flows from prior step)
- All existing step types and data model
- All existing tests
