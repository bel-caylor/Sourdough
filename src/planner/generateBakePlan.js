import {
  BULK_FERMENTATION_HOURS_BASELINE,
  INOCULATION_CONSTANT,
  MIN_COLD_PROOF_HOURS,
  STEP_DURATION_MINUTES,
  DEFAULT_REFRESH_RATIO,
  OVERPEAK_RISK_HOURS,
  RATIO_OPTIONS,
} from './constants.js';
import { accumulateFermentation } from './fermentationRates.js';
import { feedsNeeded, recoveryNote } from './starterRecoveryModel.js';
import {
  planBuildPlacement,
  calcBuildStep,
  estimatePeakWindow,
} from './buildChain.js';

// ── Time helpers ──────────────────────────────────────────────────

function subtractHours(dt, hours) {
  return new Date(dt.getTime() - hours * 60 * 60 * 1000);
}

function addMinutes(dt, minutes) {
  return new Date(dt.getTime() + minutes * 60 * 1000);
}

function subtractMinutes(dt, minutes) {
  return new Date(dt.getTime() - minutes * 60 * 1000);
}

/** Rounds a Date down to the nearest 15 minutes. */
function roundTo15(dt) {
  const ms = 15 * 60 * 1000;
  return new Date(Math.floor(dt.getTime() / ms) * ms);
}

/** Returns total minutes from midnight for a Date. */
function totalMinutes(dt) {
  return dt.getHours() * 60 + dt.getMinutes();
}

/** Parses "HH:mm" to minutes from midnight. */
function hhmm(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function isDuringSleep(dt, sleepTime, wakeTime) {
  const t = totalMinutes(dt);
  const s = hhmm(sleepTime);
  const w = hhmm(wakeTime);
  if (s > w) return t >= s || t < w;
  return t >= s && t < w;
}

function shiftBeforeSleep(dt, sleepTime, wakeTime) {
  if (!isDuringSleep(dt, sleepTime, wakeTime)) return { dt, shifted: false };
  const result = new Date(dt);
  const [sh, sm] = sleepTime.split(':').map(Number);
  result.setHours(sh, sm, 0, 0);
  if (result > dt) result.setDate(result.getDate() - 1);
  return { dt: result, shifted: true };
}

function nextWakeTime(afterDate, wakeTime) {
  const result = new Date(afterDate);
  const [wh, wm] = wakeTime.split(':').map(Number);
  result.setHours(wh, wm, 0, 0);
  if (result <= afterDate) result.setDate(result.getDate() + 1);
  return result;
}

function prevSleepStart(beforeDate, sleepTime) {
  const result = new Date(beforeDate);
  const [sh, sm] = sleepTime.split(':').map(Number);
  result.setHours(sh, sm, 0, 0);
  if (result >= beforeDate) result.setDate(result.getDate() - 1);
  return result;
}

function rateForTemp(tempF) {
  const table = [
    { temp: 60, rate: 0.45 }, { temp: 65, rate: 0.60 }, { temp: 68, rate: 0.70 },
    { temp: 70, rate: 0.80 }, { temp: 72, rate: 0.90 }, { temp: 75, rate: 1.00 },
    { temp: 78, rate: 1.15 }, { temp: 80, rate: 1.25 }, { temp: 82, rate: 1.35 },
    { temp: 85, rate: 1.50 },
  ];
  if (tempF <= table[0].temp) return table[0].rate;
  if (tempF >= table[table.length - 1].temp) return table[table.length - 1].rate;
  for (let i = 0; i < table.length - 1; i++) {
    if (tempF >= table[i].temp && tempF <= table[i + 1].temp) {
      const t = (tempF - table[i].temp) / (table[i + 1].temp - table[i].temp);
      return table[i].rate + t * (table[i + 1].rate - table[i].rate);
    }
  }
  return 1.0;
}

function formatTime(dt) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return `${days[dt.getDay()]} ${hour}:${m} ${ampm}`;
}

function fmtPeakRange(peakW) {
  return `${Math.round(peakW.minHours * 10) / 10}–${Math.round(peakW.maxHours * 10) / 10}h`;
}

// ── Step note generators ──────────────────────────────────────────

