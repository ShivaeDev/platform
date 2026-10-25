import { readFileSync } from "node:fs";
import { Effect } from "effect";
import { storyKit } from "#storyKit.ts";
import { LARGE_BAKERY } from "./failureReport.ts";
import { runStories, type StoriesRun } from "./runStories.ts";

export const storyRunner = storyKit({
	clock: "live",
	create: () => ({}),
	name: "story runner",
	stages: [],
	verbs: (_engine, story) => ({
		failure: (name: string) =>
			Effect.promise(async () => {
				story.tell(`run the story "${name}"`);
				const { stories } = await runStories({ include: "src/test-support/failingStories.ts", testNamePattern: name });
				const result = stories.find((candidate) => candidate.name === name);
				return { errors: result?.errors, state: result?.state };
			}),
		genres: (options: Omit<StoriesRun, "include">) =>
			Effect.promise(async () => {
				story.tell("run the genre stories");
				const { moduleErrors, stories, warnings } = await runStories({ include: "src/test-support/genreStories.ts", ...options });
				return [
					...moduleErrors,
					...stories.map((result) => `${result.name} [${result.tags.join(", ")}]: ${result.state}`),
					...warnings.map((warning) => `stderr: ${warning}`),
				];
			}),
		run: (options: StoriesRun) =>
			Effect.promise(() => {
				story.tell(`run the stories in ${options.include}`);
				return runStories(options);
			}),
		writtenBakery: (): unknown => JSON.parse(readFileSync(LARGE_BAKERY, "utf8")),
	}),
});
