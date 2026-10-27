import { Cause, Config } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { cachedBody, echoRpc, message } from "#test/app-host/body.ts";
import { configuration, environment, host, startupFails } from "#test/app-host/story.ts";

for (const { config, env, limit, name } of [
	{ config: undefined, env: {}, limit: 1024 * 1024, name: "the 1 MiB default" },
	{ config: undefined, env: { "MAX_BODY_SIZE": "256" }, limit: 256, name: "the environment limit" },
	{ config: 128, env: { "MAX_BODY_SIZE": "256" }, limit: 128, name: "config overriding the environment" },
	{ config: 2 * 1024 * 1024, env: {}, limit: 2 * 1024 * 1024, name: "config raising the default" },
]) {
	host.it(
		`bounds real HTTP NDJSON with ${name} before any handler runs`,
		[echoRpc, environment(env), configuration(config === undefined ? {} : { maxBodySize: config })],
		function* ({ postNdjson, calls, clearCalls }) {
			const overhead = Buffer.byteLength(message(""));
			const accepted = "é".repeat(Math.floor((limit - overhead) / 2));
			const oversized = message("small") + message("é".repeat(Math.ceil(limit / 2)), "2");
			expect(Buffer.byteLength(message(accepted))).toBeLessThanOrEqual(limit);
			for (const chunked of [false, true]) {
				clearCalls();
				const refused = yield* postNdjson(oversized, chunked);
				expect(refused.status).toBeGreaterThanOrEqual(HttpStatus.fromLiteral("BadRequest"));
				expect(refused.status).toBeLessThan(HttpStatus.fromLiteral("InternalServerError"));
				expect(calls()).toEqual([]);
				const response = yield* postNdjson(message(accepted), chunked);
				expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
				expect(response.body).toContain("accepted");
				expect(calls()).toEqual([accepted]);
			}
		},
	);
}
host.it("the bounded reader retains cached text and array-buffer reads", [cachedBody], function* ({ request }) {
	const body = '{"text":"é"}';
	const response = yield* request("/body", { body, method: "POST" });
	expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(response.body).toBe(`${body}\n${body}\n${body}`);
});
for (const maxBodySize of [-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
	for (const source of ["config", "environment"]) {
		host.it(
			`rejects invalid byte limits at startup from ${source}: ${maxBodySize}`,
			[startupFails, source === "config" ? configuration({ maxBodySize }) : environment({ "MAX_BODY_SIZE": String(maxBodySize) })],
			({ bootFailure }) => {
				expect(Cause.squash(bootFailure())).toBeInstanceOf(Config.ConfigError);
			},
		);
	}
}
