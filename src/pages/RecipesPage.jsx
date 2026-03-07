import { useBakingSessions } from '../hooks/useData';
import { format, parseISO } from 'date-fns';

const RATING_COLORS = {
  great: { range: [8, 10], color: 'var(--rise)', bg: 'var(--rise-light)', label: 'Great' },
  good: { range: [6, 7], color: 'var(--crust)', bg: '#FFF3E8', label: 'Good' },
  ok: { range: [4, 5], color: '#8C8279', bg: '#F5F0E8', label: 'Okay' },
  poor: { range: [1, 3], color: 'var(--alert)', bg: 'var(--alert-light)', label: 'Needs work' },
};

function getRatingMeta(rating) {
  for (const [, meta] of Object.entries(RATING_COLORS)) {
    if (rating >= meta.range[0] && rating <= meta.range[1]) return meta;
  }
  return { color: 'var(--mist)', bg: 'var(--cream)', label: '—' };
}

export default function RecipesPage() {
  const sessions = useBakingSessions();
  const completed = sessions?.filter(s => s.stage === -1) || [];

  // Stats
  const avg = completed.length
    ? (completed.reduce((sum, s) => sum + (s.rating || 0), 0) / completed.length).toFixed(1)
    : null;
  const best = completed.reduce((best, s) => (!best || s.rating > best.rating ? s : best), null);

  // Group by recipe name
  const byRecipe = completed.reduce((acc, s) => {
    if (!acc[s.recipeName]) acc[s.recipeName] = [];
    acc[s.recipeName].push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-8">
        <h2 className="serif" style={{ fontSize: '2rem' }}>Recipe Log</h2>
        <p style={{ color: 'var(--mist)', marginTop: '4px' }}>
          Track, rate, and learn from every bake
        </p>
      </div>

      {completed.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--mist)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>◇</div>
          <p style={{ marginBottom: '4px', fontSize: '1rem' }}>No completed bakes yet.</p>
          <p style={{ fontSize: '0.82rem' }}>Start and complete a bake in the Baking section to see your log here.</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="responsive-grid-3">
            <StatTile label="Total Bakes" value={completed.length} />
            <StatTile label="Average Rating" value={avg ? `${avg}/10` : '—'} accent="var(--crust)" />
            <StatTile label="Best Bake" value={best?.recipeName || '—'} accent="var(--rise)" sub={best?.rating ? `${best.rating}/10` : ''} />
          </div>

          {/* Grouped by recipe */}
          {Object.entries(byRecipe).map(([name, bakes]) => (
            <RecipeGroup key={name} name={name} bakes={bakes} />
          ))}
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, accent, sub }) {
  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <p style={{ fontSize: '0.72rem', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: '1.4rem', fontWeight: '700', color: accent || 'var(--char)', fontFamily: 'Playfair Display, serif', marginTop: '6px' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>{sub}</p>}
    </div>
  );
}

function RecipeGroup({ name, bakes }) {
  const avgRating = bakes.reduce((s, b) => s + (b.rating || 0), 0) / bakes.length;
  const trend = bakes.length >= 2
    ? bakes[0].rating > bakes[1].rating ? '↑ Improving'
    : bakes[0].rating < bakes[1].rating ? '↓ Check notes'
    : '→ Consistent'
    : null;

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <h3 className="serif" style={{ fontSize: '1.3rem' }}>{name}</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
          {bakes.length} bake{bakes.length !== 1 ? 's' : ''}
        </span>
        {avgRating > 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--crust)', fontWeight: '500' }}>
            avg {avgRating.toFixed(1)}/10
          </span>
        )}
        {trend && (
          <span style={{ fontSize: '0.75rem', color: 'var(--mist)', marginLeft: 'auto' }}>{trend}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {bakes.map(bake => <BakeLogCard key={bake.id} bake={bake} />)}
      </div>
    </div>
  );
}

function BakeLogCard({ bake }) {
  const meta = getRatingMeta(bake.rating);
  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
              {format(parseISO(bake.startDate), 'MMMM d, yyyy')}
            </span>
            {bake.rating && (
              <span style={{
                fontSize: '0.72rem', fontWeight: '600', padding: '2px 10px', borderRadius: '999px',
                background: meta.bg, color: meta.color,
              }}>
                {meta.label}
              </span>
            )}
          </div>

          {bake.outcome && (
            <p style={{ fontSize: '0.875rem', color: 'var(--ash)', marginBottom: '6px' }}>
              <span style={{ color: 'var(--mist)', fontSize: '0.75rem' }}>Result: </span>
              {bake.outcome}
            </p>
          )}

          {bake.notes && (
            <div style={{ background: 'var(--cream)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--mist)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Notes for next time
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--ash)', fontStyle: 'italic' }}>{bake.notes}</p>
            </div>
          )}
        </div>

        {bake.rating && (
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0, marginLeft: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            border: `2px solid ${meta.color}`,
          }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: meta.color, fontFamily: 'Playfair Display, serif' }}>
              {bake.rating}
            </span>
            <span style={{ fontSize: '0.55rem', color: meta.color }}>/ 10</span>
          </div>
        )}
      </div>
    </div>
  );
}
