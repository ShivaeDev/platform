import assert from "node:assert/strict";
import { test as it } from "node:test";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { runStarter } from "./run.ts";

const CWD = "/tmp/copied-starter";
const DATABASE = "postgres://localhost/starter-test";

function runner(lintExit: number) {
	const commands: ChildProcess.StandardCommand[] = [];
	const spawner = {
		...ChildProcessSpawner.make(() => Effect.die("Unexpected spawn")),
		exitCode: (command: ChildProcess.Command) => {
			assert.ok(ChildProcess.isStandardCommand(command));
			commands.push(command);
			return Effect.succeed(ChildProcessSpawner.ExitCode(command.args.includes("lint") ? lintExit : 0));
		},
	};
	return {
		commands,
		run: () => Effect.runPromise(runStarter(CWD, DATABASE).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))),
	};
}

it("runs the copied app's quality lint without flags before its build and runtime checks", async () => {
	const check = runner(0);
	await check.run();
	assert.deepEqual(
		check.commands.map((command) => command.args),
		[
			["exec", "quality", "lint"],
			["run", "typecheck"],
			["run", "build"],
			["test", "src/server/starterHost.test.ts", "src/server/committedJobs.spec.ts"],
		],
	);
	for (const command of check.commands) {
		assert.equal(command.command, "pnpm");
		assert.equal(command.options.cwd, CWD);
	}
});

it("fails the published-starter runner immediately when quality lint fails", async () => {
	const check = runner(1);
	await assert.rejects(check.run(), /Copied starter: pnpm exec quality lint failed \(exit 1\)/u);
	assert.equal(check.commands.length, 1);
});
