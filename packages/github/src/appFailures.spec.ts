import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { GitHubAppError } from "#errors.ts";
import {
	exchangeBadCredentials,
	exchangeDropped,
	exchangeMalformed,
	exchangeOversized,
	exchangeRefused,
	exchangeReset,
	exchangeSuspended,
	lookupDropped,
	lookupRefused,
} from "#test/appFailureTraits.ts";
import { appGithub } from "#test/appGithub.ts";

appGithub.it(
	"an exchange connection failure reaches the caller as transport with the original cause off the wire",
	[exchangeDropped],
	function* ({ appFailures, readPull, transportFailures }) {
		expect(yield* readPull()).toBe("token exchange transport failed");
		const [failure] = yield* appFailures();
		expect(failure).toBeInstanceOf(GitHubAppError);
		expect(failure).toMatchObject({ reason: "transport" });
		expect(Object.getOwnPropertyDescriptor(failure, "cause")).toMatchObject({ enumerable: false, value: expect.anything() });
		expect(failure instanceof GitHubAppError && failure.cause).toBe((yield* transportFailures())[0]);
		expect(JSON.parse(JSON.stringify(failure))).toEqual({ _tag: "GitHubAppError", reason: "transport" });
	},
);

appGithub.it(
	"a connection reset while reading the exchange response remains a transport failure",
	[exchangeReset],
	function* ({ appFailures, readPull }) {
		expect(yield* readPull()).toBe("token exchange transport failed");
		const [failure] = yield* appFailures();
		expect(failure).toMatchObject({ _tag: "GitHubAppError", cause: { _tag: "HttpClientError" }, reason: "transport" });
		expect(Object.getOwnPropertyDescriptor(failure, "cause")).toMatchObject({ enumerable: false });
	},
);

for (const [trait, status, detail] of [
	[exchangeBadCredentials, 401, "Bad credentials"],
	[exchangeSuspended, 403, "This installation has been suspended"],
] as const) {
	appGithub.it(
		`a refused exchange reaches the caller with a status reason, HTTP ${status} and GitHub's message`,
		[trait],
		function* ({ appFailures, readPull }) {
			yield* readPull();

			const [failure] = yield* appFailures();
			expect(failure).toMatchObject({ _tag: "GitHubAppError", detail, reason: "status", status });
			expect(failure instanceof GitHubAppError && failure.message).toBe(`GitHub refused the App request with HTTP ${status}: ${detail}`);
		},
	);
}

appGithub.it(
	"a refused exchange whose message echoes the App JWT carries the message with the JWT redacted",
	[exchangeRefused],
	function* ({ appFailures, credentialsSeenIn, readPull }) {
		yield* readPull();

		yield* outcomes([
			["failures", () => appFailures(), [expect.objectContaining({ detail: "Bearer <redacted> <redacted>", reason: "status", status: 401 })]],
			["credentials seen in", () => credentialsSeenIn(), {}],
		]);
	},
);

for (const [trait, causeTag] of [
	[exchangeMalformed, "SchemaError"],
	[exchangeOversized, "ResponseBodyTooLarge"],
] as const) {
	appGithub.it(`an invalid exchange response retains ${causeTag} under the response reason`, [trait], function* ({ appFailures, readPull }) {
		expect(yield* readPull()).toBe("token exchange response failed");
		const [failure] = yield* appFailures();
		expect(failure).toMatchObject({ _tag: "GitHubAppError", cause: { _tag: causeTag }, reason: "response" });
		expect(Object.getOwnPropertyDescriptor(failure, "cause")).toMatchObject({ enumerable: false });
	});
}

appGithub.it(
	"an unencodable exchange body retains its encoding failure before sending a request",
	[],
	function* ({ appFailures, readWithUnencodableScope, requests }) {
		expect(yield* readWithUnencodableScope()).toBe("token exchange encode failed");
		const [failure] = yield* appFailures();
		expect(failure).toMatchObject({ _tag: "GitHubAppError", cause: { _tag: "HttpBodyError" }, reason: "encode" });
		expect(Object.getOwnPropertyDescriptor(failure, "cause")).toMatchObject({ enumerable: false });
		expect(yield* requests()).toEqual([]);
	},
);

appGithub.it("a signing failure keeps its original crypto cause off the wire", [], function* ({ appFailures, readWithInvalidKey }) {
	yield* readWithInvalidKey();

	const [failure] = yield* appFailures();
	expect(failure).toMatchObject({ _tag: "GitHubAppError", cause: expect.any(Error), reason: "sign" });
	expect(Object.getOwnPropertyDescriptor(failure, "cause")).toMatchObject({ enumerable: false });
});

for (const [trait, expected] of [
	[lookupDropped, { reason: "transport" }],
	[lookupRefused, { detail: "Bad credentials", reason: "status", status: 401 }],
] as const) {
	appGithub.it(
		`an installation lookup failure keeps its ${expected.reason} reason before exchanging a token`,
		[trait],
		function* ({ appFailures, readRepositoryPull }) {
			yield* readRepositoryPull();

			expect(yield* appFailures()).toMatchObject([{ _tag: "GitHubAppError", ...expected }]);
		},
	);
}
