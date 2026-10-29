import { Console, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { GateFailed } from "#failure.ts";

const coverageArgs = [
	"--coverage",
	"--coverage.provider=v8",
	"--coverage.reporter=lcov",
	"--coverage.reportOnFailure",
	"--coverage.reportsDirectory=coverage",
	"--reporter=default",
	"--reporter=junit",
	"--outputFile.junit=coverage/junit.xml",
];

export const ci = Effect.fn("Cli.ci")(function* (cwd: string, coverage = false) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const scripts = ["lint", "typecheck", "build", "test"].map((script) => ["run", script, ...(script === "test" && coverage ? coverageArgs : [])]);
	for (const args of [["peers", "check"], ...scripts]) {
		yield* Console.log(`quality: running \`pnpm ${args.join(" ")}\``);
		const code = yield* spawner.exitCode(ChildProcess.make("pnpm", args, { cwd, stderr: "inherit", stdout: "inherit" }));
		if (code !== 0) {
			yield* Console.error(`quality: pnpm ${args.join(" ")} failed (exit ${code}).`);
			return yield* new GateFailed();
		}
	}
});
