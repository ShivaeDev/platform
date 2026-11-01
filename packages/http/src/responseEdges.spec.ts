import { expect } from "vitest";
import { responseEdges as edgeStories } from "#test/http-client/responseEdges.ts";

for (const transport of ["fetch", "node"] as const) {
	const edges = edgeStories(transport);
	edges.it("a zero-byte limit refuses a nonempty body", [], function* ({ read }) {
		const result = yield* read("/paper", "bytes", 0);

		expect(result).toBe("body too large");
	});
	for (const [path, method] of [
		["/204", "GET"],
		["/205", "GET"],
		["/304", "GET"],
		["/paper", "HEAD"],
		["/empty", "GET"],
	] as const) {
		for (const [format, expected] of [
			["bytes", new Uint8Array()],
			["text", ""],
			["json", "invalid JSON"],
		] as const) {
			edges.it(
				`${method} ${path} reads as empty ${format === "json" ? "input and fails JSON decoding" : format} at a zero-byte limit`,
				[],
				function* ({ read }) {
					const result = yield* read(path, format, 0, method);

					expect(result).toEqual(expected);
				},
			);
		}
	}
	for (const limit of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
		for (const format of ["bytes", "text", "json"] as const) {
			edges.it(`${format} refuses the invalid limit ${limit}`, [], function* ({ read }) {
				const result = yield* read("/paper", format, limit);

				expect(result).toBe("invalid limit");
			});
		}
		edges.it(`an empty response still refuses the invalid limit ${limit}`, [], function* ({ read }) {
			const result = yield* read("/204", "bytes", limit);

			expect(result).toBe("invalid limit");
		});
	}
}

const compressed = edgeStories("fetch");
compressed.it("a gzip response whose wire size exceeds the limit reads when its decoded bytes fit exactly", [], function* ({ read }) {
	const result = yield* read("/compressed-small", "text", 5);

	expect(result).toBe("paper");
});
compressed.it("a gzip response whose wire size fits fails when its decoded bytes exceed the limit", [], function* ({ read }) {
	const result = yield* read("/compressed-large", "bytes", 64);

	expect(result).toBe("body too large");
});

const encoded = edgeStories("node");
for (const [path, method] of [
	["/204", "GET"],
	["/205", "GET"],
	["/304", "GET"],
	["/paper", "HEAD"],
] as const) {
	for (const limit of [0, Number.NaN]) {
		encoded.it(`${method} ${path} at limit ${limit} leaves capacity for the next request`, [], function* ({ read }) {
			yield* read(path, "bytes", limit, method);

			const result = yield* read("/paper", "text", 5);

			expect(result).toBe("paper");
		});
	}
}
encoded.it("the native Node transport returns gzip bytes at their exact 25-byte stream limit", [], function* ({ read }) {
	const result = yield* read("/compressed-small", "bytes", 25);

	expect(result).toMatchObject({ 0: 31, 1: 139, 2: 8, byteLength: 25 });
});
encoded.it("the native Node transport refuses gzip bytes above its stream limit", [], function* ({ read }) {
	const result = yield* read("/compressed-small", "bytes", 24);

	expect(result).toBe("body too large");
});
