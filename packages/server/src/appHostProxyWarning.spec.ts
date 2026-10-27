import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { configuration, environment, host, sessionPolicy } from "#test/app-host/story.ts";

for (const source of ["environment", "config"]) {
	host.it(
		`warns once when session RPC binds a non-loopback host without trust (${source})`,
		[sessionPolicy, source === "config" ? configuration({ host: "0.0.0.0" }) : environment({ "HOST": "0.0.0.0" })],
		function* ({ logs, post }) {
			const warnings = logs().filter(({ level }) => level === "Warn");
			expect(warnings).toEqual([expect.objectContaining({ message: [expect.stringMatching(/TRUSTED_PROXY.*config\.trustedProxy/u)] })]);
			const status = yield* post({ host: "app.example", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" });
			expect(status).toBe(HttpStatus.fromLiteral("Forbidden"));
			expect(logs().filter(({ level }) => level === "Warn")).toEqual(warnings);
		},
	);
}

for (const [name, traits] of [
	["default loopback", [sessionPolicy]],
	["localhost", [sessionPolicy, configuration({ host: "localhost" })]],
	["IPv6 loopback", [sessionPolicy, configuration({ host: "::1" })]],
	["IPv4-mapped loopback", [sessionPolicy, configuration({ host: "::ffff:127.0.0.1" })]],
	["IPv4 loopback range", [sessionPolicy, configuration({ host: "127.0.0.2" })]],
	["loopback policy", [configuration({ host: "0.0.0.0" })]],
	["environment proxy", [sessionPolicy, environment({ "HOST": "0.0.0.0", "TRUSTED_PROXY": "127.0.0.1" })]],
	["configured proxy", [sessionPolicy, configuration({ host: "0.0.0.0", trustedProxy: "127.0.0.1" })]],
	["configured host overrides HOST", [sessionPolicy, configuration({ host: "127.0.0.1" }), environment({ "HOST": "0.0.0.0" })]],
] as const) {
	host.it(`starts without a proxy warning (${name})`, traits, function* ({ logs }) {
		expect(logs().filter(({ level }) => level === "Warn")).toEqual([]);
	});
}
