import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import * as VitestNode from "vitest/node";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

export const sessionCleanup = storyKit({
	clock: "live",
	create: () => ({}),
	name: "session cleanup",
	stages: [],
	verbs: (_engine, story) => ({
		run: () =>
			Effect.promise(async () => {
				story.tell("run the session subscription file through DOM teardown");
				const vitest = await VitestNode.createVitest(
					{
						config: false,
						environment: fileURLToPath(new URL("./sessionCleanupEnvironment.config.ts", import.meta.url)),
						include: ["src/test-support/sessionCleanupStories.ts"],
						reporters: [],
						root: fileURLToPath(new URL("../..", import.meta.url)),
						watch: false,
					},
					{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
					{ stderr: new PassThrough(), stdout: new PassThrough() },
				);
				const { testModules } = await vitest.start().finally(() => vitest.close());
				return {
					errors: [...testModules.flatMap((module) => module.errors()), ...vitest.state.getUnhandledErrors()],
					tests: testModules.flatMap((module) => [...module.children.allTests()].map((test) => ({ name: test.name, result: test.result() }))),
				};
			}),
	}),
});
