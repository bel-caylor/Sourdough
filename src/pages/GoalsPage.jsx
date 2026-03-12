import { useState, useMemo, useEffect, useRef } from 'react';
import { useStarters, useRecipes, addBakePlan, useStarterFeedings, useBakePlans } from '../hooks/useData';
import { generateBakePlan } from '../planner/generateBakePlan.js';
import { STEP_LABELS } from '../planner/constants.js';
import { format, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';

const DEFAULT_FORM = {
  title: '',
  starterId: '',
  targetBakeAt: '',
  mixDoughAt: '',
  shapeAt: '',
  roomTempDay: 72,
  roomTempNight: 68,
  wakeTime: '07:00',
  sleepTime: '22:00',
  selectedRecipeIds: [],
  starterAgeDaysOverride: '',
};

export default function GoalsPage() {
  const [view, setView] = useState('form'); // 'form' | 'preview'
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [preview, setPreview] = useState(null); // { steps, assumptions }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const starters = useStarters();
  const recipes = useRecipes();
  const bakePlans = useBakePlans();
  const starterFeedings = useStarterFeedings(form.starterId);

  // Pre-fill from most recent bake plan (runs once when plans first load)
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !bakePlans?.length) return;
    seeded.current = true;
    const last = bakePlans[0];

    // Date = 2 days from now; time = same time as last plan's bake
    let targetBakeAt = '';
    if (last.targetBakeAt) {
      const twoDaysOut = new Date();
      twoDaysOut.setDate(twoDaysOut.getDate() + 2);
      const dateStr = format(twoDaysOut, 'yyyy-MM-dd');
      const lastTime = new Date(last.targetBakeAt);
      const h = lastTime.getHours();
      const m = lastTime.getMinutes();
      const snappedM = m < 15 ? '00' : m < 45 ? '30' : '00';
      const snappedH = m >= 45 ? String(h + 1).padStart(2, '0') : String(h).padStart(2, '0');
      targetBakeAt = `${dateStr}T${snappedH}:${snappedM}`;
    }

    setForm(f => ({
      ...f,
      starterId: last.starterId || f.starterId,
      roomTempDay: last.roomTempDay ?? f.roomTempDay,
      roomTempNight: last.roomTempNight ?? f.roomTempNight,
      wakeTime: last.wakeTime || f.wakeTime,
      sleepTime: last.sleepTime || f.sleepTime,
      ...(targetBakeAt && { targetBakeAt }),
    }));
  }, [bakePlans]);

  // Most recent feeding within the last 24h for this starter
  const recentFeed = useMemo(() => {
    if (!starterFeedings || !form.starterId) return null;
    const now = new Date();
    return starterFeedings.find(f => {
      const h = (now - new Date(f.fedAt)) / 3600000;
      return h >= 0 && h < 24;
    }) ?? null;
  }, [starterFeedings, form.starterId]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const toggleRecipe = (id) => {
    setForm(f => ({
      ...f,
      selectedRecipeIds: f.selectedRecipeIds.includes(id)
        ? f.selectedRecipeIds.filter(r => r !== id)
        : [...f.selectedRecipeIds, id],
    }));
  };

  // Derive total starter needed from selected recipes
  const selectedRecipes = useMemo(() => {
    if (!recipes) return [];
    return recipes.filter(r => form.selectedRecipeIds.includes(r.id));
  }, [recipes, form.selectedRecipeIds]);

  const totalStarterNeeded = useMemo(() => {
    return selectedRecipes.reduce((sum, r) => sum + (r.starterGramsTarget || 90), 0) || 90;
  }, [selectedRecipes]);

  const totalFlourGrams = useMemo(() => {
    return selectedRecipes.reduce((sum, r) => sum + (r.flourGrams || 0), 0);
  }, [selectedRecipes]);

  // Compute starter age from selected starter's lastFedAt
  const starterAgeDays = useMemo(() => {
    if (form.starterAgeDaysOverride !== '') return Number(form.starterAgeDaysOverride);
    const starter = starters?.find(s => s.id === form.starterId);
    if (!starter?.lastFedAt) return 3;
    return Math.max(0, differenceInDays(new Date(), new Date(starter.lastFedAt)));
  }, [starters, form.starterId, form.starterAgeDaysOverride]);

  const handleGenerate = (e) => {
    e.preventDefault();
    setError('');

    if (!form.targetBakeAt) { setError('Target bake date/time is required.'); return; }
    if (!form.starterId) { setError('Please select a starter.'); return; }

    const bakeDate = new Date(form.targetBakeAt);
    if (form.mixDoughAt && new Date(form.mixDoughAt) >= bakeDate) {
      setError('Mix dough time must be before your target bake time.');
      return;
    }
    if (form.shapeAt && new Date(form.shapeAt) >= bakeDate) {
      setError('Shape time must be before your target bake time.');
      return;
    }
    if (form.mixDoughAt && form.shapeAt && new Date(form.mixDoughAt) >= new Date(form.shapeAt)) {
      setError('Mix dough time must be before shape time.');
      return;
    }

    try {
      const starter = starters?.find(s => s.id === form.starterId);
      const result = generateBakePlan({
        targetBakeAt: new Date(form.targetBakeAt).toISOString(),
        starterAgeDays,
        starterLastFedAt: starter?.lastFedAt ?? null,
        starterLastFeedData: recentFeed ?? null,
        totalStarterNeeded,
        totalFlourGrams,
        roomTempDay: Number(form.roomTempDay),
        roomTempNight: Number(form.roomTempNight),
        wakeTime: form.wakeTime,
        sleepTime: form.sleepTime,
        mixDoughAt: form.mixDoughAt ? new Date(form.mixDoughAt).toISOString() : undefined,
        shapeAt: form.shapeAt ? new Date(form.shapeAt).toISOString() : undefined,
      });
      setPreview(result);
      setView('preview');
      setSaved(false);
    } catch (err) {
      setError('Failed to generate plan. Please check your inputs.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const starter = starters?.find(s => s.id === form.starterId);
      await addBakePlan({
        title: form.title.trim() || `Bake on ${format(new Date(form.targetBakeAt), 'MMM d')}`,
        starterId: form.starterId,
        starterName: starter?.name || '',
        targetBakeAt: new Date(form.targetBakeAt).toISOString(),
        roomTempDay: Number(form.roomTempDay),
        roomTempNight: Number(form.roomTempNight),
        wakeTime: form.wakeTime,
        sleepTime: form.sleepTime,
        starterAgeDays,
        selectedRecipeIds: form.selectedRecipeIds,
        totalStarterNeeded: preview.totalStarterNeeded ?? totalStarterNeeded,
        totalFlourGrams,
        inoculationPercent: preview.inoculationPercent ?? null,
        generatedSchedule: preview.steps,
        assumptions: preview.assumptions,
        status: 'active',
      });
      setSaved(true);
    } catch {
      setError('Failed to save plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'preview' && preview) {
    return (
      <SchedulePreview
        preview={preview}
        form={form}
        starters={starters}
        selectedRecipes={selectedRecipes}
        totalStarterNeeded={totalStarterNeeded}
        starterAgeDays={starterAgeDays}
        saved={saved}
        saving={saving}
        error={error}
        onBack={() => setView('form')}
        onSave={handleSave}
      />
    );
  }

  return (
    <div style={{ animation: 'fadeUp 0.5s ease', maxWidth: '680px' }}>
      <div className="mb-8">
        <h2 className="serif" style={{ fontSize: '2rem', color: 'var(--char)' }}>Plan a Bake</h2>
        <p style={{ color: 'var(--mist)', marginTop: '4px' }}>
          Generate a step-by-step schedule working backward from your target bake time.
        </p>
      </div>

      {(!starters || starters.length === 0) && starters !== undefined && (
        <div style={{ background: 'var(--alert-light)', border: '1px solid var(--alert)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '0.875rem', color: 'var(--alert)' }}>
          You need to add a starter before planning a bake. <Link to="/starter" style={{ color: 'var(--alert)', fontWeight: '600' }}>Add a starter →</Link>
        </div>
      )}

      <form className="card" style={{ padding: '28px' }} onSubmit={handleGenerate}>
        <Section title="Bake Details">
          <Field label="Plan Title" hint="optional — auto-generated if blank">
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Weekend Country Loaf"
              style={inputStyle}
            />
          </Field>

          <Field label="Target Bake Date & Time *">
            <DateTimeSelect value={form.targetBakeAt} onChange={v => set('targetBakeAt', v)} />
          </Field>

          <Field label="Starter *">
            {starters === undefined ? (
              <p style={{ color: 'var(--mist)', fontSize: '0.85rem' }}>Loading starters…</p>
            ) : starters.length === 0 ? (
              <p style={{ color: 'var(--mist)', fontSize: '0.85rem' }}>No starters added yet.</p>
            ) : (
              <select value={form.starterId} onChange={e => set('starterId', e.target.value)} style={inputStyle}>
                <option value="">Select a starter…</option>
                {starters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </Field>

          <Field label="Days since last fed" hint="auto-calculated from starter — override if needed">
            <input
              type="number"
              value={form.starterAgeDaysOverride !== '' ? form.starterAgeDaysOverride : starterAgeDays}
              onChange={e => set('starterAgeDaysOverride', e.target.value)}
              min="0" max="90" step="1"
              style={inputStyle}
            />
          </Field>
        </Section>

        <Section title="Temperature">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Day Temp (°F)">
              <input type="number" value={form.roomTempDay} onChange={e => set('roomTempDay', e.target.value)} min="60" max="90" style={inputStyle} />
            </Field>
            <Field label="Night Temp (°F)">
              <input type="number" value={form.roomTempNight} onChange={e => set('roomTempNight', e.target.value)} min="55" max="85" style={inputStyle} />
            </Field>
          </div>
        </Section>

        <Section title="Your Schedule">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Wake Time">
              <input type="time" value={form.wakeTime} onChange={e => set('wakeTime', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Sleep Time">
              <input type="time" value={form.sleepTime} onChange={e => set('sleepTime', e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <div style={{ marginTop: '14px', padding: '14px 16px', background: 'var(--cream)', borderRadius: '10px', border: '1px solid var(--crumb)' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--ash)', marginBottom: '10px' }}>
              Optional: pin your mixing & bulk window
              <span style={{ fontWeight: '400', color: 'var(--mist)', marginLeft: '6px' }}>— the planner will compute how much starter you need based on how long your bulk is</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Mix Dough At">
                <DateTimeSelect value={form.mixDoughAt} onChange={v => set('mixDoughAt', v)} />
              </Field>
              <Field label="Shape At (bulk end)">
                <DateTimeSelect value={form.shapeAt} onChange={v => set('shapeAt', v)} />
              </Field>
            </div>
            {form.mixDoughAt && form.shapeAt && totalFlourGrams > 0 && (() => {
              const bulkH = (new Date(form.shapeAt) - new Date(form.mixDoughAt) - 15 * 60 * 1000) / (60 * 60 * 1000);
              if (bulkH <= 0) return null;
              const rate = ratePreview(Number(form.roomTempDay));
              const bulkBaseline = bulkH * rate;
              const inoc = Math.round(Math.max(5, Math.min(30, 80 / bulkBaseline)));
              const levainG = Math.round((inoc / 100) * totalFlourGrams);
              return (
                <div style={{ fontSize: '0.8rem', color: 'var(--ash)', marginTop: '8px', padding: '8px 12px', background: 'var(--warm-white)', borderRadius: '8px' }}>
                  Bulk: <strong>{Math.round(bulkH * 10) / 10}h</strong> → inoculation ~<strong style={{ color: 'var(--crust)' }}>{inoc}%</strong> → levain needed: <strong style={{ color: 'var(--crust)' }}>{levainG}g</strong>
                </div>
              );
            })()}
          </div>
        </Section>

        <Section title="Recipes">
          {recipes === undefined ? (
            <p style={{ color: 'var(--mist)', fontSize: '0.85rem' }}>Loading recipes…</p>
          ) : recipes.length === 0 ? (
            <p style={{ color: 'var(--mist)', fontSize: '0.85rem' }}>
              No recipes added. <Link to="/recipes" style={{ color: 'var(--crust)' }}>Add a recipe</Link> to include it in the plan, or the planner will use a default starter amount.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recipes.map(r => {
                const checked = form.selectedRecipeIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '10px',
                      border: `1px solid ${checked ? 'var(--crust)' : 'var(--crumb)'}`,
                      background: checked ? 'rgba(193,127,62,0.06)' : 'var(--cream)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRecipe(r.id)}
                      style={{ accentColor: 'var(--crust)', width: '16px', height: '16px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--char)' }}>{r.name}</span>
                      {r.starterGramsTarget && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--mist)', marginLeft: '8px' }}>{r.starterGramsTarget}g starter</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {totalStarterNeeded > 0 && (
            <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--ash)', background: 'var(--cream)', padding: '8px 12px', borderRadius: '8px' }}>
              Total starter needed: <strong style={{ color: 'var(--crust)' }}>{totalStarterNeeded}g</strong>
              {totalFlourGrams > 0 && <> · Total flour: <strong>{totalFlourGrams}g</strong></>}
            </div>
          )}
        </Section>

        {error && <p style={{ color: 'var(--alert)', fontSize: '0.82rem', marginBottom: '16px' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary">Generate Schedule →</button>
        </div>
      </form>
    </div>
  );
}

// ── Schedule Preview ───────────────────────────────────────────────
function SchedulePreview({ preview, form, starters, totalStarterNeeded, starterAgeDays, saved, saving, error, onBack, onSave }) {
  const starter = starters?.find(s => s.id === form.starterId);

  return (
    <div style={{ animation: 'fadeUp 0.5s ease', maxWidth: '680px' }}>
      <div className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mist)', fontSize: '0.85rem' }}>
          ← Edit Plan
        </button>
        <h2 className="serif" style={{ fontSize: '1.5rem', color: 'var(--char)' }}>
          {form.title || `Bake on ${format(new Date(form.targetBakeAt), 'MMM d')}`}
        </h2>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {starter && <Chip label="Starter" value={starter.name} />}
        <Chip label="Days since fed" value={`${starterAgeDays}d`} />
        <Chip label="Starter needed" value={`${totalStarterNeeded}g`} />
        <Chip label="Day temp" value={`${form.roomTempDay}°F`} />
        <Chip label="Night temp" value={`${form.roomTempNight}°F`} />
      </div>

      {/* Schedule */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '18px' }}>Generated Schedule</h3>
        <ScheduleTimeline steps={preview.steps} />
      </div>

      {/* Assumptions */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          Assumptions & Estimates
        </h3>
        <ul style={{ paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {preview.assumptions.map((a, i) => (
            <li key={i} style={{ fontSize: '0.82rem', color: 'var(--ash)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--mist)', flexShrink: 0 }}>—</span>
              {a}
            </li>
          ))}
        </ul>
      </div>

      {error && <p style={{ color: 'var(--alert)', fontSize: '0.82rem', marginBottom: '12px' }}>{error}</p>}

      {saved ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--rise)', fontSize: '0.9rem', fontWeight: '500' }}>✓ Plan saved</span>
          <Link to="/baking" style={{ fontSize: '0.85rem', color: 'var(--crust)', fontWeight: '500', textDecoration: 'none' }}>
            View in Bake Plans →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onBack} style={secondaryBtnStyle}>← Adjust</button>
          <button className="btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Plan'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Schedule Timeline ──────────────────────────────────────────────
export function ScheduleTimeline({ steps }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((step, i) => {
        const info = STEP_LABELS[step.stepType] || { label: step.stepType, icon: '○', color: 'var(--mist)' };
        const isLast = i === steps.length - 1;
        const dt = new Date(step.plannedAt);
        const dateLabel = format(dt, 'EEE, MMM d · h:mm a');
        const inp = step.inputs || {};

        // Refrigeration steps get a subdued compact style
        const isRefrigStep = step.stepType === 'refrigerate_starter' || step.stepType === 'remove_from_fridge';

        return (
          <div key={i} style={{ display: 'flex', gap: '14px', opacity: isRefrigStep ? 0.75 : 1 }}>
            {/* Spine */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: isRefrigStep ? '24px' : '32px',
                height: isRefrigStep ? '24px' : '32px',
                borderRadius: '50%',
                background: info.color + '18', color: info.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isRefrigStep ? '0.7rem' : '0.9rem', fontWeight: '700',
                marginLeft: isRefrigStep ? '4px' : '0',
              }}>
                {info.icon}
              </div>
              {!isLast && (
                <div style={{ width: '2px', flex: 1, minHeight: '20px', background: 'var(--crumb)', margin: '4px 0' }} />
              )}
            </div>

            {/* Content */}
            <div style={{ paddingBottom: isLast ? '0' : '18px', flex: 1 }}>
              <span style={{ fontSize: isRefrigStep ? '0.65rem' : '0.7rem', fontWeight: '600', color: info.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {info.label}
              </span>
              <p style={{ fontSize: isRefrigStep ? '0.78rem' : '0.82rem', fontWeight: '500', color: 'var(--char)', margin: '2px 0' }}>
                {dateLabel}
              </p>

              {/* Build step: show full mass-flow */}
              {inp.ratio && (
                <>
                  <p style={{ fontSize: '0.78rem', color: 'var(--ash)', marginTop: '2px' }}>
                    <strong>{inp.ratio}</strong> — {inp.seedStarterGrams}g seed + {inp.flourGrams}g flour + {inp.waterGrams}g water
                    {inp.expectedPeakHours && <> · peaks ~{inp.expectedPeakHours}h</>}
                  </p>
                  {inp.totalBuildGrams != null && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '3px' }}>
                      <MassTag label="Total build" value={`${inp.totalBuildGrams}g`} />
                      <MassTag label="Used for next step" value={`${inp.gramsUsedForNextStep}g`} accent />
                      {inp.gramsReserved > 0 && (
                        <MassTag label="Discard/reserve" value={`${inp.gramsReserved}g`} />
                      )}
                    </div>
                  )}
                </>
              )}

              {step.notes && (
                <p style={{ fontSize: '0.75rem', color: 'var(--mist)', marginTop: '4px', fontStyle: 'italic' }}>{step.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MassTag({ label, value, accent }) {
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

// ── Small components ──────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', borderBottom: '1px solid var(--crumb)', paddingBottom: '6px' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '500', color: 'var(--ash)', marginBottom: '6px' }}>
        {label}
        {hint && <span style={{ fontWeight: '400', color: 'var(--mist)', marginLeft: '6px' }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <div style={{ fontSize: '0.8rem', color: 'var(--ash)', background: 'var(--warm-white)', border: '1px solid var(--crumb)', borderRadius: '8px', padding: '4px 12px' }}>
      <span style={{ color: 'var(--mist)' }}>{label}: </span>
      <strong>{value}</strong>
    </div>
  );
}

// Generates all half-hour time options as "HH:MM" strings
const HALF_HOUR_TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  const label = (() => {
    const hour = Math.floor(i / 2);
    const ampm = hour < 12 ? 'AM' : 'PM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  })();
  return { value: `${h}:${m}`, label };
});

function DateTimeSelect({ value, onChange }) {
  const [datePart, timePart] = value ? value.split('T') : ['', ''];
  // Snap timePart to nearest 30-min slot
  const snappedTime = useMemo(() => {
    if (!timePart) return '';
    const [h, m] = timePart.split(':').map(Number);
    const snapped = m < 15 ? '00' : m < 45 ? '30' : '00';
    const snappedH = m >= 45 ? String(h + 1).padStart(2, '0') : String(h).padStart(2, '0');
    return `${snappedH}:${snapped}`;
  }, [timePart]);

  const handleDate = (e) => {
    const d = e.target.value;
    onChange(d && snappedTime ? `${d}T${snappedTime}` : d ? `${d}T` : '');
  };
  const handleTime = (e) => {
    const t = e.target.value;
    onChange(datePart && t ? `${datePart}T${t}` : '');
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <input
        type="date"
        value={datePart || ''}
        onChange={handleDate}
        style={{ ...inputStyle, flex: '1 1 auto' }}
      />
      <select
        value={snappedTime || ''}
        onChange={handleTime}
        style={{ ...inputStyle, flex: '0 0 auto', width: 'auto' }}
      >
        <option value="">Time…</option>
        {HALF_HOUR_TIMES.map(({ value: v, label }) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--crumb)', background: 'var(--cream)',
  fontSize: '0.875rem', color: 'var(--char)', outline: 'none', fontFamily: 'inherit',
};

const secondaryBtnStyle = {
  padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--crumb)',
  background: 'transparent', cursor: 'pointer', fontSize: '0.9rem',
  fontWeight: '500', color: 'var(--ash)',
};

/** Inline fermentation rate lookup for live preview (mirrors planner/fermentationRates.js). */
function ratePreview(tempF) {
  const table = [
    [60, 0.45], [65, 0.60], [68, 0.70], [70, 0.80], [72, 0.90],
    [75, 1.00], [78, 1.15], [80, 1.25], [82, 1.35], [85, 1.50],
  ];
  if (tempF <= table[0][0]) return table[0][1];
  if (tempF >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    if (tempF >= table[i][0] && tempF <= table[i + 1][0]) {
      const t = (tempF - table[i][0]) / (table[i + 1][0] - table[i][0]);
      return table[i][1] + t * (table[i + 1][1] - table[i][1]);
    }
  }
  return 1.0;
}
