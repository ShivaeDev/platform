import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { remoteExplains, remoteExplainsAndHoldsOpen } from "#test/http-client/answers.ts";
import { httpClient, usingClient } from "#test/http-client/story.ts";

const BadRequest = HttpStatus.fromLiteral("BadRequest");

for (const transport of ["fetch", "node"] as const) {
	httpClient.it(
		`${transport}: a 400 explained as {"error":"invalid_grant"} carries that text in its failure excerpt and message`,
		[usingClient(transport), remoteExplains(BadRequest, '{"error":"invalid_grant"}')],
		function* ({ failureExcerpt, failureMessage, post, remoteHost }) {
			yield* post();

			yield* outcomes([
				["failure excerpt", failureExcerpt, '{"error":"invalid_grant"}'],
				["failure message", failureMessage, `HTTP 400: POST ${yield* remoteHost()}/answer: {"error":"invalid_grant"}`],
			]);
		},
	);
}

httpClient.it(
	"a 400 body of 3000 bytes held open is cut at 2048 bytes without waiting for the rest",
	[remoteExplainsAndHoldsOpen(BadRequest, "a ".repeat(1500), '"a " 1500 times')],
	function* ({ failureExcerpt, post }) {
		const result = yield* post();

		yield* outcomes([
			["failure", () => Effect.succeed(result), "HTTP 400"],
			["failure excerpt", failureExcerpt, `${"a ".repeat(1023).trim()}…`],
		]);
	},
);

for (const [body, excerpt] of [
	['{"error":"invalid_grant","access_token":"tok-private"}', '{"error":"invalid_grant","access_token":"<redacted>"}'],
	["credential Bearer tok-private was rejected", "credential Bearer <redacted> was rejected"],
	[
		String.raw`{"error":"upstream said {\"access_token\":\"tok-private\",\"detail\":\"expired\"}"}`,
		String.raw`{"error":"upstream said {\"access_token\":\"<redacted>\",\"detail\":\"expired\"}"}`,
	],
] as const) {
	httpClient.it(
		`a 400 explained as ${body} masks the secret in its failure excerpt`,
		[remoteExplains(BadRequest, body)],
		function* ({ failureExcerpt, post }) {
			yield* post();

			expect(yield* failureExcerpt()).toBe(excerpt);
		},
	);
}

httpClient.it(
	"a 400 with a binary body fails without an excerpt",
	[remoteExplains(BadRequest, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]), "of 6 PNG-like bytes")],
	function* ({ failureExcerpt, post }) {
		const result = yield* post();

		yield* outcomes([
			["failure", () => Effect.succeed(result), "HTTP 400"],
			["failure excerpt", failureExcerpt, "no excerpt"],
		]);
	},
);

httpClient.it(
	"a 400 whose body never ends still fails as HTTP 400, without an excerpt, once the one-second excerpt deadline passes",
	[remoteExplainsAndHoldsOpen(BadRequest, '{"error":', '{"error":')],
	function* ({ failureExcerpt, postUntilExcerptDeadline }) {
		const result = yield* postUntilExcerptDeadline();

		yield* outcomes([
			["failure", () => Effect.succeed(result), "HTTP 400"],
			["failure excerpt", failureExcerpt, "no excerpt"],
		]);
	},
);

httpClient.it(
	"a 400 whose body the remote resets still fails as HTTP 400 without an excerpt",
	[remoteExplainsAndHoldsOpen(BadRequest, '{"error":', '{"error":')],
	function* ({ failureExcerpt, postAndRemoteResetsBody }) {
		const result = yield* postAndRemoteResetsBody();

		yield* outcomes([
			["failure", () => Effect.succeed(result), "HTTP 400"],
			["failure excerpt", failureExcerpt, "no excerpt"],
		]);
	},
);

httpClient.it(
	"a 400 whose body the caller already read still fails as HTTP 400 without an excerpt",
	[remoteExplains(BadRequest, '{"error":"invalid_grant"}')],
	function* ({ checkResponseAfterReadingText }) {
		expect(yield* checkResponseAfterReadingText()).toBe("HTTP 400, no excerpt");
	},
);
