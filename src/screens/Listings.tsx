import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { CURRENCY, costPerPerson, money, peopleNeeded } from '../lib/budget';
import type { Listing, ListingInput, Profile } from '../lib/types';
import { Empty, Notice, useLoad } from '../components/ui';

const emptyListing: ListingInput = {
  title: '', description: '', area: '', rent_monthly: 1200, bills_monthly: 150, deposit: 1200, max_tenants: 2,
  available_from: new Date().toISOString().slice(0, 10), lease_months: 12, furnished: false, source_url: null,
};

export function Listings({ me }: { me: Profile }) {
  const { data, error, reload } = useLoad(async () => ({
    listings: await api.listListings(),
    saved: await api.listSavedIds(),
  }));
  const [adding, setAdding] = useState(false);
  const [maxShare, setMaxShare] = useState(false);
  const [actionError, setActionError] = useState('');
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <p className="muted">Loading listings</p>;

  const act = async (action: () => Promise<void>) => {
    setActionError('');
    try {
      await action();
      await reload();
    } catch (reason) {
      setActionError((reason as Error).message);
    }
  };
  const shown = data.listings.filter((l) => !maxShare || peopleNeeded(l, me.budget_max) !== null);

  return (
    <section>
      <header className="page-head page-head-row">
        <div>
          <h1>Listings</h1>
          <p>Places shared by students. Never pay a deposit before viewing a place and checking who owns it.</p>
        </div>
        <button className="btn" onClick={() => setAdding(!adding)}>{adding ? 'Close form' : 'Share a listing'}</button>
      </header>
      {adding && <ListingForm onDone={() => { setAdding(false); void reload(); }} />}
      <label className="check" htmlFor="fit-filter">
        <input id="fit-filter" type="checkbox" checked={maxShare} onChange={(e) => setMaxShare(e.target.checked)} />
        Only show places I can afford when the rent is shared
      </label>
      {actionError && <Notice>{actionError}</Notice>}
      {shown.length === 0 && <Empty title="No listings to show"><p>Share a place you know about, or turn off the filter.</p></Empty>}
      <div className="listing-grid">
        {shown.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            me={me}
            saved={data.saved.includes(listing.id)}
            onToggle={(next) => act(() => api.setSaved(listing.id, next))}
            onTaken={() => act(() => api.markListingTaken(listing.id))}
            onDelete={() => act(() => api.deleteListing(listing.id))}
            onReport={(reason) => act(() => api.report({ listing: listing.id }, reason))}
          />
        ))}
      </div>
    </section>
  );
}

function ListingCard({ listing, me, saved, onToggle, onTaken, onDelete, onReport }: {
  listing: Listing; me: Profile; saved: boolean; onToggle: (next: boolean) => void;
  onTaken: () => void; onDelete: () => void; onReport: (reason: string) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [reported, setReported] = useState(false);
  const mine = listing.owner_id === me.id;
  const share = costPerPerson(listing, listing.max_tenants);
  const needed = peopleNeeded(listing, me.budget_max);
  return (
    <article className="listing">
      {listing.photo_urls[0]
        ? <img src={listing.photo_urls[0]} alt={listing.title} />
        : <div className="plan" aria-hidden="true"><i /><i /><i /></div>}
      <div className="listing-body">
        <h3>{listing.title}</h3>
        <p className="muted">{listing.area}. {listing.max_tenants === 1 ? 'Fits 1' : `Fits up to ${listing.max_tenants}`}. {listing.furnished ? 'Furnished' : 'Unfurnished'}.</p>
        <p className="price"><b>{money(share.monthly)}</b> each a month{listing.max_tenants > 1 ? ` split ${listing.max_tenants} ways` : ''}, bills included</p>
        <p className="fit">
          {needed === null ? 'Over your budget, even when fully shared.'
            : needed === 1 ? 'You could afford this alone.'
            : `Fits your budget with ${needed} people.`}
        </p>
        {listing.description && <p>{listing.description}</p>}
        {listing.status === 'taken' && <span className="pill">Taken</span>}
        {listing.source_url && <a href={listing.source_url} target="_blank" rel="noreferrer noopener">View the original advert</a>}
        <div className="listing-actions">
          <button className="btn btn-quiet" onClick={() => onToggle(!saved)}>{saved ? 'Remove from comparison' : 'Add to comparison'}</button>
          {mine && listing.status === 'active' && <button className="link" onClick={onTaken}>Mark as taken</button>}
          {mine && <button className="link" onClick={onDelete}>Delete</button>}
          {!mine && !reported && <button className="link" onClick={() => setReporting(!reporting)}>Report</button>}
          {reported && <span className="muted">Report sent</span>}
        </div>
        {reporting && !reported && (
          <form className="report" onSubmit={(e) => { e.preventDefault(); onReport(reason); setReported(true); }}>
            <label htmlFor={`report-${listing.id}`}>What is wrong with this listing?
              <textarea id={`report-${listing.id}`} rows={2} required minLength={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button className="btn btn-quiet">Send report</button>
          </form>
        )}
      </div>
    </article>
  );
}

function ListingForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState(emptyListing);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => setForm((c) => ({ ...c, [key]: value }));
  const number = (key: 'rent_monthly' | 'bills_monthly' | 'deposit' | 'max_tenants' | 'lease_months', label: string, min = 0) => (
    <label htmlFor={key}>{label}
      <input id={key} type="number" min={min} required value={form[key]} onChange={(e) => set(key, Number(e.target.value))} />
    </label>
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createListing({ ...form, source_url: form.source_url || null }, photos);
      onDone();
    } catch (reason) {
      setError((reason as Error).message);
      setBusy(false);
    }
  };
  return (
    <form className="form form-panel" onSubmit={submit}>
      <div className="grid-2">
        <label htmlFor="listing-title">Title
          <input id="listing-title" required minLength={3} maxLength={120} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label htmlFor="listing-area">Area (no street address)
          <input id="listing-area" required maxLength={120} value={form.area} onChange={(e) => set('area', e.target.value)} />
        </label>
        {number('rent_monthly', `Total monthly rent (${CURRENCY})`)}
        {number('bills_monthly', `Estimated monthly bills (${CURRENCY})`)}
        {number('deposit', `Total deposit (${CURRENCY})`)}
        {number('max_tenants', 'People it fits', 1)}
        {number('lease_months', 'Lease length in months', 1)}
        <label htmlFor="listing-from">Available from
          <input id="listing-from" type="date" required value={form.available_from} onChange={(e) => set('available_from', e.target.value)} />
        </label>
      </div>
      <label htmlFor="listing-description">Description
        <textarea id="listing-description" rows={3} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <label htmlFor="listing-url">Link to the advert (optional, https only)
        <input id="listing-url" type="url" pattern="https://.*" value={form.source_url ?? ''} onChange={(e) => set('source_url', e.target.value)} />
      </label>
      <label htmlFor="listing-photos">Photos, up to 6 (JPG, PNG or WebP under 5 MB)
        <input id="listing-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setPhotos([...(e.target.files ?? [])])} />
      </label>
      <label className="check" htmlFor="listing-furnished">
        <input id="listing-furnished" type="checkbox" checked={form.furnished} onChange={(e) => set('furnished', e.target.checked)} /> Furnished
      </label>
      {error && <Notice>{error}</Notice>}
      <button className="btn" disabled={busy}>{busy ? 'Sharing' : 'Share listing'}</button>
    </form>
  );
}
