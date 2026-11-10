// Runs the whole app in the browser with made-up students, so it works with no keys.
import { buildReport } from './compatibility';
import { type Api, type Connection, type Contact, type Listing, type Profile } from './types';

const ME = 'demo-you';
const person = (id: string, values: Partial<Profile>): Profile => ({
  id,
  display_name: '',
  university: 'Harbour City University',
  course: '',
  year_of_study: 2,
  bio: '',
  looking_for: 'either',
  budget_min: 500,
  budget_max: 800,
  preferred_area: 'East Gate',
  move_in_date: '2027-01-04',
  lease_months: 12,
  gender: 'prefer_not_to_say',
  roommate_gender_pref: 'any',
  smoker: false,
  okay_with_smoking: false,
  has_pets: false,
  okay_with_pets: true,
  is_visible: true,
  sleep_schedule: 3,
  cleanliness: 3,
  noise: 3,
  guests: 3,
  study_at_home: 3,
  social: 3,
  ...values,
});

const initial = () => ({
  profiles: [
    person(ME, {
      display_name: 'Alex Tan', course: 'Computer Science',
      bio: 'Second-year student. I cook most nights and study late before deadlines.',
      budget_min: 550, budget_max: 800, sleep_schedule: 4, cleanliness: 4, noise: 2, guests: 2, study_at_home: 4, social: 3,
    }),
    person('demo-priya', {
      display_name: 'Priya Nair', course: 'Psychology', year_of_study: 3,
      bio: 'I run in the evenings and like a calm flat. Happy to share cooking.',
      budget_min: 600, budget_max: 850, move_in_date: '2027-01-11', sleep_schedule: 4, cleanliness: 4, noise: 2, guests: 2, study_at_home: 3, social: 4,
    }),
    person('demo-jun', {
      display_name: 'Jun Wei Lim', course: 'Mechanical Engineering',
      bio: 'Usually on campus until late. Quiet at home and tidy in shared spaces.',
      budget_min: 500, budget_max: 700, move_in_date: '2026-12-28', sleep_schedule: 5, cleanliness: 3, noise: 1, guests: 1, study_at_home: 1, social: 2,
    }),
    person('demo-sara', {
      display_name: 'Sara Haddad', course: 'Law', year_of_study: 4,
      bio: 'Up early for placements. I need quiet evenings during exam season.',
      budget_min: 700, budget_max: 1000, move_in_date: '2027-02-01', sleep_schedule: 1, cleanliness: 5, noise: 1, guests: 2, study_at_home: 5, social: 2,
    }),
    person('demo-marcus', {
      display_name: 'Marcus Ong', course: 'Business', year_of_study: 1,
      bio: 'I host game nights and love a busy home. Band practice happens elsewhere, promise.',
      budget_min: 450, budget_max: 650, move_in_date: '2027-03-15', sleep_schedule: 4, cleanliness: 2, noise: 5, guests: 5, study_at_home: 2, social: 5,
    }),
    person('demo-mei', {
      display_name: 'Mei Chen', course: 'Architecture', year_of_study: 3,
      bio: 'Studio deadlines mean late nights. I have one very calm cat.',
      budget_min: 600, budget_max: 800, has_pets: true, move_in_date: '2027-01-18', sleep_schedule: 5, cleanliness: 3, noise: 2, guests: 3, study_at_home: 4, social: 3,
    }),
  ],
  contacts: {
    [ME]: { contact_method: 'telegram', contact_value: '@alex_sample' },
    'demo-priya': { contact_method: 'telegram', contact_value: '@priya_sample' },
    'demo-jun': { contact_method: 'email', contact_value: 'jun@example.com' },
    'demo-sara': { contact_method: 'email', contact_value: 'sara@example.com' },
    'demo-marcus': { contact_method: 'instagram', contact_value: '@marcus_sample' },
    'demo-mei': { contact_method: 'telegram', contact_value: '@mei_sample' },
  } as Record<string, Contact>,
  connections: [
    { id: 'c1', requester_id: 'demo-mei', addressee_id: ME, status: 'pending' },
  ] as Connection[],
  listings: [
    { id: 'l1', owner_id: 'demo-priya', title: 'Two-bedroom flat with study nook', description: 'Ten minutes on foot to the East Gate. Priya has one room and is looking for a flatmate for the other.', area: 'East Gate', rent_monthly: 1450, bills_monthly: 160, deposit: 1450, max_tenants: 2, available_from: '2027-01-02', lease_months: 12, furnished: true, source_url: null, photo_urls: [], status: 'active' },
    { id: 'l2', owner_id: 'demo-jun', title: 'Three-bedroom near the bus interchange', description: 'Larger shared living room. One bathroom between three.', area: 'Harbour Road', rent_monthly: 1900, bills_monthly: 210, deposit: 1900, max_tenants: 3, available_from: '2027-01-10', lease_months: 12, furnished: false, source_url: null, photo_urls: [], status: 'active' },
    { id: 'l3', owner_id: 'demo-sara', title: 'Bright studio by the lake', description: 'Fits one person comfortably. Bills included in the rent.', area: 'Lakeside', rent_monthly: 980, bills_monthly: 0, deposit: 980, max_tenants: 1, available_from: '2027-02-01', lease_months: 6, furnished: true, source_url: null, photo_urls: [], status: 'active' },
    { id: 'l4', owner_id: 'demo-marcus', title: 'Four-bedroom student house', description: 'Garden, two bathrooms, and a shared kitchen. Two rooms already let, so the sums assume four people.', area: 'North Campus', rent_monthly: 2360, bills_monthly: 300, deposit: 2360, max_tenants: 4, available_from: '2027-03-01', lease_months: 12, furnished: true, source_url: null, photo_urls: [], status: 'active' },
  ] as Listing[],
  saved: ['l1', 'l2'],
  blocked: [] as string[],
});

