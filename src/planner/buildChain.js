/**
 * Build-chain calculation module.
 *
 * Provides pure functions for:
 *  - Selecting the optimal ratio given hours available and temperature
 *  - Estimating peak window for a given ratio + temp
 *  - Planning optimal build placement (scored multi-candidate search)
 *  - Determining if a refrigeration hold is needed (legacy helper)
 *  - Calculating full build-chain mass flow (chained amounts, backward from levain needed)
 *  - Rounding gram amounts to practical values
 */

import {
  RATIO_OPTIONS,
  BUILD_BUFFER_FACTOR,
  IDEAL_PEAK_LEAD_HOURS_MIN,
  IDEAL_PEAK_LEAD_HOURS_MAX,
  OVERPEAK_RISK_HOURS,
  MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD,
} from './constants.js';
import { getRateForTemp } from './fermentationRates.js';

// ── Rounding ──────────────────────────────────────────────────────

/**
 * Round a gram amount to the nearest 5g (minimum 5g).
 * @param {number} grams
 * @returns {number}
 */
export function roundBuildAmounts(grams) {
  return Math.max(5, Math.round(grams / 5) * 5);
}

// ── Ratio selection ───────────────────────────────────────────────

/**
 * Given a ratio string and temperature (°F), return the expected peak
 * window in hours (adjusted for actual temperature vs 75°F baseline).
 *
 * @param {string} ratio - e.g. '1:4:4'
 * @param {number} tempF
 * @returns {{ minHours: number, maxHours: number, midHours: number }}
 */
export function estimatePeakWindow(ratio, tempF) {
  const option = RATIO_OPTIONS.find(o => o.ratio === ratio) ?? RATIO_OPTIONS[3];
  const rate = getRateForTemp(tempF);
  return {
    minHours: option.minH / rate,
    maxHours: option.maxH / rate,
    midHours: ((option.minH + option.maxH) / 2) / rate,
  };
}

/**
 * Given hours available until the next action and the current temperature,
 * select the best ratio so the build peaks within the ideal window before use.
 *
 * @param {number} hoursAvailable - hours between buildAt and nextActionAt
 * @param {number} tempF
 * @returns {string} ratio string, e.g. '1:4:4'
 */
export function selectRatioForWindow(hoursAvailable, tempF) {
  const rate = getRateForTemp(tempF);
  const idealLeadMid = (IDEAL_PEAK_LEAD_HOURS_MIN + IDEAL_PEAK_LEAD_HOURS_MAX) / 2;
  const targetMidH = hoursAvailable - idealLeadMid;

  let best = RATIO_OPTIONS[0];
  let bestDiff = Infinity;

  for (const option of RATIO_OPTIONS) {
    const adjustedMidH = ((option.minH + option.maxH) / 2) / rate;
    const diff = Math.abs(adjustedMidH - targetMidH);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = option;
    }
  }

  return best.ratio;
}

// ── Scored placement ──────────────────────────────────────────────

/**
 * Plan the optimal placement for a build step using a scored candidate search.
 *
 * Generates up to ~84 candidates (3 days back × 4 time slots × 7 ratios),
 * filters invalid ones, scores the rest, and returns the best.
 *
 * Recovery mode — strongly prefers daytime warm fermentation, penalizes refrigeration.
 * Levain mode   — prioritizes peak timing before mix; allows refrigeration if substantial
 *                 warm fermentation occurs first.
 *
 * @param {Date}   nextActionAt - when the build output is needed
 * @param {number} tempF        - day temperature (°F)
 * @param {{ wakeTime: string, sleepTime: string }} ctx
 * @param {'recovery' | 'levain'} mode
 * @returns {{
 *   buildAt:   Date,
 *   ratio:     string,
 *   peakWindow: { minHours: number, maxHours: number, midHours: number },
 *   refrig:    null | { refrigerateAt: Date, removeAt: Date, reason: string, warmHoursBeforeCold: number },
 *   score:     number,
 * }}
 */
