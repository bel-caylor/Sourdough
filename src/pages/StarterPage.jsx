import { useState } from 'react';
import { useStarters, addStarter, updateStarter, deleteStarter } from '../hooks/useData';
import { format, differenceInDays, differenceInHours } from 'date-fns';

const DEFAULT_FORM = {
  name: '',
  hydrationPercent: 100,
  lastFedAt: '',
  notes: '',
};

export default function StarterPage() {
  const starters = useStarters();
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editing, setEditing] = useState(null);

  const handleNew = () => {
    setEditing(null);
    setView('form');
  };

  const handleEdit = (starter) => {
    setEditing(starter);
    setView('form');
  };

  const handleDelete = async (starter) => {
    if (!confirm(`Delete "${starter.name}"? This cannot be undone.`)) return;
    await deleteStarter(starter.id);
  };

  const handleSaved = () => {
    setView('list');
    setEditing(null);
  };

  if (view === 'form') {
    return (
      <StarterForm
        initial={editing}
        onSave={handleSaved}
        onCancel={() => { setView('list'); setEditing(null); }}
      />
    );
  }

  return (
    <div style={{ animation: 'fadeUp 0.5s ease' }}>
      <div className="mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '2rem', color: 'var(--char)' }}>Starters</h2>
          <p style={{ color: 'var(--mist)', marginTop: '4px' }}>Track your sourdough starters and their feeding history.</p>
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
              onDelete={() => handleDelete(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Starter Card ───────────────────────────────────────────────────
function StarterCard({ starter, onEdit, onDelete }) {
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
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button onClick={onEdit} style={secondaryBtnStyle}>Edit</button>
          <button onClick={onDelete} style={{ ...secondaryBtnStyle, borderColor: 'var(--alert)', color: 'var(--alert)' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Starter Form ───────────────────────────────────────────────────
function StarterForm({ initial, onSave, onCancel }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() => {
    if (!initial) return { ...DEFAULT_FORM, lastFedAt: toDatetimeLocal(new Date()) };
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
