// Runs the real migration on an embedded Postgres, with Supabase's auth and storage stubbed.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
let db: PGlite;

async function as(user: string | null, sql: string) {
  await db.exec(`reset role; select set_config('test.uid', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try {
    return await db.query<Record<string, unknown>>(sql);
  } finally {
    await db.exec('reset role;');
  }
}
const profile = (id: string, name: string, visible = true) => `
  insert into public.profiles (id, display_name, university, budget_min, budget_max, move_in_date,
    sleep_schedule, cleanliness, noise, guests, study_at_home, social, is_visible)
  values ('${id}', '${name}', 'U', 500, 800, '2027-01-01', 3, 3, 3, 3, 3, 3, ${visible});
  insert into public.profile_contacts (user_id, contact_method, contact_value) values ('${id}', 'email', '${name}@x.com');`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
    grant usage on schema auth, storage, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
    grant select, insert, delete on storage.objects to authenticated;
    insert into auth.users values ('${A}'), ('${B}'), ('${C}');
  `);
  await db.exec(readFileSync('supabase/migrations/0001_init.sql', 'utf8'));
  await db.exec(profile(A, 'ann') + profile(B, 'ben') + profile(C, 'cat', false));
});

const count = async (user: string | null, sql: string) => (await as(user, sql)).rows.length;

describe('row level security', () => {
  it('gives signed-out visitors nothing', async () => {
    await expect(as(null, 'select * from public.profiles')).rejects.toThrow(/permission denied/);
    await expect(as(null, 'select * from public.profile_contacts')).rejects.toThrow(/permission denied/);
  });

  it('hides invisible profiles from others but not from their owner', async () => {
    expect(await count(A, `select id from public.profiles where id = '${C}'`)).toBe(0);
    expect(await count(C, `select id from public.profiles where id = '${C}'`)).toBe(1);
  });

  it('stops someone editing another profile', async () => {
    const result = await as(A, `update public.profiles set display_name = 'x' where id = '${B}' returning id`);
    expect(result.rows).toHaveLength(0);
  });

  it('stops someone connecting on behalf of another person, or pre-accepting', async () => {
    await expect(as(A, `insert into public.connections (requester_id, addressee_id) values ('${B}', '${C}')`)).rejects.toThrow(/row-level security/);
    await expect(as(A, `insert into public.connections (requester_id, addressee_id, status) values ('${A}', '${B}', 'accepted')`)).rejects.toThrow(/row-level security/);
  });

  it('keeps contact details private until the addressee accepts', async () => {
    expect(await count(A, `select * from public.profile_contacts where user_id = '${B}'`)).toBe(0);
    await as(A, `insert into public.connections (requester_id, addressee_id) values ('${A}', '${B}')`);

    // The requester cannot accept their own request.
    const self = await as(A, `update public.connections set status = 'accepted' returning id`);
    expect(self.rows).toHaveLength(0);
    expect(await count(A, `select * from public.profile_contacts where user_id = '${B}'`)).toBe(0);

    // The addressee cannot rewrite who the connection belongs to.
    await expect(as(B, `update public.connections set requester_id = '${C}'`)).rejects.toThrow(/permission denied/);

    await as(B, `update public.connections set status = 'accepted'`);
    expect(await count(A, `select * from public.profile_contacts where user_id = '${B}'`)).toBe(1);
    expect(await count(C, `select * from public.profile_contacts where user_id = '${B}'`)).toBe(0);
  });

  it('blocks duplicate connections in the reverse direction', async () => {
    await expect(as(B, `insert into public.connections (requester_id, addressee_id) values ('${B}', '${A}')`)).rejects.toThrow(/duplicate/);
  });

  it('makes blocking cut off profile, contact and listing access', async () => {
    await as(B, `insert into public.listings (owner_id, title, area, rent_monthly, available_from) values ('${B}', 'Room', 'East', 900, '2027-01-01')`);
    expect(await count(A, `select id from public.listings`)).toBe(1);

    await as(A, `insert into public.blocks (blocker_id, blocked_id) values ('${A}', '${B}')`);
    expect(await count(B, `select id from public.profiles where id = '${A}'`)).toBe(0);
    expect(await count(B, `select * from public.profile_contacts where user_id = '${A}'`)).toBe(0);
    expect(await count(A, `select id from public.listings`)).toBe(0);
    await as(A, `delete from public.blocks`);
  });

  it('keeps blocks and saved listings private', async () => {
    await as(A, `insert into public.blocks (blocker_id, blocked_id) values ('${A}', '${C}')`);
    expect(await count(C, 'select * from public.blocks')).toBe(0);
    await as(A, 'delete from public.blocks');
  });

  it('protects listings from other people', async () => {
    const result = await as(A, `delete from public.listings returning id`);
    expect(result.rows).toHaveLength(0);
    await expect(as(A, `insert into public.listings (owner_id, title, area, rent_monthly, available_from) values ('${B}', 'Fake', 'East', 1, '2027-01-01')`)).rejects.toThrow(/row-level security/);
  });

  it('rejects listing links that are not https', async () => {
    await expect(as(A, `insert into public.listings (owner_id, title, area, rent_monthly, available_from, source_url) values ('${A}', 'Room', 'East', 1, '2027-01-01', 'javascript:alert(1)')`)).rejects.toThrow(/check constraint/);
  });

  it('lets people file reports but not read them', async () => {
    await as(A, `insert into public.reports (reporter_id, reported_user_id, reason) values ('${A}', '${B}', 'spam')`);
    await expect(as(A, 'select * from public.reports')).rejects.toThrow(/permission denied/);
  });

  it('shows analyses only to the reader and blocks writes from the app', async () => {
    await db.exec(`insert into public.compatibility_analyses (viewer_id, other_id, input_hash, score, summary, model) values ('${A}', '${B}', 'h', 80, 's', 'm')`);
    expect(await count(A, 'select * from public.compatibility_analyses')).toBe(1);
    expect(await count(B, 'select * from public.compatibility_analyses')).toBe(0);
    await expect(as(A, `insert into public.compatibility_analyses (viewer_id, other_id, input_hash, score, summary, model) values ('${A}', '${C}', 'h', 100, 's', 'm')`)).rejects.toThrow(/permission denied/);
  });

  it('keeps the usage log away from the app', async () => {
    await expect(as(A, 'select * from public.analysis_requests')).rejects.toThrow(/permission denied/);
  });

  it('limits photo uploads to the uploader folder', async () => {
    await as(A, `insert into storage.objects (bucket_id, name) values ('listing-photos', '${A}/one.jpg')`);
    await expect(as(A, `insert into storage.objects (bucket_id, name) values ('listing-photos', '${B}/two.jpg')`)).rejects.toThrow(/row-level security/);
  });
});
