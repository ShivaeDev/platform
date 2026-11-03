import { Config, Effect, Exit, FileSystem, Path, Scope } from "effect";
import { vi } from "vitest";
import { hostPostgresBinaries } from "#server/adapters/hostPostgresBinaries.ts";
import { appPostgres } from "#server/appPostgres.ts";
import { migrateAppPostgres } from "#server/migrateAppPostgres.ts";
import { PostgresBinaries } from "#server/PostgresBinaries.ts";
import { type AppInstanceEngine, appInstance, appSql } from "#test/appInstanceEngine.ts";

export function appInstanceVerbs(engine: AppInstanceEngine, story: { tell: (line: string) => void }) {
	const start = Effect.fn("AppInstance.start")(function* () {
		story.tell("the app starts its PostgreSQL child");
		const scope = yield* Scope.fork(yield* Effect.scope);
		engine.scope = scope;
		engine.instance = yield* appPostgres({ backupsToKeep: 2, dataDirectory: engine.dataDirectory }).pipe(Effect.provideService(Scope.Scope, scope));
	});
	const migrate = Effect.fn("AppInstance.migrate")(function* (value: string) {
		story.tell(`the app migrates its stored value to ${value}`);
		yield* migrateAppPostgres(
			appInstance(engine),
			appSql(
				engine,
				`
			CREATE TABLE IF NOT EXISTS app_state (value text NOT NULL);
			TRUNCATE app_state;
			INSERT INTO app_state VALUES ('${value.replaceAll("'", "''")}');
		`,
			),
		);
	});
	return {
		denyBackupWrites: Effect.fn("AppInstance.denyBackupWrites")(function* () {
			story.tell("the backup directory becomes unwritable");
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const directory = path.join(engine.dataDirectory, "backups");
			yield* Effect.acquireRelease(fs.chmod(directory, 0o500), () => fs.chmod(directory, 0o700).pipe(Effect.orDie));
		}),
		markDifferentMajor: Effect.fn("AppInstance.markDifferentMajor")(function* () {
			story.tell("the on-disk cluster header belongs to PostgreSQL 99");
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			yield* fs.writeFileString(path.join(engine.dataDirectory, "PG_VERSION"), "99\n");
		}),
		migrate,
		start,
		startFromPath: Effect.fn("AppInstance.startFromPath")(function* () {
			story.tell("the host exposes its PostgreSQL binaries through PATH");
			const binaries = yield* PostgresBinaries;
			const path = yield* Path.Path;
			const previous = yield* Config.String("PATH").pipe(Config.withDefault(""));
			yield* Effect.acquireRelease(
				Effect.sync(() => {
					vi.stubEnv("PATH", `${path.dirname(binaries.postgres)}:${previous}`);
				}),
				() => Effect.sync(() => vi.unstubAllEnvs()),
			);
			yield* start().pipe(Effect.provide(hostPostgresBinaries()));
		}),
		stop: Effect.fn("AppInstance.stop")(function* () {
			story.tell("the app closes its database scope");
			if (!engine.scope) {
				return yield* Effect.die(new Error("Start the app before stopping it."));
			}
			yield* Scope.close(engine.scope, Exit.void);
		}),
		tryMigrate: Effect.fn("AppInstance.tryMigrate")(function* (value: string) {
			yield* migrate(value).pipe(
				Effect.catchTag("PlatformError", (error) => {
					if (error.reason._tag !== "PermissionDenied") {
						return Effect.fail(error);
					}
					engine.outcome = "backup permission denied";
					return Effect.void;
				}),
			);
		}),
		tryStart: Effect.fn("AppInstance.tryStart")(function* () {
			yield* start().pipe(
				Effect.catchTag("AppPostgresVersionMismatch", (error) => {
					engine.outcome = `data belongs to PostgreSQL ${error.observedMajor}`;
					return Effect.void;
				}),
			);
		}),
	};
}
