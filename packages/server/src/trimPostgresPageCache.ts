import { Effect, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export class PostgresPageCacheTrimError extends Schema.TaggedError<PostgresPageCacheTrimError>()("PostgresPageCacheTrimError", {
	exitCode: Schema.Number,
}) {}

export const trimPostgresPageCache = Effect.fn("Server.trimPostgresPageCache")(function* (dataDirectory: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const code = yield* spawner.exitCode(
		ChildProcess.make(
			"find",
			[
				dataDirectory,
				"-type",
				"f",
				"-exec",
				"sh",
				"-c",
				'for path do dd if="$path" iflag=nocache count=0 status=none || exit; done',
				"sh",
				"{}",
				"+",
			],
			{ stderr: "inherit", stdout: "ignore" },
		),
	);
	if (code !== 0) {
		return yield* new PostgresPageCacheTrimError({ exitCode: Number(code) });
	}
});
