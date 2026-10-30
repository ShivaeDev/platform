import { Context, Effect, Layer, Option, Ref, Schema, Stream, SubscriptionRef } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware, RpcTest } from "effect/rpc";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { contract } from "#contract.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { command, query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import { authorizeReads, CurrentViewer } from "#readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { ChangesQueries } from "#serverMetadata.ts";

export const notes = collection("notes", Schema.Number, { userId: Schema.String });
export class Row extends Schema.Class<Row>("ViewerRow")({ id: Schema.Number, owner: Schema.String, title: Schema.String }) {}
class Rows extends Context.Service<Rows, Ref.Ref<ReadonlyMap<number, Row>>>()("test/Rows") {}
class PolicyChecks extends Context.Service<PolicyChecks, SubscriptionRef.SubscriptionRef<number>>()("test/PolicyChecks") {}
export class Denied extends Schema.TaggedError<Denied>()("Denied", {}) {}
class Guard extends RpcMiddleware.Service<Guard>()("test/ViewerGuard", { error: Schema.Union([Denied, MissingReadPolicy, QueryReadDenied]) }) {}
const Get = query("get", {
	payload: { id: Schema.Number },
	readPolicy: ({ id }, viewer) =>
		Effect.gen(function* () {
			const owner = (yield* Ref.get(yield* Rows)).get(id)?.owner;
			yield* SubscriptionRef.update(yield* PolicyChecks, (count) => count + 1);
			return Option.isSome(viewer) && owner === viewer.value.id;
		}),
	reads: ({ id }) => [notes.item(id)],
	success: Row,
});
const List = query("list", {
	payload: { title: Schema.String },
	readPolicy: (_input, viewer) => Effect.succeed(Option.isSome(viewer)),
	reads: (_input, viewer) => (Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
	success: Schema.Array(Row),
});
const ListFor = query("listFor", {
	payload: { userId: Schema.String },
	readPolicy: ({ userId }, viewer) => Effect.succeed(Option.isSome(viewer) && viewer.value.id === userId),
	reads: ({ userId }) => [notes.bucket.userId(userId)],
	success: Schema.Array(Row),
});
const Unprotected = query("unprotected", { reads: () => [notes.list], success: Schema.Array(Row) });
const Rename = command("rename", { invalidates: ({ id }) => [notes.item(id)], payload: { id: Schema.Number, title: Schema.String } });
export const Notes = contract("notes", { commands: [Rename], keyScope: "session", queries: [Get, List, ListFor, Unprotected] }).middleware(Guard);

export const viewerEngine = Effect.gen(function* () {
	const stored = yield* Ref.make<ReadonlyMap<number, Row>>(
		new Map([
			[1, new Row({ id: 1, owner: "alice", title: "One" })],
			[2, new Row({ id: 2, owner: "bob", title: "Two" })],
			[3, new Row({ id: 3, owner: "alice", title: "Other" })],
		]),
	);
	const reads = yield* SubscriptionRef.make<readonly string[]>([]);
	const checks = yield* SubscriptionRef.make(0);
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	function guard(session?: string) {
		return Layer.succeed(Guard, (effect, request) => {
			const viewer = request.headers.viewer ?? session;
			return authorizeReads(effect, request, Option.fromUndefinedOr(viewer).pipe(Option.map((id) => ({ id })))).pipe(
				Effect.provideService(Rows, stored),
				Effect.provideService(PolicyChecks, checks),
			);
		});
	}
	const changesRpc = Notes.requests.get("notes.$changes");
	if (changesRpc === undefined) {
		throw new Error("The notes contract has no change subscription");
	}
	const handlers = Notes.toLayer({
		"notes.$changes": ({ queries }) =>
			Stream.unwrap(
				Effect.gen(function* () {
					const viewer = yield* CurrentViewer;
					const requests = yield* Context.getUnsafe(changesRpc.annotations, ChangesQueries).resolve(queries);
					const subscription = yield* querySubscription(requests, viewer);
					return live.subscribe(subscription, Option.isSome(viewer) ? { scope: viewer.value.id } : undefined);
				}),
			),
		"notes.get": ({ id }) => Ref.get(stored).pipe(Effect.map((rows) => rows.get(id) ?? new Row({ id, owner: "", title: "Missing" }))),
		"notes.list": ({ title }) =>
			Effect.gen(function* () {
				const viewer = yield* CurrentViewer;
				yield* SubscriptionRef.update(reads, (all) => [...all, Option.match(viewer, { onNone: () => "nobody", onSome: ({ id }) => id })]);
				return [...(yield* Ref.get(stored)).values()].filter(
					(row) => Option.isSome(viewer) && row.owner === viewer.value.id && row.title.includes(title),
				);
			}),
		"notes.listFor": ({ userId }) => Ref.get(stored).pipe(Effect.map((rows) => [...rows.values()].filter((row) => row.owner === userId))),
		"notes.rename": ({ id, title }) =>
			Effect.gen(function* () {
				const row = (yield* Ref.get(stored)).get(id);
				if (row === undefined) {
					throw new Error(`Missing note ${id}`);
				}
				yield* Ref.update(stored, (rows) => new Map([...rows, [id, new Row({ ...row, title })]]));
				yield* reactivity.invalidate(invalidationKeys([notes.item(id), notes.bucket.userId(row.owner)], { scope: row.owner }));
			}),
		"notes.unprotected": () => Ref.get(stored).pipe(Effect.map((rows) => [...rows.values()])),
	});
	const layer = Layer.mergeAll(handlers, guard());
	const client = yield* RpcTest.makeClient(Notes, { flatten: true }).pipe(Effect.provide(layer));
	return { checks, client, layer, layerFor: (viewer: string) => Layer.merge(handlers, guard(viewer)), live, reactivity, reads, stored };
});
