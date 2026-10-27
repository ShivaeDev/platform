import { Context, type Duration, Effect, Layer, Option, Ref, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware, RpcTest } from "effect/rpc";
import { contract } from "#contract.ts";
import { collection, invalidationKeys, type Key } from "#keys.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { command, query } from "#operation.ts";
import { authorizeReads, ReadPolicyMemoWindow } from "#readPolicy.ts";
import { queryKeys } from "#serverMetadata.ts";

export const notes = collection("notes", Schema.Number);
class Row extends Schema.Class<Row>("ViewerRow")({ id: Schema.Number, owner: Schema.String, title: Schema.String }) {}
export class Denied extends Schema.TaggedError<Denied>()("Denied", {}) {}
export class PolicyUnavailable extends Schema.TaggedError<PolicyUnavailable>()("PolicyUnavailable", {}) {}
class Session extends Context.Service<Session, string>()("test/ViewerSession") {}
class Guard extends RpcMiddleware.Service<Guard, { provides: Session }>()("test/ViewerGuard", { error: Schema.Union([Denied, PolicyUnavailable]) }) {}
const Get = query("get", { payload: { id: Schema.Number }, reads: ({ id }) => [notes.item(id)], success: Row });
const List = query("list", { reads: () => [notes.list], success: Schema.Array(Row) });
const Rename = command("rename", { invalidates: ({ id }) => [notes.item(id)], payload: { id: Schema.Number, title: Schema.String } });
export const Notes = contract("notes", { commands: [Rename], queries: [Get, List] }).middleware(Guard);

export const viewerEngine = Effect.gen(function* () {
	const stored = yield* Ref.make(new Map([[1, new Row({ id: 1, owner: "alice", title: "One" })]]));
	const unavailable = yield* Ref.make(false);
	const checks = yield* Ref.make<readonly { readonly viewer: string; readonly key: Key }[]>([]);
	const memoWindow = yield* Ref.make<Duration.Input>("1 second");
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	function canRead(key: Key) {
		return Effect.gen(function* () {
			const viewer = yield* Session;
			yield* Ref.update(checks, (calls) => [...calls, { key, viewer }]);
			if (yield* Ref.get(unavailable)) {
				return yield* Effect.fail(new PolicyUnavailable());
			}
			return key.collection === notes.name && (key._tag === "List" || (yield* Ref.get(stored)).get(Number(key.id))?.owner === viewer);
		});
	}
	const guard = Layer.succeed(Guard, (effect, request) => {
		const viewer = request.headers.viewer;
		return viewer === undefined
			? Effect.fail(new Denied())
			: Ref.get(memoWindow).pipe(
					Effect.flatMap((window) =>
						authorizeReads(effect, request, canRead, Option.some(viewer), Effect.fail(new Denied())).pipe(
							Effect.provideService(ReadPolicyMemoWindow, window),
							Effect.provideService(Session, viewer),
						),
					),
				);
	});
	const handlers = Notes.toLayer({
		"notes.$changes": ({ queries }) => live.stream(queryKeys(Notes.declaration.queries, queries)),
		"notes.get": ({ id }) =>
			Ref.get(stored).pipe(
				Effect.map((rows) => {
					const row = rows.get(id);
					if (row === undefined) {
						throw new Error(`Missing note ${id}`);
					}
					return row;
				}),
			),
		"notes.list": () =>
			Effect.gen(function* () {
				const viewer = yield* Session;
				return [...(yield* Ref.get(stored)).values()].filter((row) => row.owner === viewer);
			}),
		"notes.rename": ({ id, title }) =>
			Effect.gen(function* () {
				yield* Ref.update(stored, (rows) => {
					const row = rows.get(id);
					if (row === undefined) {
						throw new Error(`Missing note ${id}`);
					}
					return new Map([...rows, [id, new Row({ ...row, title })]]);
				});
				yield* reactivity.invalidate(invalidationKeys(Rename.invalidates({ id, title }, undefined)));
			}),
	});
	const layer = Layer.mergeAll(handlers, guard);
	const client = yield* RpcTest.makeClient(Notes, { flatten: true }).pipe(Effect.provide(layer));
	return { checks, client, layer, live, memoWindow, reactivity, stored, unavailable };
});
