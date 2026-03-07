import Dexie from 'dexie';

export const db = new Dexie('LevainDB');

db.version(1).stores({
  feedings: '++id, date, flourType, flourGrams, waterGrams, starterGrams, notes, riseHeight, riseTime, temp',
  weeklyGoals: '++id, weekStart, recipeName, targetDate, status, notes',
  bakingSessions: '++id, goalId, recipeName, startDate, stage, stages, notes, rating, outcome',
  starterHealth: '++id, date, floatTest, smell, color, risePercent, notes',
  reminderSettings: '++id, feedingIntervalHours, lastFed, notificationsEnabled',
});

db.version(2).stores({
  feedings: '++id, date, flourType, flourGrams, waterGrams, starterGrams, notes, riseHeight, riseTime, temp',
  weeklyGoals: '++id, weekStart, recipeName, recipeId, targetDate, status, notes',
  bakingSessions: '++id, goalId, recipeName, startDate, stage, stages, notes, rating, outcome',
  starterHealth: '++id, date, floatTest, smell, color, risePercent, notes',
  reminderSettings: '++id, feedingIntervalHours, lastFed, notificationsEnabled',
  // Recipe library
  recipes: '++id, name, style, createdAt',
  // Per-recipe bake notes
  bakeNotes: '++id, recipeId, date',
  // App-level settings (API key, etc.)
  appSettings: '++id',
});

db.on('ready', async () => {
  const count = await db.reminderSettings.count();
  if (count === 0) {
    await db.reminderSettings.add({
      feedingIntervalHours: 12,
      lastFed: null,
      notificationsEnabled: false,
    });
  }
  const settingsCount = await db.appSettings.count();
  if (settingsCount === 0) {
    await db.appSettings.add({ anthropicKey: '', openaiKey: '' });
  }
});

export default db;
