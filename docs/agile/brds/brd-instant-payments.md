# BRD-2026-014 · Instant Payments

| Field | Value |
|-------|-------|
| **Status** | Approved |
| **Author** | S. Chen (Business Analyst) |
| **Approvers** | Head of Payments, Risk & Compliance, Partner Success |
| **Version** | 1.2 |
| **Related epic** | [EPIC-001 · Instant Payments](../epics/epic-001-instant-payments.md) |

## 1. Executive summary

Partner banks require the ability to offer their customers **instant, 24/7 account-to-account payments**. Today Helios settles transfers in batches with delays of up to several hours, causing customer dissatisfaction and lost volume to competitors on instant rails. This BRD defines the business requirements for a real-time payments capability.

## 2. Business objectives

| # | Objective | Measure of success |
|---|-----------|--------------------|
| O1 | Reduce settlement time | 95th-percentile settlement < 10 seconds |
| O2 | Grow transfer volume | +18% transfer volume within two quarters of launch |
| O3 | Reduce support load | −30% "where is my money" tickets |
| O4 | Contain fraud risk | Fraud loss ≤ 5 bps of transferred value |

## 3. Stakeholders

| Role | Interest |
|------|----------|
| Head of Payments | Sponsor; owns the business case |
| Partner banks | Consumers of the API; want reliability and speed |
| Risk & Compliance | Fraud controls, regulatory reporting |
| Customer Support | Fewer, simpler tickets |

## 4. Scope

**In scope:** domestic instant transfers between Helios-connected accounts, via API and web console, with real-time status.

**Out of scope:** cross-border/FX, bulk disbursements, card transactions.

## 5. Business requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| BR-1 | Payments settle in under 10 seconds, 24/7/365. | Must |
| BR-2 | Each payment returns a real-time status (settled / held / failed). | Must |
| BR-3 | Duplicate submissions must not move funds twice. | Must |
| BR-4 | Every payment is screened for fraud before settlement. | Must |
| BR-5 | Per-account and per-transaction limits are configurable. | Should |
| BR-6 | Partners receive a webhook on status change. | Should |

## 6. Assumptions & constraints

- Partner banks integrate over the existing authenticated Helios API.
- Instant settlement is irreversible; fraud prevention must be pre-settlement.
- Must comply with applicable real-time payment scheme rules.

## 7. Non-functional requirements

- **Availability:** 99.95% for the payments endpoint.
- **Performance:** < 10 s settlement at p95; fraud score < 500 ms at p99.
- **Auditability:** every payment and decision is logged and retained per policy.

## 8. Acceptance & sign-off

This BRD is considered met when EPIC-001 is accepted against requirements BR-1 through BR-6 and non-functional targets are demonstrated in load testing.

| Approver | Decision | Date |
|----------|----------|------|
| Head of Payments | Approved | 2026-06-30 |
| Risk & Compliance | Approved | 2026-07-02 |
