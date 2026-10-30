import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import type { TaskMeta } from "vitest";
import * as VitestNode from "vitest/node";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { configured } from "./postgres.ts";

export type ConsumerStory = "the first story" | "the next story" | "the isolated story";
export type TimeoutStory = "the hanging story" | "the next story";

declare module "vitest" {
	interface TaskMeta {
		consumer?: {
			role: ConsumerStory;
			harness?: readonly string[];
			body?: readonly string[];
			isolated?: { transaction: "open" | "none"; items: readonly string[]; otherConnection: readonly string[] };
		};
		timeout?: { role: TimeoutStory; database: string; wrote: readonly string[]; closedBeforeSetup?: readonly string[] };
	}
}

interface InnerStory {
	readonly meta: TaskMeta;
	readonly outcome: string;
}

interface InnerRun {
	readonly stories: readonly InnerStory[];
	readonly uncaught: readonly string[];
}

function storyOutcome(state: string, errors: readonly { message: string }[]) {
	return errors.some(({ message }) => message.startsWith("Test timed out")) ? "timed out" : state;
}

function runVitest(file: string, hookTimeout?: number) {
	return Effect.acquireUseRelease(
		Effect.promise(() =>
			VitestNode.createVitest(
				{
					config: false,
					...(hookTimeout === undefined ? {} : { hookTimeout }),
					include: [`src/test-support/${file}`],
					reporters: [],
					root: fileURLToPath(new URL("../..", import.meta.url)),
					watch: false,
				},
				{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
				{ stderr: new PassThrough(), stdout: new PassThrough() },
			),
		),
		(vitest) =>
			Effect.promise(async (): Promise<InnerRun> => {
				const { testModules } = await vitest.start();
				return {
					stories: testModules.flatMap((module) =>
						[...module.children.allTests()].map((test) => ({
							meta: test.meta(),
							outcome: storyOutcome(test.result().state, test.result().errors ?? []),
						})),
					),
					uncaught: [...testModules.flatMap((module) => module.errors()), ...vitest.state.getUnhandledErrors()].map(String),
				};
			}),
		(vitest) => Effect.promise(() => vitest.close()),
	);
}

export const vitestRunner = storyKit({
	clock: "live",
	create: () => Effect.succeed<{ run: InnerRun }>({ run: { stories: [], uncaught: [] } }),
	inspect: ({ run }) => run,
	name: "vitest runner",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => {
		function consumer(role: ConsumerStory) {
			return Effect.sync(() => engine.run.stories.find(({ meta }) => meta.consumer?.role === role)?.meta.consumer);
		}
		function timeout(role: TimeoutStory) {
			return Effect.sync(() => engine.run.stories.find(({ meta }) => meta.timeout?.role === role));
		}
		return {
			closedBeforeNextSetup: () =>
				Effect.gen(function* () {
					const hanging = (yield* timeout("the hanging story"))?.meta.timeout?.database;
					const next = (yield* timeout("the next story"))?.meta.timeout?.closedBeforeSetup ?? [];
					return next.map((name) => (name === hanging ? "the hanging story's database" : "another database"));
				}),
			consumerOutcomes: () => Effect.sync(() => engine.run.stories.map(({ outcome }) => outcome)),
			isolatedBlockSaw: (what: "a transaction" | "its starting items" | "another connection") =>
				Effect.map(consumer("the isolated story"), (meta) => {
					const isolated = meta?.isolated;
					if (what === "a transaction") {
						return isolated?.transaction;
					}
					return what === "its starting items" ? isolated?.items : isolated?.otherConnection;
				}),
			itemsSeen: (role: ConsumerStory, when: "harness" | "body") => Effect.map(consumer(role), (meta) => meta?.[when]),
			runConsumerStories: () => {
				story.tell("Vitest runs a rollback consumer's stories in one file");
				return Effect.map(runVitest("vitestConsumer.ts"), (run) => {
					engine.run = run;
				});
			},
			runTimeoutStories: () => {
				story.tell("Vitest runs a story that hangs past its timeout with a job worker running, then the next story");
				return Effect.map(runVitest("timeoutStories.ts", 50), (run) => {
					engine.run = run;
				});
			},
			timeoutStoryOutcome: (role: TimeoutStory) => Effect.map(timeout(role), (inner) => inner?.outcome),
			uncaughtErrors: () => Effect.sync(() => engine.run.uncaught),
			workerWrote: (role: TimeoutStory) => Effect.map(timeout(role), (inner) => inner?.meta.timeout?.wrote),
		};
	},
});
