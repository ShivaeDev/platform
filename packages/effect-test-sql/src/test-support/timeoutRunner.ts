import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import * as VitestNode from "vitest/node";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { configured } from "./postgres.ts";

export const timeoutRunner = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.promise(() =>
				VitestNode.createVitest(
					{
						config: false,
						hookTimeout: 50,
						include: ["src/test-support/timeoutStories.ts"],
						reporters: [],
						root: fileURLToPath(new URL("../..", import.meta.url)),
						watch: false,
					},
					{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
					{ stderr: new PassThrough(), stdout: new PassThrough() },
				),
			),
			(vitest) => Effect.promise(() => vitest.close()),
		),
	inspect: () => ({}),
	name: "timeout runner",
	runIf: configured,
	stages: [],
	verbs: (vitest) => ({
		run: () =>
			Effect.promise(async () => {
				const { testModules } = await vitest.start();
				return {
					errors: [...testModules.flatMap((module) => module.errors()), ...vitest.state.getUnhandledErrors()],
					stories: testModules.flatMap((module) =>
						[...module.children.allTests()].map((test) => ({
							errors: (test.result().errors ?? []).map((error) => error.message),
							name: test.name,
							state: test.result().state,
						})),
					),
				};
			}),
	}),
});
