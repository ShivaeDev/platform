import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runQuality } from "./cli.ts";
import { answerOf, type CliAnswer, cliVerbs } from "./cliAnswers.ts";
import { git, mergeBranch } from "./git.ts";
import { ROOT_SHARD, readOrUndefined, recordedDebt, sourceOf, writeAll } from "./recordedDebt.ts";

export interface BaselineEngine {
	answer: CliAnswer | undefined;
	readonly folder: string;
	root: string;
}

function created(): BaselineEngine {
	const folder = mkdtempSync(join(tmpdir(), "quality-baseline-"));
	const root = join(folder, "repository");
	mkdirSync(root);
	return { answer: undefined, folder, root };
}

export const baselineStory = storyKit({
	clock: "live",
	create: () => Effect.acquireRelease(Effect.sync(created), (engine) => Effect.sync(() => rmSync(engine.folder, { force: true, recursive: true }))),
	inspect: ({ answer, root }) => ({ answer, debt: recordedDebt(root, ROOT_SHARD) }),
	name: "Quality baseline",
	stages: ["repository", "baseline", "history", "work"],
	verbs: (engine, story) => {
		const cli = cliVerbs(engine, story.tell);
		return {
			...cli,
			lastLine: () => Effect.map(cli.stdout(), (stdout) => stdout.trimEnd().split("\n").at(-1)),
			lengthens: (path: string, lines: number) =>
				Effect.sync(() => {
					story.tell(`the author lengthens ${path} to ${lines} lines`);
					writeAll(engine.root, [{ content: sourceOf(lines), path }]);
				}),
			lint: () =>
				Effect.promise(async () => {
					story.tell("quality lint checks the repository");
					return answerOf(await runQuality(engine.root, "lint")).outcome;
				}),
			localConfig: () => Effect.sync(() => git(engine.root, "config", "--local", "--list").trimEnd().split("\n")),
			merges: (branch: string) =>
				Effect.sync(() => {
					story.tell(`git merges ${branch} into the current branch`);
					return mergeBranch(engine.root, branch);
				}),
			reads: (path: string) => Effect.sync(() => readOrUndefined(engine.root, path)),
			recorded: (shard = ROOT_SHARD) => Effect.sync(() => recordedDebt(engine.root, shard)),
			rootFiles: () => Effect.sync(() => readdirSync(engine.root).sort()),
			shallow: () => Effect.sync(() => (git(engine.root, "rev-parse", "--is-shallow-repository").trim() === "true" ? "shallow" : "complete")),
			stages: (...paths: readonly string[]) =>
				Effect.sync(() => {
					story.tell(`the author stages ${paths.join(", ")}`);
					git(engine.root, "add", "--", ...paths);
				}),
			writes: (path: string, content: string) =>
				Effect.sync(() => {
					story.tell(`the author writes ${path}`);
					writeAll(engine.root, [{ content, path }]);
				}),
		};
	},
});

// Setup commands must succeed; a trait that cannot build its precondition fails the story with the command's output.
export function setupRun(engine: BaselineEngine, ...args: readonly string[]) {
	return Effect.promise(async () => {
		const answer = answerOf(await runQuality(engine.root, ...args));
		if (answer.outcome !== "passed") {
			throw new Error(`quality ${args.join(" ")} ${answer.outcome}: ${answer.stdout}${answer.stderr}`);
		}
	});
}
