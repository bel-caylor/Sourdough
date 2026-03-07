import { Link } from 'react-router-dom';
import { useRecentFeedings, useWeeklyGoals, useBakingSessions, useUpcomingGoals, useRecipes } from '../hooks/useData';
import { format, parseISO, differenceInHours, isToday, isTomorrow } from 'date-fns';

export default function Dashboard() {
  const feedings = useRecentFeedings(3);
  const goals = useWeeklyGoals();
  const sessions = useBakingSessions();
  const upcomingGoals = useUpcomingGoals(14);
  const recipes = useRecipes();

  const lastFed = feedings?.[0];
  const hoursSinceFed = lastFed
    ? differenceInHours(new Date(), parseISO(lastFed.date))
    : null;

  const starterStatus = () => {
    if (hoursSinceFed === null) return { label: 'Not yet tracked', color: 'var(--mist)', icon: '?' };
    if (hoursSinceFed < 8) return { label: 'Recently fed — happy & active', color: 'var(--rise)', icon: '↑' };
    if (hoursSinceFed < 14) return { label: 'Getting hungry soon', color: 'var(--crust)', icon: '~' };
    return { label: 'Needs feeding now', color: 'var(--alert)', icon: '!' };
  };

  const status = starterStatus();
  const activeSessions = sessions?.filter(s => s.stage !== -1) || [];
  const completedGoals = goals?.filter(g => g.status === 'complete').length || 0;
  const totalGoals = goals?.length || 0;

  const timeline = buildTimeline(upcomingGoals, recipes);

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

      {/* Status cards */}
      <div className="responsive-grid-3">
        <StatCard
          label="Starter Status"
          value={status.label}
          sub={lastFed ? `Last fed ${hoursSinceFed}h ago` : 'No feedings logged yet'}
          accent={status.color}
          icon={status.icon}
        />
        <StatCard
          label="This Week's Goals"
          value={`${completedGoals} / ${totalGoals}`}
          sub={totalGoals === 0 ? 'No goals set yet' : `${totalGoals - completedGoals} remaining`}
          accent="var(--crust)"
          icon="◎"
        />
        <StatCard
          label="Active Bakes"
          value={activeSessions.length}
          sub={activeSessions.length === 0 ? 'Nothing in progress' : activeSessions.map(s => s.recipeName).join(', ')}
          accent="var(--rise)"
          icon="◈"
        />
      </div>

      {/* Daily Timeline */}
      {timeline.length > 0 && (
        <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 className="serif" style={{ fontSize: '1.1rem' }}>Starter & Bake Timeline</h3>
            <Link to="/goals" style={{ fontSize: '0.8rem', color: 'var(--crust)', textDecoration: 'none' }}>
              Manage goals →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {timeline.map((task, i) => (
              <TimelineItem key={i} task={task} isLast={i === timeline.length - 1} />
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--mist)', marginTop: '14px', fontStyle: 'italic' }}>
            Feeding times assume 8-hour starter activity window. Levain build starts 12 hours before bake day.
          </p>
        </div>
      )}

      <div className="responsive-grid-2">
        {/* Recent feedings */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="serif" style={{ fontSize: '1.1rem' }}>Recent Feedings</h3>
            <Link to="/starter" style={{ fontSize: '0.8rem', color: 'var(--crust)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          {feedings?.length === 0 ? (
            <EmptyState message="No feedings logged yet" cta="Log first feeding" to="/starter" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {feedings?.map(f => (
                <div key={f.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: '10px', background: 'var(--cream)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                      {f.flourGrams}g flour · {f.waterGrams}g water · {f.starterGrams}g starter
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--mist)', marginTop: '2px' }}>
                      {f.flourType}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--mist)', textAlign: 'right' }}>
                    {format(parseISO(f.date), 'MMM d, h:mma')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly goals */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="serif" style={{ fontSize: '1.1rem' }}>This Week's Bakes</h3>
            <Link to="/goals" style={{ fontSize: '0.8rem', color: 'var(--crust)', textDecoration: 'none' }}>
              Manage →
            </Link>
          </div>
          {goals?.length === 0 ? (
            <EmptyState message="No baking goals this week" cta="Set a goal" to="/goals" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {goals?.map(g => (
                <GoalRow key={g.id} goal={g} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────
function buildTimeline(upcomingGoals, recipes) {
  if (!upcomingGoals?.length) return [];

  const tasks = [];

  for (const goal of upcomingGoals) {
    if (!goal.targetDate) continue;

    const bakeDay = new Date(goal.targetDate);
    bakeDay.setHours(8, 0, 0, 0); // Assume bake starts at 8am

    const recipe = recipes?.find(r => r.id === goal.recipeId);
    const starterNeeded = recipe?.starterAmount || 20;

    // Levain build: evening before bake day (bakeDay minus 12 hours)
    const levainTime = new Date(bakeDay.getTime() - 12 * 60 * 60 * 1000);
    // Feed starter: 8 hours before levain build
    const feedTime = new Date(levainTime.getTime() - 8 * 60 * 60 * 1000);

    const now = new Date();

    if (feedTime > now) {
      tasks.push({
        date: feedTime,
        type: 'feed',
        goal: goal.recipeName,
        detail: `Feed starter so it's active for the levain build`,
        amount: null,
      });
    }

    if (levainTime > now) {
      tasks.push({
        date: levainTime,
        type: 'levain',
        goal: goal.recipeName,
        detail: `Build levain: ${starterNeeded}g starter + ${starterNeeded}g flour + ${starterNeeded}g water`,
        amount: starterNeeded,
      });
    }

    tasks.push({
      date: bakeDay,
      type: 'bake',
      goal: goal.recipeName,
      detail: recipe ? `Follow the "${recipe.name}" recipe stages` : `Start your bake`,
      amount: null,
    });
  }

  return tasks
    .sort((a, b) => a.date - b.date)
    .slice(0, 10); // Show next 10 tasks max
}

const TASK_STYLES = {
  feed: { color: 'var(--crust)', bg: '#FFF3E8', icon: '○', label: 'Feed Starter' },
  levain: { color: '#5563A8', bg: '#EEF0F8', icon: '◉', label: 'Build Levain' },
  bake: { color: 'var(--rise)', bg: 'var(--rise-light)', icon: '◈', label: 'Bake Day' },
};

function TimelineItem({ task, isLast }) {
  const style = TASK_STYLES[task.type];
  const dateLabel = isToday(task.date)
    ? `Today, ${format(task.date, 'h:mm a')}`
    : isTomorrow(task.date)
    ? `Tomorrow, ${format(task.date, 'h:mm a')}`
    : format(task.date, 'EEEE MMM d, h:mm a');

  const isPast = task.date < new Date();

  return (
    <div style={{ display: 'flex', gap: '14px', opacity: isPast ? 0.5 : 1 }}>
      {/* Timeline spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: style.bg, color: style.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.9rem', fontWeight: '700', flexShrink: 0,
        }}>
          {style.icon}
        </div>
        {!isLast && (
          <div style={{ width: '2px', flex: 1, minHeight: '28px', background: 'var(--crumb)', margin: '4px 0' }} />
        )}
      </div>

      {/* Content */}
      <div style={{ paddingBottom: isLast ? '0' : '20px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '600', color: style.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {style.label}
          </span>
          {isToday(task.date) && (
            <span style={{ fontSize: '0.62rem', fontWeight: '700', color: 'white', background: 'var(--alert)', padding: '1px 7px', borderRadius: '999px', letterSpacing: '0.05em' }}>
              TODAY
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--char)', marginBottom: '2px' }}>
          {task.goal}
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--ash)' }}>{task.detail}</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--mist)', marginTop: '2px' }}>{dateLabel}</p>
      </div>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </p>
        <span style={{ fontSize: '1rem', color: accent, fontWeight: '700' }}>{icon}</span>
      </div>
      <p style={{ fontSize: '1.3rem', fontWeight: '600', color: accent, margin: '8px 0 4px', fontFamily: 'Playfair Display, serif' }}>
        {value}
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--mist)' }}>{sub}</p>
    </div>
  );
}

function GoalRow({ goal }) {
  const statusColors = {
    planned: 'var(--mist)',
    'in-progress': 'var(--crust)',
    complete: 'var(--rise)',
    skipped: '#ccc',
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 14px', borderRadius: '10px', background: 'var(--cream)'
    }}>
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%',
        background: statusColors[goal.status] || 'var(--mist)', flexShrink: 0
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{goal.recipeName}</div>
        {goal.targetDate && (
          <div style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
            Target: {format(parseISO(goal.targetDate), 'EEEE, MMM d')}
          </div>
        )}
      </div>
      <span style={{
        fontSize: '0.7rem', fontWeight: '500', color: statusColors[goal.status],
        textTransform: 'capitalize', letterSpacing: '0.04em'
      }}>
        {goal.status}
      </span>
    </div>
  );
}

function EmptyState({ message, cta, to }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--mist)' }}>
      <p style={{ fontSize: '0.875rem', marginBottom: '10px' }}>{message}</p>
      <Link to={to} style={{
        fontSize: '0.8rem', color: 'var(--crust)', fontWeight: '500', textDecoration: 'none',
        border: '1px solid var(--crust)', padding: '6px 14px', borderRadius: '8px'
      }}>
        {cta}
      </Link>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
