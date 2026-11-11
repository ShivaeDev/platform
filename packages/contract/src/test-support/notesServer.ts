import { Context, Effect, Layer, Option, Ref, Schema, Stream, SubscriptionRef } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { BadRequest, Conflict, NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { Note, NoteFields, notes } from "@shivaedev/test-kits/test-support/notes/model.ts";
import { NotesViewer } from "@shivaedev/test-kits/test-support/notes/module.ts";
import { Create, Get, List, NoteId, NoteRename, NotesOf, Rename } from "@shivaedev/test-kits/test-support/notes/operations.ts";
import { NotesRepository } from "@shivaedev/test-kits/test-support/notes/repository.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { contract } from "#contract.ts";
import { liveServerLayer } from "#live-server/layer.ts";
import { subscribe } from "#live-server/subscribe.ts";
import { command, query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer } from "#readPolicy.ts";
import type { QueryReference } from "#serverMetadata.ts";

// The reference queries declare no keys; these stories prove refreshes that follow keys a contract declares by hand.
export const DeclaredNotes = contract("notes", {
	commands: [
		command("rename", { invalidates: ({ id }) => [notes.item(id)], payload: NoteRename, rejections: { BadRequest, NotFound }, success: Note }),
		command("create", {
			invalidates: (_fields, note) => [notes.item(note.id)],
			payload: NoteFields,
			rejections: { BadRequest, Conflict, Unauthorized },
			success: Note,
		}),
	],
	queries: [
		query("get", { payload: NoteId, readPolicy: Get.readPolicy, reads: ({ id }) => [notes.item(id)], rejections: { NotFound }, success: Note }),
		query("list", { payload: NotesOf, readPolicy: List.readPolicy, reads: () => [notes.list], success: Schema.Array(Note) }),
	],
}).middleware(NotesViewer);

export const READER = "ada";

export const notesServer = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.Reactivity;
	const repository = Context.get(
		yield* Layer.build(NotesRepository.layer.pipe(Layer.provide(Layer.succeed(SqlClient.SqlClient, sql)))),
		NotesRepository,
	);
	yield* Effect.orDie(Effect.forEach(["One", "Two"], (title) => repository.insertVoid({ owner: READER, title })));
	const reads = yield* SubscriptionRef.make<readonly string[]>([]);
	const subscriptions = yield* Ref.make<readonly QueryReference[]>([]);
	const denied = yield* Ref.make(false);
	function read(label: string) {
		return SubscriptionRef.update(reads, (all) => [...all, label]);
	}
	// The client's Atom runtime builds this server, whose own Reactivity would otherwise receive the repository's writes.
	function publishing<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.provideService(effect, Reactivity.Reactivity, reactivity);
	}
	const implementation = {
		"notes.create": (payload: typeof NoteFields.Type) => publishing(Create.run(payload)),
		"notes.get": (payload: typeof NoteId.Type) => Effect.andThen(read(`get:${payload.id}`), Get.run(payload)),
		"notes.list": (payload: typeof NotesOf.Type) => Effect.andThen(read("list"), List.run(payload)),
		"notes.rename": (payload: typeof NoteRename.Type) => publishing(Rename.run(payload)),
	};
	const services = Layer.mergeAll(
		Layer.succeed(NotesRepository, repository),
		Layer.succeed(Reactivity.Reactivity, reactivity),
		Layer.succeed(SqlClient.SqlClient, sql),
	);
	const application = DeclaredNotes.application.toLayer(implementation).pipe(Layer.provide(services));
	const changes = changesHandlerLayer(
		DeclaredNotes,
		() =>
			({ queries }, options) =>
				Stream.unwrap(
					Effect.gen(function* () {
						yield* Ref.set(subscriptions, queries);
						const subscription = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
						return yield* subscribe(subscription, rerunQuery(DeclaredNotes.application.omit("notes.create", "notes.rename"), options));
					}),
				),
	);
	const handlers = Layer.merge(application, changes.pipe(Layer.provide(application))).pipe(
		Layer.provide(liveServerLayer.pipe(Layer.provide(Layer.succeed(Reactivity.Reactivity, reactivity)))),
		Layer.provide(services),
	);
	const guard = Layer.succeed(NotesViewer, (effect) =>
		Effect.flatMap(Ref.get(denied), (isDenied) =>
			isDenied
				? Effect.fail(new Unauthorized({ message: "This session is denied" }))
				: Effect.provideService(effect, CurrentViewer, Option.some({ id: READER })),
		),
	);
	return { application, denied, guard, layer: Layer.merge(handlers, guard), reads, repository, sql, subscriptions };
});
