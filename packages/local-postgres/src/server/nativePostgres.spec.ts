import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { dockerStories as postgres } from "#test/dockerStories.ts";
import { nativePostgres } from "#test/nativePostgres.ts";

for (const dockerAvailable of [true, false]) {
	postgres.it(
		`setup accepts native PostgreSQL 18.6 with a distribution suffix and leaves its connection limit unchanged ${dockerAvailable ? "without a managed container" : "without Docker installed"}`,
		[nativePostgres({ dockerAvailable })],
		function* ({ maxConnections, outcome, runningVersion, start }) {
			yield* outcomes([
				["server version", () => runningVersion(), expect.stringMatching(/^18\.6 \(.+\)$/u)],
				["max connections", () => maxConnections(), 100],
			]);

			yield* start();

			yield* outcomes([
				["setup", () => outcome(), "started"],
				["max connections", () => maxConnections(), 100],
			]);
		},
		120_000,
	);
}
