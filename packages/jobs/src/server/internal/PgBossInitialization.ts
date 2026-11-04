import { Context, type Effect, type Scope } from "effect";
import type { PgBossError, PgBossQueueNamesError, PgBossQueueOptionsError } from "#server/error.ts";
import type { PgBoss } from "#server/PgBoss.ts";
import type { PgBossService } from "#server/service.ts";

export class PgBossInitialization extends Context.Service<
	PgBossInitialization,
	Effect.Effect<PgBossService, PgBossError | PgBossQueueNamesError | PgBossQueueOptionsError, PgBoss | Scope.Scope>
>()("@shivaedev/jobs/PgBossInitialization") {}
