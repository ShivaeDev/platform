import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "#storyKit.ts";
import { LARGE_BAKERY } from "./failureReport.ts";
import { LIFETIME_LOG } from "./lifetimeLog.ts";
import { runStories, type StoriesOutcome, type StoriesRun, type StoryResult } from "./runStories.ts";

export type Fixture =
	| "brokenHttpStories"
	| "composedDisabledStories"
	| "compositionStories"
	| "disabledStories"
	| "enabledStories"
	| "failingStories"
	| "genreStories"
	| "invalidTagStories"
	| "lifetimeStories"
	| "onlyStories"
	| "outboundStories"
	| "outcomeStories"
	| "refusingStories"
	| "scopedStories"
	| "tracingStories"
	| "unlocatedStories"
	| "unroutedDomStories"
	| "unroutedNodeStories";

type RunOptions = Omit<StoriesRun, "env" | "include">;

interface Runner {
	last: StoriesOutcome | undefined;
	readonly log: string;
	story: string | undefined;
}

function exactly(name: string) {
	return `^${name.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&")}$`;
}

function ran(runner: Runner): StoryResult {
	if (runner.story === undefined) {
		throw new Error("Run one story with runStory before reading its outcome.");
	}
	return named(runner, runner.story);
}

function named(runner: Runner, name: string): StoryResult {
	const result = runner.last?.stories.find((story) => story.name === name);
	if (result === undefined) {
		throw new Error(`The last run has no story named "${name}".`);
	}
	return result;
}

function outcomeOf(result: StoryResult): string {
	return result.state === "failed" ? result.errors.join("\n") : result.state;
}

export const storyRunner = storyKit({
	clock: "live",
	*create() {
		const directory = yield* Effect.acquireRelease(
			Effect.sync(() => mkdtempSync(join(tmpdir(), "test-story-runner-"))),
			(path) => Effect.sync(() => rmSync(path, { force: true, recursive: true })),
		);
		const runner: Runner = { last: undefined, log: join(directory, "lifetime.log"), story: undefined };
		return runner;
	},
	inspect: ({ last, story }) => ({
		moduleErrors: last?.moduleErrors,
		stories: last?.stories.map(({ name, state }) => `${name}: ${state}`),
		story,
	}),
	name: "story runner",
	stages: [],
	verbs: (runner, story) => {
		function run(fixture: Fixture, options: RunOptions, name?: string) {
			return Effect.promise(async () => {
				runner.story = name;
				rmSync(runner.log, { force: true });
				runner.last = await runStories({ ...options, env: { [LIFETIME_LOG]: runner.log }, include: `src/test-support/${fixture}.ts` });
			});
		}
		return {
			cause: () => Effect.sync(() => ran(runner).causes[0]),
			changedRows: () => Effect.sync(() => (ran(runner).diffs[0] ?? "").split("\n").filter((line) => /^[-+]\s+"/u.test(line))),
			failedAt: () =>
				Effect.sync(() =>
					outcomeOf(ran(runner))
						.split("\n")
						.find((line) => /^\s*at \S+:\d+:\d+$/u.test(line))
						?.trim(),
				),
			lastWrittenOrder: () =>
				Effect.sync(() => {
					const bakery: { readonly orders: readonly string[] } = JSON.parse(readFileSync(LARGE_BAKERY, "utf8"));
					return bakery.orders.at(-1);
				}),
			lifetime: () => Effect.sync(() => (existsSync(runner.log) ? readFileSync(runner.log, "utf8").trimEnd().split("\n") : [])),
			message: () => Effect.sync(() => outcomeOf(ran(runner)).split("\n\n")[0]),
			outcome: (name?: string) => Effect.sync(() => outcomeOf(name === undefined ? ran(runner) : named(runner, name))),
			results: () =>
				Effect.sync(() => [
					...(runner.last?.moduleErrors ?? []).map((error) => `module error: ${error}`),
					...(runner.last?.stories ?? []).map((result) => `${result.name} [${result.tags.join(", ")}]: ${result.state}`),
					...(runner.last?.warnings ?? []).map((warning) => `stderr: ${warning}`),
				]),
			run: (fixture: Fixture, options: RunOptions = {}) => {
				story.tell(`run the stories in ${fixture}`);
				return run(fixture, options);
			},
			runStory: (fixture: Fixture, name: string, options: RunOptions = {}) => {
				story.tell(`run the story "${name}" from ${fixture}`);
				return run(fixture, { ...options, testNamePattern: exactly(name) }, name);
			},
			shownEngine: () =>
				Effect.sync(() =>
					outcomeOf(ran(runner))
						.split("\n")
						.find((line) => / when the test failed/u.test(line)),
				),
		};
	},
});
