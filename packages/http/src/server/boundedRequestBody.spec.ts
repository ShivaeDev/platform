import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { requestBody, routeAccepts } from "#test/request-body/story.ts";

requestBody.it(
	"refuses chunked overflow with 413, drains the rest and serves the next request on the same connection",
	[routeAccepts(8)],
	function* ({ client, route }) {
		const refused = yield* client.posts([Buffer.alloc(4), Buffer.alloc(5)], { tailAfterResponse: Buffer.alloc(1024 * 1024) });
		expect(refused.status).toBe(HttpStatus.fromLiteral("PayloadTooLarge"));
		expect(route.failures()).toEqual(["RequestBodyTooLarge"]);
		const bytes = Buffer.from([0, 255, 195, 169, 128, 13, 10]);
		const accepted = yield* client.posts([bytes.subarray(0, 3), bytes.subarray(3)]);
		expect(accepted.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(accepted.clientPort).toBe(refused.clientPort);
		expect(accepted.body).toEqual(bytes);
		expect(route.bodiesRead()).toEqual([bytes]);
	},
);

requestBody.it("refuses an oversized content-length before the client sends the body", [routeAccepts(8)], function* ({ client, route }) {
	expect((yield* client.posts([], { contentLength: 9 })).status).toBe(HttpStatus.fromLiteral("PayloadTooLarge"));
	expect(route.failures()).toEqual(["RequestBodyTooLarge"]);
	expect(route.bodiesRead()).toEqual([]);
});

requestBody.it("returns a body exactly at the limit without decoding it", [routeAccepts(8)], function* ({ client, route }) {
	const bytes = Buffer.from([255, 254, 0, 1, 2, 3, 4, 5]);
	const accepted = yield* client.posts([bytes], { contentLength: 8 });
	expect(accepted.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(accepted.body).toEqual(bytes);
	expect(route.bodiesRead()).toEqual([bytes]);
});
