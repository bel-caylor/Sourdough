import { FERMENTATION_RATE_TABLE } from './constants.js';

/**
 * Returns the fermentation rate multiplier for a given temperature (°F).
 * Linearly interpolates between table entries.
 * @param {number} tempF
 * @returns {number} rate multiplier
 */
export function getRateForTemp(tempF) {
  const table = FERMENTATION_RATE_TABLE;
  if (tempF <= table[0].temp) return table[0].rate;
  if (tempF >= table[table.length - 1].temp) return table[table.length - 1].rate;

  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i];
    const hi = table[i + 1];
    if (tempF >= lo.temp && tempF <= hi.temp) {
      const t = (tempF - lo.temp) / (hi.temp - lo.temp);
      return lo.rate + t * (hi.rate - lo.rate);
    }
  }
  return 1.0;
}

/**
 * Returns the active temperature (°F) at a given ISO timestamp,
 * based on whether the time is within the user's wake window.
 * @param {string} timestampISO
 * @param {string} wakeTime  - "HH:mm"
 * @param {string} sleepTime - "HH:mm"
 * @param {number} dayTempF
 * @param {number} nightTempF
 * @returns {number}
 */
export function getActiveTemp(timestampISO, wakeTime, sleepTime, dayTempF, nightTempF) {
  const dt = new Date(timestampISO);
  const h = dt.getHours();
  const m = dt.getMinutes();
  const totalMin = h * 60 + m;

  const [wh, wm] = wakeTime.split(':').map(Number);
  const [sh, sm] = sleepTime.split(':').map(Number);
  const wakeMin = wh * 60 + wm;
  const sleepMin = sh * 60 + sm;

  // Handle wrap-around (e.g. sleep at 22:00, wake at 06:00)
  let isAwake;
  if (wakeMin < sleepMin) {
    isAwake = totalMin >= wakeMin && totalMin < sleepMin;
  } else {
    isAwake = totalMin >= wakeMin || totalMin < sleepMin;
  }

  return isAwake ? dayTempF : nightTempF;
}

/**
 * Simulates fermentation progress accumulating over time (30-min steps).
 * Stops when cumulative progress >= targetProgress (0–1 scale, where 1.0 = fully fermented at 75°F baseline).
 *
 * @param {string} startISO - start timestamp
 * @param {number} targetProgress - fermentation progress to accumulate (e.g. 0.85 for bulk)
 * @param {{wakeTime: string, sleepTime: string, dayTempF: number, nightTempF: number}} config
 * @param {number} [maxHours=48] - safety limit
 * @returns {string} estimated end ISO timestamp
 */
export function accumulateFermentation(startISO, targetProgress, config, maxHours = 48) {
  const STEP_MS = 30 * 60 * 1000; // 30-minute steps
  const RATE_PER_STEP_AT_BASELINE = 1 / 8; // at 75°F, 8 steps (4 hrs) = 50% progress reference
  // We normalize: 1 unit of progress = 1 hour at 75°F rate
  // So per 30-min step at baseline rate 1.0, progress += 0.5

  let current = new Date(startISO).getTime();
  let progress = 0;
  const maxMs = maxHours * 60 * 60 * 1000;
  const start = current;

  while (progress < targetProgress && (current - start) < maxMs) {
    const temp = getActiveTemp(new Date(current).toISOString(), config.wakeTime, config.sleepTime, config.dayTempF, config.nightTempF);
    const rate = getRateForTemp(temp);
    progress += rate * 0.5; // 0.5 hours per 30-min step
    current += STEP_MS;
  }

  return new Date(current).toISOString();
}
