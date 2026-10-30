import { expect } from "vitest";
import { metadataWarnings } from "#test/metadataWarnings.ts";

const BROKEN = "---\nid: broken\nkind: task\nunexpected: value\n---\nBrief body.\n";

metadataWarnings.it("unchanged full reads warn only once for each invalid file", [], function* (board) {
	yield* board.write("broken.md", BROKEN);
	yield* board.write("other.md", BROKEN.replace("id: broken", "id: other"));

	yield* board.read();
	const first = board.warnings();
	expect(first).toEqual([expect.stringContaining("broken.md"), expect.stringContaining("other.md")]);
	yield* board.read();

	expect(board.warnings()).toEqual(first);
});

metadataWarnings.it("a body edit warns again even when its metadata diagnostic stays the same", [], function* (board) {
	yield* board.write("broken.md", BROKEN);
	yield* board.read();
	const first = board.warnings();
	expect(first).toEqual([expect.stringContaining("Unknown field unexpected")]);

	yield* board.write("broken.md", BROKEN.replace("Brief body.", "Edited body."));
	yield* board.read();
	yield* board.read();

	expect(board.warnings()).toEqual([...first, ...first]);
});

metadataWarnings.it("a changed area diagnostic warns again without a source edit", [], function* (board) {
	yield* board.createFolder("packages/alpha");
	yield* board.write("broken.md", BROKEN.replace("unexpected: value", "areas: [alpha, beta]"));
	yield* board.read();
	expect(board.warnings()).toEqual([expect.stringContaining('Area "beta"')]);

	yield* board.remove("packages/alpha");
	yield* board.read();
	yield* board.read();

	expect(board.warnings()).toEqual([expect.stringContaining('Area "beta"'), expect.stringContaining('Area "alpha"')]);
});

for (const recovery of ["repair", "remove"] as const) {
	metadataWarnings.it(`a warning returns after an observed ${recovery} and recurrence`, [], function* (board) {
		yield* board.write("broken.md", BROKEN);
		yield* board.read();
		const first = board.warnings();
		expect(first).toEqual([expect.stringContaining("broken.md")]);
		if (recovery === "repair") {
			yield* board.write("broken.md", BROKEN.replace("unexpected: value\n", ""));
		} else {
			yield* board.remove("broken.md");
		}
		yield* board.read();

		yield* board.write("broken.md", BROKEN);
		yield* board.read();

		expect(board.warnings()).toEqual([...first, ...first]);
	});
}
