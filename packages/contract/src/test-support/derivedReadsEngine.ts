import { Effect, Layer, Option, Ref, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { makeClient } from "#bind.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { queryKeys } from "#queryKeys.ts";
import { querySubscription } from "#querySubscription.ts";
import { authorizeReads } from "#readPolicy.ts";
import { layerMemoryProtocol } from "#testing.ts";
import { Guard, TimelineData, Timelines } from "./derivedReadsContract.ts";
import { derivedReadsData } from "./derivedReadsData.ts";

export const derivedReadsEngine = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const projectKeys = yield* Ref.make(false);
	const viewer = Option.some({ id: "alice" });
	const { create, data, edit } = yield* derivedReadsData.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const handlers = Timelines.application
		.toLayer({
			"timelines.create": create,
			"timelines.edit": edit,
			"timelines.timeline": ({ scope }) => Effect.flatMap(TimelineData, (current) => current.load(scope)),
		})
		.pipe(Layer.provide(data));
	const changes = Timelines.omit("timelines.timeline", "timelines.edit", "timelines.create")
		.toLayer({
			"timelines.$changes": ({ queries }, { rpc }) =>
				Stream.unwrap(
					Effect.gen(function* () {
						if (yield* Ref.get(projectKeys)) {
							return live.stream(yield* queryKeys(Timelines.declaration.queries, queries, viewer));
						}
						return live.subscribe(yield* querySubscription(rpc, queries, viewer));
					}),
				),
		})
		.pipe(Layer.provide(data));
	const protocol = layerMemoryProtocol(Timelines).pipe(
		Layer.provide([handlers, changes, Layer.succeed(Guard, (effect, request) => authorizeReads(effect, request, viewer))]),
	);
	const transport = yield* Layer.build(protocol);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const connection = makeClient(Timelines, { protocol: Layer.succeedContext(transport), url: "memory://timelines" });
	const client = yield* RpcClient.make(Timelines, { flatten: true }).pipe(Effect.provideContext(transport));
	const query = connection.api.timeline.query({ scope: "alice" });
	return { client, projectKeys, query, registry, sql };
});
