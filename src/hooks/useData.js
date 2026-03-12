import { useState, useEffect } from 'react';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, onSnapshot, query, orderBy, limit, where, writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { startOfWeek, isSameWeek } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────
function userCol(uid, name) {
  return collection(db, 'users', uid, name);
}

function userDoc(uid, colName, docId) {
  return doc(db, 'users', uid, colName, docId);
}

function getUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return uid;
}

// ── Starter Feedings ──────────────────────────────────────────────
export function useRecentFeedings(n = 10) {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    const q = query(userCol(user.uid, 'feedings'), orderBy('date', 'desc'), limit(n));
    return onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  }, [user?.uid, n]);

  return data;
}

export async function logFeeding(data) {
  const uid = getUid();
  const date = new Date().toISOString();
  await addDoc(userCol(uid, 'feedings'), { ...data, date });
  await setDoc(doc(db, 'users', uid, 'settings', 'reminder'), { lastFed: date }, { merge: true });
}

// ── Starter Health ────────────────────────────────────────────────
export function useStarterHealth() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    const q = query(userCol(user.uid, 'starterHealth'), orderBy('date', 'desc'), limit(5));
    return onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  }, [user?.uid]);

  return data;
}

export async function logStarterHealth(data) {
  const uid = getUid();
  return addDoc(userCol(uid, 'starterHealth'), { ...data, date: new Date().toISOString() });
}

// ── Weekly Goals ──────────────────────────────────────────────────
export function useWeeklyGoals() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    return onSnapshot(userCol(user.uid, 'weeklyGoals'), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setData(all.filter(g => g.weekStart && isSameWeek(new Date(g.weekStart), new Date(), { weekStartsOn: 1 })));
    }, () => setData([]));
  }, [user?.uid]);

  return data;
}

export function useAllGoals() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    const q = query(userCol(user.uid, 'weeklyGoals'), orderBy('weekStart', 'desc'));
    return onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  }, [user?.uid]);

  return data;
}

export function useUpcomingGoals(days = 14) {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    return onSnapshot(userCol(user.uid, 'weeklyGoals'), snap => {
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(g => {
          if (!g.targetDate || g.status === 'complete' || g.status === 'skipped') return false;
          const d = new Date(g.targetDate);
          return d >= now && d <= future;
        })
        .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
      setData(filtered);
    }, () => setData([]));
  }, [user?.uid, days]);

  return data;
}

export async function addGoal(data) {
  const uid = getUid();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  return addDoc(userCol(uid, 'weeklyGoals'), { ...data, weekStart, status: 'planned' });
}

export async function updateGoalStatus(id, status) {
  const uid = getUid();
  return updateDoc(userDoc(uid, 'weeklyGoals', id), { status });
}

export async function deleteGoal(id) {
  const uid = getUid();
  return deleteDoc(userDoc(uid, 'weeklyGoals', id));
}

// ── Recipes ───────────────────────────────────────────────────────
export function useRecipes() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    const q = query(userCol(user.uid, 'recipes'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  }, [user?.uid]);

  return data;
}

export function useRecipe(id) {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user || !id) { setData(null); return; }
    return onSnapshot(userDoc(user.uid, 'recipes', id), snap => {
      setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [user?.uid, id]);

  return data;
}

export async function addRecipe(data) {
  const uid = getUid();
  return addDoc(userCol(uid, 'recipes'), { ...data, createdAt: new Date().toISOString() });
}

export async function updateRecipe(id, data) {
  const uid = getUid();
  return updateDoc(userDoc(uid, 'recipes', id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteRecipe(id) {
  const uid = getUid();
  const notesSnap = await getDocs(query(userCol(uid, 'bakeNotes'), where('recipeId', '==', id)));
  const batch = writeBatch(db);
  notesSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(userDoc(uid, 'recipes', id));
  return batch.commit();
}

// ── Bake Notes (per recipe) ───────────────────────────────────────
export function useBakeNotes(recipeId) {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user || !recipeId) { setData([]); return; }
    const q = query(userCol(user.uid, 'bakeNotes'), where('recipeId', '==', recipeId));
    return onSnapshot(q, snap => {
      const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setData(notes.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    }, () => setData([]));
  }, [user?.uid, recipeId]);

  return data;
}

export async function addBakeNote(data) {
  const uid = getUid();
  return addDoc(userCol(uid, 'bakeNotes'), { ...data, date: new Date().toISOString() });
}

export async function deleteBakeNote(id) {
  const uid = getUid();
  return deleteDoc(userDoc(uid, 'bakeNotes', id));
}

// ── Baking Sessions ───────────────────────────────────────────────
export function useBakingSessions() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    const q = query(userCol(user.uid, 'bakingSessions'), orderBy('startDate', 'desc'));
    return onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  }, [user?.uid]);

  return data;
}

