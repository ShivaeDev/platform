import { Deferred, Effect, Schema } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";

export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", { reason: Schema.String }) {}
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
	const refetched = Deferred.makeUnsafe<void>();
	let reads = 0;
	const handlers = Commands.application.toLayer(
		Effect.succeed(
			Commands.application.of({
				"completions.list": () => {
					reads += 1;
					return reads === 1 ? Effect.succeed("initial") : Deferred.await(refetch).pipe(Effect.tap(() => Deferred.succeed(refetched, undefined)));
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
		protocol: layerLiveMemoryProtocol(Commands, handlers),
	}) {}
	const api = bind(Commands, Client);
	return {
		command: commandFor,
		finished,
		list: api.list.query(),
		reads: () => reads,
		refetch,
		refetched,
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
	};
}
export type CompletionClient = ReturnType<typeof completionClient>;
