import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import type { ViteUserConfig } from "vitest/config";
import * as VitestNode from "vitest/node";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const {
	default: { test: _test, ...viteConfig },
}: { readonly default: ViteUserConfig } = createRequire(import.meta.url)(fileURLToPath(new URL("../../vitest.config.ts", import.meta.url)));

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
					viteConfig,
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
