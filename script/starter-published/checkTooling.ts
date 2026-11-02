import { Config, Effect, FileSystem, Path } from "effect";
import { command, requireThat } from "#package-check/io.ts";

export const checkTooling = Effect.fn("Published.checkTooling")(function* (cwd: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const probe = yield* fs.makeTempDirectoryScoped({ prefix: "starter-tooling-" });
	const fixture = path.join(cwd, "src/tooling.spec.ts");
	const options = yield* Config.String("NODE_OPTIONS").pipe(Config.withDefault(""));
	const fixtures = yield* path.fromFileUrl(new URL("./fixtures/", import.meta.url));
	const preload = path.join(probe, "lock-probe.mjs");
	yield* fs.copyFile(path.join(fixtures, "lock-probe.mjs.txt"), preload);
	const preloadUrl = yield* path.toFileUrl(preload);
	const env = ["-u", "HEAVY_PROCESS_LOCK_ID", "CI=", `HEAVY_PROCESS_LOCK=${path.join(probe, "heavy.lock")}`, `TOOLING_PROBE_DIR=${probe}`];
	for (const script of ["lint", "typecheck"]) {
		yield* Effect.log(`Generated app: checking ${script} holds the heavy lock.`);
		yield* command(cwd, "env", [...env, `NODE_OPTIONS=${options} --import=${preloadUrl.href}`, "pnpm", "run", script]);
		yield* requireThat(yield* fs.exists(path.join(probe, `${script}.json`)), `Generated app: ${script} did not run the lock probe.`);
	}
	yield* Effect.acquireUseRelease(
		fs.copyFile(path.join(fixtures, "rerun.spec.ts.txt"), fixture),
		() =>
			Effect.gen(function* () {
				yield* Effect.log("Generated app: checking pnpm test holds the lock and reruns a failed test in a fresh process.");
				yield* command(cwd, "env", [...env, "pnpm", "run", "test", "src/tooling.spec.ts", "--maxWorkers=1"]);
				const report = yield* fs.readFileString(path.join(cwd, "test-results/flaky-tests.json"));
				yield* requireThat(report.includes("Generated app test must rerun"), "Generated app: missing recovered test in flaky-tests.json.");
			}),
		() => fs.remove(fixture).pipe(Effect.orDie),
	);
}, Effect.scoped);
