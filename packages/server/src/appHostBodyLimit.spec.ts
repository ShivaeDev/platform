import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { cachedBody, echoRpc, largestAcceptedMessage, oversizedBatch } from "#test/app-host/body.ts";
import { configuration, environment, host, startupFails } from "#test/app-host/story.ts";

for (const { config, env, limit, name } of [
	{ config: {}, env: {}, limit: 1024 * 1024, name: "the 1 MiB default" },
	{ config: {}, env: { "MAX_BODY_SIZE": "256" }, limit: 256, name: "MAX_BODY_SIZE" },
	{ config: { maxBodySize: 128 }, env: { "MAX_BODY_SIZE": "256" }, limit: 128, name: "config.maxBodySize over MAX_BODY_SIZE" },
	{ config: { maxBodySize: 2 * 1024 * 1024 }, env: {}, limit: 2 * 1024 * 1024, name: "config.maxBodySize above the default" },
]) {
	for (const chunked of [false, true]) {
		const transfer = chunked ? "chunked" : "content-length";
		host.it(
			`a ${transfer} NDJSON batch over ${name} is refused with a client error before any handler runs`,
			[echoRpc, environment(env), configuration(config)],
			function* ({ handledCalls, postNdjson, responseKind }) {
				yield* postNdjson(oversizedBatch(limit), { chunked });

				yield* outcomes({
					"handled calls": [handledCalls(), []],
					"response": [responseKind(), "client error"],
				});
			},
		);

		host.it(
			`a ${transfer} NDJSON message filling ${name} reaches its handler`,
			[echoRpc, environment(env), configuration(config)],
			function* ({ handledCalls, postNdjson }) {
				const message = largestAcceptedMessage(limit);

				yield* postNdjson(message.body, { chunked });

				expect(yield* handledCalls()).toEqual([message.text]);
			},
		);
	}
}

host.it("the bounded RPC request reader serves cached text and array-buffer reads of one body", [cachedBody], function* ({ request }) {
	expect(yield* request("/body", { body: '{"text":"é"}', method: "POST" })).toMatchObject({
		body: '{"text":"é"}\n{"text":"é"}\n{"text":"é"}',
		status: HttpStatus.fromLiteral("OK"),
	});
});

for (const maxBodySize of [-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
	for (const [source, limit] of [
		["config.maxBodySize", configuration({ maxBodySize })],
		["MAX_BODY_SIZE", environment({ "MAX_BODY_SIZE": String(maxBodySize) })],
	] as const) {
		host.it(`${source} ${maxBodySize} fails startup with a config error`, [startupFails, limit], function* ({ startup }) {
			expect(yield* startup()).toBe("failed with config error");
		});
	}
}
