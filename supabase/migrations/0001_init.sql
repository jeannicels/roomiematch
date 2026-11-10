-- RoomieMatch schema. Run once on a new Supabase project.
-- Privacy rules enforced here, not in the browser:
--   * Contact details are only readable by the owner and accepted connections.
--   * Blocking hides both people from each other.
--   * AI analyses are readable only by the person who ran them.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  university text not null check (char_length(university) between 1 and 120),
  course text not null default '' check (char_length(course) <= 120),
  year_of_study int not null default 1 check (year_of_study between 1 and 8),
  bio text not null default '' check (char_length(bio) <= 600),
  looking_for text not null default 'either' check (looking_for in ('room', 'roommate', 'either')),
  budget_min int not null check (budget_min >= 0),
  budget_max int not null,
  preferred_area text not null default '' check (char_length(preferred_area) <= 120),
  move_in_date date not null,
  lease_months int not null default 12 check (lease_months between 1 and 48),
  gender text not null default 'prefer_not_to_say'
    check (gender in ('woman', 'man', 'non_binary', 'prefer_not_to_say')),
  roommate_gender_pref text not null default 'any' check (roommate_gender_pref in ('any', 'same')),
  smoker boolean not null default false,
  okay_with_smoking boolean not null default false,
  has_pets boolean not null default false,
  okay_with_pets boolean not null default true,
  sleep_schedule int not null check (sleep_schedule between 1 and 5),
  cleanliness int not null check (cleanliness between 1 and 5),
  noise int not null check (noise between 1 and 5),
  guests int not null check (guests between 1 and 5),
  study_at_home int not null check (study_at_home between 1 and 5),
  social int not null check (social between 1 and 5),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max >= budget_min)
);

create table public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  contact_method text not null check (contact_method in ('email', 'phone', 'telegram', 'instagram')),
  contact_value text not null check (char_length(contact_value) between 1 and 120),
  updated_at timestamptz not null default now()
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index connections_pair_idx on public.connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  area text not null check (char_length(area) between 1 and 120),
  rent_monthly int not null check (rent_monthly >= 0),
  bills_monthly int not null default 0 check (bills_monthly >= 0),
  deposit int not null default 0 check (deposit >= 0),
  max_tenants int not null default 1 check (max_tenants between 1 and 12),
  available_from date not null,
  lease_months int not null default 12 check (lease_months between 1 and 48),
  furnished boolean not null default false,
  source_url text check (source_url is null or source_url ~* '^https://'),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 6),
  status text not null default 'active' check (status in ('active', 'taken')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_status_idx on public.listings (status, created_at desc);

create table public.saved_listings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  reported_listing_id uuid references public.listings (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(reported_user_id, reported_listing_id) = 1)
);

-- One cached analysis per reader, because each is written to the person reading it.
create table public.compatibility_analyses (
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  other_id uuid not null references public.profiles (id) on delete cascade,
  input_hash text not null,
  score int not null check (score between 0 and 100),
  summary text not null,
  strengths jsonb not null default '[]',
  friction jsonb not null default '[]',
  questions jsonb not null default '[]',
  model text not null,
  created_at timestamptz not null default now(),
  primary key (viewer_id, other_id)
);

-- One row per Claude call, used for the daily limit. Only the Edge Function touches it.
create table public.analysis_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index analysis_requests_user_idx on public.analysis_requests (user_id, created_at desc);

-- Helpers. Security definer so policies can check rows the caller cannot read.
create function public.is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create function public.are_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = a and c.addressee_id = b)
        or (c.requester_id = b and c.addressee_id = a))
  ) and not public.is_blocked_pair(a, b);
$$;

revoke all on function public.is_blocked_pair(uuid, uuid) from public, anon;
revoke all on function public.are_connected(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated, service_role;
grant execute on function public.are_connected(uuid, uuid) to authenticated, service_role;

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger contacts_touch before update on public.profile_contacts
  for each row execute function public.touch_updated_at();
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.connections enable row level security;
alter table public.blocks enable row level security;
alter table public.listings enable row level security;
alter table public.saved_listings enable row level security;
alter table public.reports enable row level security;
alter table public.compatibility_analyses enable row level security;
alter table public.analysis_requests enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid()
  or ((is_visible or public.are_connected(id, auth.uid()))
      and not public.is_blocked_pair(id, auth.uid()))
);
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = auth.uid());

create policy contacts_read on public.profile_contacts for select to authenticated using (
  user_id = auth.uid() or public.are_connected(user_id, auth.uid())
);
create policy contacts_write on public.profile_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy connections_read on public.connections for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy connections_insert on public.connections for insert to authenticated with check (
  requester_id = auth.uid()
  and status = 'pending'
  and not public.is_blocked_pair(requester_id, addressee_id)
);
create policy connections_respond on public.connections for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());
create policy connections_remove on public.connections for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

create policy blocks_read on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid());
create policy blocks_delete on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

create policy listings_read on public.listings for select to authenticated using (
  owner_id = auth.uid()
  or (status = 'active' and not public.is_blocked_pair(owner_id, auth.uid()))
);
create policy listings_insert on public.listings for insert to authenticated
  with check (owner_id = auth.uid());
create policy listings_update on public.listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy listings_delete on public.listings for delete to authenticated
  using (owner_id = auth.uid());

create policy saved_all on public.saved_listings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reports can be filed but not read back from the app. Review them in the Supabase dashboard.
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy analyses_read on public.compatibility_analyses for select to authenticated
  using (viewer_id = auth.uid());

-- Table privileges. Signed-out visitors get nothing.
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on
  public.profiles, public.profile_contacts, public.blocks, public.listings, public.saved_listings
  to authenticated;
grant select, insert, delete on public.connections to authenticated;
grant update (status) on public.connections to authenticated;
grant insert on public.reports to authenticated;
grant select on public.compatibility_analyses to authenticated;
grant all on all tables in schema public to service_role;

-- Listing photos: anyone with the link can view, people can only change their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy listing_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy listing_photos_delete on storage.objects for delete to authenticated using (
  bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
