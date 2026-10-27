import { Clock } from "effect";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import { host } from "#test/hostStory.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { statusRecord } from "#test/status.ts";

export const recentDeliveredId = host.trait("configuration", "one has an earlier delivered record", function* (engine) {
	engine.stored.one = {
		...statusRecord("one", "done"),
		boardSourcePath: "/earlier/brief.md",
		completedAt: yield* Clock.currentTimeMillis,
		result: { head: HEAD, kind: "change", paths: ["src/one.ts"], pr: PR },
	};
});

export const previouslyMergedBranch = host.trait("configuration", "the id branch has an earlier merged PR", function* (engine) {
	const github = yield* mergedReviewGithub();
	github.state.status = "MERGED";
	engine.pullRequest = github;
	engine.integrations = engineIntegrations({ ...github, publicationQuery: github.publication }, []);
});
