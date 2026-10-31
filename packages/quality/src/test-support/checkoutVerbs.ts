import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { runQuality } from "./cli.ts";
import { answerOf, type CliAnswer, cliVerbs } from "./cliAnswers.ts";
import { git, ISOLATED_ENV } from "./git.ts";
import { hookPath } from "./hookPath.ts";
import { checksLog, commits, type HookRepository, hookText } from "./hookRepository.ts";

export type CommitOutcome = "committed" | "rejected";

export interface CommitAnswer {
	readonly outcome: CommitOutcome;
	readonly stderr: string;
}

export interface CheckoutLayout {
	configless: boolean;
	folder: string;
	scripts: Readonly<Record<string, string>>;
}

export interface CheckoutEngine {
	answer: CliAnswer | undefined;
	commit: CommitAnswer | undefined;
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

export function checkoutVerbs(engine: CheckoutEngine, tell: (line: string) => void) {
	function commitFrom(folder: string, message: string): CommitAnswer {
		const run = commits(folder, message);
		engine.commit = { outcome: run.status === 0 ? "committed" : "rejected", stderr: run.stderr };
		return engine.commit;
	}
	return {
		...cliVerbs(engine, tell),
		commitErrors: () => Effect.sync(() => committed(engine).stderr),
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
		reads: (path: string) => Effect.sync(() => textIn(engine.root, path)),
		readsIn: (worktree: string, path: string) => Effect.sync(() => textIn(folderOf(engine, worktree), path)),
		reported: () => Effect.sync(() => linesOf(engine.answer?.stdout ?? "").filter((line) => line.startsWith("quality: "))),
		runsIn: (worktree: string, ...args: readonly string[]) =>
			Effect.promise(async () => {
				tell(`the author runs quality ${args.join(" ")} in the worktree ${worktree}`);
				engine.answer = answerOf(await runQuality(folderOf(engine, worktree), ...args));
				return engine.answer;
			}),
		runsOwnQuality: (...args: readonly string[]) =>
			Effect.sync(() => {
				if (engine.ownQuality === undefined) {
					throw new Error("Declare qualityFileAt(path) before running the repository's own quality");
				}
				tell(`the author runs the repository's own quality file with ${args.join(" ")}`);
				const run = spawnSync("node", ["--conditions=source", engine.ownQuality, ...args], { cwd: engine.root, encoding: "utf8", env: ISOLATED_ENV });
				engine.answer = answerOf({ status: run.status, stderr: run.stderr, stdout: run.stdout });
				return engine.answer;
			}),
		scriptLog: () => Effect.sync(() => linesOf(checksLog(engine.root))),
	};
}
