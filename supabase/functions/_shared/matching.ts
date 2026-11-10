// Shared by the web app and the Edge Function, so the score is the same in both.

export const LIFESTYLE = [
  { key: 'sleep_schedule', label: 'Sleep', low: 'Early bird', high: 'Night owl', weight: 1.3 },
  { key: 'cleanliness', label: 'Tidiness', low: 'Relaxed', high: 'Spotless', weight: 1.4 },
  { key: 'noise', label: 'Noise at home', low: 'Quiet', high: 'Lively', weight: 1.2 },
  { key: 'guests', label: 'Guests', low: 'Rarely', high: 'Often', weight: 1 },
  { key: 'study_at_home', label: 'Studying', low: 'On campus', high: 'At home', weight: 0.7 },
  { key: 'social', label: 'Time together', low: 'Own space', high: 'Do things together', weight: 0.8 },
] as const;

export type LifestyleKey = (typeof LIFESTYLE)[number]['key'];

export interface Profile extends Record<LifestyleKey, number> {
  id: string;
  display_name: string;
  university: string;
  course: string;
  year_of_study: number;
  bio: string;
  looking_for: 'room' | 'roommate' | 'either';
  budget_min: number;
  budget_max: number;
  preferred_area: string;
  move_in_date: string;
  lease_months: number;
  gender: 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';
  roommate_gender_pref: 'any' | 'same';
  smoker: boolean;
  okay_with_smoking: boolean;
  has_pets: boolean;
  okay_with_pets: boolean;
  is_visible: boolean;
}

export interface Gap {
  key: LifestyleKey;
  label: string;
  distance: number;
}

export interface MatchResult {
  score: number;
  lifestyle: number; // out of 60
  budget: number; // out of 30
  timing: number; // out of 10
  shared_budget: { min: number; max: number } | null;
  days_apart: number;
  closest: Gap[];
  widest: Gap[];
}

function genderAccepts(a: Profile, b: Profile): boolean {
  if (a.roommate_gender_pref === 'any') return true;
  return a.gender !== 'prefer_not_to_say' && a.gender === b.gender;
}

/** Dealbreakers: either person's stated limit removes the match entirely. */
export function isEligible(a: Profile, b: Profile): boolean {
  if (!genderAccepts(a, b) || !genderAccepts(b, a)) return false;
  if ((a.smoker && !b.okay_with_smoking) || (b.smoker && !a.okay_with_smoking)) return false;
  if ((a.has_pets && !b.okay_with_pets) || (b.has_pets && !a.okay_with_pets)) return false;
  return true;
}

function budgetPoints(a: Profile, b: Profile): number {
  const low = Math.max(a.budget_min, b.budget_min);
  const high = Math.min(a.budget_max, b.budget_max);
  if (low > high) {
    // No overlap: points fade to zero once the gap reaches a quarter of the higher budget.
    const tolerance = Math.max(a.budget_max, b.budget_max) * 0.25;
    return tolerance === 0 ? 0 : 12 * Math.max(0, 1 - (low - high) / tolerance);
  }
  const narrower = Math.min(a.budget_max - a.budget_min, b.budget_max - b.budget_min);
  const ratio = narrower === 0 ? 1 : (high - low) / narrower;
  return 18 + 12 * ratio;
}

export function scoreMatch(a: Profile, b: Profile): MatchResult {
  const totalWeight = LIFESTYLE.reduce((sum, item) => sum + item.weight, 0);
  let earned = 0;
  const gaps: Gap[] = LIFESTYLE.map((item) => {
    const distance = Math.abs(a[item.key] - b[item.key]);
    earned += item.weight * (1 - distance / 4);
    return { key: item.key, label: item.label, distance };
  });
  const lifestyle = (earned / totalWeight) * 60;
  const budget = budgetPoints(a, b);

  const days_apart = Math.round(
    Math.abs(Date.parse(a.move_in_date) - Date.parse(b.move_in_date)) / 86_400_000,
  );
  // Full points within 30 days, none at 120 days.
  const timing = 10 * Math.min(1, Math.max(0, (120 - days_apart) / 90));

  const low = Math.max(a.budget_min, b.budget_min);
  const high = Math.min(a.budget_max, b.budget_max);
  const sorted = [...gaps].sort((x, y) => x.distance - y.distance);

  return {
    score: Math.round(lifestyle + budget + timing),
    lifestyle: Math.round(lifestyle),
    budget: Math.round(budget),
    timing: Math.round(timing),
    shared_budget: low <= high ? { min: low, max: high } : null,
    days_apart,
    closest: sorted.slice(0, 2),
    widest: sorted.slice(-2).reverse().filter((gap) => gap.distance >= 2),
  };
}

export function rankMatches(me: Profile, others: Profile[]) {
  return others
    .filter((other) => other.id !== me.id && isEligible(me, other))
    .map((profile) => ({ profile, match: scoreMatch(me, profile) }))
    .sort((x, y) => y.match.score - x.match.score);
}
