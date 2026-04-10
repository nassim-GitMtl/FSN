# FSM Deployed Demo

`FSM_Deployed` is a polished field service demo built with React, Vite, Zustand, Supabase, and Vercel. It keeps the strongest work-order, dispatch, technician, client, billing, and mobile preview flows from the original project, but swaps the old in-memory demo sync path for a real Supabase-backed data source.

## Stack

- React 18 + Vite
- TypeScript
- Zustand for local UI state
- Supabase for the shared demo database
- Vercel for static hosting

## What the Demo Includes

- Service and installation workspaces
- Dispatch board and technician capacity views
- Job detail editing, notes, time, parts, checklist, and billing actions
- Sales order review and billing queue
- Client profiles with jobs, files, assets, and order history
- Technician mobile preview

## Required Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Copy [.env.example](/Users/nams/Desktop/New%20CustomFSM/FSM_Deployed/.env.example) to `.env.local` and fill in your Supabase values.

## Local Setup

1. Install dependencies:
```bash
npm install
```
2. Create `.env.local` from [.env.example](/Users/nams/Desktop/New%20CustomFSM/FSM_Deployed/.env.example).
3. Apply the schema in [20260410120000_init_demo.sql](/Users/nams/Desktop/New%20CustomFSM/FSM_Deployed/supabase/migrations/20260410120000_init_demo.sql).
4. Run the seed in [seed.sql](/Users/nams/Desktop/New%20CustomFSM/FSM_Deployed/supabase/seed.sql).
5. Start the app:
```bash
npm run dev
```

The migration includes open demo RLS policies so the browser app can read and write with the public Supabase key.

## Supabase Setup

### Option 1: SQL Editor

1. Open your Supabase project.
2. Run [20260410120000_init_demo.sql](/Users/nams/Desktop/New%20CustomFSM/FSM_Deployed/supabase/migrations/20260410120000_init_demo.sql) in the SQL Editor.
3. Run [seed.sql](/Users/nams/Desktop/New%20CustomFSM/FSM_Deployed/supabase/seed.sql) in the SQL Editor.

### Option 2: Supabase CLI

If you use the Supabase CLI, run:

```bash
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

## Demo Usage

Use the role picker on the login screen to enter the app quickly. `Jake Morrison` is the fastest way to test the technician and mobile flows, while `Alex Rivera` and `Taylor Brooks` are good for dispatch and billing.

Primary flows worth demoing:

1. Open the dashboard and dispatch board.
2. Review a work order and add notes, time, parts, or checklist responses.
3. Open billing and edit a sales order.
4. Open `/mobile` and test the technician flow.

## Deployment on Vercel

1. Push this folder to a Git repository.
2. Import the project into Vercel as a Vite application.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings.
4. Deploy. The included [vercel.json](/Users/nams/Desktop/New%20CustomFSM/FSM_Deployed/vercel.json) handles SPA routing.

## Build and Verification

```bash
npm run typecheck
npm run build
```

## Notes

- This demo intentionally keeps auth lightweight. The role picker is local and the shared operational data lives in Supabase.
- The database schema keeps the main entities relational, while embedded UI-first structures like customer addresses, service addresses, and sales order lines are stored as `jsonb` for simpler demo maintenance.
