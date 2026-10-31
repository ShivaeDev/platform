import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { postgresFeature } from "#test/app-host/database.ts";
import { forwarded } from "#test/app-host/options.ts";
import { configuration, environment, host } from "#test/app-host/story.ts";

const fromTheApp = { origin: "https://app.example", "x-forwarded-for": "127.0.0.2" };

for (const { bind, config, env, name } of [
	{ bind: "127.0.0.1", config: {}, env: {}, name: "by default" },
	{ bind: "0.0.0.0", config: {}, env: { "HOST": "0.0.0.0", "TRUSTED_PROXY": "127.0.0.1" }, name: "from HOST" },
	{ bind: "0.0.0.0", config: { host: "0.0.0.0", trustedProxy: "127.0.0.1" }, env: { "HOST": "127.0.0.1" }, name: "from config over HOST" },
]) {
	host.it(`a session host binds ${bind} ${name}`, [postgresFeature, configuration(config), environment(env)], function* ({ bindAddress }) {
		expect(yield* bindAddress()).toBe(bind);
	});
}

for (const { config, env, name } of [
	{ config: {}, env: { "TRUSTED_PROXY": "127.0.0.1" }, name: "TRUSTED_PROXY naming the proxy" },
	{ config: { trustedProxy: "127.0.0.1" }, env: { "TRUSTED_PROXY": "127.0.0.3" }, name: "config.trustedProxy overriding TRUSTED_PROXY" },
	{ config: {}, env: { "TRUSTED_PROXY": "127.0.0.0/31" }, name: "a TRUSTED_PROXY range containing the proxy" },
	{ config: { trustedProxy: "192.0.2.1, 127.0.0.0/31, 2001:db8::/32" }, env: {}, name: "a configured list containing the proxy" },
]) {
	host.it(
		`a forwarded RPC from the app's origin answers through a proxy trusted by ${name}`,
		[postgresFeature, configuration(config), environment(env), forwarded],
		function* ({ greet }) {
			expect(yield* greet("alice", fromTheApp)).toBe("Hello, alice");
		},
	);
}

for (const { config, env, name } of [
	{ config: {}, env: {}, name: "no proxy trust" },
	{
		config: { trustedProxy: "127.0.0.2" },
		env: { "TRUSTED_PROXY": "127.0.0.1" },
		name: "config.trustedProxy naming another peer over TRUSTED_PROXY",
	},
	{ config: { trustedProxy: "127.0.0.2/31" }, env: {}, name: "a configured range just past the proxy" },
]) {
	host.it(
		`a forwarded RPC post is forbidden before any session lookup with ${name}`,
		[postgresFeature, configuration(config), environment(env), forwarded],
		function* ({ postRpc, responseStatus, sessionLookups }) {
			yield* postRpc(fromTheApp);

			yield* outcomes({
				"response status": [responseStatus(), HttpStatus.fromLiteral("Forbidden")],
				"session lookups": [sessionLookups(), []],
			});
		},
	);
}

host.it(
	"a trusted proxy still forbids a forwarded RPC post from a foreign origin before any session lookup",
	[postgresFeature, environment({ "TRUSTED_PROXY": "127.0.0.1" }), forwarded],
	function* ({ postRpc, responseStatus, sessionLookups }) {
		yield* postRpc({ origin: "https://elsewhere.example" });

		yield* outcomes({
			"response status": [responseStatus(), HttpStatus.fromLiteral("Forbidden")],
			"session lookups": [sessionLookups(), []],
		});
	},
);
