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
			(briefs) =>
				briefs.map((brief) => {
					requested.push([brief.workId, brief.sourcePath]);
					return { ...brief, message: `id ${brief.workId} was delivered in example/project#7; give this brief a new id` };
				}),
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

for (const status of ["done", "dropped"]) {
	boardStory.it(
		`a ${status} brief keeps historical areas and identity quiet without asking Fleet`,
		[projectFiles({ "archive/old.md": SOURCE.replace("fleet: approved", `status: ${status}\nareas: [removed-package]`) }), deferredServing],
		function* ({ start, readDocument }) {
			const requested: string[] = [];
			const daemon = yield* rawDiagnosticsDaemon(
				() => ({}),
				0,
				undefined,
				(briefs) =>
					briefs.map((brief) => {
						requested.push(brief.workId);
						return { ...brief, message: "The original task path was delivered." };
					}),
			);
			yield* start({ fleetPort: daemon.port });
			expect((yield* readDocument("archive/old.md")).diagnostics).toEqual([]);
			expect(requested).toEqual([]);
		},
	);
}

const SHOWN = 30;
const shownItems = Array.from({ length: SHOWN }, (_, index) => `fleet.shown-${index}`);
boardStory.it(
	"the overview asks Fleet about every shown brief in one request and hides the refused one",
	[
		projectFiles({
			...Object.fromEntries(
				shownItems.map((id, index) => [`tasks/${index}.md`, `---\nid: ${id}\nkind: task\nstatus: ready\n---\n# Shown ${index}\n`]),
			),
			"tasks/done.md": "---\nid: fleet.delivered\nkind: task\nstatus: done\n---\n# Delivered\n",
		}),
		deferredServing,
	],
	function* ({ start, rpc, notes }) {
		const requests: string[][] = [];
		const item = { attentionOwner: "automation" as const, stage: "working" as const, stageEnteredAt: 100, updatedAt: 200 };
		const daemon = yield* rawDiagnosticsDaemon(
			() => ({}),
			0,
			() => ({
				completed: [{ ...item, completedAt: 200, stage: "done", workId: "fleet.delivered" }],
				items: shownItems.map((workId) => ({ ...item, workId })),
			}),
			(briefs) => {
				requests.push(briefs.map((brief) => brief.workId));
				return briefs
					.filter((brief) => brief.workId === "fleet.shown-0")
					.map((brief) => ({ ...brief, message: "id fleet.shown-0 was delivered in example/project#7; give this brief a new id" }));
			},
		);
		yield* start({ fleetPort: daemon.port });
		const overview = yield* rpc((client) => client("work-board.overview", undefined));
		expect(requests).toEqual([shownItems]);
		expect(overview.fleet.state === "ready" ? overview.fleet.items.map((shown) => shown.workId) : []).toEqual(shownItems.slice(1));
		expect(overview.fleet.state === "ready" ? overview.fleet.completed.map((shown) => shown.workId) : []).toEqual(["fleet.delivered"]);
		expect(requests.flat()).not.toContain("fleet.delivered");
		expect(readFileSync(`${notes.root}/tasks/0.md`, "utf8")).toContain("# Shown 0");
	},
);
