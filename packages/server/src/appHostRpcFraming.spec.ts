import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { echoRpc, largestAcceptedMessage, message } from "#test/app-host/body.ts";
import { configuration, host } from "#test/app-host/story.ts";

for (const chunked of [false, true]) {
	const transfer = chunked ? "chunked" : "content-length";
	for (const { body, name } of [
		{ body: message("é"), name: "call with Unicode" },
		{ body: message("first") + message("last", "2"), name: "batch" },
	]) {
		host.it(`a ${transfer} RPC ${name} receives the same answers with and without its final newline`, [echoRpc], function* ({ postNdjson }) {
			const terminated = yield* postNdjson(body, { chunked });

			const unterminated = yield* postNdjson(body.slice(0, -1), { chunked });

			expect(terminated.status).toBe(HttpStatus.fromLiteral("OK"));
			expect(terminated.body).toContain('"value":"accepted"');
			expect(unterminated).toEqual(terminated);
		});
	}
}

for (const newline of ["\n", ""]) {
	host.it(
		`malformed NDJSON ${newline === "" ? "without" : "with"} its final newline returns the existing RPC defect`,
		[echoRpc],
		function* ({ postNdjson }) {
			const response = yield* postNdjson(`{invalid json}${newline}`);

			expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
			expect(response.body).toContain('"_tag":"Defect"');
			expect(response.body).toContain("NdjsonDecodeError");
		},
	);
}

host.it("an unterminated RPC message filling the byte limit is answered", [echoRpc, configuration({ maxBodySize: 128 })], function* ({ postNdjson }) {
	const body = largestAcceptedMessage(129).body.slice(0, -1);

	const response = yield* postNdjson(body);

	expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(response.body).toContain('"value":"accepted"');
});
