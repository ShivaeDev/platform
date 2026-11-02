import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Config, Effect, FileSystem } from "effect";
import { command, requireThat } from "#package-check/io.ts";

export const checkTooling = Effect.fn("Published.checkTooling")(function* (cwd: string) {
	const fs = yield* FileSystem.FileSystem;
	const probe = yield* fs.makeTempDirectoryScoped({ prefix: "starter-tooling-" });
	const fixture = join(cwd, "src/tooling.spec.ts");
	const options = yield* Config.String("NODE_OPTIONS").pipe(Config.withDefault(""));
	const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
	const preload = join(probe, "lock-probe.mjs");
	yield* fs.copyFile(join(fixtures, "lock-probe.mjs.txt"), preload);
	const env = ["-u", "HEAVY_PROCESS_LOCK_ID", "CI=", `HEAVY_PROCESS_LOCK=${join(probe, "heavy.lock")}`, `TOOLING_PROBE_DIR=${probe}`];
	for (const script of ["lint", "typecheck"]) {
		yield* Effect.log(`Generated app: checking ${script} holds the heavy lock.`);
		yield* command(cwd, "env", [...env, `NODE_OPTIONS=${options} --import=${pathToFileURL(preload).href}`, "pnpm", "run", script]);
		yield* requireThat(yield* fs.exists(join(probe, `${script}.json`)), `Generated app: ${script} did not run the lock probe.`);
	}
	yield* Effect.acquireUseRelease(
		fs.copyFile(join(fixtures, "rerun.spec.ts.txt"), fixture),
		() =>
			Effect.gen(function* () {
				yield* Effect.log("Generated app: checking pnpm test holds the lock and reruns a failed test in a fresh process.");
				yield* command(cwd, "env", [...env, "pnpm", "run", "test", "src/tooling.spec.ts", "--maxWorkers=1"]);
				const report = yield* fs.readFileString(join(cwd, "test-results/flaky-tests.json"));
				yield* requireThat(report.includes("Generated app test must rerun"), "Generated app: missing recovered test in flaky-tests.json.");
			}),
		() => fs.remove(fixture).pipe(Effect.orDie),
	);
}, Effect.scoped);
