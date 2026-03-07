import { useState } from 'react';
import { useAllGoals, addGoal, updateGoalStatus, deleteGoal } from '../hooks/useData';
import { format, parseISO, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';

const STATUS_OPTIONS = ['planned', 'in-progress', 'complete', 'skipped'];
const STATUS_COLORS = {
  planned: { bg: '#EEF0F8', text: '#5563A8' },
  'in-progress': { bg: '#FFF3E8', text: 'var(--crust)' },
  complete: { bg: 'var(--rise-light)', text: 'var(--rise)' },
  skipped: { bg: '#F0F0F0', text: '#999' },
};

export default function GoalsPage() {
  const goals = useAllGoals();
  const [showForm, setShowForm] = useState(false);

  const thisWeekGoals = goals?.filter(g =>
    isSameWeek(parseISO(g.weekStart), new Date(), { weekStartsOn: 1 })
  ) || [];
  const pastGoals = goals?.filter(g =>
    !isSameWeek(parseISO(g.weekStart), new Date(), { weekStartsOn: 1 })
  ) || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '2rem' }}>Weekly Goals</h2>
          <p style={{ color: 'var(--mist)', marginTop: '4px' }}>
            Week of {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMMM d')}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Goal'}
        </button>
      </div>

      {showForm && <GoalForm onSave={() => setShowForm(false)} />}

      <section style={{ marginBottom: '40px' }}>
        <h3 className="serif" style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--ash)' }}>
          This Week
        </h3>
        {thisWeekGoals.length === 0 ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--mist)' }}>
            No baking goals set for this week yet. Add one above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {thisWeekGoals.map(g => <GoalCard key={g.id} goal={g} />)}
          </div>
        )}
      </section>

      {pastGoals.length > 0 && (
        <section>
          <h3 className="serif" style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--mist)' }}>
            Past Goals
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pastGoals.map(g => <GoalCard key={g.id} goal={g} compact />)}
          </div>
        </section>
      )}
    </div>
  );
}

function GoalForm({ onSave }) {
  const [form, setForm] = useState({ recipeName: '', targetDate: '', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.recipeName.trim()) return;
    await addGoal(form);
    onSave();
  };

  return (
    <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
      <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>New Baking Goal</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Recipe / Bread Name</label>
          <input
            type="text"
            value={form.recipeName}
            onChange={e => set('recipeName', e.target.value)}
            placeholder="e.g. Country Sourdough, Rye Loaf, Focaccia..."
          />
        </div>
        <div>
          <label>Target Bake Date</label>
          <input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
        </div>
        <div>
          <label>Notes</label>
          <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button className="btn-primary" onClick={handleSave}>Save Goal</button>
        <button className="btn-secondary" onClick={onSave}>Cancel</button>
      </div>
    </div>
  );
}

function GoalCard({ goal, compact }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const colors = STATUS_COLORS[goal.status] || STATUS_COLORS.planned;

  const handleDelete = async () => {
    if (confirm(`Delete "${goal.recipeName}"?`)) {
      await deleteGoal(goal.id);
    }
  };

  return (
    <div className="card" style={{ padding: compact ? '14px 18px' : '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: compact ? '0.9rem' : '1rem', fontWeight: '600', fontFamily: 'Playfair Display, serif' }}>
              {goal.recipeName}
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: '600', padding: '3px 10px', borderRadius: '999px',
              background: colors.bg, color: colors.text, textTransform: 'capitalize', letterSpacing: '0.03em',
            }}>
              {goal.status}
            </span>
          </div>
          {!compact && (
            <div style={{ fontSize: '0.78rem', color: 'var(--mist)', marginTop: '4px', display: 'flex', gap: '12px' }}>
              {goal.targetDate && <span>Target: {format(parseISO(goal.targetDate), 'EEEE, MMM d')}</span>}
              {goal.notes && <span>· {goal.notes}</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              onClick={() => setStatusOpen(!statusOpen)}>
              Update Status
            </button>
            {statusOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', background: 'white',
                borderRadius: '10px', padding: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                zIndex: 10, minWidth: '150px', border: '1px solid var(--crumb)'
              }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={async () => {
                    await updateGoalStatus(goal.id, s);
                    setStatusOpen(false);
                  }} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', background: 'none', border: 'none',
                    borderRadius: '7px', cursor: 'pointer', fontSize: '0.82rem',
                    color: goal.status === s ? 'var(--crust)' : 'var(--ash)',
                    fontWeight: goal.status === s ? '600' : '400',
                  }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleDelete} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#ccc',
            fontSize: '1rem', padding: '4px 6px', borderRadius: '6px',
          }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
