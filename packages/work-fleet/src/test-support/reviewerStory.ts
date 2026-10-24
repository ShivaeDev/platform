import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { providerSessionOptions } from "#test/providerSessionStory.ts";
import { reviewerNetwork } from "#test/reviewerNetwork.ts";

export const reviewerSessions = storyKit({
	...providerSessionOptions,
	name: "read-only reviewer sessions",
	verbs: (state, story) => ({
		...providerSessionOptions.verbs(state, story),
		review: reviewerNetwork(story.tell),
	}),
});

export function reviewerProvider(cloud: boolean) {
	return reviewerSessions.trait("configuration", `the reviewer uses ${cloud ? "Cloud" : "local Codex"}`, (state) => {
		state.cloud = cloud;
	});
}
