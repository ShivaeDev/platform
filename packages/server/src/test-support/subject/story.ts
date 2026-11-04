import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Deferred, Effect, Fiber, Layer, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { close, start } from "#test/app-host/lifecycle.ts";
import { emptyHost, type HostState } from "#test/app-host/state.ts";
import { Api, CannotActForAccount, type State, subjectHost } from "./feature.ts";

function httpClient(url: string, actor?: string, subject?: string) {
	const headers = { ...(actor === undefined ? {} : { authorization: actor }), ...(subject === undefined ? {} : { "x-platform-subject": subject }) };
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(headers)),
		url: `${url}/rpc`,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return Effect.flatMap(Layer.build(protocol), (services) => RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services)));
}

function socketClient(url: string, actor: string, subject: string) {
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide([
			layerWebSocket(`${url.replace(/^http/u, "ws")}/rpc`, { headers: { authorization: actor, "x-platform-subject": subject } }),
			RpcSerialization.layerNdjson,
		]),
	);
	return Effect.flatMap(Layer.build(protocol), (services) => RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services)));
}

export const subjectStory = storyKit({
	after: { configured: ({ state }: { readonly state: HostState & State }) => start(state) },
	clock: "test",
	*create() {
		const state: HostState & State = { ...emptyHost(), handled: [], revoked: new Set<string>(), sessions: true, titles: new Map<string, string>() };
		state.build = () => subjectHost(state);
		yield* Effect.addFinalizer(() => close(state).pipe(Effect.orDie));
		return { state, streams: new Map<string, Fiber.Fiber<void, unknown>>() };
	},
	name: "declared request subjects over HTTP",
	stages: ["configured"],
	verbs: ({ state, streams }, story) => ({
		follow: (actor: string, subject: string) =>
			Effect.gen(function* () {
				story.tell(`${actor} opens a stream for ${subject}`);
				const rpc = yield* socketClient(state.url, actor, subject);
				const opened = yield* Deferred.make<string>();
				const fiber = yield* rpc("delegated.follow", undefined).pipe(
					Stream.runForEach((id) => Deferred.succeed(opened, id)),
					Effect.forkScoped,
				);
				streams.set(actor, fiber);
				return yield* Deferred.await(opened);
			}),
		handledRequests: () => Effect.sync(() => [...state.handled]),
		read: (boundary: "own" | "delegated", actor: string, subject?: string) => {
			story.tell(`${actor} reads ${subject ?? "their own account"} through ${boundary}`);
			return answered(Effect.flatMap(httpClient(state.url, actor, subject), (client) => client(`${boundary}.read`, undefined)));
		},
		rename: (boundary: "own" | "delegated" | "shared", actor: string | undefined, title: string, subject?: string) => {
			story.tell(`${actor ?? "a visitor"} renames ${subject ?? "their own account"} through ${boundary}`);

			return answered(
				Effect.flatMap(httpClient(state.url, actor, subject), (client) =>
					client(boundary === "shared" ? "own.renameFor" : `${boundary}.rename`, { title }),
				).pipe(Effect.catchTag("CannotActForAccount", ({ account }) => Effect.succeed({ refused: account }))),
			);
		},

		requestChanges: (actor: string, subject: string) => {
			story.tell(`${actor} requests changes for ${subject}`);
			return answered(
				Effect.flatMap(socketClient(state.url, actor, subject), (rpc) => Stream.runHead(rpc("delegated.$changes", { queries: [] }))).pipe(
					Effect.catchTag("CannotActForAccount", ({ account }) => Effect.succeed({ refused: account })),
				),
			);
		},
		revalidationIntervalPasses: (actor: string) => {
			story.tell("the session revalidation interval passes");
			const fiber = streams.get(actor);
			if (fiber === undefined) {
				return Effect.die("Open the stream first");
			}
			return untilTimer("30 seconds").pipe(
				Effect.andThen(
					passes(
						"30 seconds",
						answered(Fiber.join(fiber), (error) => (error instanceof CannotActForAccount ? `cannot act for ${error.account}` : String(error))),
					),
				),
			);
		},
		revokeDelegation: (actor: string) => {
			story.tell(`${actor} loses the right to act for other accounts`);
			return Effect.sync(() => state.revoked.add(actor));
		},
		storedTitles: () => Effect.sync(() => Object.fromEntries(state.titles)),
	}),
});

export const withoutSessions = subjectStory.trait("configured", "the host has no session policy", ({ state }) => {
	state.sessions = false;
});
