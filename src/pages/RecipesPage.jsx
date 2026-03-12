import { useState } from 'react';
import { useRecipes, addRecipe, updateRecipe, deleteRecipe } from '../hooks/useData';
import { format, parseISO } from 'date-fns';

const RECIPE_CATEGORIES = [
  'Classic Sourdough Boule',
  'Country Sourdough',
  'Whole Wheat Sourdough',
  'Rye Sourdough',
  'Seeded Sourdough',
  'Sourdough Sandwich Loaf',
  'Sourdough Focaccia',
  'Sourdough Baguette',
  'Sourdough Pizza Dough',
  'Sourdough Discard',
  'Other',
];

const EMPTY_FORM = {
  name: '',
  category: 'Classic Sourdough Boule',
  flourGrams: '',
  waterGrams: '',
  saltGrams: '',
  starterGramsTarget: '',
  discardGrams: '',
  addIns: [],          // [{ name: string, grams: string }]
  notes: '',
};

export default function RecipesPage() {
  const recipes = useRecipes();
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'form'
  const [selected, setSelected] = useState(null);

  const handleNew = () => {
    setSelected(null);
    setView('form');
  };

  const handleEdit = (recipe) => {
    setSelected(recipe);
    setView('form');
  };

  const handleDetail = (recipe) => {
    setSelected(recipe);
    setView('detail');
  };

  const handleDelete = async (recipe) => {
    if (!confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return;
    await deleteRecipe(recipe.id);
    setView('list');
    setSelected(null);
  };

  const handleSaved = () => {
    setView('list');
    setSelected(null);
  };

  if (view === 'form') {
    return (
      <RecipeForm
        initial={selected}
        onSave={handleSaved}
        onCancel={() => { setView(selected ? 'detail' : 'list'); }}
      />
    );
  }

  if (view === 'detail' && selected) {
    return (
      <RecipeDetail
        recipe={selected}
        onBack={() => { setView('list'); setSelected(null); }}
        onEdit={() => handleEdit(selected)}
        onDelete={() => handleDelete(selected)}
      />
    );
  }

  return (
    <div style={{ animation: 'fadeUp 0.5s ease' }}>
      <div className="mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '2rem', color: 'var(--char)' }}>Recipes</h2>
          <p style={{ color: 'var(--mist)', marginTop: '4px' }}>Your sourdough recipe library.</p>
        </div>
        <button className="btn-primary" onClick={handleNew}>+ New Recipe</button>
      </div>

      {recipes === undefined ? (
        <LoadingState />
      ) : recipes.length === 0 ? (
        <EmptyState onAdd={handleNew} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {recipes.map(r => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onClick={() => handleDetail(r)}
              onEdit={() => handleEdit(r)}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Recipe Card (list item) ────────────────────────────────────────
function RecipeCard({ recipe, onClick, onEdit, onDelete }) {
  const hydration = computeHydration(recipe);

  return (
    <div
      className="card"
      style={{ padding: '18px 22px', cursor: 'pointer', transition: 'transform 0.1s' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h3 className="serif" style={{ fontSize: '1.1rem', color: 'var(--char)' }}>{recipe.name}</h3>
            {recipe.category && (
              <span style={{ fontSize: '0.72rem', color: 'var(--mist)', background: 'var(--cream)', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--crumb)' }}>
                {recipe.category}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            {recipe.flourGrams && <Stat label="Flour" value={`${recipe.flourGrams}g`} />}
            {recipe.waterGrams && <Stat label="Water" value={`${recipe.waterGrams}g`} />}
            {recipe.saltGrams && <Stat label="Salt" value={`${recipe.saltGrams}g`} />}
            {recipe.starterGramsTarget && <Stat label="Levain" value={`${recipe.starterGramsTarget}g`} />}
            {recipe.discardGrams && <Stat label="Discard" value={`${recipe.discardGrams}g`} />}
            {recipe.addIns?.length > 0 && <Stat label="Add-ins" value={recipe.addIns.map(a => a.name).join(', ')} />}
            {hydration !== null && <Stat label="Hydration" value={`${hydration}%`} />}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} style={secondaryBtnStyle}>Edit</button>
          <button onClick={onDelete} style={{ ...secondaryBtnStyle, borderColor: 'var(--alert)', color: 'var(--alert)' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Recipe Detail ─────────────────────────────────────────────────
function RecipeDetail({ recipe, onBack, onEdit, onDelete }) {
  const hydration = computeHydration(recipe);

  return (
    <div style={{ animation: 'fadeUp 0.5s ease', maxWidth: '640px' }}>
      <div className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mist)', fontSize: '0.85rem' }}>
          ← Back
        </button>
      </div>

      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="serif" style={{ fontSize: '1.6rem', color: 'var(--char)' }}>{recipe.name}</h2>
            {recipe.category && (
              <p style={{ color: 'var(--mist)', fontSize: '0.85rem', marginTop: '2px' }}>{recipe.category}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onEdit} style={secondaryBtnStyle}>Edit</button>
            <button onClick={onDelete} style={{ ...secondaryBtnStyle, borderColor: 'var(--alert)', color: 'var(--alert)' }}>Delete</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <DetailStat label="Flour" value={recipe.flourGrams ? `${recipe.flourGrams}g` : '—'} />
          <DetailStat label="Water" value={recipe.waterGrams ? `${recipe.waterGrams}g` : '—'} />
          <DetailStat label="Salt" value={recipe.saltGrams ? `${recipe.saltGrams}g` : '—'} />
          <DetailStat label="Levain" value={recipe.starterGramsTarget ? `${recipe.starterGramsTarget}g*` : 'computed'} />
          {recipe.discardGrams ? <DetailStat label="Discard" value={`${recipe.discardGrams}g`} /> : null}
          <DetailStat label="Hydration" value={hydration !== null ? `${hydration}%` : '—'} accent />
          {recipe.flourGrams && recipe.waterGrams && recipe.saltGrams && (
            <DetailStat label="Total Dough" value={`${(Number(recipe.flourGrams) + Number(recipe.waterGrams) + Number(recipe.saltGrams) + (Number(recipe.starterGramsTarget) || 0) + (Number(recipe.discardGrams) || 0))}g`} />
          )}
        </div>

        {recipe.starterGramsTarget && (
          <p style={{ fontSize: '0.72rem', color: 'var(--mist)', marginBottom: '16px', fontStyle: 'italic' }}>
            * Levain amount is a starting point — the planner may adjust based on your bulk window.
          </p>
        )}

        {recipe.addIns?.length > 0 && (
          <div style={{ borderTop: '1px solid var(--crumb)', paddingTop: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Add-ins & Inclusions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recipe.addIns.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--ash)', padding: '6px 0', borderBottom: '1px solid var(--cream)' }}>
                  <span>{a.name}</span>
                  {a.grams && <span style={{ color: 'var(--mist)', fontWeight: '500' }}>{a.grams}g</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {recipe.notes && (
          <div style={{ borderTop: '1px solid var(--crumb)', paddingTop: '16px' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Notes</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--ash)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{recipe.notes}</p>
          </div>
        )}

        {recipe.createdAt && (
          <p style={{ fontSize: '0.72rem', color: 'var(--mist)', marginTop: '20px' }}>
            Added {format(parseISO(recipe.createdAt), 'MMM d, yyyy')}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Recipe Form ───────────────────────────────────────────────────
function RecipeForm({ initial, onSave, onCancel }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() => initial ? {
    name: initial.name || '',
    category: initial.category || 'Classic Sourdough Boule',
    flourGrams: initial.flourGrams ?? '',
    waterGrams: initial.waterGrams ?? '',
    saltGrams: initial.saltGrams ?? '',
    starterGramsTarget: initial.starterGramsTarget ?? '',
    discardGrams: initial.discardGrams ?? '',
    addIns: initial.addIns ?? [],
    notes: initial.notes || '',
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // Live hydration preview
  const previewHydration = form.flourGrams && form.waterGrams
    ? Math.round((Number(form.waterGrams) / Number(form.flourGrams)) * 100)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Recipe name is required.'); return; }
    if (!form.flourGrams || Number(form.flourGrams) <= 0) { setError('Flour grams must be a positive number.'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        flourGrams: Number(form.flourGrams),
        waterGrams: form.waterGrams !== '' ? Number(form.waterGrams) : null,
        saltGrams: form.saltGrams !== '' ? Number(form.saltGrams) : null,
        starterGramsTarget: form.starterGramsTarget !== '' ? Number(form.starterGramsTarget) : null,
        discardGrams: form.discardGrams !== '' ? Number(form.discardGrams) : null,
        addIns: form.addIns.filter(a => a.name.trim()).map(a => ({
          name: a.name.trim(),
          grams: a.grams !== '' ? Number(a.grams) : null,
        })),
        notes: form.notes.trim(),
      };
      if (isEdit) {
        await updateRecipe(initial.id, payload);
      } else {
        await addRecipe(payload);
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
          {isEdit ? 'Edit Recipe' : 'New Recipe'}
        </h2>
      </div>

      <form className="card" style={{ padding: '28px' }} onSubmit={handleSubmit}>
        <Field label="Recipe Name *">
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Country Boule, Weekend Loaf"
            style={inputStyle}
          />
        </Field>

        <Field label="Category">
          <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
            {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Flour (g) *">
            <input type="number" value={form.flourGrams} onChange={e => set('flourGrams', e.target.value)} min="1" style={inputStyle} placeholder="450" />
          </Field>
          <Field label="Water (g)">
            <input type="number" value={form.waterGrams} onChange={e => set('waterGrams', e.target.value)} min="1" style={inputStyle} placeholder="340" />
          </Field>
          <Field label="Salt (g)">
            <input type="number" value={form.saltGrams} onChange={e => set('saltGrams', e.target.value)} min="0" style={inputStyle} placeholder="9" />
          </Field>
          <Field label="Levain (g)" hint="starting point — planner may adjust">
            <input type="number" value={form.starterGramsTarget} onChange={e => set('starterGramsTarget', e.target.value)} min="1" style={inputStyle} placeholder="90" />
          </Field>
          <Field label="Discard (g)" hint="if using unfed starter in addition">
            <input type="number" value={form.discardGrams} onChange={e => set('discardGrams', e.target.value)} min="0" style={inputStyle} placeholder="50" />
          </Field>
        </div>

        {previewHydration !== null && (
          <div style={{ background: 'var(--cream)', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', fontSize: '0.85rem', color: 'var(--ash)' }}>
            Hydration: <strong style={{ color: 'var(--crust)' }}>{previewHydration}%</strong>
          </div>
        )}

        <AddInsField addIns={form.addIns} onChange={v => set('addIns', v)} />

        <Field label="Notes" hint="flour blend, process, variations, etc.">
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={4}
            placeholder="e.g. 80% bread flour + 20% whole wheat. Autolyse 45 min..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        {error && <p style={{ color: 'var(--alert)', fontSize: '0.82rem', marginBottom: '16px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Recipe'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Add-ins field ─────────────────────────────────────────────────
function AddInsField({ addIns, onChange }) {
  const add = () => onChange([...addIns, { name: '', grams: '' }]);
  const remove = (i) => onChange(addIns.filter((_, idx) => idx !== i));
  const update = (i, field, value) => {
    const next = addIns.map((a, idx) => idx === i ? { ...a, [field]: value } : a);
    onChange(next);
  };

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: '500', color: 'var(--ash)' }}>
          Add-ins & Inclusions
          <span style={{ fontWeight: '400', color: 'var(--mist)', marginLeft: '6px' }}>— seeds, spices, mix-ins</span>
        </label>
        <button
          type="button"
          onClick={add}
          style={{ fontSize: '0.78rem', color: 'var(--crust)', background: 'none', border: '1px solid var(--crumb)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer' }}
        >
          + Add
        </button>
      </div>

      {addIns.length === 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--mist)', fontStyle: 'italic' }}>No add-ins yet — click + Add to include spices, seeds, etc.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {addIns.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 32px', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={item.name}
              onChange={e => update(i, 'name', e.target.value)}
              placeholder="e.g. sesame seeds, caraway, rosemary"
              style={inputStyle}
            />
            <input
              type="number"
              value={item.grams}
              onChange={e => update(i, 'grams', e.target.value)}
              placeholder="g"
              min="0"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--crumb)', background: 'transparent', cursor: 'pointer', color: 'var(--mist)', fontSize: '1rem', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function computeHydration(recipe) {
  if (!recipe.flourGrams || !recipe.waterGrams) return null;
  return Math.round((recipe.waterGrams / recipe.flourGrams) * 100);
}

function Stat({ label, value }) {
  return (
    <div>
      <span style={{ fontSize: '0.7rem', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}: </span>
      <span style={{ fontSize: '0.82rem', fontWeight: '500', color: 'var(--ash)' }}>{value}</span>
    </div>
  );
}

function DetailStat({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--cream)', borderRadius: '10px', padding: '12px 14px' }}>
      <p style={{ fontSize: '0.7rem', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '1.1rem', fontWeight: '600', color: accent ? 'var(--crust)' : 'var(--char)', fontFamily: 'Playfair Display, serif' }}>{value}</p>
    </div>
  );
}

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

function EmptyState({ onAdd }) {
  return (
    <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: '2rem', marginBottom: '12px' }}>◇</p>
      <p style={{ color: 'var(--ash)', marginBottom: '6px', fontWeight: '500' }}>No recipes yet</p>
      <p style={{ color: 'var(--mist)', fontSize: '0.85rem', marginBottom: '20px' }}>Add your first recipe to use in bake plans.</p>
      <button className="btn-primary" onClick={onAdd}>Add Recipe</button>
    </div>
  );
}

function LoadingState() {
  return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--mist)', fontStyle: 'italic' }}>Loading…</div>;
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--crumb)', background: 'var(--cream)',
  fontSize: '0.875rem', color: 'var(--char)', outline: 'none', fontFamily: 'inherit',
};

const secondaryBtnStyle = {
  padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--crumb)',
  background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--ash)',
};
