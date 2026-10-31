import { Console, Deferred, Effect } from "effect";
import { type ChildProcess, ChildProcessSpawner } from "effect/process";
import { program } from "#cli/program.ts";
import { explained } from "#cli/runMain.ts";
import { capturing } from "./cli.ts";
import { qualityLifecycle } from "./qualityLifecycle.ts";

function biomeCheckArgs(command: ChildProcess.Command): readonly string[] | undefined {
	return command._tag === "StandardCommand" && command.args.includes("check") && command.args.some((arg) => arg.endsWith("/biome/bin/biome"))
		? command.args
		: undefined;
}

export const biomeRunning = qualityLifecycle.trait(
	"running",
	"the author runs quality lint, and Biome has started checking with quality's temporary Biome config and does not finish",
	function* (engine) {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const held = ChildProcessSpawner.ChildProcessSpawner.of({
			...spawner,
			spawn: (command) =>
				Effect.gen(function* () {
					const child = yield* spawner.spawn(command);
					const args = biomeCheckArgs(command);
					if (args === undefined) {
						return child;
					}
					const configArgument = args.find((arg) => arg.startsWith("--config-path="));
					if (configArgument === undefined) {
						return yield* Effect.die(new Error("Biome started without quality's temporary config"));
					}
					yield* Deferred.succeed(engine.started, { child, path: configArgument.slice("--config-path=".length) });
					return yield* Effect.never;
				}),
		});
		engine.fiber = yield* program(["lint"], { cwd: engine.root, launch: { options: [], script: "quality" } }).pipe(
			explained,
			Effect.provideService(Console.Console, capturing(engine.output)),
			Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, held),
			Effect.forkScoped,
		);
		yield* Deferred.await(engine.started);
	},
);
