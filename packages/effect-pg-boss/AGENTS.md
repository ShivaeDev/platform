# @shivaedev/effect-pg-boss

You are changing the jobs boundary between native Effect applications and pg-boss. Producers and workers must agree on durable payloads, workers must reach the application's services, and a running queue client needs an owner that closes it. Keep one object Schema for the payload boundary and one scoped Layer for the client and its registrations. Usage is in [README.md](./README.md), the full intent in [docs/north-star.md](./docs/north-star.md), and package work and open choices in [docs/roadmap.md](./docs/roadmap.md).

## Which way to lean

When goals conflict, use this order:

1. **Native Effect stays visible.** Preserve service requirements, typed failures, scope ownership and interruption across pg-boss callbacks. A shorter API is not worth losing those contracts.
2. **One contract per durable payload.** The same Schema describes what a producer encodes and a worker decodes. Validate before domain code runs; do not introduce a separate worker payload model.
3. **One jobs path, with pg-boss as its engine.** Keep ordinary queue, worker and schedule options recognizable. Add an adapter only to remove repeated Effect boundary code, not another scheduler, retry engine or application service framework.
4. **The client has an explicit owner.** Acquisition failures and scope release must clean up resources. Client reuse is an explicit key chosen by the application; environment and deployment policy stay there.
5. **Evidence before convenience.** A registration call proves a setting was supplied, not that PostgreSQL executed a cron or retry correctly. Prove durable behavior against real PostgreSQL and keep claims within the tests.

Applications own authorization, domain side effects, external-provider policy and transaction/outbox choices. Do not settle those policies here merely because a worker needs them. Follow the [root guidance](../../AGENTS.md) for the shared package boundaries and workflow.
