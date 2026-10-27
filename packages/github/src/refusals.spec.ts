import { DateTime, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { RemoteHttpError } from "@shivaedev/http/errors.ts";
import { GitHubConversationLocked, GitHubPermissionDenied, GitHubRateLimited } from "#errors.ts";
import { budgetHeaders } from "#test/budgetHeaders.ts";
import { github } from "#test/github.ts";
import { commentWriteRefused } from "#test/writeTraits.ts";

github.it(
	"an integration permission refusal has its own typed outcome",
	[commentWriteRefused("Resource not accessible by integration")],
	function* ({ upsertComment, readComments }) {
		const error = yield* Effect.flip(upsertComment({ body: "Coverage: 90%", marker: "coverage" }));
		expect(error).toEqual(new GitHubPermissionDenied({ path: "/repos/acme/widgets/issues/1/comments" }));
		expect(yield* readComments()).toEqual([]);
	},
);

github.it("a locked conversation has its own typed outcome", [commentWriteRefused("Conversation is locked")], function* ({ upsertComment }) {
	const error = yield* Effect.flip(upsertComment({ body: "Coverage: 90%", marker: "coverage" }));
	expect(error).toEqual(new GitHubConversationLocked({ path: "/repos/acme/widgets/issues/1/comments" }));
});

github.it("an unrelated 403 remains an HTTP error", [commentWriteRefused("Forbidden")], function* ({ upsertComment }) {
	const error = yield* Effect.flip(upsertComment({ body: "Coverage: 90%", marker: "coverage" }));
	expect(error).toBeInstanceOf(RemoteHttpError);
	expect(error).toMatchObject({ status: HttpStatus.fromLiteral("Forbidden") });
});

github.it(
	"an exhausted primary budget takes precedence over a permission message",
	[commentWriteRefused("Resource not accessible by integration", budgetHeaders("core", 0, 120))],
	function* ({ upsertComment }) {
		const error = yield* Effect.flip(upsertComment({ body: "Coverage: 90%", marker: "coverage" }));
		expect(error).toEqual(new GitHubRateLimited({ resource: "core", retryAt: DateTime.makeUnsafe(120_000) }));
	},
);

github.it(
	"a secondary rate-limit 403 remains a rate-limit outcome",
	[commentWriteRefused("You have exceeded a secondary rate limit")],
	function* ({ upsertComment }) {
		const error = yield* Effect.flip(upsertComment({ body: "Coverage: 90%", marker: "coverage" }));
		expect(error).toEqual(new GitHubRateLimited({ resource: "core", retryAt: DateTime.makeUnsafe(60_000) }));
	},
);
