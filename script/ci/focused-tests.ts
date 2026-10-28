import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { testPackages } from "./testPackages.ts";

const program = Effect.gen(function* () {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	for (const { name } of testPackages(process.cwd())) {
		yield* Console.log(`Loading focused-test config for ${name}`);
		const code = yield* spawner.exitCode(
			ChildProcess.make("pnpm", ["--filter", name, "test", "__focused_config_smoke__/missing.spec.ts", "--passWithNoTests"], {
				stderr: "inherit",
				stdout: "inherit",
			}),
		);
		if (code !== 0) {
			process.exitCode = code;
			return;
		}
	}
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
