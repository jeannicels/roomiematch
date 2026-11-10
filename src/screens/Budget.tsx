import { useState } from 'react';
import { api } from '../lib/api';
import { budgetFit, costPerPerson, money, type BudgetFit } from '../lib/budget';
import { rankMatches, type Listing, type Profile } from '../lib/types';
import { Empty, Notice, useLoad } from '../components/ui';

const FIT_LABEL: Record<BudgetFit, string> = { under: 'Below budget', within: 'Within budget', over: 'Over budget' };

export function Budget({ me, go }: { me: Profile; go: (hash: string) => void }) {
  const [partnerId, setPartnerId] = useState('');
  const [splits, setSplits] = useState<Record<string, number>>({});
  const { data, error } = useLoad(async () => {
    const [listings, saved, profiles] = await Promise.all([api.listListings(), api.listSavedIds(), api.listProfiles()]);
    return { listings: listings.filter((l) => saved.includes(l.id)), matches: rankMatches(me, profiles) };
  }, [me]);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <p className="muted">Loading your comparison</p>;

  const partner = data.matches.find((entry) => entry.profile.id === partnerId)?.profile;
  const people = (listing: Listing) => splits[listing.id] ?? listing.max_tenants;

  return (
    <section>
      <header className="page-head">
        <h1>Compare rental budgets</h1>
        <p>See what each saved place costs per person, and whether it works for you and a potential roommate.</p>
      </header>
      <label htmlFor="partner">Compare with
        <select id="partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">Just me</option>
          {data.matches.map(({ profile }) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}
        </select>
      </label>

      {data.listings.length === 0 ? (
        <Empty title="No places to compare yet">
          <button className="btn" onClick={() => go('listings')}>Browse listings</button>
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Per person</th>
                {data.listings.map((l) => <th scope="col" key={l.id}>{l.title}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Split between</th>
                {data.listings.map((l) => (
                  <td key={l.id}>
                    <select aria-label={`People sharing ${l.title}`} value={people(l)} onChange={(e) => setSplits({ ...splits, [l.id]: Number(e.target.value) })}>
                      {Array.from({ length: l.max_tenants }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
              {([
                ['Rent', 'rent'], ['Bills', 'bills'], ['Monthly total', 'monthly'],
                ['Due at move-in', 'move_in'], ['Over the lease', 'lease_total'],
              ] as const).map(([label, key]) => (
                <tr key={key} className={key === 'monthly' ? 'row-strong' : ''}>
                  <th scope="row">{label}</th>
                  {data.listings.map((l) => <td key={l.id}>{money(costPerPerson(l, people(l))[key])}</td>)}
                </tr>
              ))}
              <FitRow label="Your budget" person={me} listings={data.listings} people={people} />
              {partner && <FitRow label={`${partner.display_name.split(' ')[0]}'s budget`} person={partner} listings={data.listings} people={people} />}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">Assumes rent, bills and deposit are split evenly. Due at move-in is your deposit share plus the first month.</p>
    </section>
  );
}

function FitRow({ label, person, listings, people }: {
  label: string; person: Profile; listings: Listing[]; people: (listing: Listing) => number;
}) {
  return (
    <tr>
      <th scope="row">{label}<br /><span className="muted">{money(person.budget_min)} to {money(person.budget_max)}</span></th>
      {listings.map((l) => {
        const monthly = costPerPerson(l, people(l)).monthly;
        const fit = budgetFit(monthly, person);
        return (
          <td key={l.id}>
            <span className={`pill pill-${fit}`}>{FIT_LABEL[fit]}</span>
            {fit === 'over' && <span className="muted over"> by {money(monthly - person.budget_max)}</span>}
          </td>
        );
      })}
    </tr>
  );
}
