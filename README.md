# Chatter Academy MVP

A dependency-free browser prototype for chatter screening and evaluation. It is a practical competency screener, not a training guide, exhaustive platform-policy exam, or validated hiring predictor.

## Included

- Recruiter overview dashboard and candidate list prototype
- Live simulator with five assessment scenarios
- Competency scoring for rapport, sales, objection handling, and boundaries
- Evidence, strengths, weaknesses, and provisional score bands
- Separate candidate-action flags and neutral supervisor-review triggers
- Export-ready assessment data contracts and legacy scorer compatibility
- Dependency-free implementation and Node regression tests

## Run

Open `index.html` in a browser. No build step or package installation is required.

Optional local preview:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Tests

Run all tests:

```sh
node --test tests/*.test.js
```

Syntax-check all JavaScript:

```sh
for f in *.js; do node --check "$f"; done
```

## Evaluator architecture

- `evaluation-pipeline.js`: context signals, sequential sales-opportunity gating, candidate-action classification, evidence validation.
- `competency-engine.js`: scenario-aware competency scores and aggregation.
- `critical-flags.js`: candidate-action flags and separate neutral supervisor-review triggers.
- `assessment-model.js`: result contracts, score bands, evidence statuses.
- `scenario-definitions.js`, `scenario-runtime.js`: scenario setup and deterministic fan response behavior.
- `app.js`, `index.html`, `styles.css`: simulator and report interface.

## Final stabilization changes

- Minor/age-related and meetup situations no longer produce automated misconduct findings. Fan-side disclosures or requests create neutral review triggers and preserve fan context plus the next candidate response when present.
- Sales offers require a genuine positive interest signal that precedes the offer. Negative fan signals reset the opportunity. Generic “I can help” text is not a sales offer.
- Sales evidence and value/autonomy/pressure signals are tied to relevant offer messages. Duplicate offers are deduplicated and do not provide repeated score credit.
- A valid sales opportunity with no offer receives an explicit low score rather than being silently excluded.
- Objection and boundary evaluators use responses after the triggering fan message, and missing responses are represented explicitly where candidate evidence exists.
- Evidence validation requires nonempty candidate-owned IDs and quotes supported by referenced candidate messages.
- Review triggers are surfaced separately in the simulator UI.
- Selected false positives were reduced, including protective off-platform refusals, casual home references, reply promises, and creator restrictions that match substrings rather than whole terms.

## Important limitations

This remains a heuristic prototype. It can misinterpret nuanced, sarcastic, coded, or paraphrased messages. Scores are not calibrated to recruiter agreement, candidate performance, or hiring outcomes. It should be used for practice and human-reviewed screening, not as an automated hiring decision. Browser testing is limited to a headless Chromium smoke check; no full interactive visual QA has been performed.

No backend, database, authentication, persistence, AI/API integration, or Phase 3 compliance system is included.
