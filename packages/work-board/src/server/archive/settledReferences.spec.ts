import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { settledReferencesFixture } from "#test/settledReferencesFixture.ts";

const files = projectFiles(settledReferencesFixture);

boardStory.it(
	"settling a done item keeps live item and index references resolved and Files with problems empty after restart",
	[files, deferredServing],
	function* (board) {
		expect(board.fileExists("decisions/settled.md")).toBe(true);

		yield* board.archive();
		yield* board.start({ fleetPort: null });

		expect(board.fileExists("decisions/settled.md")).toBe(false);
		expect((yield* board.readToday()).issues).toEqual([]);
		for (const file of ["index.md", "task.md"]) {
			const document = yield* board.readDocument(file);
			expect(document.references["decision.settled"]).toBe("/_board/item/decision.settled/");
		}
		expect(yield* board.readItem("decision.settled")).toMatchObject({
			file: "decisions/settled.md",
			identity: "decision.settled",
			metadata: { status: "done" },
		});
	},
);

boardStory.it("Files with problems still reports an unknown ID beside references to a settled item", [files, deferredServing], function* (board) {
	yield* board.archive();
	board.editFile("unknown.md", "---\nid: task.unknown\nrelationships: [{kind: depends_on, target: missing.id}]\n---\n# Unknown reference\n");
	yield* board.start({ fleetPort: null });

	yield* outcomes([
		[
			"files with problems",
			() => Effect.map(board.readToday(), (inbox) => inbox.issues),
			[{ file: "unknown.md", message: "Unresolved reference missing.id." }],
		],
		["unknown reference link", () => Effect.map(board.readDocument("unknown.md"), (document) => document.references["missing.id"]), undefined],
	]);
});

boardStory.it(
	"refreshing a done item out of an already indexed workspace keeps its references resolved",
	[
		projectFiles({
			...settledReferencesFixture,
			"decisions/settled.md": settledReferencesFixture["decisions/settled.md"].replace("status: done", "status: ready"),
		}),
	],
	function* (board) {
		expect((yield* board.readToday()).issues).toEqual([]);
		const events = yield* board.watchProject();
		yield* events.next();

		board.editFile("decisions/settled.md", settledReferencesFixture["decisions/settled.md"]);
		yield* events.changed("decisions/settled.md");

		expect(board.fileExists("decisions/settled.md")).toBe(false);
		yield* outcomes([
			["files with problems", () => Effect.map(board.readToday(), (inbox) => inbox.issues), []],
			[
				"settled reference link",
				() => Effect.map(board.readDocument("task.md"), (document) => document.references["decision.settled"]),
				"/_board/item/decision.settled/",
			],
		]);
	},
);

boardStory.it("a live item reusing a settled ID leaves references ambiguous", [files, deferredServing], function* (board) {
	yield* board.archive();
	board.editFile("reused.md", "---\nid: decision.settled\n---\n# Reused identity\n");
	yield* board.start({ fleetPort: null });

	yield* outcomes([
		[
			"ambiguous references",
			() => Effect.map(board.readToday(), (inbox) => inbox.issues),
			[
				{ file: "index.md", message: "Ambiguous reference decision.settled; the ID is duplicated." },
				{ file: "task.md", message: "Ambiguous reference decision.settled; the ID is duplicated." },
			],
		],
		["ambiguous reference link", () => Effect.map(board.readDocument("task.md"), (document) => document.references["decision.settled"]), undefined],
	]);
});
