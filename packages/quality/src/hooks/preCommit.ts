import { join } from "node:path";
import { Console, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { lint } from "#cli/lint.ts";
import { loadConfig } from "#config/load.ts";
import { GateFailed, SetupFailure } from "#failure.ts";

const COMMIT_AGAIN =
	"help: fix what the output above reports, then commit again; `quality hooks pre-commit` repeats these checks without committing.";

const commitScripts = Effect.fnUntraced(function* (root: string) {
	const file = join(root, "package.json");
	const readText = yield* manifestReader(root);
	const manifest = yield* Effect.tryPromise({
		catch: (cause) => new SetupFailure({ cause, message: `${file} is invalid: ${cause instanceof Error ? cause.message : String(cause)}` }),
		try: () => readPackageManifest(readText, file),
	});
	if (manifest === undefined) {
		return { manager: "npm", scripts: [] };
	}
	const manager = manifest.packageManager?.split("@")[0] ?? "npm";
	if (!["npm", "pnpm", "yarn", "bun"].includes(manager)) {
		return yield* new SetupFailure({ message: `${file}: unsupported packageManager "${manager}". Use npm, pnpm, yarn or bun.` });
	}
	return { manager, scripts: ["typecheck", "quality:commit"].filter((script) => manifest.scripts?.[script] !== undefined) };
});

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

export const preCommitHook = Effect.fn("Hooks.preCommitHook")(function* (cwd: string, path: string | undefined) {
	const config = yield* loadConfig(cwd, path);
	const { manager, scripts } = yield* commitScripts(config.root);
	const linted = yield* lint(cwd, path).pipe(
		Effect.as(true),
		Effect.catchTag("GateFailed", () => Effect.succeed(false)),
	);
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
		yield* Console.error(`quality: pre-commit failed: ${failed.join(", ")}.\n${COMMIT_AGAIN}`);
		return yield* new GateFailed();
	}
});
