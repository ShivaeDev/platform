import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readReviewerVerdict } from "#prompt/reviewer.ts";
import { cloudThread, SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { providerSessionOptions } from "#test/providerSessionStory.ts";
import { reviewerNetwork } from "#test/reviewerNetwork.ts";

function reviewerReply<TRequest extends { readonly method: string }>(request: TRequest, network: (request: TRequest) => unknown) {
	switch (request.method) {
		case "thread/start":
			return { thread: { id: "reviewer" } };
		case "thread/read":
			return cloudThread();
		default:
			return network(request);
	}
}

export const reviewerSessions = storyKit({
	...providerSessionOptions,
	name: "read-only reviewer sessions",
	verbs: (state, story) => {
		const verbs = providerSessionOptions.verbs(state, story);
		const review = reviewerNetwork(story.tell);
		return {
			...verbs,
			commands: () => Effect.sync(() => review.commands()),
			reviewerReadsEvidence: Effect.fn("Story.reviewerReadsEvidence")(function* () {
				const head = JSON.parse(yield* review.head()).headRefOid;
				const diff = yield* review.diff();
				const checks = yield* review.checks();
				review.answer(head, [diff, ...checks.evidence]);
			}),
			startReview: () =>
				Effect.suspend(() => {
					state.reply = (request) => reviewerReply(request, review.reply);
					return verbs.sessions.start({ access: "read-only", cwd: SYNTHETIC_WORKSPACE, operationId: "review", prompt: review.prompt });
				}),
			verdict: Effect.fn("Story.verdict")(function* (receipt: { readonly sessionId: string; readonly turnId: string }) {
				story.tell("read the reviewer's verdict");
				const observation = yield* verbs.sessions.observe(receipt);
				return yield* readReviewerVerdict(observation.output, receipt);
			}),
		};
	},
});

export function reviewerProvider(cloud: boolean) {
	return reviewerSessions.trait("configuration", `the reviewer uses ${cloud ? "Cloud" : "local Codex"}`, (state) => {
		state.cloud = cloud;
	});
}
