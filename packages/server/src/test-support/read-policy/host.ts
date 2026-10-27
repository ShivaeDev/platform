import { Context, Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { heard, watchHints } from "@shivaedev/contract/testing.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { close, context, start } from "#test/app-host/lifecycle.ts";
import { emptyHost } from "#test/app-host/state.ts";
import { Api, type Check, documents, policyHost } from "./fixture.ts";

export const readPolicyHost = storyKit({
	clock: "live",
	*create() {
		const checks: Check[] = [];
		const state = { ...emptyHost(), checks };
		state.build = () => policyHost(state, state.checks);
		yield* Effect.addFinalizer(() => close(state).pipe(Effect.orDie));
		yield* start(state);
		return state;
	},
	name: "host read authorization",
	stages: [],
	verbs: (state) => {
		function client(viewer?: string) {
			return RpcClient.make(Api, { flatten: true }).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (http) =>
							HttpClient.mapRequest(http, HttpClientRequest.setHeaders(viewer === undefined ? {} : { authorization: viewer })),
						url: `${state.url}/rpc`,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
				),
			);
		}
		function listen(viewer: string) {
			const queries = [viewer].map((owner) => ({ payload: { owner }, query: "get" as const }));
			return Effect.flatMap(client(viewer), (rpc) => watchHints(rpc("account.$changes", { queries })));
		}
		return {
			checks: () => state.checks.map(({ key, viewer }) => ({ key, viewer: Option.getOrUndefined(viewer) })),
			handledReads: () => state.calls,
			heard,
			listen,
			lookups: () => state.lookups,
			plainRead: () => Effect.flatMap(client("alice"), (rpc) => rpc("plain.get", undefined)),
			publicRead: (viewer?: string) => Effect.flatMap(client(viewer), (rpc) => rpc("public.read", undefined)),
			publish: () =>
				Effect.flatMap(context(state), (services) =>
					Context.getUnsafe(services, Reactivity.Reactivity).invalidate(invalidationKeys([documents.item("alice"), documents.item("bob")])),
				),
			read: (boundary: "account.get" | "profile.get", viewer: string, owner: string) =>
				Effect.flatMap(client(viewer), (rpc) => rpc(boundary, { owner })),
		};
	},
});
