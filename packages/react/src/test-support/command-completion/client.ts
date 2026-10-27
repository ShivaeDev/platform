import { Deferred, Effect, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", { reason: Schema.String }) {}
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}
const rows = collection("completion-rows", Schema.String);
const Rename = command("rename", {
	invalidates: () => [rows.list],
	payload: { title: Schema.String },
	rejections: { Rejected, Unauthorized },
	success: Schema.String,
});
const List = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [rows.list], success: Schema.String });
const Commands = contract("completions", { commands: [Rename], queries: [List] });

export function completionClient() {
	const gates = new Map<string, Deferred.Deferred<string, Rejected | Unauthorized>>();
	const calls: string[] = [];
	const finished: string[] = [];
	const refetch = Effect.runSync(Deferred.make<string>());
	let reads = 0;
	let invalidations = 0;
	const handlers = Commands.toLayer(
		Effect.succeed(
			Commands.of({
				"completions.$changes": () => Stream.never,
				"completions.list": () => {
					reads += 1;
					return reads === 1 ? Effect.succeed("initial") : Deferred.await(refetch);
				},
				"completions.rename": ({ title }) =>
					Effect.gen(function* () {
						const gate = yield* Deferred.make<string, Rejected | Unauthorized>();
						gates.set(title, gate);
						calls.push(title);
						return yield* Deferred.await(gate);
					}),
			}),
		),
	);
	class Client extends AtomRpc.Service<Client>()("test/CompletionCommands", {
		group: Commands,
		makeEffect: RpcTest.makeClient(Commands, { flatten: true }),
		protocol: handlers,
	}) {}
	const api = bind(Commands, Client);
	const watcher = Client.runtime.atom(
		Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
			const stop = reactivity.registerUnsafe(invalidationKeys([rows.list]), () => {
				invalidations += 1;
			});
			yield* Effect.addFinalizer(() => Effect.sync(stop));
			return true;
		}),
	);
	return {
		calls,
		finished,
		gate: (title: string) => {
			const gate = gates.get(title);
			if (!gate) {
				throw new Error(`Command ${title} has not started`);
			}
			return gate;
		},
		invalidations: () => invalidations,
		list: api.list.query(),
		reads: () => reads,
		run: (input: { readonly title: string }) =>
			api.rename.run(input).pipe(
				Effect.onExit(() =>
					Effect.sync(() => {
						finished.push(input.title);
					}),
				),
			),
		runtime: Client.runtime,
		watcher,
	};
}
export type CompletionClient = ReturnType<typeof completionClient>;
