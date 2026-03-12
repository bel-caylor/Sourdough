import { STEP_LABELS } from '../planner/constants.js';

// Module-level map: planId → array of timeout IDs
const scheduled = new Map();

export function notificationsSupported() {
  return 'Notification' in window;
}

export async function requestPermission() {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function permissionState() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Schedule browser notifications for all upcoming, incomplete steps in a plan.
 * Fires once at each step's plannedAt time.
 * Returns the number of steps scheduled.
 */
export function scheduleNotifications(plan) {
  cancelNotifications(plan.id);

  if (!notificationsSupported() || Notification.permission !== 'granted') return 0;

  const now = Date.now();
  const ids = [];
  let count = 0;

  for (const step of plan.generatedSchedule || []) {
    if (step.completedAt) continue;

    const stepTime = new Date(step.plannedAt).getTime();
    const delay = stepTime - now;
    if (delay < 0) continue; // already past

    const info = STEP_LABELS[step.stepType] || { label: step.stepType };
    const title = `${info.label} — ${plan.title}`;
    const body = step.notes
      ? step.notes.slice(0, 120) + (step.notes.length > 120 ? '…' : '')
      : 'Time for the next bake step.';

    const id = setTimeout(() => {
      new Notification(title, { body, icon: '/favicon.svg', tag: `${plan.id}-${step.stepType}` });
    }, delay);

    ids.push(id);
    count++;
  }

  scheduled.set(plan.id, ids);
  return count;
}

export function cancelNotifications(planId) {
  const ids = scheduled.get(planId) || [];
  ids.forEach(clearTimeout);
  scheduled.delete(planId);
}

export function isScheduled(planId) {
  return scheduled.has(planId) && scheduled.get(planId).length > 0;
}
