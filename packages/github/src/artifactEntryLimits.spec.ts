import { expect } from "vitest";
import { github } from "#test/github.ts";

github.it("extraction refuses an archive above the caller's entry cap", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([
		{ content: "", path: "one" },
		{ content: "", path: "two" },
		{ content: "", path: "three" },
	]);

	const result = yield* downloadExtracted({ entryLimit: 2 });

	expect(result).toBe("archive over 2 entries");
});

github.it("extraction accepts exactly the entry cap including directories", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([
		{ content: "", path: "reports/" },
		{ content: "report", path: "reports/result.txt" },
	]);

	const files = yield* downloadExtracted({ entryLimit: 2 });

	expect(files).toEqual([{ bytes: new TextEncoder().encode("report"), path: "reports/result.txt" }]);
});

github.it("directory entries count toward the entry cap", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([
		{ content: "", path: "one/" },
		{ content: "", path: "two/" },
	]);

	const result = yield* downloadExtracted({ entryLimit: 1 });

	expect(result).toBe("archive over 1 entries");
});

github.it("extraction refuses the excess entry before decoding its dishonest contents", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([
		{ content: "report", path: "one" },
		{ compressed: true, content: "x".repeat(4096), declaredSize: 1, path: "bomb" },
	]);

	const result = yield* downloadExtracted({ entryLimit: 1 });

	expect(result).toBe("archive over 1 entries");
});

github.it("extraction refuses more than 10000 entries by default", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive(Array.from({ length: 10_001 }, (_, index) => ({ content: "", path: `f${index}` })));

	const result = yield* downloadExtracted();

	expect(result).toBe("archive over 10000 entries");
});

github.it("a zero entry cap accepts an empty archive", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([]);

	const files = yield* downloadExtracted({ entryLimit: 0 });

	expect(files).toEqual([]);
});

github.it("a zero entry cap refuses the first file", [], function* ({ writeArchive, downloadExtracted }) {
	yield* writeArchive([{ content: "", path: "empty" }]);

	const result = yield* downloadExtracted({ entryLimit: 0 });

	expect(result).toBe("archive over 0 entries");
});
