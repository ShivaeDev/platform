import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cliProcess } from "#test/fleetCli.ts";

export const cliStory = storyKit({
	clock: "live",
	create: () => ({}),
	name: "Fleet CLI",
	stages: [],
	verbs: (_engine, story) => ({
		run: (args: readonly string[]) =>
			Effect.promise(async () => {
				story.tell(`run work-fleet ${args.join(" ")}`);
				let stderr = "";
				const result = await cliProcess(args, {
					onError: (text) => {
						stderr += text;
					},
				});
				return { ...result, stderr };
			}),
	}),
});
