import { Effect, Layer, type Redacted } from "effect";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { JobsClientFactory } from "./JobsClientFactory.ts";

export function jobsLayer(connectionString: Redacted.Redacted<string>, max?: number) {
	return Layer.unwrap(
		Effect.map(JobsClientFactory, (clientFactory) =>
			pgBossLayer({
				clientFactory,
				connectionString,
				...(max === undefined ? {} : { max }),
				migrate: false,
				stop: { graceful: true, timeout: 65_000 },
			}),
		),
	);
}