export async function createBakingSession(data) {
  const uid = getUid();
  const stages = data.stages || getDefaultStages();
  return addDoc(userCol(uid, 'bakingSessions'), {
    ...data,
    startDate: new Date().toISOString(),
    stage: 0,
    stages,
  });
}

export async function advanceStage(id) {
  const uid = getUid();
  const ref = userDoc(uid, 'bakingSessions', id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const session = snap.data();
    if (session.stage < session.stages.length - 1) {
      return updateDoc(ref, { stage: session.stage + 1 });
    }
  }
}

export async function completeSession(id, rating, outcome, notes) {
  const uid = getUid();
  return updateDoc(userDoc(uid, 'bakingSessions', id), { stage: -1, rating, outcome, notes });
}

// ── Reminder Settings ─────────────────────────────────────────────
export function useReminderSettings() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData(null); return; }
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'reminder'), snap => {
      setData(snap.exists() ? snap.data() : { feedingIntervalHours: 12, lastFed: null });
    });
  }, [user?.uid]);

  return data;
}

export async function updateReminderSettings(data) {
  const uid = getUid();
  return setDoc(doc(db, 'users', uid, 'settings', 'reminder'), data, { merge: true });
}

// ── App Settings ──────────────────────────────────────────────────
export function useAppSettings() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData(null); return; }
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'app'), snap => {
      setData(snap.exists() ? snap.data() : { anthropicKey: '', openaiKey: '' });
    });
  }, [user?.uid]);

  return data;
}

export async function updateAppSettings(data) {
  const uid = getUid();
  return setDoc(doc(db, 'users', uid, 'settings', 'app'), data, { merge: true });
}

// ── Starters ──────────────────────────────────────────────────────
export function useStarters() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    const q = query(userCol(user.uid, 'starters'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  }, [user?.uid]);

  return data;
}

export async function addStarter(data) {
  const uid = getUid();
  return addDoc(userCol(uid, 'starters'), { ...data, createdAt: new Date().toISOString() });
}

export async function updateStarter(id, data) {
  const uid = getUid();
  return updateDoc(userDoc(uid, 'starters', id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteStarter(id) {
  const uid = getUid();
  return deleteDoc(userDoc(uid, 'starters', id));
}

// ── Starter Feedings ──────────────────────────────────────────────
export function useStarterFeedings(starterId) {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user || !starterId) { setData([]); return; }
    const q = query(
      collection(db, 'users', user.uid, 'starters', starterId, 'feedings'),
      orderBy('fedAt', 'desc'),
      limit(20)
    );
    return onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  }, [user?.uid, starterId]);

  return data;
}

export async function addStarterFeeding(starterId, data) {
  const uid = getUid();
  await addDoc(
    collection(db, 'users', uid, 'starters', starterId, 'feedings'),
    { ...data, createdAt: new Date().toISOString() }
  );
  // Stamp the parent starter so lastFedAt stays fresh
  await updateDoc(userDoc(uid, 'starters', starterId), {
    lastFedAt: data.fedAt,
    updatedAt: new Date().toISOString(),
  });
}

// ── Bake Plans ────────────────────────────────────────────────────
export function useBakePlans() {
  const { user } = useAuth();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!user) { setData([]); return; }
    const q = query(userCol(user.uid, 'bakePlans'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  }, [user?.uid]);

  return data;
}

export async function addBakePlan(data) {
  const uid = getUid();
  return addDoc(userCol(uid, 'bakePlans'), { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function updateBakePlan(id, data) {
  const uid = getUid();
  return updateDoc(userDoc(uid, 'bakePlans', id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteBakePlan(id) {
  const uid = getUid();
  return deleteDoc(userDoc(uid, 'bakePlans', id));
}

// ── Default Stages ────────────────────────────────────────────────
function getDefaultStages() {
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
