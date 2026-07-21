# HEL-158 · Return real-time fraud score

| Field | Value |
|-------|-------|
| **Issue** | [HEL-158 · Return real-time fraud score](https://github.com/JesusESD/agile-docs-demo/issues/2) |
| **Epic** | [EPIC-002 · Fraud & Risk Screening](../epics/epic-002-fraud-risk-screening.md) |
| **Sprint** | 42 |
| **Estimate** | 8 points |
| **Status** | In progress |
| **Assignee** | M. Haddad |

## Story

> **As a** payments service, **I want** a fraud risk score for each transaction in under 500 ms, **so that** I can block or hold suspicious payments before they settle.

## Acceptance criteria

```gherkin
Scenario: Low-risk payment
  Given a transaction with normal characteristics
  When the payments service requests a score from /v2/risk/score
  Then a score between 0 and 100 is returned in under 500 ms
  And a score below 40 results in decision "ALLOW"

Scenario: High-risk payment
  Given a transaction matching a high-risk pattern
  When a score is requested
  Then a score above 80 results in decision "BLOCK"
  And the transaction is added to the review queue

Scenario: Scoring timeout fallback
  Given the ML model does not respond within 500 ms
  When a score is requested
  Then a rules-only score is returned
  And the transaction is flagged for post-settlement review
```

## Notes & decisions

- Decision thresholds (ALLOW / HOLD / BLOCK) are configurable by Risk & Compliance without a code change.
- Every scoring call is logged for model monitoring and auditing.

## Definition of Done

- [ ] Model + rules engine deployed behind the scoring API.
- [ ] p99 latency < 500 ms verified.
- [ ] Fallback path tested.
- [ ] Signed off by Risk & Compliance.
