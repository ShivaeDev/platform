import { Context, Layer } from "effect";
import type { PgBossClientFactory } from "@shivaedev/jobs/server/adapters/client.ts";
import { defaultClientFactory } from "@shivaedev/jobs/server/adapters/defaultClientFactory.ts";

export class JobsClientFactory extends Context.Service<JobsClientFactory, PgBossClientFactory>()("app/JobsClientFactory") {
	static readonly layer = Layer.succeed(JobsClientFactory, defaultClientFactory);
}
