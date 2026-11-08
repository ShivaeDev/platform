import { Context, Layer } from "effect";
import { defaultClientFactory } from "@shivaedev/jobs/server/adapters/defaultClientFactory.ts";
import type { PgBossOptions } from "@shivaedev/jobs/server/service.ts";

type PgBossClientFactory = NonNullable<PgBossOptions["clientFactory"]>;

export class JobsClientFactory extends Context.Service<JobsClientFactory, PgBossClientFactory>()("app/JobsClientFactory") {
	static readonly layer = Layer.succeed(JobsClientFactory, defaultClientFactory);
}
