import { Context } from "effect";
import type { PgBossClientFactory } from "#server/adapters/client.ts";
import { defaultClientFactory } from "#server/adapters/defaultClientFactory.ts";

export const JobsClientFactory = Context.Reference<PgBossClientFactory>("@shivaedev/jobs/JobsClientFactory", {
	defaultValue: () => defaultClientFactory,
});
