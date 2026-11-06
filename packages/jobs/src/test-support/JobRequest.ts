import type { Effect } from "effect";
import type { PgBossService } from "#server/service.ts";

export type JobRequest<A = unknown, E = unknown> = (jobs: PgBossService) => Effect.Effect<A, E>;
