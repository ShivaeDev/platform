import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { environmentVariable } from "#test/environmentVariable.ts";
import { close, start } from "./lifecycle.ts";
import { emptyHost, type HostState } from "./state.ts";
import { hostVerbs } from "./verbs.ts";

export function hostOptions({ database = false } = {}) {
	return {
		after: { configured: start },
		clock: "live" as const,
		*create() {
			const state = emptyHost();
			yield* Effect.addFinalizer(() =>
				Effect.gen(function* () {
					yield* close(state).pipe(Effect.orDie);
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
		runIf: !database || environmentVariable("PLATFORM_SQL_TEST_DATABASE_URL") !== undefined,
		stages: ["configured", "listening"] as const,
		verbs: hostVerbs,
	};
}

export const host = storyKit(hostOptions());

export function environment(env: Record<string, string>) {
	return host.trait("configured", `the host environment is ${JSON.stringify(env)}`, (state) => {
		Object.assign(state.env, env);
	});
}
export function configuration(config: { port?: number; host?: string; trustedProxy?: string; maxBodySize?: number }) {
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
