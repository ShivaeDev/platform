import { Clock, Crypto, Effect, Layer, Option, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { LiveConnection } from "#automaticLive.ts";
import { bind } from "#bind.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { socketIdentity } from "#rpcClient.ts";
import { Access, Guard, Records } from "./deniedContract.ts";
import { syntheticNative } from "./resumeSources.ts";

export const deniedEngine = Effect.gen(function* () {
	const access: typeof Access.Service = { allowed: false, checks: 0, rejection: "denied" };
	const attempts: number[] = [];
	const clock = yield* Clock.Clock;
	const crypto = yield* Crypto.Crypto;
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const handlers = Layer.merge(
		Records.application.toLayer({
			"denied-records.hints": () => Effect.succeed("Alice's record"),
			"denied-records.pushed": () => Effect.succeed("Alice's record"),
		}),
		changesHandlerLayer(
			Records,
			() =>
				({ queries }, { rpc }) =>
					Stream.unwrap(
						Effect.gen(function* () {
							attempts.push(clock.currentTimeMillisUnsafe());
							const viewer = yield* CurrentViewer;
							const subscription = yield* querySubscription(rpc, queries, viewer);
							return live.subscribe(subscription, () => Effect.succeed("Alice's record"));
						}),
					),
		),
	).pipe(Layer.provide(Layer.succeed(Access, access)));
	const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
	runtime.addGlobalLayer(Layer.mergeAll(Layer.succeed(Clock.Clock, clock), Layer.succeed(Crypto.Crypto, crypto)));
	class Client extends AtomRpc.Service<Client>()("test/DeniedClient", {
		group: Records,
		makeEffect: RpcTest.makeClient(Records, { flatten: true }),
		protocol: (get) => {
			const viewer = Option.map(Option.fromUndefinedOr(get(socketIdentity)), (id) => ({ id }));
			return Layer.merge(
				handlers,
				Layer.succeed(Guard, (effect) => Effect.provideService(effect, CurrentViewer, viewer).pipe(Effect.provideService(Access, access))),
			);
		},
		runtime,
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const native = syntheticNative();
	const api = bind(Records, Client, { resume: native.source });
	registry.set(api[LiveConnection].coalesceWindow, 0);
	const clientReactivity = AtomRegistry.getResult(registry, Client.runtime.atom(Effect.service(Reactivity.Reactivity)));
	return { access, api, attempts, clientReactivity, native, reactivity, registry, view: api.hints.query() };
});
export type DeniedEngine = Effect.Success<typeof deniedEngine>;
