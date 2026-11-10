import { describe, expect, it } from 'vitest';
import { buildReport } from '../src/lib/compatibility';
import { budgetFit, costPerPerson, peopleNeeded } from '../src/lib/budget';
import { isEligible, rankMatches, scoreMatch, type Profile } from '../src/lib/types';
import type { Listing } from '../src/lib/types';

const base: Profile = {
  id: 'a', display_name: 'Ada Secretname', university: 'Secret University', course: 'CS', year_of_study: 1, bio: '',
  looking_for: 'either', budget_min: 500, budget_max: 800, preferred_area: '', move_in_date: '2027-01-01',
  lease_months: 12, gender: 'woman', roommate_gender_pref: 'any', smoker: false, okay_with_smoking: false,
  has_pets: false, okay_with_pets: true, is_visible: true, sleep_schedule: 3, cleanliness: 3, noise: 3,
  guests: 3, study_at_home: 3, social: 3,
};
const person = (values: Partial<Profile>): Profile => ({ ...base, id: 'b', ...values });

describe('scoreMatch', () => {
  it('gives 100 to identical people', () => expect(scoreMatch(base, person({})).score).toBe(100));

  it('is symmetric', () => {
    const other = person({ budget_min: 700, budget_max: 900, cleanliness: 5, move_in_date: '2027-03-01' });
    expect(scoreMatch(base, other).score).toBe(scoreMatch(other, base).score);
  });

  it('scores opposite lifestyles and no budget overlap low', () => {
    const other = person({
      budget_min: 2000, budget_max: 2500, move_in_date: '2028-01-01', sleep_schedule: 5, cleanliness: 5, noise: 5,
      guests: 5, study_at_home: 5, social: 5,
    });
    const low = person({ sleep_schedule: 1, cleanliness: 1, noise: 1, guests: 1, study_at_home: 1, social: 1 });
    const result = scoreMatch(low, other);
    expect(result.score).toBe(0);
    expect(result.shared_budget).toBeNull();
  });

  it('reports the shared budget', () => {
    expect(scoreMatch(base, person({ budget_min: 700, budget_max: 900 })).shared_budget).toEqual({ min: 700, max: 800 });
  });

  it('handles single-value budgets', () => {
    const one = person({ budget_min: 600, budget_max: 600 });
    expect(scoreMatch(one, { ...one, id: 'c' }).budget).toBe(30);
  });
});

describe('dealbreakers', () => {
  it('blocks a smoker for someone who cannot live with one', () => {
    expect(isEligible(base, person({ smoker: true }))).toBe(false);
    expect(isEligible(person({ smoker: true }), base)).toBe(false);
    expect(isEligible({ ...base, okay_with_smoking: true }, person({ smoker: true }))).toBe(true);
  });
  it('blocks pets for someone who cannot live with them', () => {
    expect(isEligible(person({ has_pets: true }), { ...base, okay_with_pets: false })).toBe(false);
  });
  it('applies same-gender preference both ways', () => {
    const wantsSame = person({ gender: 'man', roommate_gender_pref: 'same' });
    expect(isEligible(wantsSame, base)).toBe(false);
    expect(isEligible(base, wantsSame)).toBe(false);
    expect(isEligible(wantsSame, person({ id: 'c', gender: 'man' }))).toBe(true);
    expect(isEligible(person({ gender: 'prefer_not_to_say', roommate_gender_pref: 'same' }), person({ id: 'c', gender: 'prefer_not_to_say' }))).toBe(false);
  });
  it('removes ineligible people and sorts by score', () => {
    const ranked = rankMatches(base, [person({ id: 'x', smoker: true }), person({ id: 'y', noise: 5 }), person({ id: 'z' }), base]);
    expect(ranked.map((r) => r.profile.id)).toEqual(['z', 'y']);
  });
});

describe('budget', () => {
  const listing = { rent_monthly: 1500, bills_monthly: 300, deposit: 1500, lease_months: 12, max_tenants: 3 } as Listing;
  it('splits evenly', () => {
    expect(costPerPerson(listing, 3)).toEqual({ rent: 500, bills: 100, monthly: 600, move_in: 1100, lease_total: 7200 });
  });
  it('rates fit', () => {
    expect(budgetFit(900, base)).toBe('over');
    expect(budgetFit(800, base)).toBe('within');
    expect(budgetFit(400, base)).toBe('under');
  });
  it('finds the people needed', () => {
    expect(peopleNeeded(listing, 2000)).toBe(1);
    expect(peopleNeeded(listing, 900)).toBe(2);
    expect(peopleNeeded(listing, 100)).toBeNull();
  });
});

describe('compatibility report', () => {
  it('names the budget and timing problems', () => {
    const other = person({ display_name: 'Ben Lee', budget_min: 2000, budget_max: 2500, move_in_date: '2027-06-01', noise: 5 });
    const report = buildReport(base, other);
    expect(report.summary).toContain('Ben');
    expect(report.friction.join(' ')).toContain('budgets do not overlap');
    expect(report.friction.join(' ')).toContain('move-in dates');
    expect(report.friction.join(' ')).toContain('Noise at home');
  });
  it('always gives at least one point in each section', () => {
    const report = buildReport(base, person({}));
    for (const list of [report.strengths, report.friction, report.questions]) expect(list.length).toBeGreaterThan(0);
  });
});
