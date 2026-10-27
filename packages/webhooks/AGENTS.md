# @shivaedev/webhooks

This package owns the receiving boundary for signed webhooks: one route verifies raw bytes, records a delivery and queues typed work. Applications register sources and event schemas, choose queues, and run their domain work in workers. Usage is in [README.md](./README.md).

Atomic receipt and job persistence wins first, then bounded bodies and credential privacy, then convenience. Use the native HTTP router, the shared HTTP body reader, Effect SQL transactions and jobs enqueueing. Keep provider verification in the provider package; strategies read identity and event headers without guessing from payloads. Never add a parallel server, worker engine or signature implementation.

Prove receiving behavior through a real appHost, real HTTP and isolated PostgreSQL databases. The receipt is an inbox record, not an event journal. Follow the [root guidance](../../AGENTS.md) for shared conventions.
