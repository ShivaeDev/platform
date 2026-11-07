import { Effect, Layer } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { authenticatedUserLayer } from "@shivaedev/identity/server/session.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { roleView } from "#test/socket-policy/role/service.ts";
import { Api, List, lists, Note, notes } from "./feature.ts";

export const migrations = {
	loader: Migrator.fromRecord({
		"001_notes": SqlClient.SqlClient.use((sql) =>
			Effect.gen(function* () {
				yield* sql`create table socket_lists (id integer primary key, owner text not null)`;
				yield* sql`create table socket_notes (id integer primary key, "listId" integer not null references socket_lists, title text not null)`;
			}),
		),
	}),
};
export const handlers = Layer.unwrap(
	Effect.gen(function* () {
		const listRepository = yield* makeRepository(List, { collection: lists, idColumn: "id", spanPrefix: "Lists", tableName: "socket_lists" });
		const noteRepository = yield* makeRepository(Note, {
			collection: notes,
			conflictColumns: ["id"],
			idColumn: "id",
			spanPrefix: "Notes",
			tableName: "socket_notes",
		});
		return Api.application.toLayer({
			"socketNotes.all": () =>
				noteRepository.findMany({ orderBy: { direction: "asc", field: "id" } }).pipe(
					Effect.map((rows) => rows.map(({ title }) => title)),
					Effect.orDie,
				),
			"socketNotes.createList": (input) => listRepository.insert(input).pipe(Effect.asVoid, Effect.orDie),
			"socketNotes.role": () =>
				Effect.gen(function* () {
					return { ...(yield* roleView.use((view) => view.read())), callerRole: (yield* SessionUser).role ?? "member" };
				}),
			"socketNotes.save": (input) => noteRepository.upsert(input, { updateColumns: ["listId", "title"] }).pipe(Effect.asVoid, Effect.orDie),
			"socketNotes.timeline": ({ owner }) =>
				SqlClient.SqlClient.use(
					(sql) =>
						sql<{
							title: string;
						}>`select n.title from socket_notes n join socket_lists l on n."listId" = l.id where l.owner = ${owner} order by n.id`,
				).pipe(
					Effect.map((rows) => rows.map(({ title }) => title)),
					Effect.orDie,
				),
		});
	}),
).pipe(Layer.provideMerge(authenticatedUserLayer()));
