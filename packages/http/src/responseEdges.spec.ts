import { expect } from "vitest";
import { compressedBody, emptyBody, noContent } from "#test/http-client/bodies.ts";
import { httpClient, usingClient } from "#test/http-client/story.ts";

for (const transport of ["fetch", "node"] as const) {
	const selected = usingClient(transport);
	httpClient.it(`${transport} refuses a nonempty body at a zero-byte limit`, [selected], function* ({ readBody: read }) {
		const result = yield* read("bytes", 0);

		expect(result).toBe("body over 0 bytes");
	});
	for (const [response, method, traits] of [
		["HTTP 204", "GET", [noContent(204)]],
		["HTTP 205", "GET", [noContent(205)]],
		["HTTP 304", "GET", [noContent(304)]],
		["HEAD", "HEAD", []],
		["zero-length body", "GET", [emptyBody]],
	] as const) {
		for (const [format, expected] of [
			["bytes", new Uint8Array()],
			["text", ""],
			["json", "Schema mismatch"],
		] as const) {
			httpClient.it(
				`${transport} ${response} reads as empty ${format === "json" ? "input and fails JSON decoding" : format} at a zero-byte limit`,
				[selected, ...traits],
				function* ({ readBody: read }) {
					const result = yield* read(format, 0, method);

					expect(result).toEqual(expected);
				},
			);
		}
	}
	for (const limit of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
		for (const format of ["bytes", "text", "json"] as const) {
			httpClient.it(`${transport} ${format} refuses the invalid limit ${limit}`, [selected], function* ({ readBody: read }) {
				const result = yield* read(format, limit);

				expect(result).toBe("invalid limit");
			});
		}
		httpClient.it(`${transport} empty response still refuses the invalid limit ${limit}`, [selected, noContent()], function* ({ readBody: read }) {
			const result = yield* read("bytes", limit);

			expect(result).toBe("invalid limit");
		});
	}
}

const selected = usingClient("fetch");
httpClient.it(
	"a gzip response whose wire size exceeds the limit reads when its decoded bytes fit exactly",
	[selected, compressedBody("paper")],
	function* ({ readBody: read }) {
		const result = yield* read("text", 5);

		expect(result).toBe("paper");
	},
);
httpClient.it(
	"a gzip response whose wire size fits fails when its decoded bytes exceed the limit",
	[selected, compressedBody("x".repeat(128))],
	function* ({ readBody: read }) {
		const result = yield* read("bytes", 64);

		expect(result).toBe("body over 64 bytes");
	},
);

for (const [response, method, traits] of [
	["HTTP 204", "GET", [noContent(204)]],
	["HTTP 205", "GET", [noContent(205)]],
	["HTTP 304", "GET", [noContent(304)]],
	["HEAD", "HEAD", []],
] as const) {
	for (const limit of [0, Number.NaN]) {
		httpClient.it(
			`node ${response} at limit ${limit} leaves capacity for the next request`,
			[usingClient("node"), ...traits],
			function* ({ readBody: read, readPaper }) {
				yield* read("bytes", limit, method);

				const result = yield* readPaper();

				expect(result).toBe("paper");
			},
		);
	}
}
httpClient.it(
	"the native Node transport returns gzip bytes at their exact 25-byte stream limit",
	[usingClient("node"), compressedBody("paper")],
	function* ({ readBody: read }) {
		const result = yield* read("bytes", 25);

		expect(result).toMatchObject({ 0: 31, 1: 139, 2: 8, byteLength: 25 });
	},
);
httpClient.it(
	"the native Node transport refuses gzip bytes above its stream limit",
	[usingClient("node"), compressedBody("paper")],
	function* ({ readBody: read }) {
		const result = yield* read("bytes", 24);

		expect(result).toBe("body over 24 bytes");
	},
);
