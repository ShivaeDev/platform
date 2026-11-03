import { connect } from "node:net";
import { Effect, FileSystem, Path } from "effect";
import { type AppInstanceEngine, appClient, appInstance, appSql } from "#test/appInstanceEngine.ts";

export function appInstanceReadouts(engine: AppInstanceEngine) {
	return {
		backupContents: Effect.fn("AppInstance.backupContents")(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const directory = path.join(engine.dataDirectory, "backups");
			const files = (yield* fs.readDirectory(directory)).sort();
			return yield* Effect.forEach(files, (file) => appClient("pg_restore", ["--data-only", "--file=-", path.join(directory, file)]));
		}),
		clusterRunning: Effect.fn("AppInstance.clusterRunning")(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			return yield* fs.exists(path.join(engine.dataDirectory, "postmaster.pid"));
		}),
		outcome: () => Effect.succeed(engine.outcome),
		socketDirectoryExists: Effect.fn("AppInstance.socketDirectoryExists")(function* () {
			const fs = yield* FileSystem.FileSystem;
			return yield* fs.exists(appInstance(engine).socketDirectory);
		}),
		socketPermissions: Effect.fn("AppInstance.socketPermissions")(function* () {
			const fs = yield* FileSystem.FileSystem;
			return ((yield* fs.stat(appInstance(engine).socketDirectory)).mode & 0o777).toString(8);
		}),
		storedValue: () => appSql(engine, "SELECT value FROM app_state"),
		tcpPortOpen: Effect.fn("AppInstance.tcpPortOpen")(function* () {
			const port = Number(yield* appSql(engine, "SHOW port"));
			return yield* Effect.callback<boolean>((resume) => {
				const socket = connect({ host: "127.0.0.1", port });
				socket.once("connect", () => resume(Effect.succeed(true)));
				socket.once("error", (error: NodeJS.ErrnoException) => resume(error.code === "ECONNREFUSED" ? Effect.succeed(false) : Effect.die(error)));
				return Effect.sync(() => socket.destroy());
			});
		}),
	};
}
