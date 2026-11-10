import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { answerOf, type CliAnswer, cliVerbs } from "#test/cliAnswers.ts";
import { heldCheck } from "#test/heldCheck.ts";
import { runQuality } from "#testing/adapters/cli.ts";
import { git, isolatedEnvironment } from "#testing/adapters/git.ts";
import { hookPath } from "#testing/adapters/hookPath.ts";
import { checksLog, commits, type HookRepository, hookText } from "#testing/adapters/hookRepository.ts";

export type CommitOutcome = "committed" | "rejected";

export interface CommitAnswer {
	readonly outcome: CommitOutcome;
	readonly stderr: string;
}

export interface CheckoutLayout {
	configless: boolean;
	folder: string;
	preCommit: "staged" | undefined;
	scripts: Readonly<Record<string, string>>;
}

export interface CheckoutEngine {
	answer: CliAnswer | undefined;
	commit: CommitAnswer | undefined;
	environment: Readonly<Record<string, string>>;
	readonly layout: CheckoutLayout;
	ownQuality: string | undefined;
	repository: HookRepository | undefined;
	root: string;
	readonly worktrees: Map<string, string>;
}

export function builtRepository(engine: CheckoutEngine): HookRepository {
	if (engine.repository === undefined) {
		throw new Error("The checkout's repository is built after its repository traits");
	}
	return engine.repository;
}

const OWNER = "# Installed by @shivaedev/quality: `quality hooks install` writes it, `quality hooks uninstall` removes it.";

function linesOf(text: string): readonly string[] {
	return text.split("\n").filter((line) => line !== "");
}

function folderOf(engine: CheckoutEngine, worktree: string): string {
	const folder = engine.worktrees.get(worktree);
	if (folder === undefined) {
		throw new Error(`Declare linkedWorktree("${worktree}") before acting in it`);
	}
	return folder;
}

function committed(engine: CheckoutEngine): CommitAnswer {
	if (engine.commit === undefined) {
		throw new Error("Commit before reading the commit's answer");
	}
	return engine.commit;
}

function textIn(folder: string, path: string): string | undefined {
	return existsSync(join(folder, path)) ? readFileSync(join(folder, path), "utf8") : undefined;
}

const RECOVERY = "If the hook stops first, run";

function recoveryCommands(stdout: string): readonly string[] {
	const lines = stdout.split("\n");
	const notice = lines.findIndex((line) => line.includes(RECOVERY));
	if (notice === -1) {
		throw new Error("The check printed no recovery commands");
	}
	const following = lines.slice(notice + 1);
	const end = following.findIndex((line) => !line.startsWith("  "));
	return (end === -1 ? following : following.slice(0, end)).map((line) => line.trim());
}

export function checkoutVerbs(engine: CheckoutEngine, tell: (line: string) => void) {
	function commitFrom(folder: string, message: string): CommitAnswer {
		const run = commits(folder, message, engine.environment);
		engine.commit = { outcome: run.status === 0 ? "committed" : "rejected", stderr: run.stderr };
		return engine.commit;
	}
	return {
		...cliVerbs(engine, tell),
		commitCheckKilledWhileBiomeRuns: () =>
			Effect.gen(function* () {
				tell("the commit check is killed while Biome checks the staged content");
				engine.answer = answerOf(yield* heldCheck(engine.root, (hook) => hook.kill("SIGKILL")));
			}),
		commitCheckWhileFolderReplaces: (path: string) =>
			Effect.gen(function* () {
				tell(`the commit check runs, and while Biome checks the staged content a folder takes the place of ${path}`);
				const run = yield* heldCheck(engine.root, (hook) => {
					rmSync(join(engine.root, path));
					mkdirSync(join(engine.root, path));
					writeFileSync(join(engine.root, path, "kept.txt"), "kept\n");
					hook.send("continue");
				});
				engine.answer = answerOf(run);
			}),
		commitErrors: () => Effect.sync(() => committed(engine).stderr),
		commitErrorsAfter: (line: string) =>
			Effect.sync(() => {
				const lines = linesOf(committed(engine).stderr);
				return lines.slice(lines.lastIndexOf(line) + 1);
			}),
		commitOutcome: () => Effect.sync(() => committed(engine).outcome),
		commits: (message: string) =>
			Effect.sync(() => {
				tell(`the author commits "${message}"`);
				return commitFrom(engine.root, message);
			}),
		commitsIn: (worktree: string, message: string) =>
			Effect.sync(() => {
				tell(`the author commits "${message}" in the worktree ${worktree}`);
				return commitFrom(folderOf(engine, worktree), message);
			}),
		folder: (worktree?: string) => Effect.sync(() => realpathSync(worktree === undefined ? engine.root : folderOf(engine, worktree))),
		history: () => Effect.sync(() => linesOf(git(builtRepository(engine).root, "log", "--format=%s"))),
		hook: () =>
			Effect.sync(() => {
				const text = hookText(builtRepository(engine));
				if (text === undefined) {
					return "none";
				}
				return text.split("\n").includes(OWNER) ? "quality's" : "another";
			}),
		hookFile: () => Effect.sync(() => hookPath(builtRepository(engine).root)),
		hookLines: () => Effect.sync(() => linesOf(hookText(builtRepository(engine)) ?? "")),
		hookScript: () => Effect.sync(() => hookText(builtRepository(engine))),
		linkTarget: (path: string) => Effect.sync(() => readlinkSync(join(engine.root, path))),
		mode: (path: string) => Effect.sync(() => (statSync(join(engine.root, path)).mode & 0o777).toString(8)),
		reads: (path: string) => Effect.sync(() => textIn(engine.root, path)),
		readsIn: (worktree: string, path: string) => Effect.sync(() => textIn(folderOf(engine, worktree), path)),
		reported: () => Effect.sync(() => linesOf(engine.answer?.stdout ?? "").filter((line) => line.startsWith("quality: "))),
		runsIn: (worktree: string, ...args: readonly string[]) =>
			Effect.gen(function* () {
				tell(`the author runs quality ${args.join(" ")} in the worktree ${worktree}`);
				engine.answer = answerOf(yield* runQuality(folderOf(engine, worktree), ...args));
				return engine.answer;
			}),
		runsOwnQuality: (...args: readonly string[]) =>
			Effect.sync(() => {
				if (engine.ownQuality === undefined) {
					throw new Error("Declare qualityFileAt(path) before running the repository's own quality");
				}
				tell(`the author runs the repository's own quality file with ${args.join(" ")}`);
				const run = spawnSync("node", ["--conditions=@shivaedev/source", engine.ownQuality, ...args], {
					cwd: engine.root,
					encoding: "utf8",
					env: isolatedEnvironment(engine.root),
				});
				engine.answer = answerOf({ status: run.status, stderr: run.stderr, stdout: run.stdout });
				return engine.answer;
			}),
		runsPrintedRecovery: () =>
			Effect.sync(() => {
				tell("the author runs the commands the check printed to get the working copies back");
				for (const command of recoveryCommands(engine.answer?.stdout ?? "")) {
					const run = spawnSync("sh", ["-c", command], { cwd: engine.root, encoding: "utf8", env: isolatedEnvironment(engine.root) });
					if (run.status !== 0) {
						throw new Error(`${command} exited ${String(run.status)}: ${run.stderr}`);
					}
				}
			}),
		scriptLog: () => Effect.sync(() => linesOf(checksLog(engine.root))),
	};
}
