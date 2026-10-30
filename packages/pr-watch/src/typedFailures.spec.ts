import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { reads, replies } from "#test/github.ts";
import { githubAnswers, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const [answer, kind] of [
	[replies.status(HttpStatus.fromLiteral("Unauthorized")), "RemoteUnauthorized"],
	[replies.status(HttpStatus.fromLiteral("NotFound")), "RemoteNotFound"],
	[replies.status(HttpStatus.fromLiteral("ServiceUnavailable")), "RemoteHttpError"],
	[replies.statusWithRetryAfter(HttpStatus.fromLiteral("TooManyRequests"), 120), "GitHubRateLimited"],
	[
		{
			description: "an integration refusal",
			reply: { body: { message: "Resource not accessible by integration" }, status: HttpStatus.fromLiteral("Forbidden") },
		},
		"GitHubPermissionDenied",
	],
	[
		{ description: "a locked conversation", reply: { body: { message: "Conversation is locked" }, status: HttpStatus.fromLiteral("Forbidden") } },
		"GitHubConversationLocked",
	],
] as const) {
	watch.it(
		`a poll preserves ${kind} for callers`,
		[openPr(1), watching(1), githubAnswers(reads.detail(1), answer)],
		function* ({ failureKind, poll }) {
			yield* poll();

			expect(yield* failureKind()).toBe(kind);
		},
	);
}

watch.it(
	"the CLI program reports GitHub's permission failure tag in its health output",
	[
		openPr(1),
		watching(1),
		githubAnswers(reads.detail(1), {
			description: "an integration refusal",
			reply: { body: { message: "Resource not accessible by integration" }, status: HttpStatus.fromLiteral("Forbidden") },
		}),
	],
	function* ({ errorKinds, runOnce }) {
		yield* runOnce();

		expect(yield* errorKinds()).toEqual(["GitHubPermissionDenied"]);
	},
);
