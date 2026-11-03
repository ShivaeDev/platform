import { Effect, Layer, Path } from "effect";
import { missingCommand, runCommand } from "#server/adapters/runCommand.ts";
import { PostgresBinaries, type PostgresExecutables } from "#server/PostgresBinaries.ts";

export function hostPostgresBinaries(directory?: string) {
	return Layer.effect(
		PostgresBinaries,
		Effect.gen(function* () {
			const path = yield* Path.Path;
			const bin =
				directory
				?? (yield* runCommand("postgres", ["--version"]).pipe(
					Effect.as(""),
					Effect.catchTag("PostgresCommandError", (error) => (missingCommand(error) ? runCommand("pg_config", ["--bindir"]) : Effect.fail(error))),
				));
			const executables: PostgresExecutables = {
				initdb: bin ? path.join(bin, "initdb") : "initdb",
				pgDump: bin ? path.join(bin, "pg_dump") : "pg_dump",
				postgres: bin ? path.join(bin, "postgres") : "postgres",
			};
			for (const command of Object.values(executables)) {
				yield* runCommand(command, ["--version"]);
			}
			return executables;
		}),
	);
}
