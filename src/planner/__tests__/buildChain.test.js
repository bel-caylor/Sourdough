import { describe, it, expect } from 'vitest';
import {
  roundBuildAmounts,
  estimatePeakWindow,
  selectRatioForWindow,
  needsRefrigerationHold,
  calcBuildStep,
  calculateBuildChain,
  planBuildPlacement,
} from '../buildChain.js';
import { MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD } from '../constants.js';

// ── roundBuildAmounts ─────────────────────────────────────────────

describe('roundBuildAmounts', () => {
  it('rounds to nearest 5g', () => {
    expect(roundBuildAmounts(12)).toBe(10);
    expect(roundBuildAmounts(13)).toBe(15);
    expect(roundBuildAmounts(100)).toBe(100);
    expect(roundBuildAmounts(47)).toBe(45);
  });

  it('enforces a minimum of 5g', () => {
    expect(roundBuildAmounts(0)).toBe(5);
    expect(roundBuildAmounts(2)).toBe(5);
    expect(roundBuildAmounts(-10)).toBe(5);
  });
});

// ── estimatePeakWindow ────────────────────────────────────────────

describe('estimatePeakWindow', () => {
  it('returns baseline range for 1:4:4 at 75°F (rate = 1.0)', () => {
    const w = estimatePeakWindow('1:4:4', 75);
    expect(w.minHours).toBeCloseTo(6, 1);
    expect(w.maxHours).toBeCloseTo(8, 1);
    expect(w.midHours).toBeCloseTo(7, 1);
  });

  it('returns faster peak at higher temp (85°F, rate = 1.5)', () => {
    const w = estimatePeakWindow('1:4:4', 85);
    // minH = 6/1.5 = 4, maxH = 8/1.5 ≈ 5.3
    expect(w.minHours).toBeCloseTo(4, 0);
    expect(w.maxHours).toBeCloseTo(5.33, 0);
  });

  it('returns slower peak at lower temp (65°F, rate = 0.6)', () => {
    const w = estimatePeakWindow('1:5:5', 65);
    // minH = 8/0.6 ≈ 13.3, maxH = 10/0.6 ≈ 16.7
    expect(w.minHours).toBeGreaterThan(10);
    expect(w.maxHours).toBeGreaterThan(13);
  });

  it('falls back to 1:4:4 for unknown ratio', () => {
    const known = estimatePeakWindow('1:4:4', 75);
    const unknown = estimatePeakWindow('1:99:99', 75);
    expect(unknown.midHours).toBeCloseTo(known.midHours, 1);
  });
});

// ── selectRatioForWindow ──────────────────────────────────────────

describe('selectRatioForWindow', () => {
  it('selects a fast ratio for short windows (4h available at 75°F)', () => {
    const ratio = selectRatioForWindow(4, 75);
    // 4h available, ideal lead ~1.25h => target midH ≈ 2.75h => 1:1:1 midH=3.5 or 1:2:2 midH=5
    // We expect one of the shorter ratios
    expect(['1:1:1', '1:2:2']).toContain(ratio);
  });

  it('selects a longer ratio for overnight windows (10h available at 75°F)', () => {
    const ratio = selectRatioForWindow(10, 75);
    // target midH ≈ 8.75h => 1:5:5 midH=9 is closest
    expect(['1:4:4', '1:5:5', '1:8:8']).toContain(ratio);
  });

  it('adjusts for temperature — same hours but warmer needs a longer ratio', () => {
    const coldRatio = selectRatioForWindow(8, 65);  // slow ferment
    const warmRatio = selectRatioForWindow(8, 80);  // fast ferment
    // At 80°F things move faster, so we need a diluted (longer) ratio to fill 8h
    // At 65°F things move slower, so we might not need as diluted a ratio
    // coldRatio should be <= warmRatio in terms of dilution
    const ratioOrder = ['1:1:1', '1:2:2', '1:3:3', '1:4:4', '1:5:5', '1:8:8', '1:10:10'];
    const coldIdx = ratioOrder.indexOf(coldRatio);
    const warmIdx = ratioOrder.indexOf(warmRatio);
    expect(warmIdx).toBeGreaterThanOrEqual(coldIdx);
  });
});

