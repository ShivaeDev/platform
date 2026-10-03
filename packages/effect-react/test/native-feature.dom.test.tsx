import { RegistryContext } from "@effect/atom-react";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { makeRepository } from "@shivaedev/effect-sql";
import { Effect, Layer, Option, Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { Rpc, RpcGroup, RpcTest } from "effect/unstable/rpc";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useAction, useQuery } from "../src/index.ts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class Note extends Model.Class<Note>("Note")({
	id: Model.Field({
		select: Schema.Number,
		update: Schema.Number,
		json: Schema.Number,
	}),
	title: Schema.String,
}) {}

const Notes = RpcGroup.make(
	Rpc.make("ListNotes", { success: Schema.Array(Note), error: Schema.String }),
	Rpc.make("CreateNote", {
		payload: { title: Schema.String },
		success: Note,
		error: Schema.String,
	}),
);

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table notes (id integer primary key, title text not null)`;
		const notes = yield* makeRepository(Note, {
			tableName: "notes",
			idColumn: "id",
			spanPrefix: "Notes",
		});
		return Notes.of({
			ListNotes: () => notes.findMany({ orderBy: { field: "id", direction: "asc" } }).pipe(Effect.mapError(() => "storage unavailable")),
			CreateNote: ({ title }) =>
				title.trim() === "" ? Effect.fail("title required") : notes.insert({ title }).pipe(Effect.mapError(() => "storage unavailable")),
		});
	}),
).pipe(Layer.provide(SqliteClient.layer({ filename: ":memory:" })));

class NotesClient extends AtomRpc.Service<NotesClient>()("test/NotesClient", {
	group: Notes,
	protocol: handlers,
	makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
}) {}

test("rendered create persists through RPC and refreshes its query; rejected saves preserve the list", async () => {
	const registry = AtomRegistry.make();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const list = NotesClient.query("ListNotes", undefined, {
		reactivityKeys: ["notes"],
	});
	const create = NotesClient.mutation("CreateNote");
	const Component = () => {
		const query = useQuery(list);
		const action = useAction(create);
		return createElement(
			"section",
			null,
			createElement(
				"output",
				null,
				JSON.stringify({
					titles: Option.getOrElse(query.data, () => []).map((note) => note.title),
					loading: query.pending,
					saving: action.pending,
					error: Option.isSome(action.cause),
				}),
			),
			createElement(
				"button",
				{
					type: "button",
					onClick: () =>
						action.dispatch({
							payload: { title: "Morning walk" },
							reactivityKeys: ["notes"],
						}),
				},
				"Save",
			),
			createElement(
				"button",
				{
					type: "button",
					onClick: () =>
						action.dispatch({
							payload: { title: "" },
							reactivityKeys: ["notes"],
						}),
				},
				"Save empty",
			),
		);
	};
	const snapshot = () => JSON.parse(container.querySelector("output")?.textContent ?? "null");
	const settled = async (titles: string[], error = false) =>
		vi.waitFor(async () => {
			await act(async () => {});
			expect(snapshot()).toEqual({
				titles,
				loading: false,
				saving: false,
				error,
			});
		});
	try {
		await act(async () => root.render(createElement(RegistryContext.Provider, { value: registry }, createElement(Component))));
		await settled([]);
		await act(async () => container.querySelectorAll("button").item(0).click());
		await settled(["Morning walk"]);
		await act(async () => container.querySelectorAll("button").item(1).click());
		await settled(["Morning walk"], true);
		const publicRead = NotesClient.runtime.atom(
			Effect.gen(function* () {
				const client = yield* NotesClient;
				return yield* client("ListNotes", undefined);
			}),
		);
		const persisted = await Effect.runPromise(AtomRegistry.getResult(registry, publicRead));
		expect(persisted.map(({ id, title }) => ({ id, title }))).toEqual([{ id: 1, title: "Morning walk" }]);
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
		container.remove();
	}
});
