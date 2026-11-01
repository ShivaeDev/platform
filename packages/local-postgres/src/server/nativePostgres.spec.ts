import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nativePostgres } from "#test/nativePostgres.ts";
import { postgres } from "#test/postgres.ts";

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

for (const password of ["bad%", "bad%GG", "bad%C3%28"]) {
	for (const action of ["query", "start", "prepare"] as const) {
		postgres.it(
			`a ${action} with malformed password escape ${password} fails with a typed local connection error`,
			[],
			function* ({ failureKind, outcome, prepare, query, start, subprocesses }) {
				const connection = `postgresql://postgres:${password}@127.0.0.1:55432/postgres`;

				if (action === "query") {
					yield* query("SELECT 1", connection);
				} else if (action === "start") {
					yield* start(connection);
				} else {
					yield* prepare([connection]);
				}

				yield* outcomes([
					["failure", () => failureKind(), "invalid local connection"],
					["diagnostic", () => outcome(), "failed: Invalid local database password escape."],
					["subprocesses", () => subprocesses(), []],
				]);
			},
		);
	}
}
