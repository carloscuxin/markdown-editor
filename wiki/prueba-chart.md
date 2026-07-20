
```mermaid
flowchart TD
    Client[Client / Partner Bank] -->\|API| Gateway[Helios API Gateway]
    Gateway --> Payments[Instant Payments Service]
    Gateway --> Cards[Card Processing Service]
    Payments --> Ledger[(Ledger)]
    Payments --> Fraud[Fraud & Risk Engine]
    Cards --> Fraud
    Fraud --> Ledger
    Ledger --> Notify[Notifications]
```
