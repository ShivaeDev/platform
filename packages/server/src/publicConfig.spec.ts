import { Effect } from "effect";
import { expect, expectTypeOf } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { configuration, serverConfiguration } from "#test/public-config/story.ts";

for (const path of [undefined, "PUBLIC"]) {
	const prefix = path === undefined ? "" : `${path}_`;
	configuration.it(
		`public configuration from ${prefix || "unprefixed "}variables decodes on an HTTP RPC client into a URL and a number without a session lookup`,
		[
			serverConfiguration(
				{ [`${prefix}INSTALL_URL`]: "https://example.com/install", [`${prefix}RETRY_LIMIT`]: "3", "SERVER_SECRET": "private-server-key" },
				{ path },
			),
		],
		function* ({ readPublicConfiguration, sessionLookups }) {
			const value = yield* readPublicConfiguration();

			expectTypeOf(value).toEqualTypeOf<{ readonly installUrl: URL; readonly retryLimit: number }>();
			yield* outcomes({
				"configuration": [
					Effect.succeed({ installUrl: value.installUrl.href, retryLimit: value.retryLimit }),
					{ installUrl: "https://example.com/install", retryLimit: 3 },
				],
				"session lookups": [sessionLookups(), []],
			});
		},
	);
}

configuration.it(
	"the public configuration answer on the wire carries only the declared public values",
	[
		serverConfiguration({
			"INSTALL_URL": "https://example.com/install",
			"RETRY_LIMIT": "5",
			"SERVER_SECRET": "private-server-key",
			"UNDECLARED_URL": "https://private.example.com/admin",
		}),
	],
	function* ({ requestPublicConfiguration, wireAnswers }) {
		yield* requestPublicConfiguration();

		expect(yield* wireAnswers()).toEqual({ "1": { succeeded: { "INSTALL_URL": "https://example.com/install", "RETRY_LIMIT": "5" } } });
	},
);

for (const [problem, installUrl] of [
	["a missing", undefined],
	["an invalid", "not a URL"],
] as const) {
	configuration.it(
		`${problem} public install URL fails host startup with a config error`,
		[
			serverConfiguration(
				{ ...(installUrl === undefined ? {} : { "INSTALL_URL": installUrl }), "RETRY_LIMIT": "3", "SERVER_SECRET": "private-server-key" },
				{ startupFails: true },
			),
		],
		function* ({ startup }) {
			expect(yield* startup()).toBe("failed with config error");
		},
	);
}
