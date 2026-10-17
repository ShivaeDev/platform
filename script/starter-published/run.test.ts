import assert from "node:assert/strict";
import { test as it } from "node:test";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { runStarter } from "./run.ts";

const CWD = "/tmp/generated-starter";
const DATABASE = "postgres://localhost/starter-test";

function runner(failedCommand?: string) {
	const commands: ChildProcess.StandardCommand[] = [];
	const spawner = {
		...ChildProcessSpawner.make(() => Effect.die("Unexpected spawn")),
		exitCode: (command: ChildProcess.Command) => {
			assert.ok(ChildProcess.isStandardCommand(command));
			commands.push(command);
			return Effect.succeed(ChildProcessSpawner.ExitCode(command.args.includes(failedCommand ?? "") ? 1 : 0));
		},
	};
	return {
		commands,
		run: () => Effect.runPromise(runStarter(CWD, DATABASE).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))),
	};
}

it("runs the generated app's own CI script with PostgreSQL", async () => {
	const check = runner();
	await check.run();
	assert.deepEqual(
		check.commands.map((command) => command.args),
		[["run", "ci"]],
	);
	for (const command of check.commands) {
		assert.equal(command.command, "pnpm");
		assert.equal(command.options.cwd, CWD);
		assert.equal(command.options.env?.TEST_DATABASE_URL, DATABASE);
	}
});

it("fails the published-starter runner when the generated app's CI script fails", async () => {
	const check = runner("ci");
	await assert.rejects(check.run(), /Generated app: pnpm run ci failed \(exit 1\)/u);
	assert.equal(check.commands.length, 1);
});