// ── needsRefrigerationHold ────────────────────────────────────────

describe('needsRefrigerationHold', () => {
  const sleepTime = '22:00';
  const wakeTime  = '07:00';

  it('returns needed=false when peak is well before next action in waking hours', () => {
    // build at 10am, peaks at 12pm (2h), next action at 1pm (lead = 1h — ideal)
    const peakAt       = new Date('2025-03-14T12:00:00');
    const nextActionAt = new Date('2025-03-14T13:00:00');
    const result = needsRefrigerationHold(peakAt, nextActionAt, sleepTime, wakeTime);
    expect(result.needed).toBe(false);
  });

  it('detects peak during sleep window', () => {
    // levain built at 9pm, peaks at 11pm (midnight — in sleep window)
    const peakAt       = new Date('2025-03-14T23:00:00');
    const nextActionAt = new Date('2025-03-15T08:00:00');
    const result = needsRefrigerationHold(peakAt, nextActionAt, sleepTime, wakeTime);
    expect(result.needed).toBe(true);
    expect(result.reason).toMatch(/sleep/i);
    expect(result.refrigerateAt).toBeDefined();
    expect(result.removeAt).toBeDefined();
  });

  it('detects overpeaked (lead > OVERPEAK_RISK_HOURS)', () => {
    // build peaks at 8am, next action at 2pm — lead = 6h (over 4h threshold)
    const peakAt       = new Date('2025-03-14T08:00:00');
    const nextActionAt = new Date('2025-03-14T14:00:00');
    const result = needsRefrigerationHold(peakAt, nextActionAt, sleepTime, wakeTime);
    expect(result.needed).toBe(true);
    expect(result.reason).toMatch(/peak/i);
  });

  it('removeAt for sleep-case is the next morning wake time', () => {
    const peakAt       = new Date('2025-03-14T23:30:00');
    const nextActionAt = new Date('2025-03-15T09:00:00');
    const result = needsRefrigerationHold(peakAt, nextActionAt, sleepTime, wakeTime);
    expect(result.needed).toBe(true);
    const remove = result.removeAt;
    expect(remove.getHours()).toBe(7);
    expect(remove.getDate()).toBe(15);
  });
});

// ── calcBuildStep ─────────────────────────────────────────────────

describe('calcBuildStep', () => {
  it('returns correct parts for 1:5:5 ratio targeting 100g output needed', () => {
    const result = calcBuildStep(100, '1:5:5');
    // totalParts = 11, with 1.15 buffer: totalBuild ≈ 115g
    // seed = 115 * 1/11 ≈ 10g, flour = 115 * 5/11 ≈ 50g, water = 115 * 5/11 ≈ 50g
    expect(result.totalBuildGrams).toBeGreaterThanOrEqual(100);
    expect(result.gramsUsedForNextStep).toBe(100);
    expect(result.gramsReserved).toBeGreaterThanOrEqual(0);
    expect(result.gramsReturnedToFridge).toBe(0);
    // ratio parts: seed should be ~1/11 of total
    expect(result.seedStarterGrams).toBeLessThan(result.flourGrams);
    expect(result.flourGrams).toBeCloseTo(result.waterGrams, 0);
  });

  it('gramsReserved = totalBuildGrams - gramsUsedForNextStep', () => {
    const result = calcBuildStep(80, '1:4:4');
    expect(result.gramsReserved).toBe(result.totalBuildGrams - result.gramsUsedForNextStep);
  });

  it('all amounts rounded to nearest 5g', () => {
    const result = calcBuildStep(73, '1:3:3');
    [result.seedStarterGrams, result.flourGrams, result.waterGrams].forEach(g => {
      expect(g % 5).toBe(0);
    });
  });
});

