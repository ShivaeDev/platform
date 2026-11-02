import { expect } from "vitest";
import { github } from "#test/github.ts";

github.it("extraction refuses a compression bomb under the default ratio cap", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([{ compressed: true, content: "x".repeat(256 * 1024), path: "bomb" }]);

	const result = yield* downloadExtracted();

	expect(result).toBe("archive entry bomb exceeds 100:1 compression");
});

github.it("extraction applies the caller's compression ratio cap", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([{ content: "report", path: "report" }]);

	const result = yield* downloadExtracted({ compressionRatioLimit: 0.5 });

	expect(result).toBe("archive entry report exceeds 0.5:1 compression");
});

github.it("a caller can raise the ratio cap for compressible logs", [], function* ({ writeArchive, downloadExtracted }) {
	const content = "x".repeat(4096);
	yield* writeArchive([{ compressed: true, content, path: "logs.txt" }]);

	const files = yield* downloadExtracted({ compressionRatioLimit: 1000 });

	expect(files).toEqual([{ bytes: new TextEncoder().encode(content), path: "logs.txt" }]);
});

github.it("a zero total-size cap accepts an empty file", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([{ content: "", path: "empty" }]);

	const files = yield* downloadExtracted({ totalSizeLimit: 0 });

	expect(files).toEqual([{ bytes: new Uint8Array(), path: "empty" }]);
});

github.it("extraction counts all files toward the total size cap", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([
		{ content: "123456", path: "one" },
		{ content: "123456", path: "two" },
	]);

	const result = yield* downloadExtracted({ totalSizeLimit: 10 });

	expect(result).toBe("extracted archive over 10 bytes");
});

github.it("extraction accepts files exactly at the total size and ratio caps", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([
		{ content: "123", path: "one" },
		{ content: "456", path: "two" },
	]);

	const files = yield* downloadExtracted({ compressionRatioLimit: 1, totalSizeLimit: 6 });

	expect(files).toEqual([
		{ bytes: new TextEncoder().encode("123"), path: "one" },
		{ bytes: new TextEncoder().encode("456"), path: "two" },
	]);
});

github.it("extraction refuses a declared size above the default total cap before decoding", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([{ content: "report", declaredSize: 100 * 1024 * 1024 + 1, path: "large" }]);

	const result = yield* downloadExtracted();

	expect(result).toBe("extracted archive over 100 MiB");
});

for (const options of [
	{ totalSizeLimit: -1 },
	{ totalSizeLimit: 1.5 },
	{ totalSizeLimit: Number.POSITIVE_INFINITY },
	{ compressionRatioLimit: 0 },
	{ compressionRatioLimit: Number.NaN },
	{ compressionRatioLimit: Number.POSITIVE_INFINITY },
]) {
	github.it(`extraction refuses invalid caps ${String(Object.entries(options))}`, [], function* ({ downloadExtracted }) {
		const result = yield* downloadExtracted(options);

		expect(result).toBe("archive extraction failed: invalid-limits");
	});
}
