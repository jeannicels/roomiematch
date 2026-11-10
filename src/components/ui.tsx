import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LIFESTYLE, type Profile } from '../lib/types';

export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useCallback(load, deps);
  const reload = useCallback(
    () =>
      stable()
        .then((value) => {
          setData(value);
          setError('');
        })
        .catch((reason: Error) => setError(reason.message)),
    [stable],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}

export const Notice = ({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) => (
  <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>{children}</p>
);

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="empty">
    <h3>{title}</h3>
    {children}
  </div>
);

export const Avatar = ({ name }: { name: string }) => (
  <span className="avatar" aria-hidden="true">
    {name.split(' ').slice(0, 2).map((part) => part[0]).join('')}
  </span>
);

/** Two markers on one scale: the gap between them is the point of the screen. */
export function LivingDial({ me, other }: { me: Profile; other: Profile }) {
  const first = other.display_name.split(' ')[0];
  return (
    <div className="dial">
      <div className="dial-key">
        <span><i className="dot dot-me" /> You</span>
        <span><i className="dot dot-them" /> {first}</span>
      </div>
      {LIFESTYLE.map((item) => {
        const mine = me[item.key];
        const theirs = other[item.key];
        const from = Math.min(mine, theirs);
        const to = Math.max(mine, theirs);
        const position = (value: number) => `${((value - 1) / 4) * 100}%`;
        return (
          <div className="dial-row" key={item.key}>
            <div className="dial-labels">
              <strong>{item.label}</strong>
              <span>{item.low} to {item.high}</span>
            </div>
            <div
              className="dial-track"
              role="img"
              aria-label={`${item.label}: you ${mine} of 5, ${first} ${theirs} of 5`}
            >
              {[1, 2, 3, 4, 5].map((tick) => (
                <i className="dial-tick" key={tick} style={{ left: position(tick) }} />
              ))}
              <i className="dial-gap" style={{ left: position(from), width: `${((to - from) / 4) * 100}%` }} />
              <i className="dot dot-them dial-dot" style={{ left: position(theirs) }} />
              <i className={`dot dot-me dial-dot ${mine === theirs ? 'dial-dot-same' : ''}`} style={{ left: position(mine) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
