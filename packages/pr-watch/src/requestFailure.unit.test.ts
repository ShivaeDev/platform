import { DateTime } from "effect";
import { expect, it } from "vitest";
import { GitHubPermissionDenied, GitHubRateLimited, GitHubTransportError } from "@shivaedev/github/errors.ts";
import { WatchError } from "#model.ts";
import { requestFailure } from "#requestFailure.ts";

it.each([
	[new WatchError({ message: "GitHub network error", reason: "response" }), false],
	[new GitHubTransportError({ path: "/pulls/1" }), true],
	[new GitHubPermissionDenied({ path: "/pulls/1" }), false],
])("retry policy uses the failure class and reason when messages name another failure", (error, retryable) => {
	Object.defineProperty(error, "message", { value: "GitHub rate limit (core)" });

	expect(requestFailure(error).retryable).toBe(retryable);
});

it("rate-limit retry metadata retains GitHub's retry instant", () => {
	const retryAt = DateTime.makeUnsafe("2026-10-30T12:00:00Z");

	expect(requestFailure(new GitHubRateLimited({ resource: "graphql", retryAt }))).toEqual({
		message: "GitHub rate limit (graphql)",
		retryAt: DateTime.toEpochMillis(retryAt),
		retryable: true,
	});
});
