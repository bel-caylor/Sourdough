import Dexie from 'dexie';

export const db = new Dexie('LevainDB');

db.version(1).stores({
  // Starter feeding log
  feedings: '++id, date, flourType, flourGrams, waterGrams, starterGrams, notes, riseHeight, riseTime, temp',
  
  // Weekly baking goals
  weeklyGoals: '++id, weekStart, recipeName, targetDate, status, notes',
  
  // Full baking sessions (process tracking)
  bakingSessions: '++id, goalId, recipeName, startDate, stage, stages, notes, rating, outcome',
  
  // Starter health snapshots
  starterHealth: '++id, date, floatTest, smell, color, risePercent, notes',

  // Reminder settings
  reminderSettings: '++id, feedingIntervalHours, lastFed, notificationsEnabled',
});

// Seed default reminder settings if empty
db.on('ready', async () => {
  const count = await db.reminderSettings.count();
  if (count === 0) {
    await db.reminderSettings.add({
      feedingIntervalHours: 12,
      lastFed: null,
      notificationsEnabled: false,
    });
  }
});

export default db;
