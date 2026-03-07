import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { startOfWeek, endOfWeek } from 'date-fns';

// ── Starter Feedings ──────────────────────────────────────────────
export function useRecentFeedings(limit = 10) {
  return useLiveQuery(() =>
    db.feedings.orderBy('date').reverse().limit(limit).toArray()
  , [limit]);
}

export async function logFeeding(data) {
  const id = await db.feedings.add({ ...data, date: new Date().toISOString() });
  // Update lastFed in reminder settings
  const setting = await db.reminderSettings.toCollection().first();
  if (setting) {
    await db.reminderSettings.update(setting.id, { lastFed: new Date().toISOString() });
  }
  return id;
}

// ── Starter Health ────────────────────────────────────────────────
export function useStarterHealth() {
  return useLiveQuery(() =>
    db.starterHealth.orderBy('date').reverse().limit(5).toArray()
  );
}

export async function logStarterHealth(data) {
  return db.starterHealth.add({ ...data, date: new Date().toISOString() });
}

// ── Weekly Goals ──────────────────────────────────────────────────
export function useWeeklyGoals() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  return useLiveQuery(() =>
    db.weeklyGoals
      .where('weekStart')
      .between(weekStart, weekEnd, true, true)
      .toArray()
      .catch(() => db.weeklyGoals.toArray())
  , [weekStart]);
}

export function useAllGoals() {
  return useLiveQuery(() => db.weeklyGoals.orderBy('weekStart').reverse().toArray());
}

export async function addGoal(data) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  return db.weeklyGoals.add({ ...data, weekStart, status: 'planned' });
}

export async function updateGoalStatus(id, status) {
  return db.weeklyGoals.update(id, { status });
}

export async function deleteGoal(id) {
  return db.weeklyGoals.delete(id);
}

// ── Baking Sessions ───────────────────────────────────────────────
export function useBakingSessions() {
  return useLiveQuery(() =>
    db.bakingSessions.orderBy('startDate').reverse().toArray()
  );
}

export function useBakingSession(id) {
  return useLiveQuery(() => id ? db.bakingSessions.get(id) : null, [id]);
}

export async function createBakingSession(data) {
  return db.bakingSessions.add({
    ...data,
    startDate: new Date().toISOString(),
    stage: 0,
    stages: getDefaultStages(data.recipeName),
  });
}

export async function advanceStage(id) {
  const session = await db.bakingSessions.get(id);
  if (session && session.stage < session.stages.length - 1) {
    return db.bakingSessions.update(id, { stage: session.stage + 1 });
  }
}

export async function completeSession(id, rating, outcome, notes) {
  return db.bakingSessions.update(id, {
    stage: -1, // -1 means complete
    rating,
    outcome,
    notes,
  });
}

// ── Reminders ─────────────────────────────────────────────────────
export function useReminderSettings() {
  return useLiveQuery(() => db.reminderSettings.toCollection().first());
}

export async function updateReminderSettings(data) {
  const setting = await db.reminderSettings.toCollection().first();
  if (setting) {
    return db.reminderSettings.update(setting.id, data);
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function getDefaultStages(recipeName) {
  // Default sourdough bread stages
  return [
    { name: 'Levain Build', description: 'Mix 20g starter + 20g flour + 20g water. Wait 4–6hrs until doubled.', duration: '4–6 hours' },
    { name: 'Autolyse', description: 'Mix flour and water. Rest 30–60 minutes for gluten development.', duration: '30–60 min' },
    { name: 'Mix & Incorporate Levain', description: 'Add levain and salt to dough. Mix until fully incorporated.', duration: '15 min' },
    { name: 'Bulk Fermentation', description: 'Stretch & fold every 30 min for first 2 hours. Then rest.', duration: '4–6 hours' },
    { name: 'Shape', description: 'Pre-shape, bench rest 20 min, then final shape.', duration: '30 min' },
    { name: 'Cold Proof', description: 'Place in banneton, cover, refrigerate overnight.', duration: '8–16 hours' },
    { name: 'Bake', description: 'Preheat Dutch oven at 500°F (260°C). Score and bake 20 min covered, 20–25 min uncovered.', duration: '45 min' },
    { name: 'Cool', description: 'Cool on wire rack at least 1 hour before cutting.', duration: '1–2 hours' },
  ];
}
