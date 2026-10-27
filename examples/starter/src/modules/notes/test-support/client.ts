import { Deferred, Effect, Layer, PubSub, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { Conflict, NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { Create, type Note, Notes, notes, Update } from "#modules/notes/notes.ts";

export function notesClient(initial: readonly (typeof Note.Type)[] = []) {
	const rows = [...initial];
	const calls: string[] = [];
	const hints = Effect.runSync(PubSub.unbounded<LiveHint>());
	const session = { signedIn: true };
	let listGate: Deferred.Deferred<void> | undefined;
	function holdList() {
		listGate = Effect.runSync(Deferred.make<void>());
	}
	function releaseList() {
		if (listGate === undefined) {
			throw new Error("The notes list is not held");
		}
		Effect.runSync(Deferred.succeed(listGate, undefined));
		listGate = undefined;
	}
	const authentication = Layer.succeed(AuthenticatedUser, (effect) =>
		session.signedIn
			? effect.pipe(
					Effect.provideService(Identity, { id: "alice" }),
					Effect.provideService(SessionUser, { email: "alice@app.test", id: "alice", name: "Alice" }),
				)
			: Effect.fail(new Unauthorized({ message: "Authentication required" })),
	);
	function get(id: number) {
		return Effect.suspend(() => {
			const row = rows.find((note) => note.id === id);
			return row === undefined ? Effect.fail(new NotFound({ message: "Note not found" })) : Effect.succeed({ ...row });
		});
	}
	function conflict() {
		return new Conflict({ message: "This note changed. Refresh and review your draft before trying again." });
	}
	const handlers = Notes.toLayer({
		"notes.$changes": () => Stream.concat(Stream.make({ _tag: "Resync" } as const), Stream.fromPubSub(hints)),
		"notes.create": ({ title }) =>
			title.trim() === "reserved"
				? Create.reject.Invalid({ field: "title", message: "Choose another title" })
				: Effect.sync(() => {
						calls.push("create");
						const row = { id: rows.length + 1, title: title.trim(), version: 0, wordCount: null };
						rows.unshift(row);
						return row;
					}),
		"notes.delete": (input) =>
			Effect.gen(function* () {
				calls.push("delete");
				const row = yield* get(input.id);
				if (row.version !== input.version) {
					return yield* Effect.fail(conflict());
				}
				rows.splice(
					rows.findIndex((note) => note.id === row.id),
					1,
				);
			}),
		"notes.get": ({ id }) =>
			Effect.tap(get(id), () =>
				Effect.sync(() => {
					calls.push("get");
				}),
			),
		"notes.list": () =>
			Effect.gen(function* () {
				calls.push("list");
				if (listGate !== undefined) {
					yield* Deferred.await(listGate);
				}
				return [...rows];
			}),
		"notes.update": (input) =>
			Effect.gen(function* () {
				calls.push("update");
				const row = yield* get(input.id);
				if (row.version !== input.version) {
					return yield* Effect.fail(conflict());
				}
				if (input.title.trim() === "reserved") {
					return yield* Update.reject.Invalid({ field: "title", message: "Choose another title" });
				}
				const saved = { ...row, title: input.title.trim(), version: row.version + 1, wordCount: null };
				rows[rows.findIndex((note) => note.id === row.id)] = saved;
				return saved;
			}),
		"notes.whoami": () => Effect.map(SessionUser, (user) => user),
	});
	class Client extends AtomRpc.Service<Client>()("app/NotesClient", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers.pipe(Layer.provideMerge(authentication)),
	}) {}
	const api = bind(Notes, Client);
	function finishNote(id: number, wordCount: number) {
		const index = rows.findIndex((note) => note.id === id);
		const row = rows[index];
		if (row === undefined) {
			throw new Error(`Missing note ${id}`);
		}
		rows[index] = { ...row, version: row.version + 1, wordCount };
		return Effect.runPromise(PubSub.publish(hints, { _tag: "Changed", keys: [notes.item(id)] }));
	}
	function reviseNote(id: number, title: string, notify = true) {
		const index = rows.findIndex((note) => note.id === id);
		const row = rows[index];
		if (row === undefined) {
			throw new Error(`Missing note ${id}`);
		}
		rows[index] = { ...row, title, version: row.version + 1 };
		return notify ? Effect.runPromise(PubSub.publish(hints, { _tag: "Changed", keys: [notes.item(id)] })).then(() => undefined) : Promise.resolve();
	}
	return { api, calls, finishNote, holdList, releaseList, reviseNote, runtime: Client.runtime, session };
}
