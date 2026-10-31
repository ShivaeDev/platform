import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { Effect, Fiber, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { appendSupervisorLog } from "#host/appendSupervisorLog.ts";
import { logSupervisor } from "#host/supervisedProcess.ts";

function sourceRevision(root: string) {
	const hash = createHash("sha256");
	const files = ["package.json", "script/build-client.ts", ...readdirSync(join(root, "src"), { recursive: true }).map((file) => `src/${file}`)];
	for (const file of files.sort((left, right) => left.localeCompare(right))) {
		if (file === "src/adapters/generated" || file.startsWith("src/adapters/generated/")) {
			continue;
		}
		const path = join(root, file);
		if (file.endsWith(".json") || file.endsWith(".ts") || file.endsWith(".tsx")) {
			hash.update(file).update(readFileSync(path));
		}
	}
	return hash.digest("hex");
}

export const pluginBuilder = Effect.fn("FleetSupervisor.pluginBuilder")(function* (fleetManifest: string, log: string) {
	const root = join(dirname(realpathSync(fleetManifest)), "../work-board-plugin");
	if (!existsSync(join(root, "script/build-client.ts"))) {
		return () => Effect.void;
	}
	let previous: string | undefined;
	return (force = false) =>
		Effect.gen(function* () {
			const revision = yield* Effect.try(() => sourceRevision(root));
			if (!force && revision === previous) {
				return;
			}
			previous = revision;
			yield* logSupervisor(log, "building Work Board plugin client bundle");
			yield* Effect.scoped(
				Effect.gen(function* () {
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					const child = yield* spawner.spawn(
						ChildProcess.make(process.execPath, ["--conditions=source", join(root, "script/build-client.ts")], {
							cwd: root,
							stderr: "pipe",
							stdin: "ignore",
							stdout: "pipe",
						}),
					);
					const output = yield* Effect.forkScoped(
						child.all.pipe(
							Stream.decodeText,
							Stream.runForEach((text) => appendSupervisorLog(log, `plugin: ${text}`)),
						),
					);
					const status = yield* child.exitCode;
					yield* Fiber.join(output);
					yield* logSupervisor(log, status === 0 ? "built Work Board plugin client bundle" : `Work Board plugin build failed: exit ${status}`);
				}),
			);
		}).pipe(Effect.catch((error) => logSupervisor(log, `Work Board plugin build failed: ${error.message}`)));
});
