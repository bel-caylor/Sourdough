import { useState } from 'react';
import { useBakingSessions, createBakingSession, advanceStage, completeSession } from '../hooks/useData';
import { format, parseISO } from 'date-fns';

export default function BakingPage() {
  const sessions = useBakingSessions();
  const [showNew, setShowNew] = useState(false);

  const active = sessions?.filter(s => s.stage !== -1) || [];
  const completed = sessions?.filter(s => s.stage === -1) || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h2 className="serif" style={{ fontSize: '2rem' }}>Baking Process</h2>
          <p style={{ color: 'var(--mist)', marginTop: '4px' }}>Step-by-step guides for active bakes</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(!showNew)}>
          {showNew ? 'Cancel' : '+ Start a Bake'}
        </button>
      </div>

      {showNew && <NewBakeForm onSave={() => setShowNew(false)} />}

      {active.length === 0 && !showNew && (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--mist)', marginBottom: '32px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>◈</div>
          <p style={{ marginBottom: '4px' }}>No active bakes.</p>
          <p style={{ fontSize: '0.8rem' }}>Start a bake to get step-by-step guidance.</p>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h3 className="serif" style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--ash)' }}>
            Active Bakes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {active.map(s => <BakeSession key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="serif" style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--mist)' }}>
            Completed Bakes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {completed.map(s => <CompletedBakeRow key={s.id} session={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function NewBakeForm({ onSave }) {
  const [name, setName] = useState('');
  const handleCreate = async () => {
    if (!name.trim()) return;
    await createBakingSession({ recipeName: name });
    onSave();
  };
  return (
    <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
      <h3 className="serif" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Start a New Bake</h3>
      <label>Recipe Name</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder="e.g. Country Sourdough, Whole Wheat Levain..." />
      <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
        <button className="btn-primary" onClick={handleCreate}>Start Bake</button>
        <button className="btn-secondary" onClick={onSave}>Cancel</button>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--mist)', marginTop: '12px' }}>
        This will start a guided 8-stage sourdough process. You can customize stages later.
      </p>
    </div>
  );
}

function BakeSession({ session }) {
  const [showComplete, setShowComplete] = useState(false);
  const [rating, setRating] = useState(5);
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');

  const currentStage = session.stages?.[session.stage];
  const progress = session.stages?.length
    ? Math.round((session.stage / session.stages.length) * 100)
    : 0;

  const handleAdvance = async () => {
    if (session.stage === session.stages.length - 1) {
      setShowComplete(true);
    } else {
      await advanceStage(session.id);
    }
  };

  const handleComplete = async () => {
    await completeSession(session.id, rating, outcome, notes);
    setShowComplete(false);
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="serif" style={{ fontSize: '1.2rem' }}>{session.recipeName}</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
          Started {format(parseISO(session.startDate), 'MMM d, h:mma')}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--mist)' }}>
            Stage {session.stage + 1} of {session.stages?.length}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--crust)', fontWeight: '500' }}>
            {progress}%
          </span>
        </div>
        <div style={{ background: 'var(--crumb)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`, height: '100%',
            background: 'var(--crust)', borderRadius: '999px',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Stage list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {session.stages?.map((stage, i) => (
          <StageRow key={i} stage={stage} index={i} currentIndex={session.stage} />
        ))}
      </div>

      {/* Current stage detail */}
      {currentStage && !showComplete && (
        <div style={{ background: 'var(--cream)', borderRadius: '12px', padding: '18px', marginBottom: '16px', borderLeft: '3px solid var(--crust)' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Current Step
          </p>
          <p style={{ fontWeight: '600', marginBottom: '6px' }}>{currentStage.name}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--ash)', lineHeight: '1.6' }}>{currentStage.description}</p>
          {currentStage.duration && (
            <p style={{ fontSize: '0.78rem', color: 'var(--crust)', marginTop: '8px', fontWeight: '500' }}>
              ⏱ {currentStage.duration}
            </p>
          )}
        </div>
      )}

      {showComplete ? (
        <div style={{ background: 'var(--rise-light)', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
          <p className="serif" style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--rise)' }}>
            🎉 Mark this bake complete!
          </p>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div>
              <label>Rating (1–10)</label>
              <input type="number" min={1} max={10} value={rating} onChange={e => setRating(+e.target.value)} />
            </div>
            <div>
              <label>Outcome / Result</label>
              <input type="text" value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="Open crumb, good oven spring, slightly dense..." />
            </div>
            <div>
              <label>Notes for next time</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What to do differently..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button className="btn-primary" onClick={handleComplete}>Complete Bake</button>
            <button className="btn-secondary" onClick={() => setShowComplete(false)}>Back</button>
          </div>
        </div>
      ) : (
        <button className="btn-primary" onClick={handleAdvance}>
          {session.stage === session.stages?.length - 1 ? 'Finish Bake →' : `Complete Stage & Continue →`}
        </button>
      )}
    </div>
  );
}

function StageRow({ stage, index, currentIndex }) {
  const isPast = index < currentIndex;
  const isCurrent = index === currentIndex;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      opacity: isPast ? 0.5 : 1,
    }}>
      <div style={{
        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.65rem', fontWeight: '700',
        background: isPast ? 'var(--rise)' : isCurrent ? 'var(--crust)' : 'var(--crumb)',
        color: isPast || isCurrent ? 'white' : 'var(--mist)',
        border: isCurrent ? '2px solid var(--crust)' : 'none',
      }}>
        {isPast ? '✓' : index + 1}
      </div>
      <span style={{
        fontSize: '0.82rem',
        fontWeight: isCurrent ? '600' : '400',
        color: isCurrent ? 'var(--char)' : 'var(--mist)',
      }}>
        {stage.name}
      </span>
    </div>
  );
}

function CompletedBakeRow({ session }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontWeight: '600', fontFamily: 'Playfair Display, serif' }}>{session.recipeName}</span>
          {session.outcome && (
            <p style={{ fontSize: '0.78rem', color: 'var(--mist)', marginTop: '3px' }}>{session.outcome}</p>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {session.rating && (
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--crust)' }}>
              {session.rating}/10
            </div>
          )}
          <div style={{ fontSize: '0.72rem', color: 'var(--mist)' }}>
            {format(parseISO(session.startDate), 'MMM d')}
          </div>
        </div>
      </div>
      {session.notes && (
        <p style={{ fontSize: '0.78rem', color: 'var(--ash)', marginTop: '6px', fontStyle: 'italic', borderTop: '1px solid var(--crumb)', paddingTop: '8px' }}>
          Notes: {session.notes}
        </p>
      )}
    </div>
  );
}
