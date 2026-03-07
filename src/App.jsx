import { Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import StarterPage from './pages/StarterPage';
import GoalsPage from './pages/GoalsPage';
import BakingPage from './pages/BakingPage';
import RecipesPage from './pages/RecipesPage';
import FeedingReminderBanner from './components/shared/FeedingReminderBanner';
import { useReminderSettings } from './hooks/useData';
import { AuthProvider, useAuth } from './context/AuthContext';
import { differenceInHours, parseISO } from 'date-fns';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', shortLabel: 'Home', icon: '⌂' },
  { path: '/starter', label: 'Starter', shortLabel: 'Starter', icon: '🫙' },
  { path: '/goals', label: 'Weekly Goals', shortLabel: 'Goals', icon: '◎' },
  { path: '/baking', label: 'Baking', shortLabel: 'Baking', icon: '◈' },
  { path: '/recipes', label: 'Recipes', shortLabel: 'Recipes', icon: '◇' },
];

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { user, signOut } = useAuth();
  const reminderSettings = useReminderSettings();
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    if (!user || !reminderSettings) { setShowReminder(false); return; }
    if (!reminderSettings.lastFed) { setShowReminder(true); return; }
    const hoursSince = differenceInHours(new Date(), parseISO(reminderSettings.lastFed));
    setShowReminder(hoursSince >= (reminderSettings.feedingIntervalHours || 12));
  }, [reminderSettings, user]);

  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--parchment)' }}>
        <p style={{ color: 'var(--mist)', fontStyle: 'italic' }}>Loading...</p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <>
      <div className="min-h-screen flex">
        {/* Desktop sidebar */}
        <aside className="sidebar-nav">
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
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px', fontSize: '0.875rem',
                  fontWeight: isActive ? '500' : '400',
                  color: isActive ? 'var(--cream)' : 'var(--mist)',
                  background: isActive ? 'rgba(193, 127, 62, 0.2)' : 'transparent',
                  textDecoration: 'none', transition: 'all 0.15s ease',
                  borderLeft: isActive ? '3px solid var(--crust)' : '3px solid transparent',
                })}
              >
                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User account */}
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--crumb)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {user.photoURL && (
                <img src={user.photoURL} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0 }} />
              )}
              <p style={{
                fontSize: '0.75rem', color: 'var(--ash)', fontWeight: '500',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
              }}>
                {user.displayName || user.email}
              </p>
            </div>
            <button onClick={signOut} style={{
              width: '100%', padding: '6px 10px', background: 'none',
              border: '1px solid var(--crumb)', borderRadius: '8px',
              cursor: 'pointer', color: 'var(--mist)', fontSize: '0.75rem',
              transition: 'all 0.15s',
            }}>
              Sign out
            </button>
            <p style={{ color: 'rgba(140,130,121,0.4)', fontSize: '0.68rem', marginTop: '8px' }}>v0.2.0</p>
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
          <main className="main-content flex-1 p-8" style={{ maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
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

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}

// ── Login Screen ──────────────────────────────────────────────────
function LoginScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn();
    } catch {
      setError('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--parchment)', padding: '24px',
    }}>
      <div style={{ maxWidth: '380px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '3.5rem', color: 'var(--crust)', lineHeight: 1, marginBottom: '6px' }}>
          Levain
        </h1>
        <p style={{ color: 'var(--mist)', fontStyle: 'italic', marginBottom: '48px', fontSize: '0.9rem' }}>
          your sourdough companion
        </p>

        <div className="card" style={{ padding: '36px' }}>
          <p style={{ color: 'var(--ash)', fontSize: '0.875rem', marginBottom: '28px', lineHeight: '1.65' }}>
            Sign in to sync your recipes, starter logs, and baking goals across all your devices.
          </p>
          <button
            onClick={handleSignIn}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: '10px',
              border: '1px solid var(--crumb)', background: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              cursor: loading ? 'default' : 'pointer', fontSize: '0.9rem',
              fontWeight: '500', color: 'var(--char)', opacity: loading ? 0.7 : 1,
            }}
          >
            <GoogleIcon />
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
          {error && (
            <p style={{ color: 'var(--alert)', fontSize: '0.8rem', marginTop: '12px' }}>{error}</p>
          )}
        </div>

        <p style={{ color: 'var(--mist)', fontSize: '0.72rem', marginTop: '20px' }}>
          Your data is stored privately — only you can access it
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.31z"/>
    </svg>
  );
}
