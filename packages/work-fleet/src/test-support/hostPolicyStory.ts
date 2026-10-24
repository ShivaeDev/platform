import { NodeServices } from "@effect/platform-node";
import { FileSystem, Path } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostGuidanceVerbs } from "#test/hostGuidanceVerbs.ts";
import { hostPolicyVerbs } from "#test/hostPolicyVerbs.ts";

export const hostPolicyStory = storyKit({
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = yield* fs.makeTempDirectoryScoped();
		return { fs, path, root };
	},
	layer: NodeServices.layer,
	name: "Fleet host policy",
	stages: [],
	verbs: (state, story) => ({ ...hostGuidanceVerbs(state, story.tell), ...hostPolicyVerbs(story.tell) }),
});
