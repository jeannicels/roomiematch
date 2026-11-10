import { createClient } from '@supabase/supabase-js';
import { buildReport } from './compatibility';
import type { Api, Connection, Contact, Listing, Profile } from './types';

const BUCKET = 'listing-photos';

export function createSupabaseApi(url: string, anonKey: string): Api {
  const db = createClient(url, anonKey);

  const uid = async () => {
    const { data } = await db.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Sign in to continue.');
    return id;
  };
  const check = <T,>({ data, error }: { data: T; error: { message: string } | null }): T => {
    if (error) throw new Error(error.message);
    return data;
  };
  const toListing = ({ photo_paths, ...row }: Omit<Listing, 'photo_urls'> & { photo_paths: string[] }): Listing => ({
    ...row,
    photo_urls: photo_paths.map((path) => db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl),
  });

  return {
    isDemo: false,
    async currentUserId() {
      const { data } = await db.auth.getSession();
      return data.session?.user.id ?? null;
    },
    onAuthChange(listener) {
      const { data } = db.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(listener);
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signUp(email, password) {
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      return data.session ? 'signed_in' : 'confirm_email';
    },
    async signOut() {
      await db.auth.signOut();
    },

    async getProfile(id) {
      return check(await db.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null;
    },
    async listProfiles() {
      const me = await uid();
      return check(await db.from('profiles').select('*').neq('id', me).limit(500)) as Profile[];
    },
    async saveProfile(profile, contact) {
      const id = await uid();
      check(await db.from('profiles').upsert({ ...profile, id }));
      check(await db.from('profile_contacts').upsert({ ...contact, user_id: id }));
    },
    async getContact(userId) {
      return check(
        await db.from('profile_contacts').select('contact_method, contact_value').eq('user_id', userId).maybeSingle(),
      ) as Contact | null;
    },

    async listConnections() {
      return check(await db.from('connections').select('*')) as Connection[];
    },
    async requestConnection(otherId) {
      check(await db.from('connections').insert({ requester_id: await uid(), addressee_id: otherId }));
    },
    async respondToConnection(id, status) {
      check(await db.from('connections').update({ status }).eq('id', id));
    },
    async removeConnection(id) {
      check(await db.from('connections').delete().eq('id', id));
    },

    async listListings() {
      const rows = check(await db.from('listings').select('*').order('created_at', { ascending: false }).limit(200));
      return (rows as Parameters<typeof toListing>[0][]).map(toListing);
    },
    async createListing(input, photos) {
      const owner_id = await uid();
      const photo_paths: string[] = [];
      for (const photo of photos.slice(0, 6)) {
        const path = `${owner_id}/${crypto.randomUUID()}.${photo.name.split('.').pop() ?? 'jpg'}`;
        check(await db.storage.from(BUCKET).upload(path, photo));
        photo_paths.push(path);
      }
      check(await db.from('listings').insert({ ...input, owner_id, photo_paths }));
    },
    async markListingTaken(id) {
      check(await db.from('listings').update({ status: 'taken' }).eq('id', id));
    },
    async deleteListing(id) {
      const row = check(await db.from('listings').select('photo_paths').eq('id', id).single()) as { photo_paths: string[] };
      if (row.photo_paths.length) await db.storage.from(BUCKET).remove(row.photo_paths);
      check(await db.from('listings').delete().eq('id', id));
    },
    async listSavedIds() {
      const rows = check(await db.from('saved_listings').select('listing_id')) as { listing_id: string }[];
      return rows.map((row) => row.listing_id);
    },
    async setSaved(listing_id, saved) {
      const user_id = await uid();
      if (saved) check(await db.from('saved_listings').upsert({ user_id, listing_id }));
      else check(await db.from('saved_listings').delete().eq('user_id', user_id).eq('listing_id', listing_id));
    },

    async analyze(otherId) {
      const [me, other] = await Promise.all([this.getProfile(await uid()), this.getProfile(otherId)]);
      if (!me || !other) throw new Error('This student is not available.');
      return buildReport(me, other);
    },
    async block(userId) {
      check(await db.from('blocks').insert({ blocker_id: await uid(), blocked_id: userId }));
    },
    async report(target, reason) {
      check(
        await db.from('reports').insert({
          reporter_id: await uid(),
          reported_user_id: target.user ?? null,
          reported_listing_id: target.listing ?? null,
          reason,
        }),
      );
    },
  };
}
