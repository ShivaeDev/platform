import { Context, Layer } from "effect";
import { defaultClientFactory, type PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";

export class JobsClientFactory extends Context.Service<JobsClientFactory, PgBossClientFactory>()("app/JobsClientFactory") {
	static readonly layer = Layer.succeed(JobsClientFactory, defaultClientFactory);
}
