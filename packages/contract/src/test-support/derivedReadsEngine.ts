import { Effect, Layer, Option, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { makeClient } from "#bind.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { Guard, TimelineData, Timelines } from "./derivedReadsContract.ts";
import { derivedReadsData } from "./derivedReadsData.ts";
import { storyRuntime } from "./storyRuntime.ts";

export const derivedReadsEngine = Effect.gen(function* () {
	const runtime = yield* storyRuntime;
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));

	const viewer = Option.some({ id: "alice" });
	const { create, data, edit } = yield* derivedReadsData.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const handlers = Timelines.application
		.toLayer({
			"timelines.create": create,
			"timelines.edit": edit,
			"timelines.timeline": ({ scope }) => Effect.flatMap(TimelineData, (current) => current.load(scope)),
		})
		.pipe(Layer.provide(data));
	const changes = changesHandlerLayer(
		Timelines,
		() =>
			({ queries }, options) =>
				Stream.unwrap(
					Effect.map(querySubscription(options.rpc, queries, viewer), (subscription) =>
						live.subscribe(subscription, rerunQuery(Timelines.application.omit("timelines.create", "timelines.edit"), options)),
					),
				),
	).pipe(Layer.provide(handlers), Layer.provide(data));
	const protocol = layerMemoryProtocol(Timelines).pipe(
		Layer.provide([handlers, changes, Layer.succeed(Guard, (effect) => Effect.provideService(effect, CurrentViewer, viewer))]),
	);
	const transport = yield* Layer.build(protocol);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const connection = makeClient(Timelines, { protocol: Layer.succeedContext(transport), runtime, url: "memory://timelines" });
	const client = yield* RpcClient.make(Timelines, { flatten: true }).pipe(Effect.provideContext(transport));
	const query = connection.api.timeline.query({ scope: "alice" });
	return { client, query, registry, sql };
});
