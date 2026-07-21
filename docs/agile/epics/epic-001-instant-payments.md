# EPIC-001 · Instant Payments

| Field | Value |
|-------|-------|
| **Status** | In progress |
| **Owner** | A. Rivera (Product Owner) |
| **Target release** | v2.4.0 |
| **Source BRD** | [BRD · Instant Payments](../brds/brd-instant-payments.md) |
| **Projects board** | `Helios Delivery` → filter `epic:EPIC-001` |

## Summary

Enable Helios customers to send and receive **account-to-account payments that settle in under 10 seconds**, 24/7, through the partner-bank API and the web console.

## Business value

Partner banks lose transfer volume to competitors offering instant rails. Delivering sub-10-second settlement is expected to increase transfer volume by **18%** and reduce support tickets related to "where is my money" by **30%**.

## Goals & success metrics

- 95th-percentile settlement time **< 10 seconds**.
- **99.95%** availability for the payments endpoint.
- Zero increase in fraud loss rate versus standard transfers (guarded by [EPIC-002](epic-002-fraud-risk-screening.md)).

## Scope

**In scope**

- Domestic instant transfers between Helios-connected accounts.
- Idempotent payment API with real-time status webhooks.
- Console UI for initiating and tracking a payment.

**Out of scope**

- Cross-border / FX payments (future epic).
- Bulk / batch disbursements.

## Child user stories

| ID | Title | Status |
|----|-------|--------|
| [HEL-142](../stories/hel-142-send-instant-payment.md) | Send an instant payment via API | In progress |
| HEL-143 | Receive payment status webhook | To do |
| HEL-144 | Track payment in web console | To do |
| HEL-145 | Idempotency & retry handling | To do |

## Dependencies & risks

!!! warning "Dependencies"
    - Ledger service must expose a synchronous reservation call (owned by Platform team).
    - Fraud engine ([EPIC-002](epic-002-fraud-risk-screening.md)) must return a score within 500 ms to stay inside the 10-second budget.

## Definition of Done

- [ ] All child stories accepted.
- [ ] Non-functional targets (latency, availability) verified in load test.
- [ ] Runbook and release notes published.
- [ ] Signed off by Business Analyst against the BRD.