function levainNote(placement, grams, tempF) {
  const { ratio, peakWindow, refrig } = placement;
  const peakRange = fmtPeakRange(peakWindow);
  if (!refrig) {
    return `Mix ${grams.seedStarterGrams}g active starter + ${grams.flourGrams}g flour + ${grams.waterGrams}g water. This ${ratio} ratio is chosen so the levain peaks close to your mixing window — expect it ready in ${peakRange} at ${tempF}°F. Use when domed and webby, not on the clock.`;
  }
  const warmH = Math.round(refrig.warmHoursBeforeCold * 10) / 10;
  return `Mix ${grams.seedStarterGrams}g active starter + ${grams.flourGrams}g flour + ${grams.waterGrams}g water. Allow ${warmH}h of room-temperature fermentation before refrigerating — the levain will finish slowly in the fridge and be ready to use after removal.`;
}

function recoveryFeedNote(placement, grams, stepType, tempF) {
  const { ratio, peakWindow, refrig } = placement;
  const peakRange = fmtPeakRange(peakWindow);
  const isFirstFeed = stepType === 'starter_refresh';

  if (!refrig) {
    const context = isFirstFeed
      ? 'This first refresh is scheduled during wake hours so the starter can rebuild activity at room temperature.'
      : 'This strengthening feed continues recovery during the day.';
    return `${context} Mix ${grams.seedStarterGrams}g starter + ${grams.flourGrams}g flour + ${grams.waterGrams}g water. Peaks in ${peakRange} at ${tempF}°F — wait until domed and active before the next step.`;
  }

  const warmH = Math.round(refrig.warmHoursBeforeCold * 10) / 10;
  if (refrig.warmHoursBeforeCold >= 5) {
    return `Mix ${grams.seedStarterGrams}g starter + ${grams.flourGrams}g flour + ${grams.waterGrams}g water. Allow most of the day to ferment at room temperature (${warmH}h), then refrigerate when active. Remove next morning and continue.`;
  }
  return `Mix ${grams.seedStarterGrams}g starter + ${grams.flourGrams}g flour + ${grams.waterGrams}g water. Allow ${warmH}h of room-temperature fermentation before refrigerating at bedtime. Remove in the morning — the starter will be active and ready to continue.`;
}

function refrigNote(placement, isLevain) {
  const { refrig } = placement;
  const warmH = Math.round(refrig.warmHoursBeforeCold * 10) / 10;
  if (isLevain) {
    return `Refrigerate the levain after ${warmH}h of fermentation to prevent over-ripening during sleep. It will continue fermenting slowly overnight.`;
  }
  return `Refrigerate the starter after ${warmH}h of room-temperature fermentation. ${refrig.reason}`;
}

function removeFridgeNote(isLevain) {
  if (isLevain) {
    return 'Remove levain from fridge. Allow 30–60 minutes at room temperature before mixing dough — it should show some doming and bubbles.';
  }
  return 'Remove starter from fridge. Allow 30–60 minutes to warm and become active before the next feed or build.';
}

// ── Main generator ────────────────────────────────────────────────

/**
 * Generates a bake plan working backward from targetBakeAt.
 *
 * @param {{
 *   targetBakeAt: string,
 *   starterAgeDays: number,
 *   starterLastFedAt?: string,
 *   starterLastFeedData?: { starterKeptGrams: number, flourGrams: number, waterGrams: number },
 *   totalStarterNeeded: number,
 *   totalFlourGrams?: number,
 *   roomTempDay: number,
 *   roomTempNight: number,
 *   wakeTime: string,
 *   sleepTime: string,
 *   mixDoughAt?: string,
 *   shapeAt?: string,
 * }} params
 *
 * @returns {{ steps: Array, assumptions: string[], inoculationPercent?: number, totalStarterNeeded: number }}
 */
