import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Deferred, Effect, Exit, Fiber, Layer, PubSub, Scope, Stream } from "effect";
import { RpcClient } from "effect/rpc";
import { browserReads } from "#server/browserReads.ts";
import { storyKit } from "#server/storyKit.ts";
import { ReadPage, readPageHost } from "#test/readPageHost.ts";

export const subscriptionClients = storyKit({
	clock: "test",
	*create() {
		const { url, held, opened } = yield* readPageHost;
		const openings = yield* PubSub.subscribe(opened);
		const observed = yield* browserReads({ contracts: [ReadPage], url, webSocketConstructor: layerWebSocketConstructor });
		const context = yield* Layer.build(observed.protocol(undefined));
		const clients = new Map<string, Scope.Closeable>();
		return { clients, context, held, observed, openings };
	},
	inspect: ({ observed }) => ({ subscriptions: observed.subscriptions() }),
	name: "subscription clients",
	stages: [],
	verbs: ({ clients, context, held, observed, openings }, story) => ({
		closeClient: (name: string) => {
			story.tell(`${name} closes their client`);
			const scope = clients.get(name);
			return scope === undefined ? Effect.die(`No client named ${name}`) : Scope.close(scope, Exit.void);
		},
		openClient: (name: string) =>
			Effect.gen(function* () {
				story.tell(`${name} opens a live page subscription`);
				const scope = yield* Effect.acquireRelease(Scope.make(), (current) => Scope.close(current, Exit.void));
				clients.set(name, scope);
				const client = yield* RpcClient.make(ReadPage).pipe(Effect.provide(context), Effect.provideService(Scope.Scope, scope));
				yield* client["page.$changes"]({ queries: [{ payload: { id: 2 }, query: "second" }] }).pipe(
					Stream.runDrain,
					Effect.exit,
					Effect.forkScoped,
					Effect.provideService(Scope.Scope, scope),
				);
				yield* PubSub.take(openings);
			}),
		releasePage: () => {
			story.tell("the server delivers the held page hint");
			return Deferred.succeed(held, "hint");
		},
		startWaiting: () =>
			Effect.gen(function* () {
				story.tell("wait for all subscription openings to settle");
				const fiber = yield* observed.waitForSubscriptions.pipe(Effect.forkScoped({ startImmediately: true }));
				return { finish: Fiber.join(fiber), state: Effect.sync(() => (fiber.pollUnsafe() === undefined ? "waiting" : "settled")) };
			}),
		states: () => Effect.sync(() => observed.subscriptions().map(({ state }) => state)),
	}),
});
