import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { close, start } from "#test/app-host/lifecycle.ts";
import { requests } from "#test/app-host/requests.ts";
import { emptyHost } from "#test/app-host/state.ts";
import { configuredHost, PublicConfig } from "./fixture.ts";

export const configuration = storyKit({
	after: { configured: start },
	clock: "live",
	*create() {
		const state = emptyHost();
		yield* Effect.addFinalizer(() => close(state).pipe(Effect.orDie));
		return state;
	},
	inspect: (state) => ({ address: state.address, bootFailure: state.bootFailure, lookups: state.lookups }),
	name: "public client configuration",
	stages: ["configured", "listening"],
	verbs: (state, story) => ({
		bootFailure: () => state.bootFailure,
		lookups: () => state.lookups,
		read: () => {
			story.tell("a native HTTP RPC client reads the public configuration without a session");
			return RpcClient.make(PublicConfig).pipe(
				Effect.flatMap((client) => client["platform.publicConfig.get"]()),
				Effect.provide(
					RpcClient.layerProtocolHttp({ url: `${state.url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
				),
				Effect.scoped,
			);
		},
		response: () =>
			requests(state, story.tell).request("/rpc", {
				body: `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "platform.publicConfig.get" })}\n`,
				headers: { "content-type": "application/ndjson" },
				method: "POST",
			}),
	}),
});

export function serverConfiguration(env: Record<string, string>, options: { path?: string | undefined; startupFails?: boolean } = {}) {
	return configuration.trait("configured", "the host exposes only its declared public schema", (state) => {
		Object.assign(state.env, env);
		state.expectBootFailure = options.startupFails ?? false;
		state.build = () => configuredHost(state, options.path);
	});
}
