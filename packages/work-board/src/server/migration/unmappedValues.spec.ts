import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { releasedApprovalFixture, unmappedBoard, unmappedCases } from "#test/migrationValuesFixture.ts";

for (const { field, value, kind } of unmappedCases) {
	const files = unmappedBoard(field, value, kind);
	boardStory.it(
		`reports the unmapped ${kind} ${field} value and exits before rewriting any file`,
		[projectFiles(files), deferredServing],
		({ tryMigration, notes }) => {
			const result = tryMigration();
			const success = 0;
			expect(result.status).not.toBe(success);
			expect(result.stderr).toContain(`z-unknown.md: ${field}: ${JSON.stringify(value)}`);
			for (const [file, source] of Object.entries(files)) {
				expect(readFileSync(join(notes.root, file), "utf8")).toBe(source);
			}
		},
	);
}

boardStory.it(
	"migrates Fleet's released approval back to held",
	[projectFiles(releasedApprovalFixture), deferredServing],
	function* ({ migrate, start, rpc }) {
		expect(migrate()).toBe("Changed 1 files and 1 fields.\n");
		expect(migrate()).toBe("Changed 0 files and 0 fields.\n");
		yield* start();
		const document = yield* rpc((client) => client("work-board.document", { url: "/released.md" }));
		expect(document.diagnostics).toEqual([]);
		expect(document.metadata).toMatchObject({ fleet: "held", status: "ready" });
	},
);
