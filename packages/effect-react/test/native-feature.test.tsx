// @vitest-environment happy-dom
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
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	title: Schema.String,
}) {}

const Notes = RpcGroup.make(
	Rpc.make("ListNotes", { error: Schema.String, success: Schema.Array(Note) }),
	Rpc.make("CreateNote", {
		error: Schema.String,
		payload: { title: Schema.String },
		success: Note,
	}),
);

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table notes (id integer primary key, title text not null)`;
		const notes = yield* makeRepository(Note, {
			idColumn: "id",
			spanPrefix: "Notes",
			tableName: "notes",
		});
		return Notes.of({
			CreateNote: ({ title }) =>
				title.trim() === "" ? Effect.fail("title required") : notes.insert({ title }).pipe(Effect.mapError(() => "storage unavailable")),
			ListNotes: () => notes.findMany({ orderBy: { direction: "asc", field: "id" } }).pipe(Effect.mapError(() => "storage unavailable")),
		});
	}),
).pipe(Layer.provide(SqliteClient.layer({ filename: ":memory:" })));

class NotesClient extends AtomRpc.Service<NotesClient>()("test/NotesClient", {
	group: Notes,
	makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
	protocol: handlers,
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
					error: Option.isSome(action.cause),
					loading: query.pending,
					saving: action.pending,
					titles: Option.getOrElse(query.data, () => []).map((note) => note.title),
				}),
			),
			createElement(
				"button",
				{
					onClick: () =>
						action.dispatch({
							payload: { title: "Morning walk" },
							reactivityKeys: ["notes"],
						}),
					type: "button",
				},
				"Save",
			),
			createElement(
				"button",
				{
					onClick: () =>
						action.dispatch({
							payload: { title: "" },
							reactivityKeys: ["notes"],
						}),
					type: "button",
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
				error,
				loading: false,
				saving: false,
				titles,
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
