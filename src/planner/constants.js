/**
 * Fermentation rate multipliers relative to 75°F baseline.
 * Key = temp in °F, value = rate multiplier.
 * Interpolated for values between entries.
 */
export const FERMENTATION_RATE_TABLE = [
  { temp: 60, rate: 0.45 },
  { temp: 65, rate: 0.60 },
  { temp: 68, rate: 0.70 },
  { temp: 70, rate: 0.80 },
  { temp: 72, rate: 0.90 },
  { temp: 75, rate: 1.00 },
  { temp: 78, rate: 1.15 },
  { temp: 80, rate: 1.25 },
  { temp: 82, rate: 1.35 },
  { temp: 85, rate: 1.50 },
];

/**
 * Ordered ratio options for dynamic ratio selection.
 * minH/maxH are hours to peak at 75°F baseline.
 * Interpolated for actual temperature by dividing by rate multiplier.
 */
export const RATIO_OPTIONS = [
  { ratio: '1:1:1',   minH: 3,  maxH: 4  },
  { ratio: '1:2:2',   minH: 4,  maxH: 6  },
  { ratio: '1:3:3',   minH: 5,  maxH: 7  },
  { ratio: '1:4:4',   minH: 6,  maxH: 8  },
  { ratio: '1:5:5',   minH: 8,  maxH: 10 },
  { ratio: '1:8:8',   minH: 10, maxH: 12 },
  { ratio: '1:10:10', minH: 10, maxH: 14 },
];

/**
 * Expected peak time range (hours) at 75°F for common feed ratios.
 * Key format: "seed:flour:water" — all entries assume equal flour:water.
 * Values: [minHours, maxHours]
 */
export const PEAK_TIME_TABLE = {
  '1:1:1':   [3,  4],
  '1:2:2':   [4,  6],
  '1:3:3':   [5,  7],
  '1:4:4':   [6,  8],
  '1:5:5':   [8,  10],
  '1:8:8':   [10, 12],
  '1:10:10': [10, 14],
};

/**
 * Default ratio used for starter refresh feeds.
 */
export const DEFAULT_REFRESH_RATIO = '1:4:4';

/**
 * Default ratio used for levain builds.
 */
export const DEFAULT_LEVAIN_RATIO = '1:5:5';

/**
 * Bulk fermentation duration in equivalent hours at 75°F baseline.
 * The simulation accumulates progress in hour-units (rate * 0.5 per 30-min step),
 * so 5.0 = "5 hours at 75°F" — adjusted faster/slower by actual temperature.
 */
export const BULK_FERMENTATION_HOURS_BASELINE = 5.0;

/**
 * Minimum cold proof duration (hours). Even if temps are warm, we enforce this.
 */
export const MIN_COLD_PROOF_HOURS = 8;

/**
 * Inoculation constant for bulk fermentation duration model (at 75°F baseline).
 * bulkHoursBaseline = INOCULATION_CONSTANT / inoculationPercent
 * Derived from: 20% inoculation → ~4h bulk, 10% → ~8h, 5% → ~16h.
 */
export const INOCULATION_CONSTANT = 80;

/**
 * Buffer factor applied when calculating build output to ensure there's
 * enough starter for the next step plus some reserve.
 */
export const BUILD_BUFFER_FACTOR = 1.15;

/**
 * Peak targeting tolerance window (hours before next action).
 * IDEAL: build peaked 0.5–2h before you need to use it.
 * ACCEPTABLE: up to 4h before use (still active).
 */
export const IDEAL_PEAK_LEAD_HOURS_MIN = 0.5;
export const IDEAL_PEAK_LEAD_HOURS_MAX = 2.0;
export const ACCEPTABLE_PEAK_LEAD_HOURS_MAX = 4.0;

/**
 * If a build peaked more than this many hours before use, fermentation
 * has gone too far — refrigeration hold is needed.
 */
export const OVERPEAK_RISK_HOURS = 4.0;

/**
 * Minimum hours of room-temperature fermentation a build must receive
 * before it may be refrigerated. Prevents the biologically poor pattern
 * of feeding and immediately chilling with no meaningful warm fermentation.
 */
export const MIN_ROOM_TEMP_HOURS_BEFORE_COLD_HOLD = 3;

/**
 * Approximate time (minutes) for hands-on steps.
 */
export const STEP_DURATION_MINUTES = {
  mix_dough: 15,
  shape: 30,
  score_and_load: 5,
};

/**
 * Human-readable labels and descriptions for each step type.
 */
export const STEP_LABELS = {
  starter_refresh:    { label: 'Starter Refresh',      icon: '○', color: 'var(--crust)' },
  strengthening_feed: { label: 'Strengthening Feed',   icon: '○', color: 'var(--crust)' },
  levain_build:       { label: 'Levain Build',          icon: '◉', color: '#5563A8' },
  mix_dough:          { label: 'Mix Dough',             icon: '◈', color: 'var(--ash)' },
  bulk_start:         { label: 'Bulk Fermentation',     icon: '◈', color: 'var(--ash)' },
  shape:              { label: 'Shape',                 icon: '◈', color: 'var(--ash)' },
  proof_start:        { label: 'Cold Proof',            icon: '◇', color: '#5563A8' },
  bake:               { label: 'Bake',                  icon: '◈', color: 'var(--rise)' },
  refrigerate_starter: { label: 'Refrigerate',          icon: '❄', color: '#5E9BD4' },
  remove_from_fridge:  { label: 'Remove from Fridge',   icon: '↑', color: '#5E9BD4' },
};
