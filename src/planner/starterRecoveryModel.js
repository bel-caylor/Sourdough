/**
 * Returns the number of starter refresh/recovery feeds needed based on
 * how many days the starter has been in the refrigerator (or unfed).
 *
 * Rules:
 *  0–3 days:   1 feed
 *  4–7 days:   1–2 feeds (returns 2 to be safe)
 *  8–14 days:  2 feeds
 *  15–30 days: 3 feeds
 *  30+ days:   4 feeds (starter needs significant recovery)
 *
 * @param {number} starterAgeDays - days since last fed / time in fridge
 * @returns {number} number of feeds needed before levain build
 */
export function feedsNeeded(starterAgeDays) {
  if (starterAgeDays <= 3)  return 1;
  if (starterAgeDays <= 7)  return 2;
  if (starterAgeDays <= 14) return 2;
  if (starterAgeDays <= 30) return 3;
  return 4;
}

/**
 * Returns a human-readable note explaining the recovery plan.
 * @param {number} starterAgeDays
 * @returns {string}
 */
export function recoveryNote(starterAgeDays) {
  const feeds = feedsNeeded(starterAgeDays);
  if (starterAgeDays <= 3) {
    return `Starter was fed ${starterAgeDays} day(s) ago — 1 refresh feed is enough to bring it to peak activity.`;
  }
  if (starterAgeDays <= 7) {
    return `Starter was in the fridge ~${starterAgeDays} days — ${feeds} refresh feeds recommended to restore activity.`;
  }
  if (starterAgeDays <= 14) {
    return `Starter has been cold for ~${starterAgeDays} days — ${feeds} refresh feeds required before levain build.`;
  }
  if (starterAgeDays <= 30) {
    return `Starter has been dormant ~${starterAgeDays} days — ${feeds} refresh feeds needed to fully revive activity.`;
  }
  return `Starter has been dormant 30+ days — ${feeds} refresh feeds required; watch for vigorous bubble activity before building levain.`;
}
