import { Cause, Config } from "effect";
import { expect, expectTypeOf } from "vitest";
import { configuration, serverConfiguration } from "#test/public-config/story.ts";

for (const path of [undefined, "PUBLIC"]) {
	const prefix = path === undefined ? "" : `${path}_`;
	configuration.it(
		`public configuration is decoded on the HTTP client with ${path ?? "root"} configuration`,
		[
			serverConfiguration(
				{ [`${prefix}INSTALL_URL`]: "https://example.com/install", [`${prefix}RETRY_LIMIT`]: "3", "SERVER_SECRET": "private-server-key" },
				{ path },
			),
		],
		function* ({ read, lookups }) {
			const value = yield* read();
			expectTypeOf(value).toEqualTypeOf<{ readonly installUrl: URL; readonly retryLimit: number }>();
			expect(value.installUrl).toBeInstanceOf(URL);
			expect(value.installUrl.href).toBe("https://example.com/install");
			expect(value.retryLimit).toBe(3);
			expect(lookups()).toEqual([]);
		},
	);
}

configuration.it(
	"server-only values and undeclared siblings never appear on the HTTP wire",
	[
		serverConfiguration({
			"INSTALL_URL": "https://example.com/install",
			"RETRY_LIMIT": "5",
			"SERVER_SECRET": "private-server-key",
			"UNDECLARED_URL": "https://private.example.com/admin",
		}),
	],
	function* ({ response }) {
		const { body, status } = yield* response();
		expect(status).toBe(200);
		expect(body).toContain('"INSTALL_URL":"https://example.com/install"');
		expect(body).toContain('"RETRY_LIMIT":"5"');
		for (const privateText of ["SERVER_SECRET", "private-server-key", "UNDECLARED_URL", "https://private.example.com/admin"]) {
			expect(body).not.toContain(privateText);
		}
	},
);

for (const installUrl of [undefined, "not a URL"]) {
	configuration.it(
		`${installUrl === undefined ? "missing" : "invalid"} public configuration fails host startup with ConfigError`,
		[
			serverConfiguration(
				{ ...(installUrl === undefined ? {} : { "INSTALL_URL": installUrl }), "RETRY_LIMIT": "3", "SERVER_SECRET": "private-server-key" },
				{ startupFails: true },
			),
		],
		({ bootFailure }) => {
			const cause = bootFailure();
			if (cause === undefined) {
				throw new Error("The host did not fail startup");
			}
			expect(Cause.squash(cause)).toBeInstanceOf(Config.ConfigError);
		},
	);
}
