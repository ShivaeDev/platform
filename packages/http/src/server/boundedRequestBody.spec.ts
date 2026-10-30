import { expect } from "vitest";
import { refusedChunkedBodyLeavesUnreadTail, requestBody, routeEchoesUpTo } from "#test/request-body/story.ts";

requestBody.it("a chunked body of 4 + 5 bytes past an 8-byte limit is answered 413 Payload Too Large", [routeEchoesUpTo(8)], function* ({ client }) {
	expect(yield* client.postsChunked(Buffer.alloc(4), Buffer.alloc(5))).toBe("413 Payload Too Large");
});

requestBody.it(
	"a content-length of 9 past an 8-byte limit is answered 413 Payload Too Large before the client sends any of the body",
	[routeEchoesUpTo(8)],
	function* ({ client }) {
		expect(yield* client.declaresLength(9)).toBe("413 Payload Too Large");
	},
);

requestBody.it(
	"a chunked body of 4 + 5 bytes past an 8-byte limit fails the route's read as a request body over 8 bytes",
	[routeEchoesUpTo(8)],
	function* ({ client, route }) {
		yield* client.postsChunked(Buffer.alloc(4), Buffer.alloc(5));

		expect(yield* route.failures()).toEqual(["request body over 8 bytes"]);
	},
);

requestBody.it(
	"a content-length of 9 past an 8-byte limit fails the route's read as a request body over 8 bytes",
	[routeEchoesUpTo(8)],
	function* ({ client, route }) {
		yield* client.declaresLength(9);

		expect(yield* route.failures()).toEqual(["request body over 8 bytes"]);
	},
);

requestBody.it("an 8-byte body that is not UTF-8 comes back byte for byte at an 8-byte limit", [routeEchoesUpTo(8)], function* ({ client }) {
	const notUtf8 = Buffer.from([255, 254, 0, 1, 2, 3, 4, 5]);

	expect(yield* client.postsWithLength(notUtf8)).toEqual(notUtf8);
});

requestBody.it(
	"after a refused chunked body ends with an unread tail, the next chunked body comes back byte for byte on the same connection",
	[routeEchoesUpTo(8), refusedChunkedBodyLeavesUnreadTail],
	function* ({ client }) {
		const splitInsideAnE = Buffer.from([0, 255, 195, 169, 128, 13, 10]);

		yield* client.postsChunked(splitInsideAnE.subarray(0, 3), splitInsideAnE.subarray(3));

		expect(yield* client.exchanges()).toEqual([
			{ connection: "connection 1", reply: "413 Payload Too Large" },
			{ connection: "connection 1", reply: splitInsideAnE },
		]);
	},
);
