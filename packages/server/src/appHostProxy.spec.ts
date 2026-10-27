import { Result } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { AuthUnavailable, Conflict, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { postgresFeature } from "#test/app-host/database.ts";
import { forwarded } from "#test/app-host/options.ts";
import { configuration, environment, host } from "#test/app-host/story.ts";

for (const { config, env, accepted, host: bindAddress, name } of [
	{ accepted: true, config: undefined, env: { "HOST": "0.0.0.0", "TRUSTED_PROXY": "127.0.0.1" }, host: "0.0.0.0", name: "environment" },
	{
		accepted: true,
		config: { host: "0.0.0.0", trustedProxy: "127.0.0.1" },
		env: { "HOST": "127.0.0.1", "TRUSTED_PROXY": "127.0.0.3" },
		host: "0.0.0.0",
		name: "config overrides environment",
	},
	{ accepted: false, config: undefined, env: {}, host: "127.0.0.1", name: "no trust" },
	{ accepted: false, config: { trustedProxy: "127.0.0.2" }, env: { "TRUSTED_PROXY": "127.0.0.1" }, host: "127.0.0.1", name: "wrong configured peer" },
	{ accepted: true, config: undefined, env: { "TRUSTED_PROXY": "127.0.0.0/31" }, host: "127.0.0.1", name: "environment range" },
	{ accepted: true, config: { trustedProxy: "192.0.2.1, 127.0.0.0/31, 2001:db8::/32" }, env: {}, host: "127.0.0.1", name: "configured list" },
	{ accepted: false, config: { trustedProxy: "127.0.0.2/31" }, env: {}, host: "127.0.0.1", name: "peer just outside range" },
]) {
	host.it(
		`forwards real HTTP RPC with ${name}`,
		[postgresFeature, configuration(config ?? {}), environment(env), forwarded],
		function* ({ hostAddress, call, post, lookups }) {
			expect(hostAddress()).toBe(bindAddress);
			const headers = { origin: "https://app.example", "x-forwarded-for": "127.0.0.2" };
			if (!accepted) {
				const refused = yield* call("alice", false, headers);
				expect(Result.isFailure(refused) && refused.failure._tag).toBe("RpcClientError");
				const status = yield* post(headers);
				expect(status).toBe(HttpStatus.fromLiteral("Forbidden"));
				expect(lookups()).toEqual([]);
				return;
			}
			const result = yield* call("alice", false, headers);
			expect(Result.isSuccess(result) && result.success).toBe("Hello, alice");
			for (const [token, reject, expected] of [
				["", false, Unauthorized],
				["alice", true, Conflict],
				["outage", false, AuthUnavailable],
			] as const) {
				const refused = yield* call(token, reject, { origin: "https://app.example" });
				expect(Result.isFailure(refused) && refused.failure).toBeInstanceOf(expected);
			}
			const before = [...lookups()];
			for (const refusedHeaders of [{ origin: "https://elsewhere.example" }, { "content-type": "application/json" }]) {
				const status = yield* post(refusedHeaders);
				expect(status).toBe(HttpStatus.fromLiteral("Forbidden"));
			}
			expect(lookups()).toEqual(before);
		},
	);
}
