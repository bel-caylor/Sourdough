import { useState } from 'react';
import {
  useStarters, addStarter, updateStarter, deleteStarter,
  useStarterFeedings, addStarterFeeding,
} from '../hooks/useData';
import { format, differenceInDays, differenceInHours } from 'date-fns';

const DEFAULT_STARTER_FORM = {
  name: '',
  hydrationPercent: 100,
  lastFedAt: '',
  notes: '',
};

const DEFAULT_FEEDING_FORM = {
  fedAt: '',
  flourType: '',
  starterKeptGrams: '',
  discardGrams: '',
  flourGrams: '',
  waterGrams: '',
  notes: '',
};

export default function StarterPage() {
  const starters = useStarters();
  const [view, setView] = useState('list'); // 'list' | 'starter-form' | 'feeding'
  const [editing, setEditing] = useState(null);
  const [feedingTarget, setFeedingTarget] = useState(null); // starter being fed

  const handleNew = () => { setEditing(null); setView('starter-form'); };
  const handleEdit = (s) => { setEditing(s); setView('starter-form'); };
  const handleFeed = (s) => { setFeedingTarget(s); setView('feeding'); };

  const handleDelete = async (s) => {
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    await deleteStarter(s.id);
  };

  const handleBack = () => { setView('list'); setEditing(null); setFeedingTarget(null); };

  if (view === 'starter-form') {
    return (
      <StarterForm
        initial={editing}
        onSave={handleBack}
        onCancel={handleBack}
      />
    );
  }

  if (view === 'feeding') {
    return (
      <FeedingForm
        starter={feedingTarget}
        onSave={handleBack}
        onCancel={handleBack}
      />
    );
  }

  return (
    <div style={{ animation: 'fadeUp 0.5s ease' }}>
      <div className="mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '2rem', color: 'var(--char)' }}>Starters</h2>
          <p style={{ color: 'var(--mist)', marginTop: '4px' }}>Track your sourdough starters and feeding history.</p>
        </div>
        <button className="btn-primary" onClick={handleNew}>+ New Starter</button>
      </div>

      {starters === undefined ? (
        <LoadingState />
      ) : starters.length === 0 ? (
        <EmptyState onAdd={handleNew} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {starters.map(s => (
            <StarterCard
              key={s.id}
              starter={s}
              onEdit={() => handleEdit(s)}
              onFeed={() => handleFeed(s)}
              onDelete={() => handleDelete(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Starter Card ───────────────────────────────────────────────────
function StarterCard({ starter, onEdit, onFeed, onDelete }) {
  const [showHistory, setShowHistory] = useState(false);
  const feedings = useStarterFeedings(showHistory ? starter.id : null);

  const lastFed = starter.lastFedAt ? new Date(starter.lastFedAt) : null;
  const ageDays = lastFed ? differenceInDays(new Date(), lastFed) : null;
  const ageHours = lastFed ? differenceInHours(new Date(), lastFed) : null;

  const statusInfo = () => {
    if (ageHours === null) return { label: 'No feeding recorded', color: 'var(--mist)' };
    if (ageHours < 8)  return { label: 'Recently fed — active', color: 'var(--rise)' };
    if (ageHours < 24) return { label: 'Getting hungry', color: 'var(--crust)' };
    if (ageDays < 4)   return { label: `${ageDays}d in fridge — ready to use`, color: 'var(--crust)' };
    if (ageDays < 8)   return { label: `${ageDays}d in fridge — needs 1–2 refreshes`, color: '#C08030' };
    if (ageDays < 15)  return { label: `${ageDays}d in fridge — needs 2 refreshes`, color: 'var(--alert)' };
    return { label: `${ageDays}d dormant — needs full revival`, color: 'var(--alert)' };
  };

  const status = statusInfo();

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <h3 className="serif" style={{ fontSize: '1.2rem', color: 'var(--char)', marginBottom: '4px' }}>{starter.name}</h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--mist)' }}>
              {starter.hydrationPercent ?? 100}% hydration
            </span>
            {lastFed && (
              <span style={{ fontSize: '0.8rem', color: 'var(--mist)' }}>
                Last fed: {format(lastFed, 'MMM d, h:mm a')}
              </span>
            )}
          </div>
          <span style={{
            fontSize: '0.78rem', fontWeight: '500', color: status.color,
            background: status.color + '22', padding: '3px 10px', borderRadius: '999px',
          }}>
            {status.label}
          </span>
          {starter.notes && (
            <p style={{ fontSize: '0.8rem', color: 'var(--ash)', marginTop: '10px', fontStyle: 'italic' }}>
              {starter.notes}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={onFeed} className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
            Feed
          </button>
          <button onClick={onEdit} style={secondaryBtnStyle}>Edit</button>
          <button onClick={onDelete} style={{ ...secondaryBtnStyle, borderColor: 'var(--alert)', color: 'var(--alert)' }}>Delete</button>
        </div>
      </div>

      {/* Feeding history toggle */}
      <div style={{ marginTop: '14px', borderTop: '1px solid var(--crumb)', paddingTop: '12px' }}>
        <button
          onClick={() => setShowHistory(h => !h)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mist)', fontSize: '0.78rem', padding: 0 }}
        >
          {showHistory ? '▲ Hide history' : '▼ Show feeding history'}
        </button>

        {showHistory && (
          <FeedingHistory feedings={feedings} />
        )}
      </div>
    </div>
  );
}

// ── Feeding History ────────────────────────────────────────────────
function FeedingHistory({ feedings }) {
  if (feedings === undefined) {
    return <p style={{ color: 'var(--mist)', fontSize: '0.8rem', marginTop: '10px', fontStyle: 'italic' }}>Loading…</p>;
  }
  if (feedings.length === 0) {
    return <p style={{ color: 'var(--mist)', fontSize: '0.8rem', marginTop: '10px', fontStyle: 'italic' }}>No feedings recorded yet.</p>;
  }

  return (
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {feedings.map(f => {
        const total = (Number(f.starterKeptGrams) || 0) + (Number(f.flourGrams) || 0) + (Number(f.waterGrams) || 0);
        const hydration = f.flourGrams > 0 ? Math.round((f.waterGrams / f.flourGrams) * 100) : null;

        return (
          <div key={f.id} style={{
            background: 'var(--cream)', borderRadius: '8px', padding: '10px 14px',
            fontSize: '0.8rem', color: 'var(--ash)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: '500', color: 'var(--char)' }}>
                {format(new Date(f.fedAt), 'MMM d, h:mm a')}
              </span>
              {f.flourType && (
                <span style={{ color: 'var(--mist)' }}>{f.flourType}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {f.starterKeptGrams > 0 && <span>Kept {f.starterKeptGrams}g</span>}
              {f.discardGrams > 0 && <span style={{ color: 'var(--mist)' }}>Discarded {f.discardGrams}g</span>}
              {f.flourGrams > 0 && <span>+ {f.flourGrams}g flour</span>}
              {f.waterGrams > 0 && <span>+ {f.waterGrams}g water</span>}
              {total > 0 && <span style={{ color: 'var(--crust)', fontWeight: '500' }}>= {total}g total</span>}
              {hydration !== null && <span style={{ color: 'var(--mist)' }}>{hydration}% hydration</span>}
            </div>
            {f.notes && (
              <p style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--mist)' }}>{f.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Feeding Form ───────────────────────────────────────────────────
function FeedingForm({ starter, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...DEFAULT_FEEDING_FORM,
    fedAt: toDatetimeLocal(new Date()),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const kept   = Number(form.starterKeptGrams) || 0;
  const flour  = Number(form.flourGrams) || 0;
  const water  = Number(form.waterGrams) || 0;
  const total  = kept + flour + water;
  const hydration = flour > 0 ? Math.round((water / flour) * 100) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fedAt) { setError('Feed time is required.'); return; }
    if (flour === 0 && water === 0) { setError('Enter at least flour and water amounts.'); return; }

    setSaving(true);
    setError('');
    try {
      await addStarterFeeding(starter.id, {
        fedAt: new Date(form.fedAt).toISOString(),
        flourType: form.flourType.trim(),
        starterKeptGrams: kept,
        discardGrams: Number(form.discardGrams) || 0,
        flourGrams: flour,
        waterGrams: water,
        notes: form.notes.trim(),
      });
      onSave();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ animation: 'fadeUp 0.5s ease', maxWidth: '560px' }}>
      <div className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mist)', fontSize: '0.85rem' }}>
          ← Back
        </button>
        <div>
          <h2 className="serif" style={{ fontSize: '1.5rem', color: 'var(--char)' }}>Feed Starter</h2>
          <p style={{ color: 'var(--mist)', fontSize: '0.8rem', marginTop: '2px' }}>{starter.name}</p>
        </div>
      </div>

      <form className="card" style={{ padding: '28px' }} onSubmit={handleSubmit}>

        <Field label="Feed time *" hint="When did you feed it?">
          <input
            type="datetime-local"
            value={form.fedAt}
            onChange={e => set('fedAt', e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Flour type" hint="e.g. AP flour, whole wheat, rye">
          <input
            type="text"
            value={form.flourType}
            onChange={e => set('flourType', e.target.value)}
            placeholder="e.g. all-purpose, 50% whole wheat"
            style={inputStyle}
          />
        </Field>

        {/* Gram inputs in a 2-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
          <Field label="Starter kept (g)" hint="Seed amount">
            <input
              type="number" min="0" step="1"
              value={form.starterKeptGrams}
              onChange={e => set('starterKeptGrams', e.target.value)}
              placeholder="e.g. 20"
              style={inputStyle}
            />
          </Field>

          <Field label="Discard (g)" hint="Removed before feeding">
            <input
              type="number" min="0" step="1"
              value={form.discardGrams}
              onChange={e => set('discardGrams', e.target.value)}
              placeholder="e.g. 80"
              style={inputStyle}
            />
          </Field>

          <Field label="Flour added (g) *">
            <input
              type="number" min="0" step="1"
              value={form.flourGrams}
              onChange={e => set('flourGrams', e.target.value)}
              placeholder="e.g. 50"
              style={inputStyle}
            />
          </Field>

          <Field label="Water added (g) *">
            <input
              type="number" min="0" step="1"
              value={form.waterGrams}
              onChange={e => set('waterGrams', e.target.value)}
              placeholder="e.g. 50"
              style={inputStyle}
            />
          </Field>
        </div>

        {/* Live totals preview */}
        {total > 0 && (
          <div style={{
            background: 'var(--cream)', borderRadius: '8px', padding: '12px 16px',
            marginBottom: '18px', display: 'flex', gap: '24px', flexWrap: 'wrap',
            fontSize: '0.82rem', color: 'var(--ash)',
          }}>
            <span><strong style={{ color: 'var(--char)' }}>{total}g</strong> total in jar</span>
            {hydration !== null && (
              <span><strong style={{ color: 'var(--crust)' }}>{hydration}%</strong> hydration</span>
            )}
            {flour > 0 && kept > 0 && (
              <span style={{ color: 'var(--mist)' }}>
                {Math.round(kept / flour * 100)}% inoculation
              </span>
            )}
          </div>
        )}

        <Field label="Notes" hint="Optional — observations, texture, smell, etc.">
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            placeholder="e.g. Very active — doubled in 4 hours. Tangy smell."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        {error && <p style={{ color: 'var(--alert)', fontSize: '0.82rem', marginBottom: '16px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Log Feeding'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Starter Form ───────────────────────────────────────────────────
function StarterForm({ initial, onSave, onCancel }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() => {
    if (!initial) return { ...DEFAULT_STARTER_FORM, lastFedAt: toDatetimeLocal(new Date()) };
    return {
      name: initial.name || '',
      hydrationPercent: initial.hydrationPercent ?? 100,
      lastFedAt: initial.lastFedAt ? toDatetimeLocal(new Date(initial.lastFedAt)) : '',
      notes: initial.notes || '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Starter name is required.'); return; }
    if (!form.lastFedAt) { setError('Last fed date/time is required.'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        hydrationPercent: Number(form.hydrationPercent) || 100,
        lastFedAt: new Date(form.lastFedAt).toISOString(),
        notes: form.notes.trim(),
      };
      if (isEdit) {
        await updateStarter(initial.id, payload);
      } else {
        await addStarter(payload);
      }
      onSave();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ animation: 'fadeUp 0.5s ease', maxWidth: '560px' }}>
      <div className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mist)', fontSize: '0.85rem' }}>
          ← Back
        </button>
        <h2 className="serif" style={{ fontSize: '1.5rem', color: 'var(--char)' }}>
          {isEdit ? 'Edit Starter' : 'New Starter'}
        </h2>
      </div>

      <form className="card" style={{ padding: '28px' }} onSubmit={handleSubmit}>
        <Field label="Starter Name *">
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Rosie, My Daily Driver"
            style={inputStyle}
          />
        </Field>

        <Field label="Hydration %" hint="100 = equal weight flour and water">
          <input
            type="number"
            value={form.hydrationPercent}
            onChange={e => set('hydrationPercent', e.target.value)}
            min="50" max="200" step="5"
            style={inputStyle}
          />
        </Field>

        <Field label="Last Fed *" hint="When was this starter last fed?">
          <input
            type="datetime-local"
            value={form.lastFedAt}
            onChange={e => set('lastFedAt', e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Notes" hint="Optional — flour type, observations, etc.">
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="e.g. Fed with 50% whole wheat..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        {error && <p style={{ color: 'var(--alert)', fontSize: '0.82rem', marginBottom: '16px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Starter'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '500', color: 'var(--ash)', marginBottom: '6px' }}>
        {label}
        {hint && <span style={{ fontWeight: '400', color: 'var(--mist)', marginLeft: '6px' }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function toDatetimeLocal(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EmptyState({ onAdd }) {
  return (
    <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🫙</p>
      <p style={{ color: 'var(--ash)', marginBottom: '6px', fontWeight: '500' }}>No starters yet</p>
      <p style={{ color: 'var(--mist)', fontSize: '0.85rem', marginBottom: '20px' }}>Add your first sourdough starter to get started.</p>
      <button className="btn-primary" onClick={onAdd}>Add Starter</button>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--mist)', fontStyle: 'italic' }}>Loading…</div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--crumb)', background: 'var(--cream)',
  fontSize: '0.875rem', color: 'var(--char)', outline: 'none',
  fontFamily: 'inherit',
};

const secondaryBtnStyle = {
  padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--crumb)',
  background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--ash)',
};
