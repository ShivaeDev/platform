import { Effect, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { LocalPostgresError } from "#LocalPostgresError.ts";
import { POSTGRES_IMAGE } from "#localContainer.ts";
import type { docker as localDocker } from "#localDocker.ts";
import type { PostgresCommandError } from "#PostgresCommandError.ts";
import type { PostgresVersionMismatch } from "#PostgresVersionMismatch.ts";

export class PostgresSettingError extends Schema.TaggedError<PostgresSettingError>()("PostgresSettingError", {
	cause: Schema.Unknown,
	container: Schema.Literal("development-postgres"),
	setting: Schema.Literal("max_connections"),
}) {
	override get message() {
		return "Could not set max_connections to at least 500 in container development-postgres.";
	}
}

type Query = (query: string) => Effect.Effect<string, LocalPostgresError | PostgresCommandError, ChildProcessSpawner.ChildProcessSpawner>;

export const ensureConnections = Effect.fn("LocalPostgres.ensureConnections")(function* (
	docker: (args: readonly string[]) => ReturnType<typeof localDocker>,
	sql: Query,
	ready: () => Effect.Effect<void, LocalPostgresError | PostgresCommandError | PostgresVersionMismatch, ChildProcessSpawner.ChildProcessSpawner>,
) {
	yield* Effect.gen(function* () {
		const current = Number(yield* sql("SHOW max_connections"));
		if (!Number.isInteger(current) || current <= 0) {
			return yield* new LocalPostgresError({ message: "PostgreSQL returned an invalid max_connections value." });
		}
		if (current >= 500) {
			return;
		}
		const managed = yield* docker(["ps", "--filter", "name=^/development-postgres$", "--filter", "publish=55432", "--format", "{{.ID}}"]).pipe(
			Effect.catchTag("PostgresCommandError", () => Effect.succeed("")),
		);
		if (!managed) {
			return;
		}
		const image = yield* docker(["inspect", "--format", "{{.Config.Image}}", "development-postgres"]);
		if (image !== POSTGRES_IMAGE) {
			return yield* new LocalPostgresError({
				message: "The shared PostgreSQL container uses a different image. Preserve its data and upgrade it explicitly.",
			});
		}
		yield* sql("ALTER SYSTEM SET max_connections = 500");
		yield* docker(["restart", "development-postgres"]);
		yield* ready();
		if (!(Number(yield* sql("SHOW max_connections")) >= 500)) {
			return yield* new LocalPostgresError({ message: "PostgreSQL did not apply max_connections after restarting." });
		}
	}).pipe(Effect.mapError((cause) => new PostgresSettingError({ cause, container: "development-postgres", setting: "max_connections" })));
});
