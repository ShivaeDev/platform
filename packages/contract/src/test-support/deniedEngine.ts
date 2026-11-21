import { Clock, Effect, Layer, Option, Stream } from "effect";
import { Digest } from "effect/crypto";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { type ContractsClient, makeClient } from "#makeClient.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { Access, Guard, Records } from "#test/deniedContract.ts";
import { syntheticNative } from "#test/resumeSources.ts";

export const deniedEngine = Effect.gen(function* () {
	const access: typeof Access.Service = { allowed: false, checks: 0, rejection: "denied" };
	const attempts: number[] = [];
	const clock = yield* Clock.Clock;
	const digest = yield* Digest.Digest;
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const handlers = Layer.merge(
		Records.application.toLayer({
			"denied-records.pushed": () => Effect.succeed("Alice's record"),
			"denied-records.touch": () => Effect.void,
			"denied-records.unkeyed": () => Effect.succeed("Alice's record"),
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
	runtime.addGlobalLayer(Layer.mergeAll(Layer.succeed(Clock.Clock, clock), Layer.succeed(Digest.Digest, digest)));
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const native = syntheticNative();
	const connection = makeClient(
		{ records: Records },
		{
			protocol: (identity) => {
				const viewer = Option.map(Option.fromUndefinedOr(identity), (id) => ({ id }));
				const guard = Layer.succeed(Guard, (effect) =>
					Effect.provideService(effect, CurrentViewer, viewer).pipe(Effect.provideService(Access, access)),
				);
				return layerMemoryProtocol(Records).pipe(Layer.provide(Layer.merge(handlers, guard)));
			},
			resume: native.source,
			runtime,
		},
	);
	const api = connection.api.records;
	function run<A, E>(effect: Effect.Effect<A, E, ContractsClient | Reactivity.Reactivity>) {
		return AtomRegistry.getResult(registry, connection.runtime.atom(effect));
	}
	return { access, api, attempts, native, reactivity, registry, run, view: api.pushed.query() };
});
export type DeniedEngine = Effect.Success<typeof deniedEngine>;
