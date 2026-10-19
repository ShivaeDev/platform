import { engineIntegrations } from "#test/engineIntegrations.ts";
import { host } from "#test/hostStory.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export function pullRequestWithPendingChecks() {
	return host.trait("configuration", "GitHub holds the delivered PR's checks pending", function* (engine) {
		const github = yield* mergedReviewGithub();
		github.state.pending = true;
		engine.github = github;
		engine.integrations = engineIntegrations(github, []);
	});
}
