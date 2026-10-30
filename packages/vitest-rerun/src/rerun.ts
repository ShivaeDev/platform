import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Console, Effect, FileSystem, Option } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ATTEMPT_REPORT, attemptPaths, reportPaths } from "#internal/reportPaths.ts";
import { failedFiles, readSnapshot } from "#internal/snapshot.ts";
import type { RerunOptions } from "#options.ts";

const ATTEMPT_MODULE = fileURLToPath(import.meta.resolve("#internal/attempt.ts"));

const removeReports = Effect.fn("VitestRerun.removeReports")(function* (outputDir: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.makeDirectory(outputDir, { recursive: true });
	const { flaky, json, junit } = reportPaths(outputDir);
	const attempts = (yield* fs.readDirectory(outputDir)).filter((name) => ATTEMPT_REPORT.test(name));
	yield* Effect.forEach([flaky, json, junit, ...attempts.map((name) => join(outputDir, name))], (path) => fs.remove(path, { force: true }));
});

const spawnAttempt = Effect.fn("VitestRerun.spawnAttempt")(function* (options: RerunOptions, attempt: number) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const command = ChildProcess.make(
		process.execPath,
		[...process.execArgv, ATTEMPT_MODULE, String(attempt), options.outputDir, ...options.vitestArgs],
		{ cwd: options.cwd, extendEnv: true, stderr: "inherit", stdin: "inherit", stdout: "inherit" },
	);
	return yield* spawner.exitCode(command).pipe(
		Effect.map((code) => Option.some(Number(code))),
		Effect.catch((error) => Effect.as(Console.error(`vitest-rerun: attempt ${attempt} ended without an exit code: ${error.message}`), Option.none())),
	);
});

const rerunnable = Effect.fn("VitestRerun.rerunnable")(function* (outputDir: string, attempt: number) {
	const fs = yield* FileSystem.FileSystem;
	const { snapshot } = attemptPaths(outputDir, attempt);
	const { json } = reportPaths(outputDir);
	if (!((yield* fs.exists(snapshot)) && (yield* fs.exists(json)))) {
		return false;
	}
	return (yield* readSnapshot(snapshot)).errors.length === 0 && (yield* failedFiles(json)).length > 0;
});

const keepFirstAttempt = Effect.fn("VitestRerun.keepFirstAttempt")(function* (outputDir: string) {
	const fs = yield* FileSystem.FileSystem;
	const final = reportPaths(outputDir);
	const first = attemptPaths(outputDir, 1);
	yield* fs.copyFile(final.json, first.json);
	yield* fs.copyFile(final.junit, first.junit);
});

const removeSnapshots = Effect.fn("VitestRerun.removeSnapshots")(function* (outputDir: string, attempts: number) {
	const fs = yield* FileSystem.FileSystem;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		yield* fs.remove(attemptPaths(outputDir, attempt).snapshot, { force: true });
	}
});

export const rerun = Effect.fn("VitestRerun.rerun")(function* (options: RerunOptions) {
	yield* removeReports(options.outputDir);
	let attempts = 1;
	let code = yield* spawnAttempt(options, attempts);
	while (attempts <= options.reruns && Option.exists(code, (status) => status !== 0) && (yield* rerunnable(options.outputDir, attempts))) {
		if (attempts === 1) {
			yield* keepFirstAttempt(options.outputDir);
		}
		attempts += 1;
		code = yield* spawnAttempt(options, attempts);
	}
	yield* removeSnapshots(options.outputDir, attempts);
	return Option.getOrElse(code, () => 1);
});
