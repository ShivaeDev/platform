import { Deferred, Effect, Layer, Option } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { Conflict, NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { Create, type Note, NoteReadAccess, Notes, notes, Update } from "#modules/notes/notes.ts";
import { notesClientHost } from "#modules/notes/test-support/clientHost.ts";

export const notesClient = Effect.fn("ScreenStory.notesClient")(function* (initial: readonly (typeof Note.Type)[] = []) {
	const rows = [...initial];
	const reads = { list: 0, note: 0 };
	const reactivity = yield* Reactivity.make;
	function announce(id: number) {
		return reactivity.invalidate(invalidationKeys([notes.item(id), notes.bucket.userId("alice")]));
	}
	const session = { signedIn: true };
	const faults = { saveDefect: false };
	let listStarted = Deferred.makeUnsafe<void>();
	let listGate: Deferred.Deferred<void> | undefined;
	function holdList() {
		listStarted = Deferred.makeUnsafe<void>();
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
					Effect.provideService(CurrentViewer, Option.some({ id: "alice" })),
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
	const handlers = Notes.application.toLayer({
		"notes.create": ({ title }) =>
			Effect.gen(function* () {
				if (faults.saveDefect) {
					return yield* Effect.die("Save unavailable");
				}
				if (title === "reserved") {
					return yield* Create.reject.Invalid({ field: "title", message: "Choose another title" });
				}
				const row = { id: rows.length + 1, title, version: 0, wordCount: null };
				rows.unshift(row);
				yield* announce(row.id);
				return row;
			}),
		"notes.delete": (input) =>
			Effect.gen(function* () {
				const row = yield* get(input.id);
				if (row.version !== input.version) {
					return yield* Effect.fail(conflict());
				}
				rows.splice(
					rows.findIndex((note) => note.id === row.id),
					1,
				);
				yield* announce(row.id);
			}),
		"notes.get": ({ id }) =>
			Effect.sync(() => {
				reads.note += 1;
			}).pipe(Effect.andThen(get(id))),
		"notes.import": () => Effect.die("Import is exercised through the application host kit"),
		"notes.list": () =>
			Effect.gen(function* () {
				reads.list += 1;
				const gate = listGate;
				if (gate !== undefined) {
					yield* Deferred.succeed(listStarted, undefined);
					yield* Deferred.await(gate);
				}
				return [...rows];
			}),
		"notes.update": (input) =>
			Effect.gen(function* () {
				if (faults.saveDefect) {
					return yield* Effect.die("Save unavailable");
				}
				const row = yield* get(input.id);
				if (row.version !== input.version) {
					return yield* Effect.fail(conflict());
				}
				if (input.title === "reserved") {
					return yield* Update.reject.Invalid({ field: "title", message: "Choose another title" });
				}
				const saved = { ...row, title: input.title, version: row.version + 1, wordCount: null };
				rows[rows.findIndex((note) => note.id === row.id)] = saved;
				yield* announce(row.id);
				return saved;
			}),
	});
	const client = yield* notesClientHost(
		handlers.pipe(Layer.provide(Layer.succeed(NoteReadAccess, () => Effect.succeed(true)))),
		authentication,
		Layer.succeed(Reactivity.Reactivity, reactivity),
	);
	function finishNote(id: number, wordCount: number) {
		const index = rows.findIndex((note) => note.id === id);
		const row = rows[index];
		if (row === undefined) {
			throw new Error(`Missing note ${id}`);
		}
		rows[index] = { ...row, version: row.version + 1, wordCount };
		return Effect.runPromise(announce(id));
	}
	function reviseNote(id: number, title: string, notify = true) {
		const index = rows.findIndex((note) => note.id === id);
		const row = rows[index];
		if (row === undefined) {
			throw new Error(`Missing note ${id}`);
		}
		rows[index] = { ...row, title, version: row.version + 1 };
		return notify ? Effect.runPromise(announce(id)).then(() => undefined) : Promise.resolve();
	}
	return {
		...client,
		faults,
		finishNote,
		holdList,
		listHeld: () => listGate !== undefined,
		listWaiting: () => Deferred.await(listStarted),
		reads,
		releaseList,
		reviseNote,
		session,
	};
});
