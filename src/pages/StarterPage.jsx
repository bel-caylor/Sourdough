import { useState } from 'react';
import { useRecentFeedings, useStarterHealth, logFeeding, logStarterHealth, useReminderSettings, updateReminderSettings } from '../hooks/useData';
import { format, parseISO, differenceInHours } from 'date-fns';

const FLOUR_TYPES = ['all-purpose', 'bread flour', 'whole wheat', 'rye', 'einkorn', 'spelt', 'mix'];

export default function StarterPage() {
  const [tab, setTab] = useState('feed');
  const feedings = useRecentFeedings(20);
  const healthLogs = useStarterHealth();
  const reminder = useReminderSettings();

  return (
    <div>
      <div className="mb-6">
        <h2 className="serif" style={{ fontSize: '2rem' }}>Starter Tracker</h2>
        <p style={{ color: 'var(--mist)', marginTop: '4px' }}>
          Log feedings, check health, and manage reminder intervals
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--crumb)', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        {[['feed', '🫙 Log Feeding'], ['health', '◉ Health Check'], ['reminders', '⏰ Reminders']].map(([key, label]) => (
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div>
          {tab === 'feed' && <FeedingForm />}
          {tab === 'health' && <HealthForm />}
          {tab === 'reminders' && <ReminderForm settings={reminder} />}
        </div>

        <div>
          {tab === 'feed' && <FeedingHistory feedings={feedings} />}
          {tab === 'health' && <HealthHistory logs={healthLogs} />}
          {tab === 'reminders' && <ReminderInfo settings={reminder} feedings={feedings} />}
        </div>
      </div>
    </div>
  );
}

function FeedingForm() {
  const [form, setForm] = useState({
    flourType: 'all-purpose',
    flourGrams: 50,
    waterGrams: 50,
    starterGrams: 10,
    riseHeight: '',
    riseTime: '',
    temp: '',
    notes: '',
  });
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    await logFeeding(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm(f => ({ ...f, notes: '', riseHeight: '', riseTime: '', temp: '' }));
  };

  const hydration = form.flourGrams > 0
    ? Math.round((form.waterGrams / form.flourGrams) * 100)
    : 0;

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 className="serif" style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Log a Feeding</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Flour Type</label>
          <select value={form.flourType} onChange={e => set('flourType', e.target.value)}>
            {FLOUR_TYPES.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>

        <div>
          <label>Flour (g)</label>
          <input type="number" value={form.flourGrams} onChange={e => set('flourGrams', +e.target.value)} />
        </div>
        <div>
          <label>Water (g)</label>
          <input type="number" value={form.waterGrams} onChange={e => set('waterGrams', +e.target.value)} />
        </div>
        <div>
          <label>Starter kept (g)</label>
          <input type="number" value={form.starterGrams} onChange={e => set('starterGrams', +e.target.value)} />
        </div>
        <div>
          <label>Room temp (°F)</label>
          <input type="number" value={form.temp} onChange={e => set('temp', e.target.value)} placeholder="72" />
        </div>
        <div>
          <label>Rise height (optional)</label>
          <input type="text" value={form.riseHeight} onChange={e => set('riseHeight', e.target.value)} placeholder="e.g. doubled" />
        </div>
        <div>
          <label>Rise time (optional)</label>
          <input type="text" value={form.riseTime} onChange={e => set('riseTime', e.target.value)} placeholder="e.g. 4 hours" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Smells great, very active..." />
        </div>
      </div>

      <div style={{ marginTop: '12px', marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'var(--cream)', fontSize: '0.8rem', color: 'var(--mist)' }}>
        Hydration: <strong style={{ color: 'var(--crust)' }}>{hydration}%</strong>
        &nbsp;·&nbsp; Total: <strong style={{ color: 'var(--char)' }}>{+form.flourGrams + +form.waterGrams + +form.starterGrams}g</strong>
      </div>

      <button className="btn-primary" style={{ width: '100%' }} onClick={handleSubmit}>
        {saved ? '✓ Feeding logged!' : 'Log Feeding'}
      </button>
    </div>
  );
}

