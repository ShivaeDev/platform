import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Context, Effect, Layer, Option, Predicate } from "effect";
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
		const revoked = new Set<string>();
		const rows = new Map([
			["alice", "Alice's document"],
			["bob", "Bob's document"],
		]);
		const state = { ...emptyHost(), checks, revoked, rows };
		state.build = () => policyHost(state, state.checks, revoked, rows);
		yield* Effect.addFinalizer(() => close(state).pipe(Effect.orDie));
		yield* start(state);
		return state;
	},
	name: "host read authorization",
	stages: [],
	verbs: (state) => {
		function client(viewer?: string, socket = false) {
			const protocol = socket
				? RpcClient.layerProtocolSocket().pipe(
						Layer.provide([
							layerWebSocket(`${state.url.replace(/^http/u, "ws")}/rpc`, { headers: { authorization: viewer ?? "" } }),
							RpcSerialization.layerNdjson,
						]),
					)
				: RpcClient.layerProtocolHttp({
						transformClient: (http) =>
							HttpClient.mapRequest(http, HttpClientRequest.setHeaders(viewer === undefined ? {} : { authorization: viewer })),
						url: `${state.url}/rpc`,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
			return Effect.flatMap(Layer.build(protocol), (services) => RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services)));
		}
		function listen(viewer: string) {
			const queries = [viewer].map((owner) => ({ payload: { owner }, query: "get" as const }));
			return Effect.flatMap(client(viewer, true), (rpc) => watchHints(rpc("account.$changes", { queries })));
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
			revokeRead: (viewer: string) => Effect.sync(() => state.rows.delete(viewer)),
			revokeSession: (viewer: string) => Effect.sync(() => state.revoked.add(viewer)),
			subscriptionEnd: (listener: Effect.Success<ReturnType<typeof listen>>) =>
				listener.finished.pipe(
					Effect.match({
						onFailure: (error) => (Predicate.isTagged(error, "QueryReadDenied") ? "read denied" : String(error)),
						onSuccess: () => "completed",
					}),
				),
		};
	},
});
