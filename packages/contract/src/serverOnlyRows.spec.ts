import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { serverOnlyRows } from "#test/serverOnlyRows.ts";

serverOnlyRows.it(
	"a hand-written contract that sends the stored credential class fails to encode it: the HTTP client receives a defect naming the server-only digest's path, no response body carries the digest, and the server's report names the path without the digest",
	[],
	function* ({ call, sentBodiesHoldTheDigest, serverDiagnostics }) {
		const answer = yield* call("storedRow");

		yield* outcomes([
			[
				"answer names the RPC",
				() => Effect.succeed(answer.startsWith('died: Error: Failed to encode response for RPC "credentials.storedRow"')),
				true,
			],
			["answer names the digest's path", () => Effect.succeed(answer.includes('encode Redacted\n  at ["value"]["digest"]')), true],
			["answer holds the digest", () => Effect.succeed(answer.includes("digest-of-alice")), false],
			["response bodies hold the digest", () => sentBodiesHoldTheDigest(), false],
			[
				"server reports the encode failure at the digest's path",
				() =>
					Effect.map(serverDiagnostics(), (entries) =>
						entries.some((entry) => entry.includes("credentials.storedRow") && entry.includes('["digest"]')),
					),
				true,
			],
			[
				"server diagnostics hold the digest",
				() => Effect.map(serverDiagnostics(), (entries) => entries.some((entry) => entry.includes("digest-of-alice"))),
				false,
			],
		]);
	},
);

serverOnlyRows.it(
	"a handler that returns the stored credential typed as a public struct sends only the public fields",
	[],
	function* ({ call, sentBodiesHoldTheDigest }) {
		const answer = yield* call("castRow");

		expect(answer).toBe('{"id":1,"owner":"alice"}');
		expect(yield* sentBodiesHoldTheDigest()).toBe(false);
	},
);

for (const [operation, received] of [
	["sensitiveRedactedRow", "Redacted(digest-of-alice)"],
	["sensitiveRow", "digest-of-alice"],
] as const) {
	serverOnlyRows.it(
		`${operation} sends its Model.Sensitive digest as plain text, because only serverOnly makes the class refuse to encode it`,
		[],
		function* ({ call, sentBodiesHoldTheDigest }) {
			const answer = yield* call(operation);

			expect(answer).toBe(`{"digest":"${received}","id":1,"owner":"alice"}`);
			expect(yield* sentBodiesHoldTheDigest()).toBe(true);
		},
	);
}