function FeedingHistory({ feedings }) {
  if (!feedings?.length) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--mist)' }}>
        <p>No feedings logged yet.</p>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Feeding History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto' }}>
        {feedings.map(f => (
          <div key={f.id} style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--cream)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--char)' }}>
                {f.flourGrams}g {f.flourType} · {f.waterGrams}g water
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
                {format(parseISO(f.date), 'MMM d, h:mma')}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
              Kept: {f.starterGrams}g
              {f.temp && ` · ${f.temp}°F`}
              {f.riseHeight && ` · Rose: ${f.riseHeight}`}
              {f.riseTime && ` in ${f.riseTime}`}
            </div>
            {f.notes && <p style={{ fontSize: '0.78rem', color: 'var(--ash)', marginTop: '4px', fontStyle: 'italic' }}>{f.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthForm() {
  const [form, setForm] = useState({ floatTest: '', smell: '', color: '', risePercent: '', notes: '' });
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    await logStarterHealth(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm({ floatTest: '', smell: '', color: '', risePercent: '', notes: '' });
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 className="serif" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Health Check</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--mist)', marginBottom: '20px' }}>
        Run these checks 4–6 hours after a feeding at peak activity.
      </p>

      <HealthTip icon="💧" title="Float Test" detail="Drop a small spoonful in water. Does it float?" />

      <div style={{ display: 'grid', gap: '14px', marginTop: '16px' }}>
        <div>
          <label>Float Test Result</label>
          <select value={form.floatTest} onChange={e => set('floatTest', e.target.value)}>
            <option value="">— select —</option>
            <option value="floats">Floats ✓ (ready to bake)</option>
            <option value="sinks">Sinks (not ready)</option>
            <option value="borderline">Borderline</option>
          </select>
        </div>
        <div>
          <label>Smell</label>
          <select value={form.smell} onChange={e => set('smell', e.target.value)}>
            <option value="">— select —</option>
            <option value="yeasty-sweet">Yeasty & sweet</option>
            <option value="sour-tangy">Sour & tangy</option>
            <option value="very-sour">Very sour / acetone</option>
            <option value="flat">Flat / no smell</option>
            <option value="off">Off / unpleasant</option>
          </select>
        </div>
        <div>
          <label>Color</label>
          <select value={form.color} onChange={e => set('color', e.target.value)}>
            <option value="">— select —</option>
            <option value="white-cream">White / cream</option>
            <option value="slightly-gray">Slightly gray</option>
            <option value="pink-orange">Pink or orange (discard!)</option>
          </select>
        </div>
        <div>
          <label>Rise % since feeding</label>
          <input type="number" value={form.risePercent} onChange={e => set('risePercent', e.target.value)} placeholder="e.g. 100 (doubled)" />
        </div>
        <div>
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Observations..." />
        </div>
      </div>

      <button className="btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={handleSubmit}>
        {saved ? '✓ Saved!' : 'Save Health Check'}
      </button>
    </div>
  );
}

function HealthHistory({ logs }) {
  if (!logs?.length) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--mist)' }}>
        <p>No health checks logged yet.</p>
      </div>
    );
  }
  const smellScore = { 'yeasty-sweet': '🟢', 'sour-tangy': '🟡', 'very-sour': '🟠', 'flat': '🔴', 'off': '🔴' };
  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Health History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto' }}>
        {logs.map(l => (
          <div key={l.id} style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--cream)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                {l.floatTest === 'floats' ? '✓ Float test passed' : l.floatTest === 'sinks' ? '✗ Sinks' : 'Float: borderline'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--mist)' }}>
                {format(parseISO(l.date), 'MMM d')}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--mist)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {l.smell && <span>{smellScore[l.smell] || '?'} {l.smell}</span>}
              {l.color && <span>Color: {l.color}</span>}
              {l.risePercent && <span>Rose {l.risePercent}%</span>}
            </div>
            {l.notes && <p style={{ fontSize: '0.78rem', marginTop: '4px', fontStyle: 'italic', color: 'var(--ash)' }}>{l.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthTip({ icon, title, detail }) {
  return (
    <div style={{ background: 'var(--rise-light)', borderRadius: '10px', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <div>
        <p style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--rise)', marginBottom: '2px' }}>{title}</p>
        <p style={{ fontSize: '0.78rem', color: 'var(--ash)' }}>{detail}</p>
      </div>
    </div>
  );
}

function ReminderForm({ settings }) {
  const [hours, setHours] = useState(settings?.feedingIntervalHours || 12);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updateReminderSettings({ feedingIntervalHours: hours });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 className="serif" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Reminder Settings</h3>
      <div style={{ marginBottom: '20px' }}>
        <label>Feeding interval (hours)</label>
        <input type="number" value={hours} min={4} max={48} onChange={e => setHours(+e.target.value)} />
        <p style={{ fontSize: '0.75rem', color: 'var(--mist)', marginTop: '6px' }}>
          A banner will appear at the top of the app when it's time to feed.
          At room temp (~70°F), feed every 12h. In summer, every 8h. In winter, every 18–24h.
        </p>
      </div>
      <button className="btn-primary" style={{ width: '100%' }} onClick={handleSave}>
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}

function ReminderInfo({ settings, feedings }) {
  const lastFed = feedings?.[0];
  const hoursSince = lastFed ? differenceInHours(new Date(), parseISO(lastFed.date)) : null;
  const nextFeed = settings?.feedingIntervalHours && hoursSince !== null
    ? Math.max(0, settings.feedingIntervalHours - hoursSince)
    : null;

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Current Status</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <InfoRow label="Last fed" value={lastFed ? `${hoursSince}h ago (${format(parseISO(lastFed.date), 'MMM d, h:mma')})` : 'Not yet logged'} />
        <InfoRow label="Feeding interval" value={settings?.feedingIntervalHours ? `Every ${settings.feedingIntervalHours} hours` : '—'} />
        <InfoRow label="Next feeding in" value={nextFeed !== null ? (nextFeed === 0 ? 'Now!' : `~${nextFeed}h`) : '—'} highlight={nextFeed === 0} />
      </div>
      <div style={{ marginTop: '20px', padding: '14px', background: 'var(--cream)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--mist)', lineHeight: '1.6' }}>
        <strong style={{ color: 'var(--ash)', display: 'block', marginBottom: '6px' }}>Feeding Tips</strong>
        At room temp (~70°F), feed every 12 hours. Warmer kitchens need more frequent feeding.
        Cold starters (fridge) only need feeding once a week — take out, feed, let it peak, then use or return to fridge.
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--crumb)' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--mist)' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: '500', color: highlight ? 'var(--alert)' : 'var(--char)' }}>{value}</span>
    </div>
  );
}
