# Sprint 42 Review

| Field | Value |
|-------|-------|
| **Sprint** | 42 (2026-07-03 → 2026-07-16) |
| **Sprint goal** | Ship Instant Payments API to GA readiness |
| **Facilitator** | D. Novak (Scrum Master) |
| **Attendees** | Team, PO, 2 partner-bank stakeholders |

## Sprint goal outcome

**Met.** The instant payments API reached GA readiness and shipped in [v2.4.0](../release-notes/v2.4.0.md).

## Committed vs. completed

| Metric | Value |
|--------|-------|
| Committed points | 34 |
| Completed points | 31 |
| Velocity (3-sprint avg) | 30 |
| Stories accepted | 6 of 7 |

## Demonstrated

- [HEL-142](../stories/hel-142-send-instant-payment.md) — live instant payment settling in 6.2 s. **Accepted.**
- Real-time webhook status stream. **Accepted.**
- Fraud scoring pilot ([HEL-158](../stories/hel-158-realtime-fraud-score.md)) — in progress, demoed at 480 ms p99. **Carried to Sprint 43.**

## Stakeholder feedback

- Partner banks asked for a sandbox environment to test integrations — logged as a new backlog item.
- Request to expose settlement time in the webhook payload — accepted, small change.

## Carry-over

- HEL-158 (3 points remaining) moves to Sprint 43.
