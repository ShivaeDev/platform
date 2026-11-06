import { Deferred, Effect, Predicate } from "effect";
import { type ChildProcess, ChildProcessSpawner } from "effect/process";
import { qualityLifecycle, startQuality } from "./qualityLifecycle.ts";

function biomeCheckArgs(command: ChildProcess.Command): readonly string[] | undefined {
	const args = command._tag === "StandardCommand" ? command.args.filter(Predicate.isString) : [];
	return args.includes("check") && args.some((arg) => arg.endsWith("/biome/bin/biome")) ? args : undefined;
}

export const biomeRunning = qualityLifecycle.trait(
	"running",
	"the author runs quality lint, and Biome has started checking with quality's cached Biome config and does not finish",
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
						return yield* Effect.die(new Error("Biome started without quality's cached config"));
					}
					yield* Deferred.succeed(engine.started, { child, path: configArgument.slice("--config-path=".length) });
					return yield* Effect.never;
				}),
		});
		engine.fiber = yield* startQuality(engine, held);
		yield* Deferred.await(engine.started);
	},
);
