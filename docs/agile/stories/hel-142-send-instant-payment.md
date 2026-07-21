# HEL-142 · Send an instant payment via API

| Field | Value |
|-------|-------|
| **Issue** | [HEL-142 · Send Instant Payment](https://github.com/JesusESD/agile-docs-demo/issues/1) |
| **Epic** | [EPIC-001 · Instant Payments](../epics/epic-001-instant-payments.md) |
| **Sprint** | 42 |
| **Estimate** | 5 points |
| **Status** | In progress |
| **Assignee** | J. Okoro |

## Story

> **As a** partner-bank integrator, **I want** to submit a payment through a single API call, **so that** my customers' funds move to the beneficiary in under 10 seconds.

## Acceptance criteria

```gherkin
Scenario: Successful instant payment
  Given a funded source account and a valid beneficiary
  When the client POSTs a payment to /v2/payments with a unique idempotency key
  Then the API responds 201 with status "SETTLED"
  And the settlement completes in under 10 seconds
  And the ledger reflects the debit and credit atomically

Scenario: Insufficient funds
  Given a source account without enough balance
  When the client POSTs the payment
  Then the API responds 422 with error code "INSUFFICIENT_FUNDS"
  And no ledger entry is created

Scenario: Duplicate request
  Given a payment was already submitted with idempotency key K
  When the client resubmits with key K
  Then the API returns the original result without creating a second payment
```

## Notes & decisions

- Payment amounts are validated against per-account limits configured in the console.
- The fraud score (see [HEL-158](hel-158-realtime-fraud-score.md)) is called synchronously; a score above the block threshold returns `409 PAYMENT_HELD`.

## Definition of Done

- [ ] Code merged and covered by unit + contrac.
- [ ] API reference updated.
- [ ] Load test confirms < 10 s at target throughput.
- [ ] Demoed at [Sprint 42 Review](../reports/sprint-42-review.md).
