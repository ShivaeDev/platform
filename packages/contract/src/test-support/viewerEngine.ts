import { Context, Effect, Layer, Option, Schema, Stream, SubscriptionRef } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { Note } from "@shivaedev/test-kits/test-support/notes/model.ts";
import { NotesViewer, noteOperations, viewerFromHeader } from "@shivaedev/test-kits/test-support/notes/module.ts";
import { NotesRepository } from "@shivaedev/test-kits/test-support/notes/Repository.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { defineModule } from "#defineModule.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { moduleHandlers } from "#moduleHandlers.ts";
import { query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer, signedIn } from "#readPolicy.ts";

class PageReads extends Context.Service<PageReads, SubscriptionRef.SubscriptionRef<readonly string[]>>()("@shivaedev/contract/test/PageReads") {}

const Titled = query("titled", {
	payload: { title: Schema.String },
	readPolicy: signedIn,
	*run({ title }) {
		const viewer = Option.match(yield* CurrentViewer, { onNone: () => "", onSome: ({ id }) => id });
		yield* SubscriptionRef.update(yield* PageReads, (reads) => [...reads, viewer]);
		const rows = yield* Effect.orDie((yield* NotesRepository).findMany({ orderBy: { direction: "asc", field: "id" }, where: { owner: viewer } }));
		const titled: readonly Note[] = rows.filter((row) => row.title.includes(title)).map((row) => new Note(row));
		return titled;
	},
	success: Schema.Array(Note),
});

export const Notes = defineModule({
	middleware: NotesViewer,
	name: "notes",
	operations: [...noteOperations, Titled],
	requires: [NotesRepository, PageReads],
});

export const viewerEngine = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	const reads = yield* SubscriptionRef.make<readonly string[]>([]);
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const sql = Layer.succeed(SqlClient.SqlClient, yield* SqlClient.SqlClient);
	const repository = Context.get(
		yield* Layer.build(NotesRepository.layer.pipe(Layer.provide([sql, Layer.succeed(Reactivity.Reactivity, reactivity)]))),
		NotesRepository,
	);
	yield* Effect.orDie(
		Effect.forEach(
			[
				{ owner: "alice", title: "One" },
				{ owner: "bob", title: "Two" },
				{ owner: "alice", title: "Other" },
			],
			(row) => repository.insertVoid(row),
		),
	);
	const services = Layer.mergeAll(
		Layer.succeed(NotesRepository, repository),
		Layer.succeed(PageReads, reads),
		Layer.succeed(Reactivity.Reactivity, reactivity),
	);
	const application = moduleHandlers(Notes).pipe(Layer.provide(services));
	const changes = changesHandlerLayer(
		Notes,
		() =>
			({ queries }, options) =>
				Stream.unwrap(
					Effect.gen(function* () {
						const subscription = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
						return live.subscribe(subscription, rerunQuery(Notes.application, options));
					}),
				),
	).pipe(Layer.provide(application), Layer.provide(services));
	const handlers = Layer.merge(application, changes);
	const client = yield* RpcTest.makeClient(Notes, { flatten: true }).pipe(Effect.provide(Layer.merge(handlers, viewerFromHeader())));
	return {
		client,
		layerFor: (viewer: string) => Layer.merge(handlers, viewerFromHeader(viewer)),
		reads,
		repository,
	};
});
