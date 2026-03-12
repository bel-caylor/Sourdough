import { PEAK_TIME_TABLE, DEFAULT_REFRESH_RATIO, DEFAULT_LEVAIN_RATIO } from './constants.js';
import { getRateForTemp } from './fermentationRates.js';

/**
 * Returns estimated peak hours for a given ratio string and temperature.
 * Uses the midpoint of the table range, adjusted by temperature rate.
 *
 * @param {string} ratio - e.g. '1:4:4', '1:5:5'
 * @param {number} tempF
 * @returns {number} estimated hours to peak
 */
export function estimatePeakHours(ratio, tempF) {
  const entry = PEAK_TIME_TABLE[ratio] ?? PEAK_TIME_TABLE[DEFAULT_REFRESH_RATIO];
  const [minH, maxH] = entry;
  const midH = (minH + maxH) / 2;
  const rate = getRateForTemp(tempF);
  // Higher rate = faster fermentation = fewer hours to peak
  return midH / rate;
}

/**
 * Returns estimated peak hours for a refresh feed, given avg day temp.
 * @param {number} tempF
 * @returns {number}
 */
export function estimateRefreshPeakHours(tempF) {
  return estimatePeakHours(DEFAULT_REFRESH_RATIO, tempF);
}

/**
 * Returns estimated peak hours for a levain build, given avg day temp.
 * @param {number} tempF
 * @returns {number}
 */
export function estimateLevainPeakHours(tempF) {
  return estimatePeakHours(DEFAULT_LEVAIN_RATIO, tempF);
}

/**
 * Parses a ratio string like '1:4:4' into { seed, flour, water }.
 * @param {string} ratio
 * @returns {{ seed: number, flour: number, water: number }}
 */
export function parseRatio(ratio) {
  const [seed, flour, water] = ratio.split(':').map(Number);
  return { seed, flour, water };
}

/**
 * Given total grams needed and a ratio, returns feed gram amounts.
 * @param {number} totalGrams - total starter output needed
 * @param {string} ratio - e.g. '1:5:5'
 * @returns {{ seedStarterGrams: number, flourGrams: number, waterGrams: number }}
 */
export function calcFeedAmounts(totalGrams, ratio) {
  const { seed, flour, water } = parseRatio(ratio);
  const total = seed + flour + water;
  const factor = totalGrams / total;
  return {
    seedStarterGrams: Math.round(seed * factor),
    flourGrams: Math.round(flour * factor),
    waterGrams: Math.round(water * factor),
  };
}
