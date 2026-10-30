import { expect } from "vitest";
import { GitHubAppError } from "#errors.ts";
import { exchangeDropped, exchangeMalformed, exchangeOversized, exchangeReset, lookupDropped, lookupRefused } from "#test/appFailureTraits.ts";
import { appGithub, exchangeRefused } from "#test/appGithub.ts";

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

appGithub.it("a refused exchange reaches the caller with a status reason and HTTP 401", [exchangeRefused], function* ({ appFailures, readPull }) {
	yield* readPull();

	expect(yield* appFailures()).toMatchObject([{ _tag: "GitHubAppError", reason: "status", status: 401 }]);
});

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
	[lookupRefused, { reason: "status", status: 401 }],
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
