import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { VitestRunner } from "#adapters/VitestRunner.ts";
import { runAttempt } from "#internal/runAttempt.ts";

export const argumentStory = storyKit({
	create: () => Effect.void,
	layer: NodeServices.layer,
	name: "Vitest arguments",
	stages: [],
	verbs: (_, story) => ({
		attempt: (...vitestArgs: string[]) => {
			story.tell(`an attempt runs with ${vitestArgs.join(" ")}`);
			return runAttempt({ attempt: 1, outputDir: ".", vitestArgs }).pipe(
				Effect.provide(VitestRunner.layer),
				Effect.match({ onFailure: (error) => `${error._tag}: ${error.message}`, onSuccess: () => "completed" }),
			);
		},
	}),
});
