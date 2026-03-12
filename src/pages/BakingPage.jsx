import { useState } from 'react';
import { useBakePlans, updateBakePlan, deleteBakePlan } from '../hooks/useData';
import { ScheduleTimeline } from './GoalsPage.jsx';
import { STEP_LABELS } from '../planner/constants.js';
import { format, isFuture } from 'date-fns';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  active:   { label: 'Active',    color: 'var(--rise)',  bg: 'var(--rise-light)' },
  draft:    { label: 'Draft',     color: 'var(--mist)',  bg: 'var(--cream)' },
  complete: { label: 'Complete',  color: '#5563A8',      bg: '#EEF0F8' },
};

export default function BakingPage() {
  const plans = useBakePlans();
  const [selected, setSelected] = useState(null);

  const handleDelete = async (plan) => {
    if (!confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
    await deleteBakePlan(plan.id);
    if (selected?.id === plan.id) setSelected(null);
  };

  const handleStatusChange = async (plan, status) => {
    await updateBakePlan(plan.id, { status });
    if (selected?.id === plan.id) setSelected(p => ({ ...p, status }));
  };

  if (selected) {
    return (
      <PlanDetail
        plan={selected}
        onBack={() => setSelected(null)}
        onDelete={() => handleDelete(selected)}
        onStatusChange={(s) => handleStatusChange(selected, s)}
      />
    );
  }

  return (
    <div style={{ animation: 'fadeUp 0.5s ease' }}>
      <div className="mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '2rem', color: 'var(--char)' }}>Bake Plans</h2>
          <p style={{ color: 'var(--mist)', marginTop: '4px' }}>Your saved baking schedules.</p>
        </div>
        <Link to="/goals">
          <button className="btn-primary">+ Plan a Bake</button>
        </Link>
      </div>

      {plans === undefined ? (
        <LoadingState />
      ) : plans.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Active plans first */}
          {plans.filter(p => p.status === 'active').length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <SectionHeader>Active Plans</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {plans.filter(p => p.status === 'active').map(p => (
                  <PlanCard key={p.id} plan={p} onSelect={() => setSelected(p)} onDelete={() => handleDelete(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Draft plans */}
          {plans.filter(p => p.status === 'draft').length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <SectionHeader>Drafts</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {plans.filter(p => p.status === 'draft').map(p => (
                  <PlanCard key={p.id} plan={p} onSelect={() => setSelected(p)} onDelete={() => handleDelete(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Complete plans */}
          {plans.filter(p => p.status === 'complete').length > 0 && (
            <div>
              <SectionHeader>Completed</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {plans.filter(p => p.status === 'complete').map(p => (
                  <PlanCard key={p.id} plan={p} onSelect={() => setSelected(p)} onDelete={() => handleDelete(p)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Plan Card ──────────────────────────────────────────────────────
function PlanCard({ plan, onSelect, onDelete }) {
  const statusStyle = STATUS_STYLES[plan.status] || STATUS_STYLES.draft;
  const bakeAt = plan.targetBakeAt ? new Date(plan.targetBakeAt) : null;

  // Find next upcoming step
  const nextStep = plan.generatedSchedule?.find(s => isFuture(new Date(s.plannedAt)));

  return (
    <div
      className="card"
      style={{ padding: '18px 22px', cursor: 'pointer' }}
      onClick={onSelect}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <h3 className="serif" style={{ fontSize: '1.1rem', color: 'var(--char)' }}>{plan.title}</h3>
            <span style={{
              fontSize: '0.7rem', fontWeight: '600', padding: '2px 8px', borderRadius: '999px',
              color: statusStyle.color, background: statusStyle.bg,
            }}>
              {statusStyle.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '6px' }}>
            {bakeAt && (
              <span style={{ fontSize: '0.8rem', color: 'var(--mist)' }}>
                Bake: {format(bakeAt, 'EEE, MMM d · h:mm a')}
              </span>
            )}
            {plan.starterName && (
              <span style={{ fontSize: '0.8rem', color: 'var(--mist)' }}>Starter: {plan.starterName}</span>
            )}
            {plan.totalStarterNeeded && (
              <span style={{ fontSize: '0.8rem', color: 'var(--mist)' }}>{plan.totalStarterNeeded}g starter</span>
            )}
          </div>
          {nextStep && (
            <p style={{ fontSize: '0.78rem', color: 'var(--crust)', fontWeight: '500' }}>
              Next: {STEP_LABEL(nextStep.stepType)} at {format(new Date(nextStep.plannedAt), 'EEE h:mm a')}
            </p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--crumb)', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--mist)', flexShrink: 0 }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Plan Detail ───────────────────────────────────────────────────
function PlanDetail({ plan, onBack, onDelete, onStatusChange }) {
  const statusStyle = STATUS_STYLES[plan.status] || STATUS_STYLES.draft;
  const bakeAt = plan.targetBakeAt ? new Date(plan.targetBakeAt) : null;

  return (
    <div style={{ animation: 'fadeUp 0.5s ease', maxWidth: '680px' }}>
      <div className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mist)', fontSize: '0.85rem' }}>
          ← Bake Plans
        </button>
      </div>

      <div className="mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '1.6rem', color: 'var(--char)' }}>{plan.title}</h2>
          {bakeAt && <p style={{ color: 'var(--mist)', fontSize: '0.875rem', marginTop: '2px' }}>Bake: {format(bakeAt, 'EEEE, MMMM d · h:mm a')}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '3px 10px', borderRadius: '999px', color: statusStyle.color, background: statusStyle.bg }}>
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {plan.starterName && <Chip label="Starter" value={plan.starterName} />}
        {plan.starterAgeDays !== undefined && <Chip label="Starter age" value={`${plan.starterAgeDays}d`} />}
        {plan.totalStarterNeeded && <Chip label="Starter needed" value={`${plan.totalStarterNeeded}g`} />}
        {plan.roomTempDay && <Chip label="Day temp" value={`${plan.roomTempDay}°F`} />}
        {plan.roomTempNight && <Chip label="Night temp" value={`${plan.roomTempNight}°F`} />}
      </div>

      {/* Schedule */}
      {plan.generatedSchedule?.length > 0 && (
        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '18px' }}>Schedule</h3>
          <ScheduleTimeline steps={plan.generatedSchedule} />
        </div>
      )}

      {/* Assumptions */}
      {plan.assumptions?.length > 0 && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Assumptions & Estimates
          </h3>
          <ul style={{ paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {plan.assumptions.map((a, i) => (
              <li key={i} style={{ fontSize: '0.82rem', color: 'var(--ash)', display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--mist)', flexShrink: 0 }}>—</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {plan.status !== 'active' && (
          <button onClick={() => onStatusChange('active')} style={secondaryBtnStyle}>Mark Active</button>
        )}
        {plan.status !== 'complete' && (
          <button onClick={() => onStatusChange('complete')} style={secondaryBtnStyle}>Mark Complete</button>
        )}
        {plan.status !== 'draft' && (
          <button onClick={() => onStatusChange('draft')} style={secondaryBtnStyle}>Move to Draft</button>
        )}
        <button onClick={onDelete} style={{ ...secondaryBtnStyle, borderColor: 'var(--alert)', color: 'var(--alert)' }}>Delete Plan</button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function STEP_LABEL(stepType) {
  return STEP_LABELS[stepType]?.label || stepType;
}

function Chip({ label, value }) {
  return (
    <div style={{ fontSize: '0.8rem', color: 'var(--ash)', background: 'var(--warm-white)', border: '1px solid var(--crumb)', borderRadius: '8px', padding: '4px 12px' }}>
      <span style={{ color: 'var(--mist)' }}>{label}: </span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <p style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
      {children}
    </p>
  );
}

function EmptyState() {
  return (
    <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: '2rem', marginBottom: '12px' }}>◈</p>
      <p style={{ color: 'var(--ash)', marginBottom: '6px', fontWeight: '500' }}>No bake plans yet</p>
      <p style={{ color: 'var(--mist)', fontSize: '0.85rem', marginBottom: '20px' }}>Create your first bake plan to generate a schedule.</p>
      <Link to="/goals">
        <button className="btn-primary">Plan a Bake</button>
      </Link>
    </div>
  );
}

function LoadingState() {
  return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--mist)', fontStyle: 'italic' }}>Loading…</div>;
}

const secondaryBtnStyle = {
  padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--crumb)',
  background: 'transparent', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--ash)',
};
