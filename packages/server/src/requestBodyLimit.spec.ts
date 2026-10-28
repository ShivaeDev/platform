import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boundedBody } from "#test/app-host/body.ts";
import { host } from "#test/app-host/story.ts";

host.it("returns 413 for chunked overflow and preserves bytes and the same HTTP connection", [boundedBody], function* ({ postBytes, calls }) {
	expect((yield* postBytes([Buffer.alloc(4), Buffer.alloc(5)], { finishAfterResponse: true })).status).toBe(
		HttpStatus.fromLiteral("PayloadTooLarge"),
	);
	expect(calls()).toEqual([]);
	const bytes = Buffer.from([0, 255, 195, 169, 128, 13, 10]);
	const accepted = yield* postBytes([bytes.subarray(0, 3), bytes.subarray(3)]);
	expect(accepted.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(accepted.reusedSocket).toBe(true);
	expect(accepted.body).toEqual(bytes);
	expect(calls()).toEqual([bytes]);
	expect((yield* postBytes([Buffer.alloc(9)], { contentLength: 9 })).status).toBe(HttpStatus.fromLiteral("PayloadTooLarge"));
	expect(calls()).toEqual([bytes]);
});
host.it("rejects an oversized content-length before the client sends the body", [boundedBody], function* ({ postBytes }) {
	expect((yield* postBytes([], { contentLength: 9 })).status).toBe(HttpStatus.fromLiteral("PayloadTooLarge"));
});
