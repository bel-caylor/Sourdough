import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import StarterPage from './pages/StarterPage';
import GoalsPage from './pages/GoalsPage';
import BakingPage from './pages/BakingPage';
import RecipesPage from './pages/RecipesPage';
import FeedingReminderBanner from './components/shared/FeedingReminderBanner';
import { useReminderSettings } from './hooks/useData';
import { differenceInHours, parseISO } from 'date-fns';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '⌂' },
  { path: '/starter', label: 'Starter', icon: '🫙' },
  { path: '/goals', label: 'Weekly Goals', icon: '◎' },
  { path: '/baking', label: 'Baking', icon: '◈' },
  { path: '/recipes', label: 'Recipe Log', icon: '◇' },
];

export default function App() {
  const location = useLocation();
  const reminderSettings = useReminderSettings();
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    if (!reminderSettings?.lastFed) {
      setShowReminder(true);
      return;
    }
    const hoursSince = differenceInHours(new Date(), parseISO(reminderSettings.lastFed));
    setShowReminder(hoursSince >= (reminderSettings.feedingIntervalHours || 12));
  }, [reminderSettings]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside style={{ background: 'var(--char)', width: '220px', minHeight: '100vh', flexShrink: 0 }}
        className="flex flex-col py-8 px-5">
        <div className="mb-10">
          <h1 style={{ color: 'var(--crust)', fontSize: '1.6rem', lineHeight: 1.1 }}>
            Levain
          </h1>
          <p style={{ color: 'var(--mist)', fontSize: '0.75rem', marginTop: '4px', fontStyle: 'italic' }}>
            sourdough companion
          </p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '0.875rem',
                fontWeight: isActive ? '500' : '400',
                color: isActive ? 'var(--cream)' : 'var(--mist)',
                background: isActive ? 'rgba(193, 127, 62, 0.2)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                borderLeft: isActive ? '3px solid var(--crust)' : '3px solid transparent',
              })}
            >
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ color: 'var(--mist)', fontSize: '0.7rem', marginTop: 'auto', paddingTop: '20px' }}>
          <p>All data stored locally</p>
          <p style={{ color: 'rgba(140,130,121,0.5)', marginTop: '2px' }}>v0.1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
        {showReminder && (
          <FeedingReminderBanner
            settings={reminderSettings}
            onDismiss={() => setShowReminder(false)}
          />
        )}
        <main className="flex-1 p-8" style={{ maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/starter" element={<StarterPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/baking" element={<BakingPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
