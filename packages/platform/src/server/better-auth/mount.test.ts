import { inspect } from "node:util";
import { expect } from "vitest";
import { applicationRateLimit, environment, mount } from "#test/better-auth/mount.ts";

mount.it("logs a redacted provider failure in the request trace before answering 503", [], function* ({ logs, request, stopAuth }) {
	expect((yield* request()).status).toBe(200);
	expect(logs().filter((log) => log.level === "Error")).toEqual([]);
	yield* stopAuth();
	const traceId = "1234567890abcdef1234567890abcdef";
	expect(yield* request({ traceparent: `00-${traceId}-1234567890abcdef-01` })).toEqual({
		body: "Authentication is temporarily unavailable",
		status: 503,
	});
	expect(logs().filter((log) => log.level === "Error")).toEqual([
		{
			level: "Error",
			message: [
				"Authentication provider failed",
				expect.objectContaining({
					cause: expect.objectContaining({ message: "password=<redacted>" }),
					cookie: "<redacted>",
					message: "Authentication provider is down: token=<redacted>",
				}),
			],
			traceId,
		},
	]);
	expect(inspect(logs(), { depth: 20 })).not.toMatch(/provider-token|database-password|provider-cookie/u);
});

for (const trust of [undefined, "127.0.0.2", "127.0.0.1", "127.0.0.0/8"]) {
	for (const header of ["x-forwarded-for", "x-real-ip"]) {
		mount.it(
			`passes ${header} only from a trusted peer (${trust ?? "unset"})`,
			[
				environment({
					"AUTH_CLIENT_IP_HEADER": header,
					...(trust === undefined ? {} : { "TRUSTED_PROXY": trust }),
				}),
			],
			function* ({ request }) {
				const response = yield* request({ "x-forwarded-for": "198.51.100.10", "x-real-ip": "203.0.113.10" });
				expect(response.status).toBe(200);
				const trusted = trust === "127.0.0.1" || trust === "127.0.0.0/8";
				expect(JSON.parse(response.body)).toEqual({
					forwardedFor: trusted ? "198.51.100.10" : null,
					realIp: trusted || header !== "x-real-ip" ? "203.0.113.10" : null,
				});
			},
		);
	}
}

mount.it("enables rate limits by default even when app options disable them", [], function* ({ request }) {
	expect((yield* request()).status).toBe(200);
	expect((yield* request()).status).toBe(200);
	expect((yield* request()).status).toBe(429);
});

mount.it(
	"disables rate limits through Config",
	[applicationRateLimit(true), environment({ "AUTH_RATE_LIMIT_ENABLED": "false" })],
	function* ({ request }) {
		for (let attempt = 0; attempt < 4; attempt += 1) {
			expect((yield* request()).status).toBe(200);
		}
	},
);

for (const header of ["x-forwarded-for", "x-real-ip"]) {
	mount.it(
		`isolates rate limits by ${header} from a trusted peer`,
		[
			environment({
				"AUTH_CLIENT_IP_HEADER": header,
				"AUTH_RATE_LIMIT_ENABLED": "true",
				"TRUSTED_PROXY": "127.0.0.1",
			}),
		],
		function* ({ request }) {
			const alice = { [header]: "198.51.100.10" };
			expect((yield* request(alice)).status).toBe(200);
			expect((yield* request(alice)).status).toBe(200);
			expect((yield* request(alice)).status).toBe(429);
			expect((yield* request({ [header]: "198.51.100.20" })).status).toBe(200);
		},
	);
}
