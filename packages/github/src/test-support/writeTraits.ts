import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeHttpReply } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { PullRequestComment } from "#stickyComments.ts";
import { github } from "./github.ts";

export function pullRequestHasComments(comments: readonly (typeof PullRequestComment.Encoded)[]) {
	return github.trait("github", "the pull request already has comments", ({ writes }) => {
		writes.comments = [...comments];
	});
}

export function commentWriteRefused(message: string, headers: FakeHttpReply["headers"] = {}) {
	return github.trait("github", `GitHub refuses comment writes: ${message}`, function* ({ server }) {
		yield* server.scriptFault("createComment", {
			kind: "status",
			reply: { body: { message }, headers, status: HttpStatus.fromLiteral("Forbidden") },
		});
	});
}
