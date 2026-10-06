import { join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { Scope } from "#baseline/update.ts";
import { shrinkBaseline } from "#cli/baseline.ts";
import { lint } from "#cli/lint.ts";
import { loadConfig, type ResolvedConfig } from "#config/load.ts";
import { GateFailed, SetupFailure } from "#failure.ts";
import { gitOrFail } from "#git/command.ts";
import { changesSince } from "#git/history.ts";

const COMMIT_AGAIN =
	"help: fix what the output above reports, then commit again; `quality hooks pre-commit` repeats these checks without committing.";

// A partly staged file is counted as it is on disk, which is not what the commit holds, so its entries wait for a later commit.
const stagedScope = Effect.fnUntraced(function* (config: ResolvedConfig) {
	const unstaged = (yield* changesSince(config.root, [])).files;
	if (unstaged.has(config.baseline)) {
		return undefined;
	}
	const staged = yield* changesSince(config.root, ["--cached"]);
	const held = new Set([...unstaged, ...[...staged.moves].filter(([, to]) => unstaged.has(to)).map(([from]) => from)]);
	const scope: Scope = {
		files: new Set([...staged.files].filter((file) => !held.has(file))),
		moves: new Map([...staged.moves].filter(([from]) => !held.has(from))),
	};
	return scope;
});

const tighten = Effect.fnUntraced(function* (cwd: string, path: string | undefined, config: ResolvedConfig) {
	const scope = yield* stagedScope(config);
	if (scope === undefined) {
		return yield* Console.error(
			`quality: left ${config.baseline} as it is, because it has unstaged changes.\nhelp: stage or discard them to tighten it.`,
		);
	}
	yield* shrinkBaseline(cwd, path, () => Effect.succeed(scope));
	const fs = yield* FileSystem.FileSystem;
	if (yield* Effect.orElseSucceed(fs.exists(join(config.root, config.baseline)), () => false)) {
		yield* gitOrFail(config.root, ["add", "--", config.baseline]);
	}
});

const shell = Effect.fnUntraced(
	function* (root: string, command: string) {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const child = yield* spawner.spawn(
			ChildProcess.make("sh", ["-c", command], { cwd: root, stderr: "inherit", stdin: "inherit", stdout: "inherit" }),
		);
		return Number(yield* child.exitCode);
	},
	Effect.scoped,
	Effect.mapError((error) => new SetupFailure({ message: `cannot run a pre-commit command: ${error.message}` })),
);

export const preCommitHook = Effect.fn("Hooks.preCommitHook")(function* (cwd: string, path: string | undefined) {
	const config = yield* loadConfig(cwd, path);
	if (config.preCommit.tighten) {
		yield* tighten(cwd, path, config);
	}
	const linted = yield* lint(cwd, path, "summary").pipe(
		Effect.as(true),
		Effect.catchTag("GateFailed", () => Effect.succeed(false)),
	);
	const failed = linted ? [] : ["quality lint"];
	for (const command of config.preCommit.run) {
		yield* Console.log(`quality: running \`${command}\``);
		const code = yield* shell(config.root, command);
		if (code !== 0) {
			failed.push(`\`${command}\` (exit code ${code})`);
		}
	}
	if (failed.length > 0) {
		yield* Console.error(`quality: pre-commit failed: ${failed.join(", ")}.\n${COMMIT_AGAIN}`);
		return yield* new GateFailed();
	}
});
