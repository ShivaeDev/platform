import { Effect, FileSystem, Path, type Scope } from "effect";
import { runCommand } from "#server/adapters/runCommand.ts";
import type { AppPostgresInstance } from "#server/appPostgres.ts";
import { PostgresBinaries } from "#server/PostgresBinaries.ts";

export interface AppInstanceEngine {
	readonly dataDirectory: string;
	instance?: AppPostgresInstance;
	outcome?: string;
	scope?: Scope.Closeable;
}

export const createAppInstance = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "app-instance-story-" });
	const engine: AppInstanceEngine = { dataDirectory: path.join(root, "data") };
	return engine;
});

export function appInstance(engine: AppInstanceEngine) {
	if (!engine.instance) {
		throw new Error("Start the application's PostgreSQL first.");
	}
	return engine.instance;
}

export const appClient = Effect.fn("AppInstance.appClient")(function* (command: string, args: readonly string[]) {
	const binaries = yield* PostgresBinaries;
	const path = yield* Path.Path;
	const executable = binaries.postgres === "postgres" ? command : path.join(path.dirname(binaries.postgres), command);
	return yield* runCommand(executable, args);
});

export function appSql(engine: AppInstanceEngine, query: string) {
	return appClient("psql", ["-X", "--set", "ON_ERROR_STOP=1", "-At", "--dbname", appInstance(engine).connectionUrl, "-c", query]);
}
