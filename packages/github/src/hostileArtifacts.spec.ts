import { expect } from "vitest";
import { github } from "#test/github.ts";

github.it("extraction returns nested, empty and binary files while omitting directories", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([
		{ content: "", path: "reports/" },
		{ compressed: true, content: "coverage: 95%", path: "reports/coverage.txt" },
		{ content: "", path: "empty.txt" },
		{ content: new Uint8Array([0, 255, 128]), path: "image.bin" },
	]);

	const files = yield* downloadExtracted();

	expect(files).toEqual([
		{ bytes: new TextEncoder().encode("coverage: 95%"), path: "reports/coverage.txt" },
		{ bytes: new Uint8Array(), path: "empty.txt" },
		{ bytes: new Uint8Array([0, 255, 128]), path: "image.bin" },
	]);
});

for (const path of [
	"../escape",
	"safe/../../escape",
	"/etc/passwd",
	"C:/escape",
	"C:escape",
	"..\\escape",
	"\\\\host\\share",
	"a/./b",
	"a//b",
	"a\0b",
]) {
	github.it(`extraction refuses unsafe path ${JSON.stringify(path)}`, [], function* ({ writeArchive, downloadExtracted }) {
		yield* writeArchive([{ content: "hostile", path }]);

		const result = yield* downloadExtracted();

		expect(result).toBe(`unsafe archive path: ${path}`);
	});
}

github.it("extraction refuses symbolic links", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([{ content: "../../outside", path: "link", symlink: true }]);

	const result = yield* downloadExtracted();

	expect(result).toBe("archive symlink: link");
});

for (const paths of [
	["report.txt", "report.txt"],
	["reports/", "reports/"],
	["reports", "reports/child"],
	["reports/child", "reports"],
]) {
	github.it(`extraction refuses conflicting entries ${paths.join(" and ")}`, [], function* ({ writeArchive, downloadExtracted }) {
		yield* writeArchive(paths.map((path) => ({ content: path.endsWith("/") ? "" : "report", path })));

		const result = yield* downloadExtracted();

		expect(result).toBe(`duplicate archive entry: ${paths[1]}`);
	});
}

github.it("extraction translates dishonest entry sizes into a typed invalid-archive error", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([{ compressed: true, content: "x".repeat(4096), declaredSize: 1, path: "bomb" }]);

	const result = yield* downloadExtracted({ totalSizeLimit: 10 });

	expect(result).toBe("archive extraction failed: invalid-archive");
});

github.it("extraction refuses a non-ZIP storage response with a typed error", [], function* ({ writeInvalidArchive, downloadExtracted }) {
	yield* writeInvalidArchive();

	const result = yield* downloadExtracted();

	expect(result).toBe("archive extraction failed: invalid-archive");
});
github.it("extraction refuses directory entries carrying file contents", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([{ content: "hidden", path: "reports/" }]);

	const result = yield* downloadExtracted();

	expect(result).toBe("archive extraction failed: invalid-archive");
});
