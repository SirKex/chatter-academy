# Chatter Academy

Static prototype of a recruiter workspace plus candidate assessment portal. The evaluator is heuristic and unvalidated; use for human-reviewed screening and pilot testing only, not automated hiring decisions.

## Local preview

```sh
python -m http.server 8000
```

- Recruiter prototype: `http://localhost:8000/`
- Candidate experience: `http://localhost:8000/candidate.html?token=sample-token`

## Candidate portal
`candidate.html` includes candidate identity fields, consent, scenario selection, simulated conversation, and submission flow. In preview mode, a JSON file downloads at completion. It does **not** send the candidate's results to the recruiter.

## Live deployment
GitHub Pages can host the static interface only. For actual submissions, see `backend/SETUP.md` and `backend/schema.sql`. Supabase Edge Function source is in `backend/supabase/functions/candidate-submit/`. Configure `supabase-config.js` with the project URL, public anon key, and function name. Never place a service-role key in the public repository.

The current invite generator makes a candidate URL and locally stores the invite in the browser. It does not provision an invite in Supabase automatically. A real deployment still requires authenticated admin invite creation, server-side scoring, privacy/retention controls, and abuse protection before real candidate data is collected.

## Tests

```sh
node --test tests/*.test.js
for f in *.js; do node --check "$f"; done
```

10 regression suites currently pass.
