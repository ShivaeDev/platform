import type { PullRequestComment } from "#stickyComments.ts";
import { github } from "./github.ts";

export function pullRequestHasComments(comments: readonly (typeof PullRequestComment.Type)[]) {
	return github.trait("github", "the pull request already has comments", ({ writes }) => {
		writes.comments = [...comments];
	});
}

export const commentWritesForbidden = github.trait("github", "GitHub refuses comment writes", function* ({ server }) {
	yield* server.scriptFault("createComment", { kind: "status", reply: { body: { message: "Resource not accessible by integration" }, status: 403 } });
});
