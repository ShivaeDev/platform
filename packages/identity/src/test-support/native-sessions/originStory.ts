import { Effect } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { forwardingProxy } from "@shivaedev/test-story/server/forwardingProxy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ANDROID_ORIGIN, type Host, NATIVE_ORIGIN, startHost } from "./host.ts";
import { originVerbs } from "./originVerbs.ts";

interface State {
	host?: Host;
	nativeOrigins?: readonly string[];
	trustedProxy?: string;
}
export const origins = storyKit({
	after: {
		*configured(state) {
			state.host = yield* startHost(true, state.nativeOrigins, state.trustedProxy);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: (): State => ({ nativeOrigins: [NATIVE_ORIGIN, ANDROID_ORIGIN] }),
	inspect: (state) => ({ lookups: state.host?.activity.lookups, nativeOrigins: state.nativeOrigins }),
	layer: postgres,
	name: "native origins through appHost over HTTP",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "listening"],
	verbs: (state, story) => {
		if (state.host === undefined) {
			throw new Error("The host has not started");
		}
		return originVerbs(state.host, story.tell);
	},
});
export const withoutNativeOrigins = origins.trait("configured", "native origins are not configured", (state) => {
	delete state.nativeOrigins;
});
export function proxyTrust(address: string) {
	return origins.trait("configured", "the host configures its trusted proxy peer", (state) => {
		state.trustedProxy = address;
	});
}
export function forwardedNative(authority = "app.example", protocol = "https") {
	return origins.trait("listening", "a real proxy forwards the public authority", function* (state) {
		if (state.host === undefined) {
			return yield* Effect.die("The host has not started");
		}
		const proxy = yield* forwardingProxy(state.host.baseUrl, {
			headers: { host: "internal.test", "x-forwarded-host": authority, "x-forwarded-proto": protocol },
		});
		state.host.baseUrl = proxy.url;
	});
}
