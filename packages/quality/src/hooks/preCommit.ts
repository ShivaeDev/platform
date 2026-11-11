import { Config, Console, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { reportLint } from "#cli/lint.ts";
import { loadConfig } from "#config/load.ts";
import { passes } from "#engine/evaluate.ts";
import { projectScripts } from "#engine/projectScripts.ts";
import { GateFailed, SetupFailure } from "#failure.ts";
import { stagedCheck } from "#hooks/stagedCheck.ts";
import { recap } from "#report/recap.ts";

const COMMIT_AGAIN =
	"help: fix what the output above reports, then commit again; `quality hooks pre-commit` repeats these checks without committing.";

const runScript = Effect.fnUntraced(
	function* (root: string, manager: string, script: string) {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const child = yield* spawner.spawn(
			ChildProcess.make(manager, ["run", script], { cwd: root, stderr: "inherit", stdin: "inherit", stdout: "inherit" }),
		);
		return Number(yield* child.exitCode);
	},
	Effect.scoped,
	Effect.mapError((error) => new SetupFailure({ cause: error, message: `cannot run a pre-commit script: ${error.message}` })),
);

const inCloudSession = Config.String("CLAUDE_CODE_REMOTE").pipe(
	Config.withDefault(""),
	Config.map((value) => value === "true"),
);

export const preCommitHook = Effect.fn("Hooks.preCommitHook")(function* (cwd: string, path: string | undefined) {
	const config = yield* loadConfig(cwd, path);
	const cloud = yield* inCloudSession.pipe(Effect.mapError((cause) => new SetupFailure({ cause, message: "cannot read CLAUDE_CODE_REMOTE." })));
	if (config.preCommit === "staged" && !cloud) {
		if (!(yield* stagedCheck(config))) {
			yield* Console.error(`quality: pre-commit failed: Biome on the staged files.\n${COMMIT_AGAIN}`);
			return yield* new GateFailed();
		}
		return;
	}
	const { manager, scripts: declared } = yield* projectScripts(config.root);
	const scripts = ["typecheck", "quality:commit"].filter((script) => declared[script] !== undefined);
	const { context, outcome } = yield* reportLint(cwd, path, true);
	const linted = passes(outcome);
	const failed = linted ? [] : ["quality lint"];
	for (const script of scripts) {
		const command = `${manager} run ${script}`;
		yield* Console.log(`quality: running \`${command}\``);
		const code = yield* runScript(config.root, manager, script);
		if (code !== 0) {
			failed.push(`\`${command}\` (exit code ${code})`);
		}
	}
	if (failed.length > 0) {
		const findings = linted ? [] : [recap(outcome, context)];
		yield* Console.error([...findings, `quality: pre-commit failed: ${failed.join(", ")}.`, COMMIT_AGAIN].join("\n"));
		return yield* new GateFailed();
	}
});
