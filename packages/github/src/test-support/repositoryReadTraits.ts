import type { FakeHttpReply } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { github } from "./github.ts";
import { repositoryFixtures } from "./repositoryFixtures.ts";

export const dailyRepositoryReads = github.trait(
	"github",
	"GitHub has an issue, a renamed file, a commit, a recursive tree and Alice's access",
	({ readReplies }) => {
		for (const [path, body] of repositoryFixtures) {
			readReplies.set(path, { body });
		}
		const firstFiles = readReplies.get("/repos/acme/widgets/pulls/3/files?per_page=100");
		readReplies.set("/repos/acme/widgets/pulls/3/files?per_page=100", {
			...firstFiles,
			headers: { Link: '</repos/acme/widgets/pulls/3/files?per_page=100&page=2>; rel="next"' },
		});
	},
);

export function githubAnswers(path: string, reply: FakeHttpReply) {
	return github.trait("github", `GitHub answers ${path} with the supplied representation`, ({ readReplies }) => {
		readReplies.set(path, reply);
	});
}
