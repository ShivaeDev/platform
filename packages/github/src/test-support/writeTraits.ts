import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeHttpReply } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { PullRequestComment } from "#stickyComments.ts";
import { github } from "./github.ts";
import type { CheckOnGitHub } from "./pullRequestWrites.ts";

export const HEAD = "a".repeat(40);

export function pullRequestHasComments(description: string, comments: readonly (typeof PullRequestComment.Encoded)[]) {
	return github.trait("github", `pull request 1 already has ${description}`, ({ writes }) => {
		writes.comments = [...comments];
	});
}

export function commentWriteRefused(message: string, headers: FakeHttpReply["headers"] = {}) {
	return github.trait("github", `GitHub refuses new comments on pull request 1 with 403 "${message}"`, function* ({ server }) {
		yield* server.scriptFault("createComment", {
			kind: "status",
			reply: { body: { message }, headers, status: HttpStatus.fromLiteral("Forbidden") },
		});
	});
}

function check(status: "queued" | "in_progress", output: CheckOnGitHub["output"]): CheckOnGitHub {
	return { conclusion: null, detailsUrl: null, headSha: HEAD, id: 1, name: "Coverage", output, status };
}

export const coverageCheckQueued = github.trait("github", "GitHub holds check 1, a queued Coverage check", ({ writes }) => {
	writes.checks = [check("queued", { summary: null, text: null, title: null })];
});

export const coverageCheckRunning = github.trait("github", "GitHub holds check 1, a Coverage check in progress while measuring", ({ writes }) => {
	writes.checks = [check("in_progress", { summary: "Measuring", text: null, title: "Coverage" })];
});
