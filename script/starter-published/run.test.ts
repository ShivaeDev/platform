import assert from "node:assert/strict";
import { test as it } from "node:test";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
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

it("runs the generated app's quality lint without flags before its build and runtime checks", async () => {
	const check = runner();
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
		assert.equal(command.options.env?.TEST_DATABASE_URL, DATABASE);
		assert.equal(command.options.env?.PLATFORM_EFFECT_SQL_TEST_DATABASE_URL, DATABASE);
	}
});

for (const [index, name] of ["lint", "typecheck", "build", "test"].entries()) {
	it(`fails the published-starter runner immediately when ${name} fails`, async () => {
		const check = runner(name);
		await assert.rejects(check.run(), /Generated starter: pnpm .* failed \(exit 1\)/u);
		assert.equal(check.commands.length, index + 1);
	});
}
