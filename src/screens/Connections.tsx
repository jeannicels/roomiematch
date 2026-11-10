import { api } from '../lib/api';
import type { Connection, Contact, Profile } from '../lib/types';
import { Avatar, Empty, Notice, useLoad } from '../components/ui';

interface Row {
  connection: Connection;
  person: Profile | null;
  contact: Contact | null;
}

export function Connections({ me, go, onChange }: { me: Profile; go: (hash: string) => void; onChange: () => void }) {
  const { data, error, reload } = useLoad(async (): Promise<Row[]> => {
    const connections = await api.listConnections();
    return Promise.all(connections.map(async (connection) => {
      const otherId = connection.requester_id === me.id ? connection.addressee_id : connection.requester_id;
      return { connection, person: await api.getProfile(otherId), contact: await api.getContact(otherId) };
    }));
  }, [me.id]);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <p className="muted">Loading connections</p>;

  const update = async (action: Promise<void>) => {
    await action;
    await reload();
    onChange();
  };
  const incoming = data.filter((r) => r.connection.status === 'pending' && r.connection.addressee_id === me.id);
  const accepted = data.filter((r) => r.connection.status === 'accepted');
  const sent = data.filter((r) => r.connection.status === 'pending' && r.connection.requester_id === me.id);

  const name = (row: Row) => row.person?.display_name ?? 'Unavailable student';
  return (
    <section className="narrow">
      <header className="page-head">
        <h1>Connections</h1>
        <p>Contact details appear here once both of you agree.</p>
      </header>
      {data.length === 0 && (
        <Empty title="No connections yet">
          <button className="btn" onClick={() => go('matches')}>See your matches</button>
        </Empty>
      )}
      {incoming.length > 0 && <h2>Waiting for your reply</h2>}
      {incoming.map((row) => (
        <div className="row" key={row.connection.id}>
          <Avatar name={name(row)} />
          <button className="link row-name" onClick={() => go(`person-${row.person?.id}`)}>{name(row)}</button>
          <button className="btn" onClick={() => update(api.respondToConnection(row.connection.id, 'accepted'))}>Accept</button>
          <button className="btn btn-quiet" onClick={() => update(api.respondToConnection(row.connection.id, 'declined'))}>Decline</button>
        </div>
      ))}
      {accepted.length > 0 && <h2>Connected</h2>}
      {accepted.map((row) => (
        <div className="row" key={row.connection.id}>
          <Avatar name={name(row)} />
          <button className="link row-name" onClick={() => go(`person-${row.person?.id}`)}>{name(row)}</button>
          {row.contact && <span className="contact"><span className="muted">{row.contact.contact_method}</span> <strong>{row.contact.contact_value}</strong></span>}
          <button className="link" onClick={() => update(api.removeConnection(row.connection.id))}>Remove</button>
        </div>
      ))}
      {sent.length > 0 && <h2>Sent</h2>}
      {sent.map((row) => (
        <div className="row" key={row.connection.id}>
          <Avatar name={name(row)} />
          <span className="row-name">{name(row)}</span>
          <button className="link" onClick={() => update(api.removeConnection(row.connection.id))}>Withdraw</button>
        </div>
      ))}
    </section>
  );
}
