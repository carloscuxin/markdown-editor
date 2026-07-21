# EPIC-002 · Fraud & Risk Screening

| Field | Value |
|-------|-------|
| **Status** | In progress |
| **Owner** | KASS (Product Owner) |
| **Target release** | v2.5.0 |
| **Projects board** | `Helios Delivery` → filter `epic:EPIC-002` |

## Summary

Screen every payment in real time with a machine-learning risk score, blocking or holding suspicious transactions **without adding meaningful latency** to the instant-payments flow.

## Business value

Instant settlement removes the ability to claw back fraudulent transfers, so prevention must happen *before* settlement. Target: keep fraud loss below **5 basis points** of transferred value while holding false-positive rate under **1.5%**.

## Goals & success metrics

- Risk score returned in **< 500 ms** at the 99th percentile.
- Fraud loss rate **≤ 0.05%** of value.
- False-positive (good payments held) rate **≤ 1.5%**.

## Scope

**In scope**

- Real-time scoring API called synchronously by the payments service.
- Rules + ML hybrid model with a human-review queue for held payments.
- Analyst dashboard for reviewing and releasing holds.

**Out of scope**

- Chargeback / dispute management (handled by a separate domain).

## Child user stories

| ID | Title | Status |
|----|-------|--------|
| [HEL-158](../stories/hel-158-realtime-fraud-score.md) | Return real-time fraud score | In progress |
| HEL-159 | Hold-and-review queue | To do |
| HEL-160 | Analyst review dashboard | To do |

## Dependencies & risks

!!! warning "Key risk"
    The 500 ms scoring budget is tight. If the model can't meet it, the payments service falls back to a rules-only score and flags the transaction for post-settlement review.

## Definition of Done

- [ ] All child stories accepted.
- [ ] Latency budget verified under peak load.
- [ ] Model performance signed off by Risk & Compliance.
- [ ] Release notes and analyst runbook published.
