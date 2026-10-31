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

interface Command {
	readonly arrived: Deferred.Deferred<void>;
	readonly finished: Deferred.Deferred<void>;
	readonly gate: Deferred.Deferred<string, Rejected | Unauthorized>;
}

export function completionClient() {
	const commands = new Map<string, Command>();
	function commandFor(title: string) {
		const existing = commands.get(title);
		if (existing) {
			return existing;
		}
		const created: Command = {
			arrived: Deferred.makeUnsafe<void>(),
			finished: Deferred.makeUnsafe<void>(),
			gate: Deferred.makeUnsafe<string, Rejected | Unauthorized>(),
		};
		commands.set(title, created);
		return created;
	}
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
						const { arrived, gate } = commandFor(title);
						Deferred.doneUnsafe(arrived, Effect.void);
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
	const api = bind(Commands, Client, { live: false });
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
		command: commandFor,
		finished,
		invalidations: () => invalidations,
		list: api.list.query(),
		reads: () => reads,
		run: (input: { readonly title: string }) =>
			api.rename.run(input).pipe(
				Effect.onExit(() =>
					Effect.sync(() => {
						finished.push(input.title);
						Deferred.doneUnsafe(commandFor(input.title).finished, Effect.void);
					}),
				),
			),
		runtime: Client.runtime,
		watcher,
	};
}
export type CompletionClient = ReturnType<typeof completionClient>;