export function createDemoApi(): Api {
  const state = initial();
  const others = () => state.profiles.filter((p) => p.id !== ME && !state.blocked.includes(p.id));
  const listeners = new Set<() => void>();
  let signedIn = true;

  return {
    isDemo: true,
    currentUserId: async () => (signedIn ? ME : null),
    onAuthChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signIn() {
      signedIn = true;
      listeners.forEach((listener) => listener());
    },
    signUp: async () => 'signed_in',
    async signOut() {
      signedIn = false;
      listeners.forEach((listener) => listener());
    },

    getProfile: async (id) => state.profiles.find((p) => p.id === id) ?? null,
    listProfiles: async () => others().filter((p) => p.is_visible),
    async saveProfile(profile, contact) {
      state.profiles = state.profiles.map((p) => (p.id === ME ? { ...profile, id: ME } : p));
      state.contacts[ME] = contact;
    },
    async getContact(userId) {
      const connected = state.connections.some(
        (c) => c.status === 'accepted' && [c.requester_id, c.addressee_id].includes(userId),
      );
      return userId === ME || connected ? state.contacts[userId] ?? null : null;
    },

    listConnections: async () => [...state.connections],
    async requestConnection(otherId) {
      state.connections.push({ id: crypto.randomUUID(), requester_id: ME, addressee_id: otherId, status: 'pending' });
    },
    async respondToConnection(id, status) {
      state.connections = state.connections.map((c) => (c.id === id ? { ...c, status } : c));
    },
    async removeConnection(id) {
      state.connections = state.connections.filter((c) => c.id !== id);
    },

    listListings: async () => state.listings.filter((l) => l.status === 'active' || l.owner_id === ME),
    async createListing(input, photos) {
      state.listings.unshift({
        ...input, id: crypto.randomUUID(), owner_id: ME, status: 'active',
        photo_urls: photos.slice(0, 6).map((photo) => URL.createObjectURL(photo)),
      });
    },
    async markListingTaken(id) {
      state.listings = state.listings.map((l) => (l.id === id ? { ...l, status: 'taken' } : l));
    },
    async deleteListing(id) {
      state.listings = state.listings.filter((l) => l.id !== id);
    },
    listSavedIds: async () => [...state.saved],
    async setSaved(id, saved) {
      state.saved = saved ? [...new Set([...state.saved, id])] : state.saved.filter((item) => item !== id);
    },

    async analyze(otherId) {
      return buildReport(state.profiles.find((p) => p.id === ME)!, state.profiles.find((p) => p.id === otherId)!);
    },
    async block(userId) {
      state.blocked.push(userId);
      state.connections = state.connections.filter((c) => ![c.requester_id, c.addressee_id].includes(userId));
    },
    report: async () => undefined,
  };
}