export function planBuildPlacement(nextActionAt, tempF, ctx, mode) {
  const { wakeTime, sleepTime, notBefore } = ctx;
  const candidates = [];

  // ── Candidate generation ──────────────────────────────────────
  // Try builds in 4 slots across the last 3 days.
  // Slots: start of wake, +2h (mid-morning), +4h (midday), sleep−MIN_ROOM_TEMP_HOURS (last viable cold-hold).
  for (let daysBack = 0; daysBack <= 2; daysBack++) {
    const dayRef = new Date(nextActionAt.getTime() - daysBack * 24 * 3600000);
    const wakeStart = _setTimeOnDate(dayRef, wakeTime);
    const sleepStart = _nextSleepStart(wakeStart, sleepTime);

    const slots = [
      wakeStart,
      new Date(wakeStart.getTime() + 2 * 3600000),
      new Date(wakeStart.getTime() + 4 * 3600000),
      new Date(sleepStart.getTime() - MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD * 3600000),
    ];

    for (const candidateBuildAt of slots) {
      // Must be strictly before next action
      if (candidateBuildAt >= nextActionAt) continue;
      // Must not require the user to be awake during sleep
      if (_isDuringSleep(candidateBuildAt, sleepTime, wakeTime)) continue;
      // Don't reach back more than 4 days
      if (nextActionAt - candidateBuildAt > 4 * 24 * 3600000) continue;
      // Don't place steps before the earliest allowed time (e.g. "now")
      if (notBefore && candidateBuildAt < notBefore) continue;

      for (const { ratio } of RATIO_OPTIONS) {
        const peakW = estimatePeakWindow(ratio, tempF);
        const peakAt = new Date(candidateBuildAt.getTime() + peakW.midHours * 3600000);
        const leadHours = (nextActionAt - peakAt) / 3600000;

        // Hasn't peaked by the time we need it — skip
        if (leadHours < -0.5) continue;

        const peakInSleep = _isDuringSleep(peakAt, sleepTime, wakeTime);
        const leadTooLong  = leadHours > OVERPEAK_RISK_HOURS;
        const requiresRefrig = peakInSleep || leadTooLong;

        let warmHoursBeforeCold = Infinity;
        let refrigerateAt = null;
        let removeAt = null;
        let refrigReason = '';

        if (requiresRefrig) {
          if (peakInSleep) {
            // Refrigerate at bedtime; warm fermentation = build time → sleep start
            const nextSleep = _nextSleepStart(candidateBuildAt, sleepTime);
            warmHoursBeforeCold = (nextSleep - candidateBuildAt) / 3600000;
            refrigerateAt = nextSleep;
            removeAt = _nextWakeTime(nextSleep, wakeTime);
            refrigReason = 'Peak falls during sleep — refrigerate at bedtime, remove at wake.';
          } else {
            // leadTooLong: refrigerate at peak, remove before use
            warmHoursBeforeCold = peakW.midHours;
            refrigerateAt = peakAt;
            const naturalWake = _nextWakeTime(peakAt, wakeTime);
            const beforeUse  = new Date(nextActionAt.getTime() - 1.5 * 3600000);
            removeAt = new Date(Math.max(naturalWake.getTime(), beforeUse.getTime()));
            refrigReason = `Peaked ${Math.round(leadHours)}h before needed — refrigerate at peak to pause fermentation.`;
          }

          // Reject if too little warm fermentation before cold hold
          if (warmHoursBeforeCold < MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD) continue;
        }

        // Effective lead: how long from "ready to use" until actually used
        const effectiveLeadHours = requiresRefrig
          ? (nextActionAt - removeAt) / 3600000
          : leadHours;

        const score = _scorePlacement({
          buildAt: candidateBuildAt, peakAt, leadHours, effectiveLeadHours,
          requiresRefrig, warmHoursBeforeCold, daysBack, mode,
        });

        candidates.push({
          buildAt: candidateBuildAt,
          ratio,
          peakWindow: peakW,
          refrig: requiresRefrig
            ? { refrigerateAt, removeAt, reason: refrigReason, warmHoursBeforeCold }
            : null,
          score,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return _fallbackPlacement(nextActionAt, tempF, ctx);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Score a candidate placement. Higher = better.
 * Separate criteria for 'recovery' vs 'levain' modes.
 */
function _scorePlacement({ buildAt, peakAt, leadHours, effectiveLeadHours,
                            requiresRefrig, warmHoursBeforeCold, daysBack, mode }) {
  let score = 0;

  if (mode === 'recovery') {
    // ── Refrigeration preference ─────────────────────────────────
    // Recovery feeds benefit most from uninterrupted room-temp fermentation.
    if (!requiresRefrig) {
      score += 40; // strong preference for no fridge
    } else if (warmHoursBeforeCold >= 6) {
      score += 15; // morning build, refrigerate at peak — acceptable
    } else if (warmHoursBeforeCold >= 3) {
      score += 5;  // evening build, refrigerate at bedtime — marginal
    }
    // < 3h: already filtered out

    // ── Freshness when used for the next step ────────────────────
    if (effectiveLeadHours >= 0 && effectiveLeadHours <= 3) score += 20;
    else if (effectiveLeadHours <= 6) score += 10;
    else score -= 5;

    // ── Prefer daytime peaks (biologically strongest activity) ───
    if (!requiresRefrig) {
      const h = peakAt.getHours();
      if (h >= 8 && h <= 18) score += 8;
    }

    // ── Prefer morning builds ────────────────────────────────────
    const buildHour = buildAt.getHours();
    if (buildHour >= 6 && buildHour <= 10) score += 5;

    // ── Prefer more recent placements ────────────────────────────
    score += Math.max(0, 3 - daysBack) * 2;

  } else { // 'levain'
    // ── Peak timing relative to mix ──────────────────────────────
    if (effectiveLeadHours >= 0.5 && effectiveLeadHours <= 2)  score += 30; // ideal
    else if (effectiveLeadHours >= 0 && effectiveLeadHours <= 3) score += 20;
    else if (effectiveLeadHours <= 4) score += 10;
    else if (effectiveLeadHours <= 6) score += 5;

    // ── Refrigeration preference ─────────────────────────────────
    if (!requiresRefrig) {
      score += 15;
    } else if (warmHoursBeforeCold >= 5) {
      score += 5;  // afternoon build, overnight cold — fine
    }
    // 3–5h: score 0, already meets minimum

    // ── Prefer more recent placements ────────────────────────────
    score += Math.max(0, 3 - daysBack) * 2;
  }

  return score;
}

/**
 * Last-resort fallback when no scored candidate is found.
 * Uses the old midpoint-targeting approach, allowing immediate refrigeration.
 */
function _fallbackPlacement(nextActionAt, tempF, ctx) {
  const { wakeTime, sleepTime } = ctx;
  const ratio = selectRatioForWindow(8, tempF);
  const peakW = estimatePeakWindow(ratio, tempF);

  let buildAt = new Date(nextActionAt.getTime() - (peakW.midHours + 1.25) * 3600000);
  if (_isDuringSleep(buildAt, sleepTime, wakeTime)) {
    const [sh, sm] = sleepTime.split(':').map(Number);
    buildAt.setHours(sh, sm, 0, 0);
    if (buildAt >= nextActionAt) buildAt.setDate(buildAt.getDate() - 1);
  }

  const peakAt = new Date(buildAt.getTime() + peakW.midHours * 3600000);
  const peakInSleep = _isDuringSleep(peakAt, sleepTime, wakeTime);
  const leadHours = (nextActionAt - peakAt) / 3600000;

  let refrig = null;
  if (peakInSleep || leadHours > OVERPEAK_RISK_HOURS) {
    const nextSleep = _nextSleepStart(buildAt, sleepTime);
    refrig = {
      refrigerateAt: nextSleep,
      removeAt: _nextWakeTime(nextSleep, wakeTime),
      reason: 'No better window found — refrigerate at bedtime to control fermentation.',
      warmHoursBeforeCold: Math.max(0, (nextSleep - buildAt) / 3600000),
    };
  }

  return { buildAt, ratio, peakWindow: peakW, refrig, score: -100 };
}

// ── Legacy refrigeration check ────────────────────────────────────

/**
 * Determine whether a build needs a refrigeration hold.
 * Kept for backward compatibility and test coverage.
 *
 * @param {Date} peakAt - estimated peak time (mid of window)
 * @param {Date} nextActionAt - when the build output is needed
 * @param {string} sleepTime - "HH:mm"
 * @param {string} wakeTime  - "HH:mm"
 * @returns {{ needed: boolean, reason: string, refrigerateAt?: Date, removeAt?: Date }}
 */
export function needsRefrigerationHold(peakAt, nextActionAt, sleepTime, wakeTime) {
  const leadHours = (nextActionAt - peakAt) / (60 * 60 * 1000);

  if (_isDuringSleep(peakAt, sleepTime, wakeTime)) {
    const sleepStart = _prevSleepStart(peakAt, sleepTime);
    const removeAt = _nextWakeTime(peakAt, wakeTime);
    return {
      needed: true,
      reason: 'Peak falls during sleep — put in fridge when you go to bed, remove at wake.',
      refrigerateAt: sleepStart,
      removeAt,
    };
  }

  if (leadHours > OVERPEAK_RISK_HOURS) {
    const removeAt = new Date(nextActionAt.getTime() - 60 * 60 * 1000);
    return {
      needed: true,
      reason: `Build peaks ${Math.round(leadHours * 10) / 10}h before needed — refrigerate at peak to pause fermentation, remove 1h before use.`,
      refrigerateAt: new Date(peakAt),
      removeAt,
    };
  }

  return { needed: false, reason: '' };
}

// ── Mass-flow calculation ─────────────────────────────────────────

/**
 * Calculate grams for a single build step.
 *
 * @param {number} gramsNeededForNextStep
 * @param {string} ratio
 * @param {number} [bufferFactor]
 * @returns {{
 *   ratio: string,
 *   seedStarterGrams: number,
 *   flourGrams: number,
 *   waterGrams: number,
 *   totalBuildGrams: number,
 *   gramsUsedForNextStep: number,
 *   gramsReserved: number,
 *   gramsReturnedToFridge: number,
 * }}
 */
export function calcBuildStep(gramsNeededForNextStep, ratio, bufferFactor = BUILD_BUFFER_FACTOR) {
  const [seedPart, flourPart, waterPart] = ratio.split(':').map(Number);
  const totalParts = seedPart + flourPart + waterPart;

  const totalBuildGrams = roundBuildAmounts(gramsNeededForNextStep * bufferFactor);
  const seedStarterGrams = roundBuildAmounts(totalBuildGrams * seedPart / totalParts);
  const flourGrams = roundBuildAmounts(totalBuildGrams * flourPart / totalParts);
  const waterGrams = roundBuildAmounts(totalBuildGrams * waterPart / totalParts);
  const actualTotal = seedStarterGrams + flourGrams + waterGrams;
  const gramsUsedForNextStep = roundBuildAmounts(gramsNeededForNextStep);
  const gramsReserved = Math.max(0, actualTotal - gramsUsedForNextStep);

  return {
    ratio,
    seedStarterGrams,
    flourGrams,
    waterGrams,
    totalBuildGrams: actualTotal,
    gramsUsedForNextStep,
    gramsReserved,
    gramsReturnedToFridge: 0,
  };
}

/**
 * Calculate the full build chain, working backward from levain needed.
 *
 * @param {{
 *   levainNeeded: number,
 *   numFeeds: number,
 *   levainRatio: string,
 *   refreshRatios: string | string[],  // single ratio or per-feed array (oldest first)
 * }} params
 * @returns {Array}
 */
export function calculateBuildChain({ levainNeeded, numFeeds, levainRatio, refreshRatio, refreshRatios }) {
  // Accept singular refreshRatio (legacy) or plural refreshRatios (per-feed array or string)
  const ratioSource = refreshRatios ?? refreshRatio;
  const chain = [];

  const levainBuild = calcBuildStep(levainNeeded, levainRatio, 1.15);
  chain.unshift({ type: 'levain_build', ...levainBuild });

  let seedNeededForNext = levainBuild.seedStarterGrams;

  for (let i = 0; i < numFeeds; i++) {
    const isFirstFeed = i === numFeeds - 1;
    const stepType = isFirstFeed ? 'starter_refresh' : 'strengthening_feed';
    // ratioSource may be a string (one ratio for all) or array ordered oldest→newest
    const ratio = Array.isArray(ratioSource)
      ? ratioSource[numFeeds - 1 - i]   // i=0 → newest, i=numFeeds-1 → oldest
      : ratioSource;
    const feedBuild = calcBuildStep(seedNeededForNext, ratio, 1.2);
    chain.unshift({ type: stepType, ratio, ...feedBuild });
    seedNeededForNext = feedBuild.seedStarterGrams;
  }

  return chain;
}

// ── Internal time helpers ─────────────────────────────────────────

function _hhmm(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function _isDuringSleep(dt, sleepTime, wakeTime) {
  const t = dt.getHours() * 60 + dt.getMinutes();
  const s = _hhmm(sleepTime);
  const w = _hhmm(wakeTime);
  if (s > w) return t >= s || t < w;
  return t >= s && t < w;
}

function _prevSleepStart(beforeDate, sleepTime) {
  const result = new Date(beforeDate);
  const [sh, sm] = sleepTime.split(':').map(Number);
  result.setHours(sh, sm, 0, 0);
  if (result >= beforeDate) result.setDate(result.getDate() - 1);
  return result;
}

function _nextWakeTime(afterDate, wakeTime) {
  const result = new Date(afterDate);
  const [wh, wm] = wakeTime.split(':').map(Number);
  result.setHours(wh, wm, 0, 0);
  if (result <= afterDate) result.setDate(result.getDate() + 1);
  return result;
}

/** Set a specific HH:mm time on the same calendar date as referenceDate. */
function _setTimeOnDate(referenceDate, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const result = new Date(referenceDate);
  result.setHours(h, m, 0, 0);
  return result;
}

/** Find the next sleep-start strictly after afterDate. */
function _nextSleepStart(afterDate, sleepTime) {
  const result = new Date(afterDate);
  const [sh, sm] = sleepTime.split(':').map(Number);
  result.setHours(sh, sm, 0, 0);
  if (result <= afterDate) result.setDate(result.getDate() + 1);
  return result;
}
