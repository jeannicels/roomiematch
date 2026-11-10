import type { Listing, Profile } from './types';

export const CURRENCY: string = import.meta.env.VITE_CURRENCY_SYMBOL || 'S$';
export const money = (amount: number) => `${CURRENCY}${Math.round(amount).toLocaleString('en-US')}`;

export interface CostBreakdown {
  rent: number;
  bills: number;
  monthly: number;
  move_in: number; // deposit share plus the first month
  lease_total: number;
}

/** Each person's share, assuming rent, bills and deposit are split evenly. */
export function costPerPerson(listing: Listing, people: number): CostBreakdown {
  const split = Math.max(1, people);
  const rent = listing.rent_monthly / split;
  const bills = listing.bills_monthly / split;
  const monthly = rent + bills;
  return {
    rent,
    bills,
    monthly,
    move_in: listing.deposit / split + monthly,
    lease_total: monthly * listing.lease_months,
  };
}

export type BudgetFit = 'under' | 'within' | 'over';

export function budgetFit(monthly: number, person: Pick<Profile, 'budget_min' | 'budget_max'>): BudgetFit {
  if (monthly > person.budget_max) return 'over';
  return monthly < person.budget_min ? 'under' : 'within';
}

/** The smallest number of tenants that brings the listing within budget, or null if none does. */
export function peopleNeeded(listing: Listing, budgetMax: number): number | null {
  for (let people = 1; people <= listing.max_tenants; people += 1) {
    if (costPerPerson(listing, people).monthly <= budgetMax) return people;
  }
  return null;
}
