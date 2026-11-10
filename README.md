# RoomieMatch

Helps university students find compatible roommates and accommodation.
Built with React and Supabase. It needs no AI service or AI key.

- Student profiles with lifestyle, budget and dealbreaker answers
- Ranked roommate matches (lifestyle 60, budget 30, move-in timing 10)
- A compatibility report built from both students' answers
- Listings with photos, saved places and reports
- Per-person rent comparison against your budget and a match's budget
- Contact details stay hidden until both people agree to connect
- Block and report tools

## Run it

You need Node.js 20 or newer.

    npm install
    npm run dev

With no keys set, the app runs on sample data.

## Connect Supabase

1. Create a project at supabase.com.
2. Open the SQL Editor, paste `supabase/migrations/0001_init.sql`, and run it once.
3. Copy `.env.example` to `.env`. Add your Project URL and publishable key.
   Never use the secret key here.

## Put it online

Deploy to Vercel, add the three `VITE_` variables in the project settings, then set the Vercel link as
the Site URL in Supabase under Authentication > URL Configuration.

## Before real students use it

- Limit sign-ups to university email addresses.
- Check the `reports` table often. Nobody is notified of new reports.
- Add terms and a privacy notice. In Singapore, the PDPA may apply.
- Check any rules on restricting housing by gender.

## Tests

    npm test

These cover scoring, budget maths and the report. They also run the real migration on an embedded
Postgres to test the access rules. They do not call a live Supabase project.
