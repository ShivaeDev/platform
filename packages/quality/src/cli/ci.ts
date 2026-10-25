import { Console, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { GateFailed } from "#failure.ts";

export const ci = Effect.fn("Cli.ci")(function* (cwd: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	for (const args of [["peers", "check"], ...["lint", "typecheck", "build", "test"].map((script) => ["run", script])]) {
		yield* Console.log(`quality: running \`pnpm ${args.join(" ")}\``);
		const code = yield* spawner.exitCode(ChildProcess.make("pnpm", args, { cwd, stderr: "inherit", stdout: "inherit" }));
		if (code !== 0) {
			yield* Console.error(`quality: pnpm ${args.join(" ")} failed (exit ${code}).`);
			return yield* new GateFailed();
		}
	}
});
