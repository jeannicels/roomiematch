export * from '../../supabase/functions/_shared/matching.ts';
import type { Profile } from '../../supabase/functions/_shared/matching.ts';

export type ContactMethod = 'email' | 'phone' | 'telegram' | 'instagram';
export interface Contact {
  contact_method: ContactMethod;
  contact_value: string;
}

export interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface Listing {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  area: string;
  rent_monthly: number;
  bills_monthly: number;
  deposit: number;
  max_tenants: number;
  available_from: string;
  lease_months: number;
  furnished: boolean;
  source_url: string | null;
  photo_urls: string[];
  status: 'active' | 'taken';
}

export type ListingInput = Omit<Listing, 'id' | 'owner_id' | 'photo_urls' | 'status'>;

export interface Analysis {
  summary: string;
  strengths: string[];
  friction: string[];
  questions: string[];
}

export interface Api {
  isDemo: boolean;
  currentUserId(): Promise<string | null>;
  onAuthChange(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<'signed_in' | 'confirm_email'>;
  signOut(): Promise<void>;

  getProfile(id: string): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  saveProfile(profile: Profile, contact: Contact): Promise<void>;
  getContact(userId: string): Promise<Contact | null>;

  listConnections(): Promise<Connection[]>;
  requestConnection(otherId: string): Promise<void>;
  respondToConnection(id: string, status: 'accepted' | 'declined'): Promise<void>;
  removeConnection(id: string): Promise<void>;

  listListings(): Promise<Listing[]>;
  createListing(input: ListingInput, photos: File[]): Promise<void>;
  markListingTaken(id: string): Promise<void>;
  deleteListing(id: string): Promise<void>;
  listSavedIds(): Promise<string[]>;
  setSaved(listingId: string, saved: boolean): Promise<void>;

  analyze(otherId: string): Promise<Analysis>;
  block(userId: string): Promise<void>;
  report(target: { user?: string; listing?: string }, reason: string): Promise<void>;
}
