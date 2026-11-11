import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { decodeBaseline } from "#baseline/format.ts";
import { SHARD_NAME } from "#baseline/shards.ts";
import { answerOf, type CliAnswer, cliVerbs } from "#test/cliAnswers.ts";
import { ROOT_SHARD, readOrUndefined, recordedDebt, sourceOf, writeAll } from "#test/recordedDebt.ts";
import { runQuality } from "#testing/adapters/cli.ts";
import { git, mergeBranch } from "#testing/adapters/git.ts";

export interface BaselineEngine {
	answer: CliAnswer | undefined;
	readonly folder: string;
	root: string;
}

function shardPaths(root: string): string[] {
	const packages = join(root, "packages");
	const names = existsSync(packages) ? readdirSync(packages).sort() : [];
	return [ROOT_SHARD, ...names.map((name) => `packages/${name}/${SHARD_NAME}`)].filter((path) => existsSync(join(root, path)));
}

function created(): BaselineEngine {
	const folder = mkdtempSync(join(tmpdir(), "quality-baseline-"));
	const root = join(folder, "repository");
	mkdirSync(root);
	return { answer: undefined, folder, root };
}

export const baselineStory = storyKit({
	create: () => Effect.acquireRelease(Effect.sync(created), (engine) => Effect.sync(() => rmSync(engine.folder, { force: true, recursive: true }))),
	inspect: ({ answer, root }) => ({ answer, debt: recordedDebt(root, ROOT_SHARD) }),
	name: "Quality baseline",
	stages: ["repository", "baseline", "history", "work"],
	verbs: (engine, story) => {
		const cli = cliVerbs(engine, story.tell);
		return {
			...cli,
			closingSections: (count: number) => Effect.map(cli.stdout(), (stdout) => stdout.trimEnd().split("\n\n").slice(-count)),
			decode: (raw: string | undefined) => {
				story.tell("quality decodes the baseline file");
				return Effect.sync(() => decodeBaseline(raw));
			},
			lengthens: (path: string, lines: number) =>
				Effect.sync(() => {
					story.tell(`the author lengthens ${path} to ${lines} lines`);
					writeAll(engine.root, [{ content: sourceOf(lines), path }]);
				}),
			lint: () =>
				Effect.gen(function* () {
					story.tell("quality lint checks the repository");
					return answerOf(yield* runQuality(engine.root, "lint")).outcome;
				}),
			localConfig: () => Effect.sync(() => git(engine.root, "config", "--local", "--list").trimEnd().split("\n")),
			merges: (branch: string) =>
				Effect.sync(() => {
					story.tell(`git merges ${branch} into the current branch`);
					return mergeBranch(engine.root, branch);
				}),
			reads: (path: string) => Effect.sync(() => readOrUndefined(engine.root, path)),
			recorded: (shard = ROOT_SHARD) => Effect.sync(() => recordedDebt(engine.root, shard)),
			removesShards: () =>
				Effect.sync(() => {
					story.tell("the author deletes every baseline shard");
					for (const path of shardPaths(engine.root)) {
						rmSync(join(engine.root, path));
					}
				}),
			rootFiles: () => Effect.sync(() => readdirSync(engine.root).sort()),
			shallow: () => Effect.sync(() => (git(engine.root, "rev-parse", "--is-shallow-repository").trim() === "true" ? "shallow" : "complete")),
			shards: () => Effect.sync(() => shardPaths(engine.root).map((path) => [path, readOrUndefined(engine.root, path)] as const)),
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
export const setupRun = Effect.fn("BaselineStory.setupRun")(function* (engine: BaselineEngine, ...args: readonly string[]) {
	const answer = answerOf(yield* runQuality(engine.root, ...args));
	if (answer.outcome !== "passed") {
		throw new Error(`quality ${args.join(" ")} ${answer.outcome}: ${answer.stdout}${answer.stderr}`);
	}
});
