import { useState } from 'react';
import { api } from '../lib/api';
import { money } from '../lib/budget';
import { rankMatches, scoreMatch, type Analysis, type Connection, type Contact, type Profile } from '../lib/types';
import { Avatar, Empty, LivingDial, Notice, useLoad } from '../components/ui';

export function Matches({ me, selected, go }: { me: Profile; selected?: string; go: (hash: string) => void }) {
  const [area, setArea] = useState('');
  const { data, error, reload } = useLoad(async () => ({
    ranked: rankMatches(me, await api.listProfiles()),
    connections: await api.listConnections(),
  }), [me]);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <p className="muted">Finding your matches</p>;

  const list = data.ranked.filter(({ profile }) =>
    profile.preferred_area.toLowerCase().includes(area.toLowerCase()));
  const active = selected ?? (matchMedia('(min-width: 960px)').matches ? list[0]?.profile.id : undefined);

  return (
    <div className={`split ${selected ? 'split-detail' : ''}`}>
      <section className="split-list">
        <header className="page-head">
          <h1>Your matches</h1>
          <p>Ranked by lifestyle, budget and move-in date. Dealbreakers are already filtered out.</p>
        </header>
        <label htmlFor="area-filter">Filter by area
          <input id="area-filter" value={area} onChange={(e) => setArea(e.target.value)} placeholder="East Gate" />
        </label>
        {list.length === 0 && (
          <Empty title="No matches yet">
            <p>{area ? 'Clear the area filter to see everyone.' : 'Widen your dealbreakers in your profile, or invite classmates to join.'}</p>
          </Empty>
        )}
        <ul className="match-list">
          {list.map(({ profile, match }) => (
            <li key={profile.id}>
              <button className={`match ${active === profile.id ? 'match-on' : ''}`} onClick={() => go(`person-${profile.id}`)}>
                <span className="score">{match.score}</span>
                <span className="match-body">
                  <strong>{profile.display_name}</strong>
                  <span>{profile.course || profile.university}</span>
                  <span className="muted">
                    {match.shared_budget ? `Shared budget ${money(match.shared_budget.min)} to ${money(match.shared_budget.max)}` : 'Budgets do not overlap'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="split-main">
        {active
          ? <Person key={active} me={me} id={active} connections={data.connections} onChange={reload} go={go} />
          : <p className="muted desktop-only">Choose a match to compare how you live.</p>}
      </section>
    </div>
  );
}

function Person({ me, id, connections, onChange, go }: {
  me: Profile; id: string; connections: Connection[]; onChange: () => void; go: (hash: string) => void;
}) {
  const [analysis, setAnalysis] = useState<Analysis>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [done, setDone] = useState('');
  const { data } = useLoad(async () => {
    const person = await api.getProfile(id);
    const contact: Contact | null = person ? await api.getContact(id) : null;
    return { person, contact };
  }, [id, connections]);
  if (!data) return <p className="muted">Loading</p>;
  const person = data.person;
  if (!person) return <Empty title="This student is not available" />;

  const match = scoreMatch(me, person);
  const first = person.display_name.split(' ')[0];
  const connection = connections.find((c) => [c.requester_id, c.addressee_id].includes(id));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="person">
      <button className="link back" onClick={() => go('matches')}>Back to matches</button>
      <header className="person-head">
        <Avatar name={person.display_name} />
        <div>
          <h2>{person.display_name}</h2>
          <p className="muted">{person.course ? `${person.course}, year ${person.year_of_study}` : `Year ${person.year_of_study}`}. {person.university}</p>
        </div>
        <div className="person-score"><b>{match.score}</b><span>out of 100</span></div>
      </header>
      {person.bio && <p className="bio">{person.bio}</p>}

      <LivingDial me={me} other={person} />

      <dl className="facts">
        <div><dt>Lifestyle</dt><dd>{match.lifestyle}/60</dd></div>
        <div><dt>Budget</dt><dd>{match.budget}/30</dd></div>
        <div><dt>Timing</dt><dd>{match.timing}/10</dd></div>
        <div><dt>Their budget</dt><dd>{money(person.budget_min)} to {money(person.budget_max)}</dd></div>
        <div><dt>Moving</dt><dd>{new Date(person.move_in_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</dd></div>
        <div><dt>Area</dt><dd>{person.preferred_area || 'Open'}</dd></div>
      </dl>

      {error && <Notice>{error}</Notice>}

      <section className="analysis">
        {!analysis && (
          <>
            <h3>Would you actually get along?</h3>
            <p>See where you line up, what may cause friction, and what to ask {first} before signing.</p>
            <button className="btn" disabled={busy} onClick={() => run(async () => setAnalysis(await api.analyze(id)))}>
              {busy ? 'Building report' : 'See compatibility report'}
            </button>
          </>
        )}
        {analysis && (
          <>
            <h3>Compatibility report</h3>
            <p>{analysis.summary}</p>
            <h4>Where you line up</h4>
            <ul>{analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
            <h4>Where it could get tense</h4>
            <ul>{analysis.friction.map((item) => <li key={item}>{item}</li>)}</ul>
            <h4>Ask before you sign</h4>
            <ul>{analysis.questions.map((item) => <li key={item}>{item}</li>)}</ul>
          </>
        )}
      </section>

      <div className="actions">
        {!connection && (
          <button className="btn" disabled={busy} onClick={() => run(async () => { await api.requestConnection(id); onChange(); })}>
            Send connection request
          </button>
        )}
        {connection?.status === 'pending' && connection.requester_id === me.id && <span className="pill">Request sent</span>}
        {connection?.status === 'pending' && connection.addressee_id === me.id && (
          <button className="btn" disabled={busy} onClick={() => run(async () => { await api.respondToConnection(connection.id, 'accepted'); onChange(); })}>
            Accept request
          </button>
        )}
        {connection?.status === 'declined' && <span className="pill">Not connected</span>}
        {connection?.status === 'accepted' && data.contact && (
          <p className="contact"><span className="muted">{data.contact.contact_method}</span> <strong>{data.contact.contact_value}</strong></p>
        )}
      </div>

      <div className="safety">
        {done ? <p className="muted">{done}</p> : (
          <>
            {reporting ? (
              <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.report({ user: id }, reason); setDone('Report sent. Thank you.'); }); }}>
                <label htmlFor="report-reason">What happened?
                  <textarea id="report-reason" required minLength={3} maxLength={1000} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
                <button className="btn btn-quiet" disabled={busy}>Send report</button>
              </form>
            ) : <button className="link" onClick={() => setReporting(true)}>Report {first}</button>}
            {confirmBlock ? (
              <button className="link link-danger" onClick={() => run(async () => { await api.block(id); go('matches'); onChange(); })}>
                Confirm: block {first}
              </button>
            ) : <button className="link" onClick={() => setConfirmBlock(true)}>Block {first}</button>}
          </>
        )}
      </div>
    </article>
  );
}
