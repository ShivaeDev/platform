import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { withHost } from "#test/fleetHost.ts";
import { withFollower } from "#test/follower.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("work-fleet follower failures against PostgreSQL", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);
	test("missing watch configuration exits 1", function* () {
		yield* withHost(
			{},
			{},
			Effect.fnUntraced(function* (fixture) {
				yield* withFollower(
					`${fixture.configFile}.missing`,
					"watch",
					["a"],
					{},
					Effect.fnUntraced(function* (follower) {
						expect((yield* Effect.promise(() => follower.done)).code).toBe(1);
					}),
				);
			}),
		);
	});

	for (const command of ["watch", "wait"] as const) {
		test(`${command} stops after consecutive connection failures`, function* () {
			yield* withHost(
				{},
				{},
				Effect.fnUntraced(function* (fixture) {
					fixture.write(
						"fleet.config.json",
						JSON.stringify({ database: { url: "postgresql://postgres:postgres@127.0.0.1:1/unavailable" }, provider: "local" }),
					);
					yield* withFollower(
						fixture.configFile,
						command,
						["a"],
						{ interval: 0.001 },
						Effect.fnUntraced(function* (follower) {
							const outcome = yield* Effect.promise(() => follower.done);
							expect(outcome.code).toBe(1);
							expect(`${outcome.stderr}${outcome.stdout}`).toContain("Fleet PostgreSQL is unreachable");
						}),
					);
				}),
			);
		});
	}
});
