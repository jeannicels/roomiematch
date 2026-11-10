// Used only by the demo build, which never talks to a server.
export function createClient(): never {
  throw new Error('Supabase is not available in the demo');
}
