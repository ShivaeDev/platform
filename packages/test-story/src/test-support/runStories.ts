import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import * as VitestNode from "vitest/node";
import type { GenreTag } from "#genreTags.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));

export interface StoriesRun {
	readonly allowOnly?: boolean;
	readonly environment?: string;
	readonly include: string;
	readonly tags?: readonly GenreTag[];
	readonly tagsFilter?: string[];
	readonly testNamePattern?: string;
}

export interface StoryResult {
	readonly diffs?: readonly (string | undefined)[];
	readonly errors: readonly string[];
	readonly name: string;
	readonly state: string;
	readonly tags: readonly string[];
}

export interface StoriesOutcome {
	readonly moduleErrors: readonly string[];
	readonly stories: readonly StoryResult[];
	readonly warnings: readonly string[];
}

export async function runStories({
	allowOnly = false,
	environment,
	include,
	tags = [],
	tagsFilter = [],
	testNamePattern,
}: StoriesRun): Promise<StoriesOutcome> {
	const stderr = new PassThrough();
	const warnings: string[] = [];
	stderr.on("data", (chunk: Buffer) => warnings.push(chunk.toString()));
	const vitest = await VitestNode.createVitest(
		{
			allowOnly,
			config: false,
			...(environment === undefined ? {} : { environment }),
			include: [include],
			reporters: [],
			root,
			tags: [...tags],
			tagsFilter,
			watch: false,
			...(testNamePattern === undefined ? {} : { testNamePattern }),
		},
		{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
		{ stderr, stdout: new PassThrough() },
	);
	try {
		const { testModules } = await vitest.start();
		return {
			moduleErrors: [
				...testModules.flatMap((module) => module.errors().map((error) => error.message)),
				...vitest.state.getUnhandledErrors().map((error) => (error instanceof Error ? error.message : String(error))),
			],
			stories: testModules.flatMap((module) =>
				[...module.children.allTests()].map((test) => ({
					...(test.result().errors?.length ? { diffs: (test.result().errors ?? []).map((error) => error.diff) } : {}),
					errors: (test.result().errors ?? []).map((error) => error.message),
					name: test.name,
					state: test.result().state,
					tags: test.tags,
				})),
			),
			warnings,
		};
	} finally {
		await vitest.close();
	}
}
