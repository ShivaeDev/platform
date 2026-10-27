import { readFileSync } from "node:fs";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { rawDiagnosticsDaemon } from "#test/diagnosticsDaemon.ts";

const SOURCE = "---\nid: fleet.example\nkind: task\nfleet: approved\n---\n# New brief\n";
boardStory.it(
	"a Fleet identity refusal appears on the brief's id and leaves its source untouched",
	[projectFiles({ "new.md": SOURCE }), deferredServing],
	function* ({ start, readDocument, notes }) {
		const requested: string[][] = [];
		const daemon = yield* rawDiagnosticsDaemon(
			() => ({}),
			0,
			undefined,
			(id, path) => {
				requested.push([id, path]);
				return `id ${id} was delivered in example/project#7; give this brief a new id`;
			},
		);
		yield* start({ fleetPort: daemon.port });
		const document = yield* readDocument("new.md");
		expect(document.diagnostics).toEqual([
			{ field: "id", line: 2, message: "id fleet.example was delivered in example/project#7; give this brief a new id" },
		]);
		expect(requested).toEqual([["fleet.example", `${notes.root}/new.md`]]);
		expect(document.source).toContain("# New brief");
		expect(readFileSync(`${notes.root}/new.md`, "utf8")).toBe(SOURCE);
	},
);
