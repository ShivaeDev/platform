import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { close, start } from "./lifecycle.ts";
import { emptyHost } from "./state.ts";
import { hostVerbs } from "./verbs.ts";

export const host = storyKit({
	after: { configured: start },
	clock: "live",
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
	inspect: (state) => ({
		address: state.address,
		bootFailure: state.bootFailure,
		calls: state.calls,
		lifecycle: state.lifecycle,
		logs: state.logs,
		lookups: state.lookups,
	}),
	name: "app host",
	stages: ["configured", "listening"],
	verbs: hostVerbs,
});

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