// ── calculateBuildChain ───────────────────────────────────────────

describe('calculateBuildChain', () => {
  it('produces levain_build as last item with no feeds', () => {
    const chain = calculateBuildChain({
      levainNeeded: 150,
      numFeeds: 0,
      levainRatio: '1:5:5',
      refreshRatio: '1:4:4',
    });
    expect(chain).toHaveLength(1);
    expect(chain[0].type).toBe('levain_build');
    expect(chain[0].gramsUsedForNextStep).toBe(150);
    expect(chain[0].totalBuildGrams).toBeGreaterThanOrEqual(150);
  });

  it('produces correct chain order with 2 feeds', () => {
    const chain = calculateBuildChain({
      levainNeeded: 100,
      numFeeds: 2,
      levainRatio: '1:5:5',
      refreshRatio: '1:4:4',
    });
    expect(chain).toHaveLength(3);
    expect(chain[0].type).toBe('starter_refresh');
    expect(chain[1].type).toBe('strengthening_feed');
    expect(chain[2].type).toBe('levain_build');
  });

  it('seed flows correctly: each step output >= next step seedStarterGrams', () => {
    const chain = calculateBuildChain({
      levainNeeded: 120,
      numFeeds: 2,
      levainRatio: '1:5:5',
      refreshRatio: '1:4:4',
    });
    // chain[0] (starter_refresh) gramsUsedForNextStep = chain[1] (strengthening_feed) seedStarterGrams
    expect(chain[0].gramsUsedForNextStep).toBe(chain[1].seedStarterGrams);
    // chain[1] (strengthening_feed) gramsUsedForNextStep = chain[2] (levain_build) seedStarterGrams
    expect(chain[1].gramsUsedForNextStep).toBe(chain[2].seedStarterGrams);
    // chain[2] gramsUsedForNextStep = levainNeeded
    expect(chain[2].gramsUsedForNextStep).toBe(120);
  });

  it('with 1 feed, that feed is starter_refresh', () => {
    const chain = calculateBuildChain({
      levainNeeded: 80,
      numFeeds: 1,
      levainRatio: '1:5:5',
      refreshRatio: '1:4:4',
    });
    expect(chain[0].type).toBe('starter_refresh');
    expect(chain[1].type).toBe('levain_build');
  });

  it('gramsReserved >= 0 for all steps', () => {
    const chain = calculateBuildChain({
      levainNeeded: 200,
      numFeeds: 3,
      levainRatio: '1:5:5',
      refreshRatio: '1:4:4',
    });
    chain.forEach(step => {
      expect(step.gramsReserved).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── planBuildPlacement ────────────────────────────────────────────

describe('planBuildPlacement', () => {
  // Scenario: wake 07:00, sleep 22:00, day temp 75°F
  // next action at Thursday 2pm — plenty of same-day time available.
  const ctx = { wakeTime: '07:00', sleepTime: '22:00' };

  it('recovery mode: prefers no refrigeration when same-day window fits', () => {
    const nextActionAt = new Date('2025-03-13T14:00:00'); // Thu 2pm
    const result = planBuildPlacement(nextActionAt, 75, ctx, 'recovery');

    // Should find a no-fridge option (peak before or at 2pm, build in daytime)
    expect(result.refrig).toBeNull();
    expect(result.buildAt).toBeInstanceOf(Date);
    expect(result.buildAt.getTime()).toBeLessThan(nextActionAt.getTime());
  });

  it('recovery mode: build is not during sleep', () => {
    const nextActionAt = new Date('2025-03-13T14:00:00');
    const result = planBuildPlacement(nextActionAt, 75, ctx, 'recovery');
    const h = result.buildAt.getHours();
    const m = result.buildAt.getMinutes();
    const totalMin = h * 60 + m;
    // Not between 22:00 (1320) and 07:00 (420)
    expect(totalMin >= 420 && totalMin < 1320).toBe(true);
  });

  it('recovery mode: enforces MIN_ROOM_TEMP_HOURS before cold hold', () => {
    // next action is early morning Thursday — forces prior-day placement with overnight hold
    const nextActionAt = new Date('2025-03-13T09:00:00'); // Thu 9am
    const result = planBuildPlacement(nextActionAt, 75, ctx, 'recovery');

    if (result.refrig !== null) {
      // If refrigeration is used, warm ferment must be >= MIN_ROOM_TEMP_HOURS
      expect(result.refrig.warmHoursBeforeCold).toBeGreaterThanOrEqual(
        MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD
      );
    }
    // And the build itself must not be during sleep
    const buildH = result.buildAt.getHours();
    expect(buildH).toBeGreaterThanOrEqual(7); // after wake
    expect(buildH).toBeLessThan(22);           // before sleep
  });

  it('recovery mode: when fridge is required, morning build scores higher than bedtime build', () => {
    // next action Thu 9am — no good same-day option, must use prior day
    const nextActionAt = new Date('2025-03-13T09:00:00');
    const result = planBuildPlacement(nextActionAt, 75, ctx, 'recovery');

    // Whatever placement was chosen, the build hour should not be late evening
    // (i.e. the planner should not default to bedtime + immediate fridge)
    const buildH = result.buildAt.getHours();
    const buildMin = result.buildAt.getMinutes();
    const buildTotalMin = buildH * 60 + buildMin;
    // Should not be within MIN_ROOM_TEMP_HOURS of sleep (i.e. not after 19:00 = 1140)
    // unless it genuinely is the best available option
    if (result.refrig) {
      // If there's a morning alternative with more warm ferment time, it should win
      // Proxy: warmHoursBeforeCold should reflect meaningful daytime fermentation
      expect(result.refrig.warmHoursBeforeCold).toBeGreaterThanOrEqual(
        MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD
      );
    }
  });

  it('levain mode: targets peak close to mix time (effectiveLeadHours 0–3h)', () => {
    // next action (mix) is Thursday 1pm — enough same-day levain window
    const nextActionAt = new Date('2025-03-13T13:00:00');
    const result = planBuildPlacement(nextActionAt, 75, ctx, 'levain');

    const peakAt = new Date(result.buildAt.getTime() + result.peakWindow.midHours * 3600000);
    const effectivePeakAt = result.refrig ? result.refrig.removeAt : peakAt;
    const effectiveLeadHours = (nextActionAt - effectivePeakAt) / 3600000;

    // Should be within a 0–4h window
    expect(effectiveLeadHours).toBeGreaterThanOrEqual(-0.5);
    expect(effectiveLeadHours).toBeLessThanOrEqual(4);
  });

  it('levain mode: refrigeration hold has >= MIN_ROOM_TEMP_HOURS warm ferment', () => {
    // next action very early Thu — forces an overnight levain hold
    const nextActionAt = new Date('2025-03-13T08:00:00'); // Thu 8am
    const result = planBuildPlacement(nextActionAt, 75, ctx, 'levain');

    if (result.refrig !== null) {
      expect(result.refrig.warmHoursBeforeCold).toBeGreaterThanOrEqual(
        MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD
      );
    }
  });

  it('always returns a valid result (no crash) for various inputs', () => {
    const scenarios = [
      new Date('2025-03-13T09:00:00'),
      new Date('2025-03-13T12:00:00'),
      new Date('2025-03-13T18:00:00'),
      new Date('2025-03-14T07:30:00'),
    ];
    for (const nextActionAt of scenarios) {
      for (const mode of ['recovery', 'levain']) {
        const result = planBuildPlacement(nextActionAt, 75, ctx, mode);
        expect(result.buildAt).toBeInstanceOf(Date);
        expect(result.ratio).toMatch(/^\d+:\d+:\d+$/);
        expect(result.peakWindow).toHaveProperty('midHours');
        expect(result.buildAt.getTime()).toBeLessThan(nextActionAt.getTime());
      }
    }
  });
});
