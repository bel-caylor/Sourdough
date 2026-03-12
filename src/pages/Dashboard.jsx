import { Link } from 'react-router-dom';
import { useStarters, useBakePlans } from '../hooks/useData';
import { STEP_LABELS } from '../planner/constants.js';
import { format, differenceInDays, differenceInHours, isFuture, isToday, isTomorrow } from 'date-fns';

export default function Dashboard() {
  const starters = useStarters();
  const plans = useBakePlans();

  const activePlans = plans?.filter(p => p.status === 'active') || [];

  // Find the single next action across all active plans
  const nextAction = activePlans
    .flatMap(p => (p.generatedSchedule || []).map(s => ({ ...s, planTitle: p.title })))
    .filter(s => isFuture(new Date(s.plannedAt)))
    .sort((a, b) => new Date(a.plannedAt) - new Date(b.plannedAt))[0] || null;

  const upcomingPlans = plans
    ?.filter(p => p.status === 'active' && p.targetBakeAt && isFuture(new Date(p.targetBakeAt)))
    .sort((a, b) => new Date(a.targetBakeAt) - new Date(b.targetBakeAt))
    .slice(0, 3) || [];

  return (
    <div style={{ animation: 'fadeUp 0.5s ease' }}>
      <div className="mb-8">
        <h2 className="serif" style={{ fontSize: '2rem', color: 'var(--char)' }}>
          Good {getTimeOfDay()},
        </h2>
        <p style={{ color: 'var(--mist)', marginTop: '4px' }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
      </div>

      {/* Stat cards */}
      <div className="responsive-grid-3">
        <StatCard
          label="Starters"
          value={starters?.length ?? '—'}
          sub={starters?.length === 0 ? 'Add your first starter' : `${starters?.length} starter${starters?.length === 1 ? '' : 's'} tracked`}
          accent="var(--crust)"
          icon="🫙"
          to="/starter"
        />
        <StatCard
          label="Active Plans"
          value={activePlans.length}
          sub={activePlans.length === 0 ? 'No active bake plans' : activePlans.map(p => p.title).slice(0, 2).join(', ')}
          accent="var(--rise)"
          icon="◈"
          to="/baking"
        />
        <StatCard
          label="Next Action"
          value={nextAction ? formatStepLabel(nextAction.stepType) : '—'}
          sub={nextAction ? formatRelativeTime(new Date(nextAction.plannedAt)) : 'No upcoming steps'}
          accent={nextAction ? 'var(--crust)' : 'var(--mist)'}
          icon="◎"
          to="/baking"
        />
      </div>

      {/* Next action highlight */}
      {nextAction && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: '24px', borderLeft: '4px solid var(--crust)' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Next Up
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--crust)', marginBottom: '2px' }}>
                {formatStepLabel(nextAction.stepType)}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--ash)' }}>
                {nextAction.planTitle} — {format(new Date(nextAction.plannedAt), 'EEE, MMM d · h:mm a')}
              </p>
              {nextAction.inputs?.ratio && (
                <p style={{ fontSize: '0.8rem', color: 'var(--mist)', marginTop: '4px' }}>
                  {nextAction.inputs.seedStarterGrams}g starter + {nextAction.inputs.flourGrams}g flour + {nextAction.inputs.waterGrams}g water
                </p>
              )}
            </div>
            <Link to="/baking" style={{ fontSize: '0.8rem', color: 'var(--crust)', textDecoration: 'none', flexShrink: 0 }}>
              View plan →
            </Link>
          </div>
        </div>
      )}

      <div className="responsive-grid-2">
        {/* Starters */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="serif" style={{ fontSize: '1.1rem' }}>Starters</h3>
            <Link to="/starter" style={{ fontSize: '0.8rem', color: 'var(--crust)', textDecoration: 'none' }}>
              {starters?.length ? 'Manage →' : 'Add →'}
            </Link>
          </div>
          {starters?.length === 0 ? (
            <EmptyState message="No starters yet" cta="Add a starter" to="/starter" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {starters?.slice(0, 4).map(s => <StarterRow key={s.id} starter={s} />)}
            </div>
          )}
        </div>

        {/* Upcoming bakes */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="serif" style={{ fontSize: '1.1rem' }}>Upcoming Bakes</h3>
            <Link to="/baking" style={{ fontSize: '0.8rem', color: 'var(--crust)', textDecoration: 'none' }}>
              {upcomingPlans.length ? 'View all →' : 'Plan a bake →'}
            </Link>
          </div>
          {upcomingPlans.length === 0 ? (
            <EmptyState message="No upcoming bakes" cta="Plan a bake" to="/goals" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingPlans.map(p => <PlanRow key={p.id} plan={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────
function StarterRow({ starter }) {
  const lastFed = starter.lastFedAt ? new Date(starter.lastFedAt) : null;
  const ageHours = lastFed ? differenceInHours(new Date(), lastFed) : null;
  const ageDays = lastFed ? differenceInDays(new Date(), lastFed) : null;

  const statusColor = () => {
    if (ageHours === null) return 'var(--mist)';
    if (ageHours < 8) return 'var(--rise)';
    if (ageDays < 4) return 'var(--crust)';
    if (ageDays < 8) return '#C08030';
    return 'var(--alert)';
  };

  const statusLabel = () => {
    if (ageHours === null) return 'No feeding recorded';
    if (ageHours < 8) return 'Active';
    if (ageDays < 4) return `${ageDays}d — ready`;
    if (ageDays < 8) return `${ageDays}d — needs refresh`;
    return `${ageDays}d — needs revival`;
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'var(--cream)' }}>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{starter.name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--mist)' }}>{starter.hydrationPercent ?? 100}% hydration</div>
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: '500', color: statusColor() }}>{statusLabel()}</span>
    </div>
  );
}

function PlanRow({ plan }) {
  const bakeAt = plan.targetBakeAt ? new Date(plan.targetBakeAt) : null;
  const nextStep = plan.generatedSchedule?.find(s => isFuture(new Date(s.plannedAt)));

  return (
    <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--cream)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{plan.title}</div>
        {bakeAt && (
          <div style={{ fontSize: '0.72rem', color: 'var(--mist)', textAlign: 'right' }}>
            {format(bakeAt, 'MMM d')}
          </div>
        )}
      </div>
      {nextStep && (
        <div style={{ fontSize: '0.75rem', color: 'var(--crust)', marginTop: '3px' }}>
          Next: {formatStepLabel(nextStep.stepType)} at {format(new Date(nextStep.plannedAt), 'h:mm a')}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent, icon, to }) {
  const content = (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
        <span style={{ fontSize: '1rem', color: accent }}>{icon}</span>
      </div>
      <p style={{ fontSize: '1.3rem', fontWeight: '600', color: accent, margin: '8px 0 4px', fontFamily: 'Playfair Display, serif' }}>{value}</p>
      <p style={{ fontSize: '0.78rem', color: 'var(--mist)' }}>{sub}</p>
    </div>
  );

  return to ? (
    <Link to={to} style={{ textDecoration: 'none' }}>{content}</Link>
  ) : content;
}

function EmptyState({ message, cta, to }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--mist)' }}>
      <p style={{ fontSize: '0.875rem', marginBottom: '10px' }}>{message}</p>
      <Link to={to} style={{ fontSize: '0.8rem', color: 'var(--crust)', fontWeight: '500', textDecoration: 'none', border: '1px solid var(--crust)', padding: '6px 14px', borderRadius: '8px' }}>
        {cta}
      </Link>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function formatStepLabel(stepType) {
  return STEP_LABELS[stepType]?.label || stepType;
}

function formatRelativeTime(date) {
  if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`;
  if (isTomorrow(date)) return `Tomorrow at ${format(date, 'h:mm a')}`;
  return format(date, 'EEE, MMM d · h:mm a');
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
