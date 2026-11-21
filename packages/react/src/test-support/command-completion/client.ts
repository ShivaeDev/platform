import { Deferred, Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { activityScreenSignal, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { settledBeside } from "#test/settledBeside.ts";

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
	readonly ended: Deferred.Deferred<void>;
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
			ended: Deferred.makeUnsafe<void>(),
			finished: Deferred.makeUnsafe<void>(),
			gate: Deferred.makeUnsafe<string, Rejected | Unauthorized>(),
		};
		commands.set(title, created);
		return created;
	}
	const finished: string[] = [];
	const refetch = Effect.runSync(Deferred.make<string>());
	const refetched = Deferred.makeUnsafe<void>();
	const rereading = Deferred.makeUnsafe<void>();
	const reads: string[] = [];
	const handlers = Commands.application.toLayer(
		Effect.succeed(
			Commands.application.of({
				"completions.list": () => {
					reads.push(reads.length === 0 ? "first read" : "read after a change");
					if (reads.length === 1) {
						return Effect.succeed("initial");
					}
					Deferred.doneUnsafe(rereading, Effect.void);
					return Deferred.await(refetch).pipe(Effect.tap(() => Deferred.succeed(refetched, undefined)));
				},
				"completions.rename": ({ title }) => {
					const { arrived, ended, gate } = commandFor(title);
					return Effect.gen(function* () {
						Deferred.doneUnsafe(arrived, Effect.void);
						return yield* Deferred.await(gate);
					}).pipe(Effect.ensuring(Effect.sync(() => Deferred.doneUnsafe(ended, Effect.void))));
				},
			}),
		),
	);
	const connection = makeClient({ completions: Commands }, { protocol: layerLiveMemoryProtocol(Commands, handlers), url: "memory://completions" });
	const api = connection.api.completions;
	const settled = settledBeside(() => ({
		awaitingReruns: Deferred.isDoneUnsafe(rereading) && !Deferred.isDoneUnsafe(refetch) ? undefined : 0,
		commands: [...commands.values()].filter(({ arrived, ended }) => Deferred.isDoneUnsafe(arrived) && !Deferred.isDoneUnsafe(ended)).length,
	}));
	return {
		activity: activityScreenSignal(clientActivity(connection), settled),
		command: commandFor,
		finished,
		list: api.list.query(),
		reads: () => [...reads],
		refetch,
		refetched,
		rereading,
		run: (input: { readonly title: string }) =>
			api.rename.run(input).pipe(
				Effect.onExit(() =>
					Effect.sync(() => {
						finished.push(input.title);
						Deferred.doneUnsafe(commandFor(input.title).finished, Effect.void);
					}),
				),
			),
		runtime: connection.Client.runtime,
	};
}
export type CompletionClient = ReturnType<typeof completionClient>;
