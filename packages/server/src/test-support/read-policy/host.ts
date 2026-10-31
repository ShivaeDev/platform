import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Context, Effect, Layer, Option, Predicate } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { answered } from "@shivaedev/test/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { close, context, start } from "#test/app-host/lifecycle.ts";
import { emptyHost } from "#test/app-host/state.ts";
import { type Feed, followHints } from "#test/rpc/followHints.ts";
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
		const state = { ...emptyHost(), checks, feeds: new Map<string, Feed>(), revoked, rows };
		state.build = () => policyHost(state, state.checks, revoked, rows);
		yield* Effect.addFinalizer(() => close(state).pipe(Effect.orDie));
		yield* start(state);
		return state;
	},
	name: "host read authorization",
	stages: [],
	verbs: (state, story) => {
		function feed(viewer: string) {
			const found = state.feeds.get(viewer);
			return found === undefined ? Effect.die(`${viewer} has not subscribed`) : Effect.succeed(found);
		}
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
		function viewerWords(viewer?: string) {
			return viewer === undefined ? "a visitor" : viewer;
		}
		return {
			handledReads: () => Effect.sync(() => [...state.calls]),
			listen: (viewer: string) =>
				Effect.gen(function* () {
					story.tell(`${viewer} subscribes over a socket to changes of ${viewer}'s document`);
					const rpc = yield* client(viewer, true);
					state.feeds.set(viewer, yield* followHints(rpc("account.$changes", { queries: [{ payload: { owner: viewer }, query: "get" }] })));
				}),
			nextHint: (viewer: string) => Effect.flatMap(feed(viewer), (subscription) => subscription.next),
			plainRead: () => {
				story.tell("alice reads the private document through a contract without identity middleware");
				return answered(Effect.flatMap(client("alice"), (rpc) => rpc("plain.get", undefined)));
			},
			policyChecks: () =>
				Effect.sync(() =>
					state.checks.map(({ key, viewer }) => {
						const document = Predicate.hasProperty(key, "id") ? `document ${String(key.id)}` : "the document list";
						return `${document} for ${Option.match(viewer, { onNone: () => "no viewer", onSome: ({ id }) => id })}`;
					}),
				),
			publicRead: (viewer?: string) => {
				story.tell(`${viewerWords(viewer)} reads the public documents`);
				return answered(Effect.flatMap(client(viewer), (rpc) => rpc("public.read", undefined)));
			},
			publish: () => {
				story.tell("the host announces changes to alice's and bob's documents");
				return Effect.flatMap(context(state), (services) =>
					Context.getUnsafe(services, Reactivity.Reactivity).invalidate(invalidationKeys([documents.item("alice"), documents.item("bob")])),
				);
			},
			read: (boundary: "account.get" | "profile.get", viewer: string, owner: string) => {
				story.tell(`${viewer} reads ${owner}'s document through ${boundary}`);
				return answered(Effect.flatMap(client(viewer), (rpc) => rpc(boundary, { owner })));
			},
			revokeRead: (viewer: string) => {
				story.tell(`${viewer}'s document is removed, so the read policy denies ${viewer}`);
				return Effect.sync(() => state.rows.delete(viewer));
			},
			revokeSession: (viewer: string) => {
				story.tell(`${viewer}'s session is revoked`);
				return Effect.sync(() => state.revoked.add(viewer));
			},
			sessionLookups: () => Effect.sync(() => [...state.lookups]),
			subscriptionOutcome: (viewer: string) =>
				Effect.gen(function* () {
					const subscription = yield* feed(viewer);
					const ending = yield* subscription.ending;
					return { ending, hints: [...subscription.hints] };
				}),
		};
	},
});
