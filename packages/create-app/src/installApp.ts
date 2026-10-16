import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { CreateAppError } from "./CreateAppError.ts";

export const installApp = Effect.fn("CreateApp.installApp")(function* (target: string, folder: string, files: readonly string[]) {
	const fs = yield* FileSystem.FileSystem;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	for (const command of ["install", "format"]) {
		const code = yield* spawner.exitCode(ChildProcess.make("pnpm", [command], { cwd: target, stderr: "inherit", stdout: "inherit" }));
		for (const path of files) {
			yield* fs.chmod(join(target, path), 0o644);
		}
		const lockfile = join(target, "pnpm-lock.yaml");
		if (yield* fs.exists(lockfile)) {
			yield* fs.chmod(lockfile, 0o644);
		}
		if (code !== 0) {
			return yield* new CreateAppError({ message: `pnpm ${command} failed (exit ${code}). Run pnpm ${command} in ${folder} to retry.` });
		}
	}
});
