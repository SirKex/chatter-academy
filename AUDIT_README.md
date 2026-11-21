# Chatter Academy Final Stabilization Package

This package contains the complete dependency-free application, evaluation modules, scenario runtime, regression tests, and final stabilization report. The bounded remediation has been implemented and tested.

## Architecture

```text
Scenario runtime
  -> Stable-ID transcript
  -> EvaluationPipeline
     -> Context/opportunity identification
     -> Authoritative candidate-action classification
  -> CompetencyEngine consumes pipeline classifications
  -> Evidence validation
  -> Recalculated competency/group/overall scores
  -> Independent CriticalFlagEngine output
```

Source files:

- `index.html`, `styles.css`, `app.js`: dependency-free browser application
- `scenario-definitions.js`, `scenario-runtime.js`: five scenario definitions and deterministic flows
- `evaluation-pipeline.js`: authoritative context and candidate-action classifications
- `competency-engine.js`: competency scoring and provisional aggregation
- `assessment-model.js`: result contracts and evidence statuses
- `critical-flags.js`: independent heuristic critical flags
- `text-utils.js`: normalization and deduplication
- `scorer-adapter.js`, `scoring.js`: legacy compatibility and Phase 1 scorer
- `tests/`: complete regression, adversarial, integration, and integrity suite

## Run the application

Open `index.html` directly in a browser. No install or build step is required.

Optional local preview:

```text
python -m http.server 8000
```

Open `http://localhost:8000/`.

## Run all tests

```text
node --check evaluation-pipeline.js
node --check competency-engine.js
node --check critical-flags.js
node --check scenario-runtime.js
node --check app.js
node tests/phase263-integrity.test.js
node tests/phase262-reliability.test.js
node tests/phase261-adversarial.test.js
node tests/phase261-integration.test.js
node tests/phase26-validation.test.js
node tests/integrity-remediation.test.js
node tests/competency-engine.test.js
node tests/assessment-model.test.js
node tests/scoring.test.js
```

## Evaluation and scoring flow

The pipeline identifies fan context and opportunities, then classifies candidate actions. The competency engine consumes those action records rather than independently deciding whether a sales behavior occurred.

Evidence is validated after competency evaluation. Context evidence cannot support candidate competency credit. Candidate evidence must be typed `CANDIDATE_BEHAVIOR` and reference valid candidate message IDs. Invalid evidence clears the competency score and band and triggers recomputation of competency-group and overall scores.

Results distinguish `ASSESSED`, `INSUFFICIENT_EVIDENCE`, and `NOT_ASSESSED`. Unsupported results have null scores and do not contribute to the overall result.

## Provisional scoring weights

- Rapport: 40%
- Sales: 25%
- Objection handling: 20%
- Boundaries: 15%

Applicable weights are renormalized. Scores and weights are provisional and unvalidated.

## Critical flags

Critical flags are independent of skill scores and require human review. Current heuristic categories include minor-related risk, unsafe meetup agreement, personal identifying information, personal contact requests, off-platform transactions, coercion, secrecy, deceptive promises, and creator-boundary violations.

Protective refusals do not create misconduct flags. A protective phrase combined with a separate unsafe action remains eligible for a flag. Detection is heuristic and does not guarantee complete coverage.

## Known limitations

- Heuristic action classification is not semantic language understanding.
- Subtle manipulation, coded language, sarcasm, and paraphrased gaming may evade detection.
- Evidence validation protects attribution but does not guarantee interpretation accuracy.
- Scores and weights are not calibrated against reviewer agreement or hiring outcomes.
- Browser visual testing remains outstanding because browser preview access was unavailable.
- No backend, database, authentication, persistence, external AI, or API integration exists.

## Final test results

```text
Phase 2.6.3 integrity tests passed.
Phase 2.6.2 reliability tests passed.
Phase 2.6.1 adversarial tests passed.
Phase 2.6.1 integration tests passed.
Phase 2.6 validation tests passed.
Integrity remediation tests passed.
Competency engine tests passed.
Assessment model contract tests passed.
A. Strong conversationalist: 85/100 | No major heuristic penalties detected
B. Generic chatter: 0/100 | Repeated generic questions, Ignored information shared by the fan, Repetitive responses
C. Immediate seller: 15/100 | Premature PPV selling, Poorly timed sales transition
D. Ignores shared information: 0/100 | Repeated generic questions, Ignored information shared by the fan
E. Rapport but no monetization: 72/100 | No major heuristic penalties detected
F. Aggressive pressure: 0/100 | Ignored information shared by the fan, Premature PPV selling, Aggressive sales pressure, Poorly timed sales transition
All scoring regression tests passed.
Final stabilization regression tests passed.
10 test files passed, 0 failed.
```

## Phase status

Final stabilization is complete in this package. The evaluator remains provisional and unvalidated for real hiring decisions. Browser interaction/visual QA remains outstanding. Phase 3 has not started.
