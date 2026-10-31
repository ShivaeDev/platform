import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { Effect, Fiber, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { appendSupervisorLog } from "#host/appendSupervisorLog.ts";
import { logSupervisor } from "#host/supervisedProcess.ts";

function lockfileFrom(manifest: string): string | undefined {
	let directory = dirname(realpathSync(manifest));
	for (;;) {
		const file = join(directory, "pnpm-lock.yaml");
		if (existsSync(file)) {
			return file;
		}
		const parent = dirname(directory);
		if (parent === directory) {
			return undefined;
		}
		directory = parent;
	}
}

export const dependencyInstaller = Effect.fn("FleetSupervisor.dependencyInstaller")(function* (fleetManifest: string, log: string) {
	const file = yield* Effect.try(() => lockfileFrom(fleetManifest));
	if (file === undefined) {
		return () => Effect.succeed("unchanged" as const);
	}
	let previous = yield* Effect.try(() => readFileSync(file, "utf8"));
	let failed = false;
	return () =>
		Effect.gen(function* () {
			const revision = yield* Effect.try(() => readFileSync(file, "utf8"));
			if (revision === previous) {
				return failed ? ("failed" as const) : ("unchanged" as const);
			}
			previous = revision;
			failed = true;
			yield* logSupervisor(log, "lockfile changed; installing locked dependencies");
			yield* Effect.scoped(
				Effect.gen(function* () {
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					const child = yield* spawner.spawn(
						ChildProcess.make("pnpm", ["install", "--frozen-lockfile"], {
							cwd: dirname(file),
							stderr: "pipe",
							stdin: "ignore",
							stdout: "pipe",
						}),
					);
					const output = yield* Effect.forkScoped(
						child.all.pipe(
							Stream.decodeText,
							Stream.runForEach((text) => appendSupervisorLog(log, `install: ${text}`)),
						),
					);
					const status = yield* child.exitCode;
					yield* Fiber.join(output);
					if (status !== 0) {
						return yield* Effect.fail(new Error(`exit ${status}`));
					}
				}),
			);
			failed = false;
			yield* logSupervisor(log, "installed locked dependencies");
			return "installed" as const;
		}).pipe(Effect.catch((error) => logSupervisor(log, `Dependency install failed: ${error.message}`).pipe(Effect.as("failed" as const))));
});
