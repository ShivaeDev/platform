import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { Effect } from "effect";
import type { Run } from "#testing/adapters/cli.ts";
import { isolatedEnvironment } from "#testing/adapters/git.ts";

const require = createRequire(import.meta.url);

// The hook runs in its own process so it can be killed; it reports Biome's launch over IPC and waits for the story to let Biome run.
const SCRIPT = `
import process from "node:process";
import { Effect } from ${JSON.stringify(require.resolve("effect"))};
import { ChildProcessSpawner } from ${JSON.stringify(require.resolve("effect/process"))};
import { preCommitHook } from ${JSON.stringify(new URL("../hooks/preCommit.ts", import.meta.url).href)};
import { exitCode, explained, services } from ${JSON.stringify(new URL("../adapters/runMain.ts", import.meta.url).href)};
let held = false;
const program = Effect.gen(function* () {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const holding = ChildProcessSpawner.ChildProcessSpawner.of({
		...spawner,
		spawn: command => Effect.gen(function* () {
			if (!held && command._tag === "StandardCommand" && command.args.some(arg => typeof arg === "string" && arg.endsWith("/biome/bin/biome"))) {
				held = true;
				process.send("biome");
				yield* Effect.promise(() => new Promise(resolve => process.once("message", resolve)));
			}
			return yield* spawner.spawn(command);
		})
	});
	return yield* preCommitHook(process.cwd(), undefined).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, holding));
});
const exit = await Effect.runPromiseExit(explained(program).pipe(Effect.provide(services)));
process.disconnect();
process.exitCode = exitCode(exit);
`;

export function heldCheck(root: string, whileBiomeHeld: (hook: ChildProcess) => void): Effect.Effect<Run> {
	return Effect.promise(
		() =>
			new Promise<Run>((resolve, reject) => {
				const hook = spawn(process.execPath, ["--conditions=@shivaedev/source", "--input-type=module", "--eval", SCRIPT], {
					cwd: root,
					env: isolatedEnvironment(root),
					stdio: ["ignore", "pipe", "pipe", "ipc"],
				});
				let stdout = "";
				let stderr = "";
				hook.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
					stdout += chunk;
				});
				hook.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
					stderr += chunk;
				});
				hook.once("error", reject);
				hook.once("message", () => whileBiomeHeld(hook));
				hook.once("close", (status) => resolve({ status, stderr, stdout }));
			}),
	);
}
