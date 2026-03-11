import { useState, useEffect } from 'react';
import { useRecipes, addRecipe, updateRecipe, deleteRecipe, useBakeNotes, addBakeNote, deleteBakeNote, useAppSettings, updateAppSettings } from '../hooks/useData';
import { generateRecipe } from '../lib/ai';
import { format, parseISO } from 'date-fns';

const BREAD_STYLES = [
  'Classic Sourdough Boule', 'Country Sourdough', 'Whole Wheat Sourdough',
  'Rye Sourdough', 'Einkorn Sourdough', 'Seeded Sourdough', 'Focaccia',
  'Ciabatta', 'Baguette', 'Sourdough Sandwich Loaf', 'Sourdough Bagels',
  'Sourdough Pizza Dough', 'Sourdough Flatbread', 'Sourdough Discard Pancakes',
  'Other',
];

const UNITS = ['g', 'ml', 'tsp', 'tbsp', 'cup', 'oz'];

export default function RecipesPage() {
  const recipes = useRecipes();
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'create' | 'edit'
  const [selected, setSelected] = useState(null);
  const [createMode, setCreateMode] = useState('manual'); // 'manual' | 'ai'

  const handleSelectRecipe = (recipe) => {
    setSelected(recipe);
    setView('detail');
  };

  const handleEdit = (recipe) => {
    setSelected(recipe);
    setView('edit');
  };

  const handleDelete = async (recipe) => {
    if (!confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return;
    await deleteRecipe(recipe.id);
    setView('list');
    setSelected(null);
  };

  const handleSaved = (id) => {
    // After save, go back to list
    setView('list');
    setSelected(null);
  };

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

  if (view === 'edit' && selected) {
    return (
      <RecipeForm
        initial={selected}
        onSave={handleSaved}
        onCancel={() => setView('detail')}
      />
    );
  }

  if (view === 'create') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
          <button onClick={() => setView('list')} style={backBtnStyle}>← Back</button>
          <h2 className="serif" style={{ fontSize: '2rem' }}>New Recipe</h2>
        </div>

        <div className="tab-bar" style={{ marginBottom: '24px' }}>
          {[['manual', '✏ Create Manually'], ['ai', '✦ Generate with AI']].map(([key, label]) => (
            <button key={key} onClick={() => setCreateMode(key)} style={{
              padding: '8px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              background: createMode === key ? 'white' : 'transparent',
              color: createMode === key ? 'var(--char)' : 'var(--mist)',
              fontWeight: createMode === key ? '500' : '400',
              fontSize: '0.875rem',
              boxShadow: createMode === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>

        {createMode === 'manual' ? (
          <RecipeForm onSave={handleSaved} onCancel={() => setView('list')} />
        ) : (
          <AIRecipeGenerator onSave={handleSaved} onCancel={() => setView('list')} />
        )}
      </div>
    );
  }

  // List view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '2rem' }}>Recipe Library</h2>
          <p style={{ color: 'var(--mist)', marginTop: '4px' }}>
            Your saved sourdough recipes — create manually or with AI
          </p>
        </div>
        <button className="btn-primary" onClick={() => setView('create')}>+ New Recipe</button>
      </div>

      {!recipes || recipes.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--mist)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>◇</div>
          <p style={{ marginBottom: '4px', fontSize: '1rem', color: 'var(--ash)' }}>No recipes yet.</p>
          <p style={{ fontSize: '0.82rem', marginBottom: '20px' }}>
            Create a recipe manually or let AI generate one from your style and ingredients.
          </p>
          <button className="btn-primary" onClick={() => setView('create')}>Create First Recipe</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recipes.map(r => (
            <RecipeCard key={r.id} recipe={r} onClick={() => handleSelectRecipe(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onClick }) {
  const ingredientCount = recipe.ingredients?.length || 0;
  const stageCount = recipe.stages?.length || 0;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ padding: '18px 22px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 className="serif" style={{ fontSize: '1.15rem' }}>{recipe.name}</h3>
            {recipe.style && (
              <span style={{
                fontSize: '0.7rem', padding: '2px 10px', borderRadius: '999px',
                background: 'var(--cream)', color: 'var(--mist)', letterSpacing: '0.03em',
              }}>
                {recipe.style}
              </span>
            )}
          </div>
          {recipe.description && (
            <p style={{ fontSize: '0.82rem', color: 'var(--ash)', marginTop: '4px', lineHeight: '1.5' }}>
              {recipe.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--mist)' }}>
            {ingredientCount > 0 && <span>{ingredientCount} ingredients</span>}
            {stageCount > 0 && <span>{stageCount} stages</span>}
            {recipe.starterAmount > 0 && <span>{recipe.starterAmount}g starter</span>}
            {recipe.loaves > 1 && <span>{recipe.loaves} loaves</span>}
          </div>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--mist)', flexShrink: 0, marginLeft: '16px' }}>
          View →
        </span>
      </div>
    </div>
  );
}

function RecipeDetail({ recipe, onBack, onEdit, onDelete }) {
  const [tab, setTab] = useState('ingredients');
  const bakeNotes = useBakeNotes(recipe.id);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const hydration = calcHydration(recipe.ingredients);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
        <button onClick={onBack} style={backBtnStyle}>← Back</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '2rem' }}>{recipe.name}</h2>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            {recipe.style && (
              <span style={{ fontSize: '0.75rem', color: 'var(--mist)', background: 'var(--cream)', padding: '2px 10px', borderRadius: '999px' }}>
                {recipe.style}
              </span>
            )}
            {hydration && (
              <span style={{ fontSize: '0.75rem', color: 'var(--crust)', fontWeight: '500' }}>
                {hydration}% hydration
              </span>
            )}
            {recipe.loaves > 1 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>{recipe.loaves} loaves</span>
            )}
          </div>
          {recipe.description && (
            <p style={{ fontSize: '0.875rem', color: 'var(--ash)', marginTop: '8px', lineHeight: '1.6', maxWidth: '600px' }}>
              {recipe.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '8px 14px' }} onClick={onEdit}>
            Edit
          </button>
          <button onClick={onDelete} style={{
            background: 'none', border: '1px solid #ddd', cursor: 'pointer',
            color: '#bbb', fontSize: '0.8rem', padding: '8px 12px', borderRadius: '8px',
          }}>
            Delete
          </button>
        </div>
      </div>

      <div className="tab-bar" style={{ marginBottom: '24px' }}>
        {[['ingredients', 'Ingredients'], ['stages', 'Stages'], ['notes', `Bake Notes${bakeNotes?.length ? ` (${bakeNotes.length})` : ''}`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
            background: tab === key ? 'white' : 'transparent',
            color: tab === key ? 'var(--char)' : 'var(--mist)',
            fontWeight: tab === key ? '500' : '400',
            fontSize: '0.875rem',
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'ingredients' && (
        <div className="card" style={{ padding: '24px' }}>
          {recipe.ingredients?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Ingredient</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((ing, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--crumb)' }}>
                    <td style={tdStyle}>{ing.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '500' }}>{ing.amount}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--mist)' }}>{ing.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--mist)', fontSize: '0.875rem' }}>No ingredients listed.</p>
          )}
          {recipe.starterAmount > 0 && (
            <div style={{ marginTop: '16px', padding: '12px 14px', background: 'var(--cream)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--ash)' }}>
              <strong style={{ color: 'var(--char)' }}>Starter needed:</strong> {recipe.starterAmount}g active starter for levain build
            </div>
          )}
          {recipe.notes && (
            <div style={{ marginTop: '16px', padding: '14px', background: 'var(--rise-light)', borderRadius: '10px', borderLeft: '3px solid var(--rise)' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--rise)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Baker's Notes</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--ash)', lineHeight: '1.6', fontStyle: 'italic' }}>{recipe.notes}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'stages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recipe.stages?.length > 0 ? recipe.stages.map((stage, i) => (
            <div key={i} className="card" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--crust)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: '700',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h4 style={{ fontWeight: '600', fontFamily: 'Playfair Display, serif', fontSize: '1rem' }}>{stage.name}</h4>
                    {stage.duration && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--crust)', fontWeight: '500' }}>
                        ⏱ {stage.duration}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ash)', lineHeight: '1.7' }}>{stage.description}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--mist)' }}>
              No stages defined.
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="btn-primary" onClick={() => setShowNoteForm(!showNoteForm)}>
              {showNoteForm ? 'Cancel' : '+ Add Bake Note'}
            </button>
          </div>
          {showNoteForm && (
            <BakeNoteForm
              recipeId={recipe.id}
              onSave={() => setShowNoteForm(false)}
            />
          )}
          {bakeNotes?.length === 0 && !showNoteForm ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--mist)' }}>
              <p style={{ marginBottom: '4px' }}>No bake notes yet.</p>
              <p style={{ fontSize: '0.8rem' }}>After each bake, add a note to track your progress over time.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bakeNotes?.map(note => (
                <BakeNoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BakeNoteForm({ recipeId, onSave }) {
  const [form, setForm] = useState({ rating: '', outcome: '', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.outcome?.trim() && !form.notes?.trim()) return;
    await addBakeNote({ recipeId, ...form, rating: form.rating ? +form.rating : null });
    onSave();
  };

  return (
    <div className="card" style={{ padding: '22px', marginBottom: '16px', borderLeft: '3px solid var(--crust)' }}>
      <h4 className="serif" style={{ fontSize: '1rem', marginBottom: '14px' }}>New Bake Note</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label>Rating (1–10)</label>
          <input type="number" min={1} max={10} value={form.rating} onChange={e => set('rating', e.target.value)} placeholder="8" />
        </div>
        <div>
          <label>Outcome</label>
          <input type="text" value={form.outcome} onChange={e => set('outcome', e.target.value)} placeholder="Open crumb, great oven spring..." />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Notes for next time</label>
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="What worked, what to change, environment conditions..." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <button className="btn-primary" onClick={handleSave}>Save Note</button>
        <button className="btn-secondary" onClick={onSave}>Cancel</button>
      </div>
    </div>
  );
}

function BakeNoteCard({ note }) {
  const ratingColor = note.rating >= 8 ? 'var(--rise)' : note.rating >= 6 ? 'var(--crust)' : note.rating >= 4 ? 'var(--ash)' : 'var(--alert)';

  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
              {format(parseISO(note.date), 'MMMM d, yyyy')}
            </span>
            {note.rating && (
              <span style={{
                fontSize: '0.72rem', fontWeight: '600', padding: '2px 10px', borderRadius: '999px',
                background: `${ratingColor}18`, color: ratingColor,
              }}>
                {note.rating}/10
              </span>
            )}
          </div>
          {note.outcome && (
            <p style={{ fontSize: '0.875rem', color: 'var(--ash)', marginBottom: '6px' }}>
              <span style={{ color: 'var(--mist)', fontSize: '0.75rem' }}>Result: </span>
              {note.outcome}
            </p>
          )}
          {note.notes && (
            <div style={{ background: 'var(--cream)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--mist)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Notes
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--ash)', fontStyle: 'italic', lineHeight: '1.5' }}>{note.notes}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => deleteBakeNote(note.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.9rem', padding: '4px 6px', flexShrink: 0, marginLeft: '8px' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Recipe Form (manual create / edit) ───────────────────────────
function RecipeForm({ initial, onSave, onCancel }) {
  const empty = {
    name: '', style: '', description: '', loaves: 1,
    ingredients: [{ name: '', amount: '', unit: 'g' }],
    stages: [{ name: 'Levain Build', description: '', duration: '' }],
    starterAmount: 20, notes: '',
  };

  const [form, setForm] = useState(initial ? {
    name: initial.name || '',
    style: initial.style || '',
    description: initial.description || '',
    loaves: initial.loaves || 1,
    ingredients: initial.ingredients?.length ? initial.ingredients : empty.ingredients,
    stages: initial.stages?.length ? initial.stages : empty.stages,
    starterAmount: initial.starterAmount || 20,
    notes: initial.notes || '',
  } : empty);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Ingredients
  const setIngredient = (i, k, v) => setForm(f => {
    const ings = [...f.ingredients];
    ings[i] = { ...ings[i], [k]: v };
    return { ...f, ingredients: ings };
  });
  const addIngredient = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', amount: '', unit: 'g' }] }));
  const removeIngredient = (i) => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));

  // Stages
  const setStage = (i, k, v) => setForm(f => {
    const stages = [...f.stages];
    stages[i] = { ...stages[i], [k]: v };
    return { ...f, stages };
  });
  const addStage = () => setForm(f => ({ ...f, stages: [...f.stages, { name: '', description: '', duration: '' }] }));
  const removeStage = (i) => setForm(f => ({ ...f, stages: f.stages.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.name.trim()) return alert('Recipe name is required.');
    const clean = {
      ...form,
      ingredients: form.ingredients.filter(i => i.name.trim()),
      stages: form.stages.filter(s => s.name.trim()),
      loaves: +form.loaves || 1,
      starterAmount: +form.starterAmount || 20,
    };
    if (initial) {
      await updateRecipe(initial.id, clean);
    } else {
      await addRecipe(clean);
    }
    onSave();
  };

  return (
    <div>
      {/* Basic info */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '18px' }}>Recipe Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Recipe Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Country Sourdough" />
          </div>
          <div>
            <label>Style / Type</label>
            <select value={form.style} onChange={e => set('style', e.target.value)}>
              <option value="">— select —</option>
              {BREAD_STYLES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label>Number of Loaves</label>
            <input type="number" min={1} max={10} value={form.loaves} onChange={e => set('loaves', e.target.value)} />
          </div>
          <div>
            <label>Starter needed (g)</label>
            <input type="number" value={form.starterAmount} onChange={e => set('starterAmount', e.target.value)} placeholder="20" />
            <p style={{ fontSize: '0.72rem', color: 'var(--mist)', marginTop: '4px' }}>
              Grams of active starter to build the levain
            </p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of this recipe..." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Baker's Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Tips, variations, what to watch for..." />
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Ingredients</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {form.ingredients.map((ing, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 32px', gap: '8px', alignItems: 'center' }}>
              <input
                type="text" value={ing.name}
                onChange={e => setIngredient(i, 'name', e.target.value)}
                placeholder="e.g. bread flour"
              />
              <input
                type="number" value={ing.amount}
                onChange={e => setIngredient(i, 'amount', e.target.value)}
                placeholder="450"
              />
              <select value={ing.unit} onChange={e => setIngredient(i, 'unit', e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <button
                onClick={() => removeIngredient(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={addIngredient}>
          + Add Ingredient
        </button>
      </div>

      {/* Stages */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Stages / Steps</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '12px' }}>
          {form.stages.map((stage, i) => (
            <div key={i} style={{ display: 'grid', gap: '8px', padding: '14px', background: 'var(--cream)', borderRadius: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 32px', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text" value={stage.name}
                  onChange={e => setStage(i, 'name', e.target.value)}
                  placeholder="Stage name (e.g. Bulk Fermentation)"
                />
                <input
                  type="text" value={stage.duration}
                  onChange={e => setStage(i, 'duration', e.target.value)}
                  placeholder="4–6 hours"
                />
                <button
                  onClick={() => removeStage(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>
              <textarea
                rows={2} value={stage.description}
                onChange={e => setStage(i, 'description', e.target.value)}
                placeholder="Detailed instructions for this step..."
              />
            </div>
          ))}
        </div>
        <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={addStage}>
          + Add Stage
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button className="btn-primary" onClick={handleSave}>
          {initial ? 'Save Changes' : 'Save Recipe'}
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── AI Recipe Generator ───────────────────────────────────────────
function AIRecipeGenerator({ onSave, onCancel }) {
  const appSettings = useAppSettings();
  const [form, setForm] = useState({ style: '', ingredients: '', suggestions: '' });
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const savedKey = provider === 'anthropic' ? appSettings?.anthropicKey : appSettings?.openaiKey;
  const keyPlaceholder = provider === 'anthropic' ? 'sk-ant-...' : 'sk-...';

  useEffect(() => {
    if (savedKey && !apiKey) setApiKey(savedKey);
  }, [savedKey]);

  const handleGenerate = async () => {
    const key = apiKey.trim() || savedKey;
    if (!key) {
      setError(`Enter your ${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key below.`);
      return;
    }
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const recipe = await generateRecipe({ ...form, apiKey: key, provider });
      setPreview(recipe);
      if (apiKey.trim()) {
        await updateAppSettings(provider === 'anthropic'
          ? { anthropicKey: apiKey.trim() }
          : { openaiKey: apiKey.trim() }
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreview = async () => {
    if (!preview) return;
    await addRecipe(preview);
    onSave();
  };

  return (
    <div>
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Generate with AI</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--mist)', marginBottom: '16px' }}>
          Describe what you want and AI will generate a complete recipe.
          Requires running locally (dev mode) with an API key.
        </p>

        {/* Provider toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[['anthropic', 'Claude (Anthropic)'], ['openai', 'GPT-4o (OpenAI)']].map(([key, label]) => (
            <button key={key} onClick={() => { setProvider(key); setApiKey(''); setError(''); }} style={{
              padding: '7px 16px', borderRadius: '9px', border: '1px solid',
              borderColor: provider === key ? 'var(--crust)' : 'var(--crumb)',
              background: provider === key ? '#FFF3E8' : 'white',
              color: provider === key ? 'var(--crust)' : 'var(--mist)',
              fontWeight: provider === key ? '600' : '400',
              fontSize: '0.8rem', cursor: 'pointer',
            }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label>Bread Style / Type *</label>
            <input
              type="text" value={form.style}
              onChange={e => set('style', e.target.value)}
              placeholder="e.g. Country sourdough boule, Focaccia, Whole wheat sandwich loaf"
            />
          </div>
          <div>
            <label>Key Ingredients or Inclusions</label>
            <textarea
              rows={2} value={form.ingredients}
              onChange={e => set('ingredients', e.target.value)}
              placeholder="e.g. 30% whole wheat, walnuts and cranberries, rosemary and sea salt"
            />
          </div>
          <div>
            <label>Preferences & Suggestions</label>
            <textarea
              rows={2} value={form.suggestions}
              onChange={e => set('suggestions', e.target.value)}
              placeholder="e.g. High hydration (80%+), overnight cold proof, for 2 loaves, beginner-friendly steps"
            />
          </div>

          <div style={{ borderTop: '1px solid var(--crumb)', paddingTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
              <span style={{ fontSize: '0.7rem', color: 'var(--mist)', fontWeight: '400' }}>
                — stored locally, only sent to {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={savedKey ? 'Key saved — click to change' : keyPlaceholder}
                style={{ flex: 1 }}
              />
              <button
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '8px 12px', flexShrink: 0 }}
                onClick={() => setShowKey(s => !s)}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--alert-light)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--alert)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading || !form.style.trim()}>
            {loading ? 'Generating...' : '✦ Generate Recipe'}
          </button>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>

      {preview && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="serif" style={{ fontSize: '1.3rem' }}>Preview: {preview.name}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" onClick={handleSavePreview}>Save to Library</button>
              <button className="btn-secondary" onClick={() => setPreview(null)}>Regenerate</button>
            </div>
          </div>

          {preview.description && (
            <p style={{ color: 'var(--ash)', marginBottom: '16px', lineHeight: '1.6' }}>{preview.description}</p>
          )}

          <div className="responsive-grid-2" style={{ marginBottom: '16px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h4 className="serif" style={{ marginBottom: '12px' }}>Ingredients</h4>
              {preview.ingredients?.map((ing, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--crumb)', fontSize: '0.85rem' }}>
                  <span>{ing.name}</span>
                  <span style={{ color: 'var(--crust)', fontWeight: '500' }}>{ing.amount}{ing.unit}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <h4 className="serif" style={{ marginBottom: '12px' }}>Overview</h4>
              {preview.style && <p style={{ fontSize: '0.82rem', color: 'var(--mist)', marginBottom: '6px' }}>Style: {preview.style}</p>}
              {preview.loaves && <p style={{ fontSize: '0.82rem', color: 'var(--mist)', marginBottom: '6px' }}>Loaves: {preview.loaves}</p>}
              {preview.starterAmount && <p style={{ fontSize: '0.82rem', color: 'var(--mist)', marginBottom: '6px' }}>Starter: {preview.starterAmount}g</p>}
              {preview.notes && (
                <div style={{ marginTop: '10px', padding: '10px', background: 'var(--rise-light)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--ash)', fontStyle: 'italic' }}>
                  {preview.notes}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {preview.stages?.map((stage, i) => (
              <div key={i} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '50%', background: 'var(--crust)', color: 'white',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: '700', flexShrink: 0,
                  }}>{i + 1}</span>
                  <strong style={{ fontFamily: 'Playfair Display, serif' }}>{stage.name}</strong>
                  {stage.duration && <span style={{ fontSize: '0.72rem', color: 'var(--crust)' }}>⏱ {stage.duration}</span>}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--ash)', lineHeight: '1.6', marginLeft: '32px' }}>{stage.description}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="btn-primary" onClick={handleSavePreview}>Save to Library</button>
            <button className="btn-secondary" onClick={() => setPreview(null)}>Regenerate</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function calcHydration(ingredients) {
  if (!ingredients?.length) return null;
  const water = ingredients.find(i => i.name?.toLowerCase().includes('water'));
  const flour = ingredients.filter(i => i.name?.toLowerCase().includes('flour'));
  if (!water || !flour.length) return null;
  const totalFlour = flour.reduce((sum, f) => sum + (+f.amount || 0), 0);
  if (!totalFlour) return null;
  return Math.round(((+water.amount) / totalFlour) * 100);
}

const backBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--mist)', fontSize: '0.85rem', padding: '0',
};

const thStyle = {
  fontSize: '0.7rem', color: 'var(--mist)', textTransform: 'uppercase',
  letterSpacing: '0.06em', padding: '8px 0', textAlign: 'left',
};

const tdStyle = {
  padding: '10px 0', fontSize: '0.875rem', color: 'var(--ash)',
};