export function generateBakePlan(params) {
  const {
    targetBakeAt,
    starterAgeDays,
    starterLastFedAt,
    starterLastFeedData,
    totalStarterNeeded: totalStarterNeededInput,
    totalFlourGrams,
    roomTempDay,
    roomTempNight,
    wakeTime,
    sleepTime,
    mixDoughAt: mixDoughAtInput,
    shapeAt: shapeAtInput,
  } = params;

  const assumptions = [];
  const steps = [];
  const tempConfig = { wakeTime, sleepTime, dayTempF: roomTempDay, nightTempF: roomTempNight };
  const avgDayTemp = roomTempDay;
  const now = new Date();
  const ctx = { wakeTime, sleepTime, notBefore: now };

  // ── 1. Bake ──────────────────────────────────────────────────────
  const bakeAt = roundTo15(new Date(targetBakeAt));
  steps.push({
    stepType: 'bake',
    plannedAt: bakeAt.toISOString(),
    inputs: {},
    notes: 'Preheat Dutch oven 45–60 min before loading. Score dough, bake covered 20 min at 500°F, uncovered 20–25 min until deep brown.',
  });

  // ── 2. Shape + cold proof ─────────────────────────────────────────
  let shapeAt;
  let proofStartAt;

  if (shapeAtInput) {
    shapeAt = roundTo15(new Date(shapeAtInput));
    proofStartAt = addMinutes(shapeAt, STEP_DURATION_MINUTES.shape);
    assumptions.push(`Shape time set by you: ${formatTime(shapeAt)}.`);
  } else {
    let sleepBeforeBake = prevSleepStart(bakeAt, sleepTime);
    const tentativeProofHours = (bakeAt - sleepBeforeBake) / (60 * 60 * 1000);
    if (tentativeProofHours < MIN_COLD_PROOF_HOURS) {
      sleepBeforeBake = new Date(sleepBeforeBake);
      sleepBeforeBake.setDate(sleepBeforeBake.getDate() - 1);
    }
    proofStartAt = new Date(sleepBeforeBake);
    shapeAt = roundTo15(subtractMinutes(proofStartAt, STEP_DURATION_MINUTES.shape));
  }

  const actualProofHours = Math.round((bakeAt - proofStartAt) / (60 * 60 * 1000));

  steps.push({
    stepType: 'proof_start',
    plannedAt: proofStartAt.toISOString(),
    inputs: {},
    notes: `Shape into banneton, cover tightly, and refrigerate. Bake straight from cold ${actualProofHours}h later — no need to temper.`,
  });
  assumptions.push(`Cold proof: into fridge ${formatTime(proofStartAt)}, bake ${actualProofHours}h later straight from cold.`);

  steps.push({
    stepType: 'shape',
    plannedAt: shapeAt.toISOString(),
    inputs: {},
    notes: 'Pre-shape, bench rest 20 min, then final shape. Aim for good surface tension.',
  });

  // ── 3. Bulk fermentation + mix dough ─────────────────────────────
  let bulkStartAt;
  let bulkHours;
  let totalStarterNeeded = totalStarterNeededInput;
  let inoculationPercent = null;

  if (mixDoughAtInput) {
    const mixDoughFixed = roundTo15(new Date(mixDoughAtInput));
    bulkStartAt = addMinutes(mixDoughFixed, STEP_DURATION_MINUTES.mix_dough);
    bulkHours = (shapeAt - bulkStartAt) / (60 * 60 * 1000);
    if (bulkHours <= 0) {
      throw new Error('Mix dough time must be before your shape / bake time.');
    }

    if (totalFlourGrams && totalFlourGrams > 0) {
      const bulkHoursBaseline = bulkHours * rateForTemp(roomTempDay);
      inoculationPercent = Math.round(INOCULATION_CONSTANT / bulkHoursBaseline);
      inoculationPercent = Math.max(5, Math.min(30, inoculationPercent));
      totalStarterNeeded = Math.round((inoculationPercent / 100) * totalFlourGrams);
      assumptions.push(
        `Inoculation rate: ~${inoculationPercent}% (${totalStarterNeeded}g levain for ${totalFlourGrams}g flour), calculated from your ${Math.round(bulkHours * 10) / 10}h bulk window.`
      );
    }

    assumptions.push(`Mix dough time set by you: ${formatTime(mixDoughFixed)}.`);
    assumptions.push(
      `Bulk fermentation: ${Math.round(bulkHours * 10) / 10} hours (${formatTime(bulkStartAt)} → ${formatTime(shapeAt)}).`
    );

    steps.push({
      stepType: 'bulk_start',
      plannedAt: bulkStartAt.toISOString(),
      inputs: {},
      notes: `Bulk ferment ${Math.round(bulkHours * 10) / 10} hrs. Perform stretch & folds every 30 min for the first 2 hours, then leave undisturbed.`,
    });
    steps.push({
      stepType: 'mix_dough',
      plannedAt: mixDoughFixed.toISOString(),
      inputs: {},
      notes: 'Mix flour, water, salt, and levain until fully incorporated — no dry patches. Autolyse 30–60 min beforehand if desired.',
    });

  } else {
    const bulkEstimateStart = subtractHours(shapeAt, 6);
    const bulkSimEnd = new Date(
      accumulateFermentation(bulkEstimateStart.toISOString(), BULK_FERMENTATION_HOURS_BASELINE, tempConfig)
    );
    bulkHours = (bulkSimEnd - bulkEstimateStart) / (60 * 60 * 1000);

    bulkStartAt = subtractHours(shapeAt, bulkHours);
    const { dt: bulkShifted, shifted: bulkWasShifted } = shiftBeforeSleep(bulkStartAt, sleepTime, wakeTime);
    if (bulkWasShifted) {
      bulkStartAt = bulkShifted;
      assumptions.push('Bulk fermentation start shifted earlier to avoid sleep window.');
    }
    bulkStartAt = roundTo15(bulkStartAt);

    steps.push({
      stepType: 'bulk_start',
      plannedAt: bulkStartAt.toISOString(),
      inputs: {},
      notes: `Bulk ferment ~${Math.round(bulkHours * 10) / 10} hrs at room temperature. Stretch & fold every 30 min for the first 2 hours.`,
    });
    assumptions.push(
      `Bulk fermentation: ~${Math.round(bulkHours * 10) / 10} hours at ${roomTempDay}°F day / ${roomTempNight}°F night (5h at 75°F baseline, temperature-adjusted).`
    );

    const mixAt = roundTo15(subtractMinutes(bulkStartAt, STEP_DURATION_MINUTES.mix_dough));
    steps.push({
      stepType: 'mix_dough',
      plannedAt: mixAt.toISOString(),
      inputs: {},
      notes: 'Mix flour, water, salt, and levain until fully incorporated — no dry patches. Autolyse 30–60 min beforehand if desired.',
    });
  }

  // ── 4. Levain build ───────────────────────────────────────────────
  const mixStep = steps.find(s => s.stepType === 'mix_dough');
  const mixAt = new Date(mixStep.plannedAt);

  const levainPlacement = planBuildPlacement(mixAt, avgDayTemp, ctx, 'levain');
  const levainBuildAt = roundTo15(levainPlacement.buildAt);
  const levainPeak = levainPlacement.peakWindow;
  const levainRatio = levainPlacement.ratio;
  const levainRefrig = levainPlacement.refrig;

  // Gram amounts for the levain build
  const levainGrams = calcBuildStep(totalStarterNeeded, levainRatio, 1.15);
  const peakRangeStr = fmtPeakRange(levainPeak);

  steps.push({
    stepType: 'levain_build',
    plannedAt: levainBuildAt.toISOString(),
    inputs: {
      ratio: levainRatio,
      seedStarterGrams: levainGrams.seedStarterGrams,
      flourGrams: levainGrams.flourGrams,
      waterGrams: levainGrams.waterGrams,
      totalBuildGrams: levainGrams.totalBuildGrams,
      gramsUsedForNextStep: levainGrams.gramsUsedForNextStep,
      gramsReserved: levainGrams.gramsReserved,
      gramsReturnedToFridge: 0,
      expectedPeakHours: Math.round(levainPeak.midHours * 10) / 10,
    },
    notes: levainNote(levainPlacement, levainGrams, avgDayTemp),
  });

  assumptions.push(
    `Levain: ${levainRatio} ratio — peaks in ${peakRangeStr} at ${avgDayTemp}°F. Builds ${levainGrams.totalBuildGrams}g, uses ${levainGrams.gramsUsedForNextStep}g for dough.`
  );

  if (levainRefrig) {
    steps.push({
      stepType: 'refrigerate_starter',
      plannedAt: roundTo15(levainRefrig.refrigerateAt).toISOString(),
      inputs: { targetStep: 'levain_build' },
      notes: refrigNote(levainPlacement, true),
    });
    steps.push({
      stepType: 'remove_from_fridge',
      plannedAt: roundTo15(levainRefrig.removeAt).toISOString(),
      inputs: { targetStep: 'levain_build' },
      notes: removeFridgeNote(true),
    });
    assumptions.push(`Levain refrigeration: ${levainRefrig.reason}`);
  }

  // ── 5. Starter recovery feeds ─────────────────────────────────────
  const numFeeds = feedsNeeded(starterAgeDays);
  assumptions.push(recoveryNote(starterAgeDays));

  if (numFeeds === 0) {
    steps.sort((a, b) => new Date(a.plannedAt) - new Date(b.plannedAt));
    _appendCommonAssumptions(assumptions, roomTempDay, roomTempNight, wakeTime, sleepTime);
    return { steps, assumptions, inoculationPercent, totalStarterNeeded };
  }

  // If the starter was fed within the last 24h, treat that actual feed as the
  // starter_refresh step rather than scheduling a new one in the past.
  let alreadyFedAt = null;
  if (starterLastFedAt) {
    const lastFed = new Date(starterLastFedAt);
    const hoursSinceFed = (now - lastFed) / 3600000;
    if (hoursSinceFed >= 0 && hoursSinceFed < 24) alreadyFedAt = lastFed;
  }

  const refreshSteps = [];

  if (alreadyFedAt) {
    // Credit the actual morning feed as the starter_refresh.
    // Use real feed amounts if available, otherwise fall back to estimates.
    let feedGrams, estRatio, feedNote;

    if (starterLastFeedData?.starterKeptGrams > 0) {
      const { starterKeptGrams, flourGrams: actualFlour, waterGrams: actualWater } = starterLastFeedData;
      const totalBuildGrams = starterKeptGrams + actualFlour + actualWater;
      const gramsUsedForNextStep = levainGrams.seedStarterGrams;

      // Find the closest RATIO_OPTIONS entry by flour multiplier for peak estimation
      const flourMult = actualFlour / starterKeptGrams;
      estRatio = RATIO_OPTIONS.reduce((best, opt) => {
        const [, f] = opt.ratio.split(':').map(Number);
        const [, bf] = best.split(':').map(Number);
        return Math.abs(f - flourMult) < Math.abs(bf - flourMult) ? opt.ratio : best;
      }, RATIO_OPTIONS[0].ratio);

      const rf = Math.round(actualFlour / starterKeptGrams * 10) / 10;
      const rw = Math.round(actualWater / starterKeptGrams * 10) / 10;
      feedGrams = {
        ratio: `1:${rf}:${rw}`,
        seedStarterGrams: starterKeptGrams,
        flourGrams: actualFlour,
        waterGrams: actualWater,
        totalBuildGrams,
        gramsUsedForNextStep,
        gramsReserved: Math.max(0, totalBuildGrams - gramsUsedForNextStep),
      };
      feedNote = (peakAt) => `You already did this feed. Starter expected to peak around ${formatTime(peakAt)}.`;
    } else {
      estRatio = DEFAULT_REFRESH_RATIO;
      feedGrams = calcBuildStep(levainGrams.seedStarterGrams, estRatio, 1.2);
      feedNote = (peakAt) => `You already did this feed. Grams shown are estimates — use what you actually mixed. Starter expected to peak around ${formatTime(peakAt)}.`;
    }

    const peakW = estimatePeakWindow(estRatio, avgDayTemp);
    const peakAt = new Date(alreadyFedAt.getTime() + peakW.midHours * 3600000);
    const leadHoursToLevain = (levainBuildAt - peakAt) / 3600000;

    refreshSteps.push({
      stepType: 'starter_refresh',
      plannedAt: roundTo15(alreadyFedAt).toISOString(),
      inputs: {
        ratio: feedGrams.ratio,
        seedStarterGrams: feedGrams.seedStarterGrams,
        flourGrams: feedGrams.flourGrams,
        waterGrams: feedGrams.waterGrams,
        totalBuildGrams: feedGrams.totalBuildGrams,
        gramsUsedForNextStep: feedGrams.gramsUsedForNextStep,
        gramsReserved: feedGrams.gramsReserved,
        expectedPeakHours: Math.round(peakW.midHours * 10) / 10,
      },
      notes: feedNote(peakAt),
    });
    assumptions.push(`Starter refresh: used your actual feed at ${formatTime(alreadyFedAt)} — no additional refresh needed.`);

    if (leadHoursToLevain > OVERPEAK_RISK_HOURS) {
      // Starter will be well past peak by levain build — refrigerate.
      const refrigerateAt = roundTo15(new Date(Math.max(peakAt.getTime(), now.getTime())));
      const removeAt = roundTo15(new Date(Math.max(
        nextWakeTime(refrigerateAt, wakeTime).getTime(),
        levainBuildAt.getTime() - 30 * 60 * 1000,
      )));
      const warmH = Math.round((refrigerateAt - alreadyFedAt) / 3600000 * 10) / 10;
      const reason = `Peaked ~${Math.round(leadHoursToLevain)}h before levain build — refrigerate at peak to pause fermentation.`;
      refreshSteps.push({
        stepType: 'refrigerate_starter',
        plannedAt: refrigerateAt.toISOString(),
        inputs: {},
        notes: `Refrigerate the starter after ~${warmH}h of room-temperature fermentation. ${reason}`,
      });
      refreshSteps.push({
        stepType: 'remove_from_fridge',
        plannedAt: removeAt.toISOString(),
        inputs: {},
        notes: removeFridgeNote(false),
      });
      assumptions.push(`Starter refrigeration: ${reason}`);
    }

  } else {
    // Normal case: generate feeds placed in the future (notBefore = now via ctx).
    // Collect placements working backward from levain build.
    const reversePlacements = [];
    let cursor = levainBuildAt;
    for (let i = 0; i < numFeeds; i++) {
      const placement = planBuildPlacement(cursor, avgDayTemp, ctx, 'recovery');
      reversePlacements.push(placement);
      cursor = roundTo15(placement.buildAt);
    }

    // Compute gram amounts working backward from levain's seed requirement.
    let seedNeededForNext = levainGrams.seedStarterGrams;
    for (let i = 0; i < numFeeds; i++) {
      const feedGrams = calcBuildStep(seedNeededForNext, reversePlacements[i].ratio, 1.2);
      reversePlacements[i].chainData = feedGrams;
      seedNeededForNext = feedGrams.seedStarterGrams;
    }

    // Emit steps chronologically (oldest first = reversePlacements[numFeeds-1] first).
    for (let i = numFeeds - 1; i >= 0; i--) {
      const placement = reversePlacements[i];
      const grams = placement.chainData;
      const stepType = i === numFeeds - 1 ? 'starter_refresh' : 'strengthening_feed';

      refreshSteps.push({
        stepType,
        plannedAt: roundTo15(placement.buildAt).toISOString(),
        inputs: {
          ratio: placement.ratio,
          seedStarterGrams: grams.seedStarterGrams,
          flourGrams: grams.flourGrams,
          waterGrams: grams.waterGrams,
          totalBuildGrams: grams.totalBuildGrams,
          gramsUsedForNextStep: grams.gramsUsedForNextStep,
          gramsReserved: grams.gramsReserved,
          gramsReturnedToFridge: 0,
          expectedPeakHours: Math.round(placement.peakWindow.midHours * 10) / 10,
        },
        notes: recoveryFeedNote(placement, grams, stepType, avgDayTemp),
      });

      if (placement.refrig) {
        refreshSteps.push({
          stepType: 'refrigerate_starter',
          plannedAt: roundTo15(placement.refrig.refrigerateAt).toISOString(),
          inputs: { targetStep: stepType },
          notes: refrigNote(placement, false),
        });
        refreshSteps.push({
          stepType: 'remove_from_fridge',
          plannedAt: roundTo15(placement.refrig.removeAt).toISOString(),
          inputs: { targetStep: stepType },
          notes: removeFridgeNote(false),
        });
        assumptions.push(`Starter refrigeration: ${placement.refrig.reason}`);
      }
    }
  }

  steps.push(...refreshSteps);
  steps.sort((a, b) => new Date(a.plannedAt) - new Date(b.plannedAt));

  _appendCommonAssumptions(assumptions, roomTempDay, roomTempNight, wakeTime, sleepTime);
  return { steps, assumptions, inoculationPercent, totalStarterNeeded };
}

function _appendCommonAssumptions(assumptions, dayTemp, nightTemp, wakeTime, sleepTime) {
  assumptions.push('All times rounded to nearest 15 minutes.');
  assumptions.push(
    `Day temperature (${dayTemp}°F) during wake hours (${wakeTime}–${sleepTime}), night temperature (${nightTemp}°F) during sleep.`
  );
}
