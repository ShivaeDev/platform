import { Effect } from "effect";
import { clientConnection } from "#server/adapters/clientConnection.ts";
import type { docker } from "#server/adapters/docker.ts";
import { sqlInContainer } from "#server/adapters/localContainer.ts";
import { type CommandOptions, missingCommand, runCommand } from "#server/adapters/runCommand.ts";
import { assertLocalDatabase } from "#server/assertLocalDatabase.ts";
import { LocalPostgresError } from "#server/LocalPostgresError.ts";

export function localSql(localDocker: (args: readonly string[], options?: CommandOptions) => ReturnType<typeof docker>) {
	return Effect.fn("LocalPostgres.sql")(function* (value: string | URL, query: string) {
		const parsed = yield* Effect.try({ catch: () => new LocalPostgresError({ message: "Invalid local database URL." }), try: () => new URL(value) });
		const { url, options } = yield* Effect.fromResult(
			clientConnection(yield* Effect.fromResult(assertLocalDatabase(parsed.toString(), [parsed.pathname.slice(1)]))),
		);
		const args = ["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", query];
		return yield* runCommand("psql", [...args, "--dbname", url.toString()], options).pipe(
			Effect.catchTag("PostgresCommandError", (error) =>
				missingCommand(error) ? sqlInContainer(localDocker, url, args, options) : Effect.fail(error),
			),
		);
	});
}
