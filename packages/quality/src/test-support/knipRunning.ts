import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Deferred, Effect, Fiber, Stream } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { type Lifecycle, qualityLifecycle, type RunningTool, startQuality } from "./qualityLifecycle.ts";

function configLoaded(engine: Lifecycle, tool: RunningTool) {
	let stderr = "";
	return (chunk: Uint8Array) => {
		stderr += new TextDecoder().decode(chunk);
		return stderr.includes("knip config ready") ? Deferred.succeed(engine.started, tool) : Effect.void;
	};
}

export const knipRunning = qualityLifecycle.trait(
	"running",
	"quality lint runs knip, which waits inside the repository's Vitest config",
	function* (engine) {
		writeFileSync(join(engine.root, "package.json"), JSON.stringify({ name: "app", scripts: { test: "vitest run" }, type: "module" }));
		writeFileSync(
			join(engine.root, "vitest.config.mjs"),
			`console.error("knip config ready");
setInterval(() => {}, 1000);
await new Promise(() => {});
export default {};
`,
		);
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const observed = ChildProcessSpawner.ChildProcessSpawner.of({
			...spawner,
			spawn: (command) =>
				Effect.gen(function* () {
					const child = yield* spawner.spawn(command);
					if (command._tag !== "StandardCommand" || !command.args.includes("--tsConfig")) {
						return child;
					}
					const config = command.args[command.args.indexOf("--config") + 1];
					const sourceConfig = command.args[command.args.indexOf("--tsConfig") + 1];
					if (config === undefined || sourceConfig === undefined) {
						return yield* Effect.die(new Error("knip started without quality's generated configs"));
					}
					const tool = { child, path: config, sourceConfig: join(engine.root, sourceConfig) };
					return { ...child, stderr: child.stderr.pipe(Stream.tap(configLoaded(engine, tool))) };
				}),
		});
		engine.fiber = yield* startQuality(engine, observed);
		yield* Effect.raceFirst(
			Deferred.await(engine.started),
			Fiber.join(engine.fiber).pipe(Effect.andThen(Effect.die(new Error(`quality finished before knip loaded its config: ${engine.output.stderr}`)))),
		);
	},
);
