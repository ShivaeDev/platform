import { Effect, Layer, Option, Ref, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware, RpcTest } from "effect/rpc";
import { contract } from "#contract.ts";
import { collection, invalidationKeys, type Key } from "#keys.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { query } from "#operation.ts";
import { authorizeReads, mergeReadPolicies } from "#readPolicy.ts";
import { queryKeys } from "#serverMetadata.ts";
import { documents, modulePolicies, mySpaces, tasks } from "./modulePolicies.ts";

class Denied extends Schema.TaggedError<Denied>()("Denied", {}) {}
class Guard extends RpcMiddleware.Service<Guard>()("test/ModulePolicies", { error: Denied }) {}
const Documents = contract("documents", {
	queries: [
		query("read", {
			payload: { ids: Schema.Array(Schema.String) },
			reads: ({ ids }) => ids.map(documents.item),
			success: Schema.Array(Schema.String),
		}),
		query("mine", { payload: { member: Schema.String }, reads: ({ member }) => [mySpaces.item(member)], success: Schema.Array(Schema.String) }),
	],
}).middleware(Guard);
const Tasks = contract("tasks", {
	queries: [
		query("read", {
			payload: { member: Schema.String },
			reads: ({ member }) => [tasks.item(member)],
			success: Schema.Array(Schema.String),
		}),
		query("unclaimed", { reads: () => [collection("unclaimed", Schema.String).list], success: Schema.Array(Schema.String) }),
	],
}).middleware(Guard);
const Api = Documents.merge(Tasks);

export const modulePolicyEngine = Effect.gen(function* () {
	const policies = modulePolicies();
	const policy = mergeReadPolicies(policies.documentPolicies, policies.taskPolicies);
	const stored = yield* Ref.make(
		new Map([
			["one/a", "First document"],
			["one/b", "Second document"],
			["one/c", "Third document"],
			["two/a", "Bob's document"],
		]),
	);
	const storedTasks = yield* Ref.make(
		new Map([
			["alice", ["Review first document"]],
			["bob", ["Review Bob's document"]],
		]),
	);
	const spaces = yield* Ref.make(
		new Map([
			["alice", ["one"]],
			["bob", ["two"]],
		]),
	);
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const guard = Layer.succeed(Guard, (effect, request) =>
		authorizeReads(
			effect,
			request,
			policy,
			Option.fromUndefinedOr(request.headers.viewer).pipe(Option.map((id) => ({ id }))),
			Effect.fail(new Denied()),
		),
	);
	const handlers = Documents.toLayer({
		"documents.$changes": ({ queries }) => live.stream(queryKeys(Documents.declaration.queries, queries)),
		"documents.mine": ({ member }) => Ref.get(spaces).pipe(Effect.map((rows) => rows.get(member) ?? [])),
		"documents.read": ({ ids }) => Ref.get(stored).pipe(Effect.map((rows) => ids.flatMap((id) => rows.get(id) ?? []))),
	}).pipe(
		Layer.merge(
			Tasks.toLayer({
				"tasks.$changes": ({ queries }) => live.stream(queryKeys(Tasks.declaration.queries, queries)),
				"tasks.read": ({ member }) => Ref.get(storedTasks).pipe(Effect.map((rows) => rows.get(member) ?? [])),
				"tasks.unclaimed": () => Ref.get(stored).pipe(Effect.map((rows) => [...rows.values()])),
			}),
		),
		Layer.merge(guard),
	);
	const client = yield* RpcTest.makeClient(Api, { flatten: true }).pipe(Effect.provide(handlers));
	return { ...policies, client, publish: (keys: readonly Key[]) => reactivity.invalidate(invalidationKeys(keys)) };
});
