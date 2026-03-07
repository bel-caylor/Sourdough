import { logFeeding } from '../../hooks/useData';

export default function FeedingReminderBanner({ settings, onDismiss }) {
  const handleFeedNow = async () => {
    // Quick-log a feeding with defaults so the timer resets
    await logFeeding({
      flourType: 'all-purpose',
      flourGrams: 50,
      waterGrams: 50,
      starterGrams: 10,
      notes: 'Quick feed (from reminder)',
      riseHeight: '',
      riseTime: '',
      temp: '',
    });
    onDismiss();
  };

  return (
    <div style={{
      background: 'var(--crust)',
      color: 'white',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      fontSize: '0.875rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.2rem' }}>⏰</span>
        <span>
          <strong>Time to feed your starter!</strong>
          {settings?.lastFed
            ? ` It's been a while since the last feeding.`
            : ` Log your first feeding to start tracking.`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={handleFeedNow}
          style={{
            background: 'white',
            color: 'var(--crust-dark)',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 14px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          I fed it
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Snooze
        </button>
      </div>
    </div>
  );
}
