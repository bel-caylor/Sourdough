import { useState, useEffect } from 'react';
import { useBakePlans, updateBakePlan, deleteBakePlan } from '../hooks/useData';
import { STEP_LABELS } from '../planner/constants.js';
import { format, isFuture } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  notificationsSupported,
  requestPermission,
  permissionState,
  scheduleNotifications,
  cancelNotifications,
  isScheduled,
} from '../lib/notifications.js';

const STATUS_STYLES = {
  active:   { label: 'Active',    color: 'var(--rise)',  bg: 'var(--rise-light)' },
  draft:    { label: 'Draft',     color: 'var(--mist)',  bg: 'var(--cream)' },
  complete: { label: 'Complete',  color: '#5563A8',      bg: '#EEF0F8' },
};

export default function BakingPage() {
  const plans = useBakePlans();
  const [selected, setSelected] = useState(null);

  // Auto-schedule notifications for active plans when the page loads
  useEffect(() => {
    if (!plans || permissionState() !== 'granted') return;
    plans.filter(p => p.status === 'active').forEach(p => {
      if (!isScheduled(p.id)) scheduleNotifications(p);
    });
  }, [plans]);

  const handleDelete = async (plan) => {
    if (!confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
    await deleteBakePlan(plan.id);
    if (selected?.id === plan.id) setSelected(null);
  };

  const handleStatusChange = async (plan, status) => {
    await updateBakePlan(plan.id, { status });
    if (selected?.id === plan.id) setSelected(p => ({ ...p, status }));
  };

  const handleScheduleChange = async (newSteps) => {
    setSelected(p => ({ ...p, generatedSchedule: newSteps }));
    await updateBakePlan(selected.id, { generatedSchedule: newSteps });
  };

  if (selected) {
    return (
      <PlanDetail
        plan={selected}
        onBack={() => setSelected(null)}
        onDelete={() => handleDelete(selected)}
        onStatusChange={(s) => handleStatusChange(selected, s)}
        onScheduleChange={handleScheduleChange}
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

// ── Notification Toggle ───────────────────────────────────────────
function NotifyToggle({ plan }) {
  const [state, setState] = useState(() => ({
    permission: permissionState(),
    on: isScheduled(plan.id),
  }));

  if (!notificationsSupported()) return null;

  const handleToggle = async () => {
    if (state.on) {
      cancelNotifications(plan.id);
      setState(s => ({ ...s, on: false }));
      return;
    }
    let perm = state.permission;
    if (perm !== 'granted') {
      const granted = await requestPermission();
      perm = granted ? 'granted' : 'denied';
      setState(s => ({ ...s, permission: perm }));
      if (!granted) return;
    }
    const count = scheduleNotifications(plan);
    setState(s => ({ ...s, on: count > 0 }));
  };

  if (state.permission === 'denied') {
    return (
      <span style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
        Notifications blocked — enable in browser settings
      </span>
    );
  }

  return (
    <button
      onClick={handleToggle}
      title={state.on ? 'Disable step notifications' : 'Enable step notifications'}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
        fontSize: '0.8rem', fontWeight: '500',
        border: `1px solid ${state.on ? 'var(--crust)' : 'var(--crumb)'}`,
        background: state.on ? 'rgba(193,127,62,0.08)' : 'transparent',
        color: state.on ? 'var(--crust)' : 'var(--mist)',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: '1rem' }}>{state.on ? '🔔' : '🔕'}</span>
      {state.on ? 'Notifications on' : 'Notify me'}
    </button>
  );
}

// ── Plan Detail ───────────────────────────────────────────────────
function PlanDetail({ plan, onBack, onDelete, onStatusChange, onScheduleChange }) {
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '3px 10px', borderRadius: '999px', color: statusStyle.color, background: statusStyle.bg }}>
            {statusStyle.label}
          </span>
          <NotifyToggle plan={plan} />
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
          <EditableScheduleTimeline steps={plan.generatedSchedule} onStepsChange={onScheduleChange} />
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

// ── Editable Schedule Timeline ────────────────────────────────────
function EditableScheduleTimeline({ steps, onStepsChange }) {
  const [editingTimeIdx, setEditingTimeIdx] = useState(null);
  const [editTimeVal, setEditTimeVal] = useState('');

  const updateStep = (i, patch) => {
    onStepsChange(steps.map((s, j) => j === i ? { ...s, ...patch } : s));
  };

  const startEditTime = (i) => {
    const dt = new Date(steps[i].plannedAt);
    const pad = n => String(n).padStart(2, '0');
    setEditTimeVal(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
    setEditingTimeIdx(i);
  };

  const commitTime = (i) => {
    if (editTimeVal) updateStep(i, { plannedAt: new Date(editTimeVal).toISOString() });
    setEditingTimeIdx(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((step, i) => {
        const info = STEP_LABELS[step.stepType] || { label: step.stepType, icon: '○', color: 'var(--mist)' };
        const isLast = i === steps.length - 1;
        const isRefrig = step.stepType === 'refrigerate_starter' || step.stepType === 'remove_from_fridge';
        const isComplete = !!step.completedAt;
        const dt = new Date(step.plannedAt);
        const inp = step.inputs || {};

        return (
          <div key={i} style={{ display: 'flex', gap: '14px', opacity: isRefrig ? 0.75 : 1 }}>
            {/* Spine */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => updateStep(i, { completedAt: isComplete ? null : new Date().toISOString() })}
                title={isComplete ? 'Mark incomplete' : 'Mark complete'}
                style={{
                  width: isRefrig ? '24px' : '32px', height: isRefrig ? '24px' : '32px',
                  borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                  marginLeft: isRefrig ? '4px' : '0',
                  background: isComplete ? info.color : info.color + '18',
                  color: isComplete ? 'white' : info.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isComplete ? '0.75rem' : (isRefrig ? '0.7rem' : '0.9rem'), fontWeight: '700',
                  transition: 'all 0.15s',
                }}
              >
                {isComplete ? '✓' : info.icon}
              </button>
              {!isLast && <div style={{ width: '2px', flex: 1, minHeight: '20px', background: 'var(--crumb)', margin: '4px 0' }} />}
            </div>

            {/* Content */}
            <div style={{ paddingBottom: isLast ? 0 : '20px', flex: 1, opacity: isComplete ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              <span style={{ fontSize: isRefrig ? '0.65rem' : '0.7rem', fontWeight: '600', color: info.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {info.label}
              </span>

              {/* Time row */}
              {editingTimeIdx === i ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: '4px 0', flexWrap: 'wrap' }}>
                  <input
                    type="datetime-local" step="1800" value={editTimeVal}
                    onChange={e => setEditTimeVal(e.target.value)}
                    autoFocus
                    style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--crumb)', background: 'var(--cream)', color: 'var(--char)', fontFamily: 'inherit' }}
                  />
                  <button onClick={() => commitTime(i)} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--crust)', color: 'white', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingTimeIdx(null)} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--crumb)', background: 'transparent', cursor: 'pointer', color: 'var(--mist)' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0' }}>
                  <p style={{ fontSize: isRefrig ? '0.78rem' : '0.82rem', fontWeight: '500', color: 'var(--char)', margin: 0 }}>
                    {format(dt, 'EEE, MMM d · h:mm a')}
                  </p>
                  <button onClick={() => startEditTime(i)} title="Edit time" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mist)', fontSize: '0.72rem', padding: '0 2px', lineHeight: 1 }}>✎</button>
                </div>
              )}

              {/* Ratio / mass info */}
              {inp.ratio && (
                <>
                  <p style={{ fontSize: '0.78rem', color: 'var(--ash)', marginTop: '2px' }}>
                    <strong>{inp.ratio}</strong> — {inp.seedStarterGrams}g seed + {inp.flourGrams}g flour + {inp.waterGrams}g water
                    {inp.expectedPeakHours && <> · peaks ~{inp.expectedPeakHours}h</>}
                  </p>
                  {inp.totalBuildGrams != null && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '3px' }}>
                      <MiniTag label="Total build" value={`${inp.totalBuildGrams}g`} />
                      <MiniTag label="Used for next step" value={`${inp.gramsUsedForNextStep}g`} accent />
                      {inp.gramsReserved > 0 && <MiniTag label="Discard/reserve" value={`${inp.gramsReserved}g`} />}
                    </div>
                  )}
                </>
              )}

              {/* Generated notes */}
              {step.notes && (
                <p style={{ fontSize: '0.75rem', color: 'var(--mist)', marginTop: '4px', fontStyle: 'italic' }}>{step.notes}</p>
              )}

              {/* User notes */}
              <UserNoteField
                value={step.userNotes || ''}
                onSave={(note) => updateStep(i, { userNotes: note })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserNoteField({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(!!value);

  useEffect(() => { setDraft(value); }, [value]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ marginTop: '5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.73rem', color: 'var(--mist)', padding: 0, display: 'block' }}>
        + Add note
      </button>
    );
  }

  return (
    <textarea
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); if (!draft.trim()) setOpen(false); }}
      placeholder="Add a note…"
      autoFocus={!value}
      rows={2}
      style={{ marginTop: '6px', width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--crumb)', background: 'var(--cream)', fontSize: '0.78rem', color: 'var(--char)', fontFamily: 'inherit', resize: 'vertical', outline: 'none', display: 'block' }}
    />
  );
}

function MiniTag({ label, value, accent }) {
  return (
    <span style={{
      fontSize: '0.7rem', color: accent ? 'var(--crust)' : 'var(--ash)',
      background: accent ? 'rgba(193,127,62,0.08)' : 'var(--cream)',
      border: `1px solid ${accent ? 'var(--crust)' : 'var(--crumb)'}`,
      borderRadius: '5px', padding: '1px 6px',
    }}>
      {label}: <strong>{value}</strong>
    </span>
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
