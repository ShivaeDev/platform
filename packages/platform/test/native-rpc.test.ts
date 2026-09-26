import { Context, Effect, Layer, Ref, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/unstable/rpc";
import { expect, test } from "vitest";

const Note = Schema.Struct({ id: Schema.String, title: Schema.String });
const MissingNote = Schema.Struct({
	_tag: Schema.Literal("MissingNote"),
	id: Schema.String,
});
const Notes = RpcGroup.make(
	Rpc.make("get", {
		payload: { id: Schema.String },
		success: Note,
		error: MissingNote,
	}),
	Rpc.make("rename", {
		payload: { id: Schema.String, title: Schema.String },
		success: Note,
		error: MissingNote,
	}),
);

class Owner extends Context.Service<Owner, string>()("@test/native-rpc/Owner") {}

const Handlers = Notes.toLayer(
	Effect.gen(function* () {
		const owner = yield* Owner;
		const note = yield* Ref.make({ id: "note-1", title: owner });
		return {
			get: ({ id }) =>
				Effect.gen(function* () {
					const current = yield* Ref.get(note);
					return current.id === id ? current : yield* Effect.fail({ _tag: "MissingNote" as const, id });
				}),
			rename: ({ id, title }) =>
				Effect.gen(function* () {
					const current = yield* Ref.get(note);
					if (current.id !== id) {
						return yield* Effect.fail({ _tag: "MissingNote" as const, id });
					}
					const updated = { id, title };
					yield* Ref.set(note, updated);
					return updated;
				}),
		};
	}),
).pipe(Layer.provide(Layer.succeed(Owner, "from-service")));

test("native generated client returns ordinary values from Layer-backed handlers", async () => {
	await Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(Notes);
			expect(yield* client.get({ id: "note-1" })).toEqual({
				id: "note-1",
				title: "from-service",
			});
			expect(yield* client.rename({ id: "note-1", title: "Updated" })).toEqual({
				id: "note-1",
				title: "Updated",
			});
			expect(yield* client.get({ id: "note-1" })).toEqual({
				id: "note-1",
				title: "Updated",
			});
		}).pipe(Effect.provide(Handlers), Effect.scoped),
	);
});

test("native generated client preserves declared failures and rejects mutations without changing state", async () => {
	await Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(Notes);
			expect(yield* Effect.flip(client.rename({ id: "missing", title: "Wrong" }))).toEqual({
				_tag: "MissingNote",
				id: "missing",
			});
			expect(yield* Effect.flip(client.get({ id: "missing" }))).toEqual({
				_tag: "MissingNote",
				id: "missing",
			});
			expect((yield* client.get({ id: "note-1" })).title).toBe("from-service");
		}).pipe(Effect.provide(Handlers), Effect.scoped),
	);
});
