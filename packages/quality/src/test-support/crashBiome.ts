import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { Effect } from "effect";

const require = createRequire(import.meta.url);

export const crashBiome = Effect.fn("BiomeCache.crashBiome")(function* (root: string) {
	const script = `
import process from "node:process";
import { Effect } from ${JSON.stringify(require.resolve("effect"))};
import { ChildProcessSpawner } from ${JSON.stringify(require.resolve("effect/process"))};
import { runBiome } from ${JSON.stringify(new URL("../adapters/biome/run.ts", import.meta.url).href)};
import { services } from ${JSON.stringify(new URL("../cli/runMain.ts", import.meta.url).href)};
await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const held = ChildProcessSpawner.ChildProcessSpawner.of({
		...spawner,
		spawn: command => Effect.gen(function* () {
			const child = yield* spawner.spawn(command);
			if (command._tag === "StandardCommand" && command.args.some(arg => typeof arg === "string" && arg.endsWith("/biome/bin/biome"))) {
				process.stdout.write("Biome started");
				return yield* Effect.never;
			}
			return child;
		})
	});
	yield* runBiome(${JSON.stringify(root)}, ["check", "src/value.ts"]).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, held));
})).pipe(Effect.provide(services)));
`;
	return yield* Effect.promise(
		() =>
			new Promise<string>((resolve, reject) => {
				const child = spawn(process.execPath, ["--conditions=@shivaedev/source", "--input-type=module", "--eval", script], {
					cwd: root,
					stdio: ["ignore", "pipe", "pipe"],
				});
				let stderr = "";
				child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
					stderr += chunk;
				});
				child.once("error", reject);
				child.stdout.once("data", () => child.kill("SIGKILL"));
				child.once("close", (code, signal) => (signal === "SIGKILL" ? resolve(signal) : reject(new Error(`Child exited ${code}: ${stderr}`))));
			}),
	);
});
