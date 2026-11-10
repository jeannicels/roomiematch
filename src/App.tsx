import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from './lib/api';
import type { Profile } from './lib/types';
import { Notice } from './components/ui';
import { Budget } from './screens/Budget';
import { Connections } from './screens/Connections';
import { Listings } from './screens/Listings';
import { Matches } from './screens/Matches';
import { ProfileForm } from './screens/ProfileForm';

const TABS = [
  ['matches', 'Matches'],
  ['listings', 'Listings'],
  ['budget', 'Budget'],
  ['connections', 'Connections'],
  ['my-profile', 'Profile'],
] as const;

const readHash = () => location.hash.slice(1) || 'matches';

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'in') await api.signIn(email, password);
      else if ((await api.signUp(email, password)) === 'confirm_email') setMessage('Check your email to confirm your account, then sign in.');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="signin">
      <div className="brand brand-large">Roomie<span>Match</span></div>
      <h1>Find someone you can actually live with.</h1>
      <p>Match with students by lifestyle, budget and move-in date, then compare places together.</p>
      <form className="form" onSubmit={submit}>
        <label htmlFor="email">Email<input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label htmlFor="password">Password<input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <Notice>{error}</Notice>}
        {message && <Notice tone="info">{message}</Notice>}
        <button className="btn" disabled={busy}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
      </button>
    </main>
  );
}

export function App() {
  const [userId, setUserId] = useState<string | null | undefined>();
  const [me, setMe] = useState<Profile | null | undefined>();
  const [pending, setPending] = useState(0);
  const [hash, setHash] = useState(readHash);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const id = await api.currentUserId();
      setUserId(id);
      if (!id) return setMe(null);
      setMe(await api.getProfile(id));
      const connections = await api.listConnections();
      setPending(connections.filter((c) => c.status === 'pending' && c.addressee_id === id).length);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const stop = api.onAuthChange(() => void refresh());
    const onHash = () => setHash(readHash());
    addEventListener('hashchange', onHash);
    return () => {
      stop();
      removeEventListener('hashchange', onHash);
    };
  }, [refresh]);

  const go = useCallback((next: string) => {
    location.hash = next;
    setHash(next);
    scrollTo(0, 0);
  }, []);

  if (error) return <main className="signin"><Notice>{error}</Notice></main>;
  if (userId === undefined || me === undefined) return <main className="signin"><p className="muted">Loading</p></main>;
  if (!userId) return <SignIn />;
  if (!me) return <main className="page"><ProfileForm userId={userId} onSaved={refresh} firstTime /></main>;

  const selected = hash.startsWith('person-') ? hash.slice('person-'.length) : undefined;
  const tab = selected ? 'matches' : hash;

  return (
    <>
      {api.isDemo && <p className="demo-bar">Demo with made-up students. Nothing you enter leaves this page, and it resets when you reload.</p>}
      <header className="top">
        <div className="top-inner">
          <button className="brand" onClick={() => go('matches')}>Roomie<span>Match</span></button>
          <nav aria-label="Main">
            {TABS.map(([id, label]) => (
              <button key={id} className={tab === id ? 'tab tab-on' : 'tab'} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
                {label}{id === 'connections' && pending > 0 && <span className="badge">{pending}</span>}
              </button>
            ))}
          </nav>
          {!api.isDemo && <button className="link signout" onClick={() => api.signOut()}>Sign out</button>}
        </div>
      </header>
      <main className="page">
        {tab === 'matches' && <Matches me={me} selected={selected} go={go} />}
        {tab === 'listings' && <Listings me={me} />}
        {tab === 'budget' && <Budget me={me} go={go} />}
        {tab === 'connections' && <Connections me={me} go={go} onChange={refresh} />}
        {tab === 'my-profile' && <div className="narrow"><ProfileForm userId={userId} onSaved={refresh} /></div>}
      </main>
    </>
  );
}
