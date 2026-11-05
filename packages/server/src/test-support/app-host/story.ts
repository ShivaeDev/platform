import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { start, teardown } from "./lifecycle.ts";
import { emptyHost, type HostState } from "./state.ts";
import { hostVerbs } from "./verbs.ts";

export function hostOptions() {
	return {
		after: {
			configured: (state: HostState) =>
				Effect.gen(function* () {
					yield* Effect.addFinalizer(() => teardown(state).pipe(Effect.orDie));
					yield* start(state);
				}),
		},
		clock: "test" as const,
		*create() {
			const state = emptyHost();
			yield* Effect.addFinalizer(() =>
				Effect.gen(function* () {
					for (const cleanup of state.cleanup.toReversed()) {
						yield* Effect.promise(async () => {
							await cleanup();
						});
					}
				}),
			);
			return state;
		},
		inspect: (state: HostState) => ({
			address: state.address,
			bootFailure: state.bootFailure,
			calls: state.calls,
			lifecycle: state.lifecycle,
			logs: state.logs,
			lookups: state.lookups,
		}),
		name: "app host",
		stages: ["configured", "listening"] as const,
		verbs: hostVerbs,
	};
}

export const host = storyKit(hostOptions());
export const postgresHost = storyKit({
	...hostOptions(),
	around: withIsolatedDatabase,
	*create() {
		const state = yield* hostOptions().create();
		state.database = yield* PostgresTestDatabase;
		return state;
	},
	layer: postgres,
	runIf: databaseUrl !== undefined,
});

export function environment(env: Record<string, string>) {
	return host.trait("configured", `the host environment is ${JSON.stringify(env)}`, (state) => {
		Object.assign(state.env, env);
	});
}
export function configuration(config: {
	port?: number;
	host?: string;
	trustedProxy?: string;
	maxBodySize?: number;
	sensitiveKeys?: readonly string[];
}) {
	return host.trait("configured", `the host configuration is ${JSON.stringify(config)}`, (state) => {
		Object.assign(state.config, config);
	});
}
export const startupFails = host.trait("configured", "startup must fail", (state) => {
	state.expectBootFailure = true;
});
export const sessionPolicy = host.trait("configured", "the fixture resolves sessions", (state) => {
	state.loopback = false;
});
