import type { Redacted } from "effect";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";

export function jobsLayer(connectionString: Redacted.Redacted<string>, max?: number) {
	return pgBossLayer({
		connectionString,
		...(max === undefined ? {} : { max }),
		migrate: false,
		stop: { graceful: true, timeout: 65_000 },
	});
}
