import { engineIntegrations } from "#test/engineIntegrations.ts";
import { host } from "#test/hostStory.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export const humanDelivery = host.trait("configuration", "a pull request waits for a human merge", function* (engine) {
	engine.pullRequest = yield* mergedReviewGithub();
	engine.integrations = engineIntegrations(engine.pullRequest, []);
});
