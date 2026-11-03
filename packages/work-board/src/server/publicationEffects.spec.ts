import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { publicationStory, sourceChangesDuringWrite, writePaused } from "#test/publicationStory.ts";

publicationStory.it("republishing the same report succeeds with one complete file", [], function* ({ entries, publish, text }) {
	expect(yield* publish("fleet/reports/review.md", "Report bytes")).toBe("published");

	yield* outcomes([
		["republish", () => publish("fleet/reports/review.md", "Report bytes"), "published"],
		["report", () => text("fleet/reports/review.md"), "Report bytes"],
		["report directory", () => entries("fleet/reports"), ["review.md"]],
	]);
});

publicationStory.it("an immutable attachment keeps its exact bytes on republish", [], function* ({ bytes, entries, publish }) {
	const content = new Uint8Array([0, 255, 128, 10]);
	expect(yield* publish("responses/report.attachments/result.bin", content)).toBe("published");

	yield* outcomes([
		["republish", () => publish("responses/report.attachments/result.bin", content), "published"],
		["attachment bytes", () => bytes("responses/report.attachments/result.bin"), [0, 255, 128, 10]],
		["attachment directory", () => entries("responses/report.attachments"), ["result.bin"]],
	]);
});

publicationStory.it("replacement publishes complete content when the expected source matches", [], function* ({ edit, entries, replace, text }) {
	yield* edit("task.md", "Reviewed source");
	expect(yield* text("task.md")).toBe("Reviewed source");

	yield* outcomes([
		["replacement", () => replace("task.md", "Reviewed source", "Completed source"), "replaced"],
		["source", () => text("task.md"), "Completed source"],
		["workspace", () => entries(""), ["task.md"]],
	]);
});

publicationStory.it("replacement refuses changed source and preserves the author's bytes", [], function* ({ edit, entries, replace, text }) {
	yield* edit("task.md", "Author changed this");

	expect(yield* replace("task.md", "Reviewed source", "Completed source")).toBe("precondition failed: Source changed; no file was replaced.");

	yield* outcomes([
		["source", () => text("task.md"), "Author changed this"],
		["workspace", () => entries(""), ["task.md"]],
	]);
});

publicationStory.it(
	"replacement refuses a source edit made while staging and cleans the temporary file",
	[sourceChangesDuringWrite("task.md", "Author edited during staging")],
	function* ({ edit, entries, replace, text }) {
		yield* edit("task.md", "Reviewed source");

		expect(yield* replace("task.md", "Reviewed source", "Completed source")).toBe("precondition failed: Source changed; no file was replaced.");

		yield* outcomes([
			["source", () => text("task.md"), "Author edited during staging"],
			["workspace", () => entries(""), ["task.md"]],
		]);
	},
);

for (const operation of ["publish", "replace"] as const) {
	publicationStory.it(
		`interrupting ${operation} cleans a partial staged file and preserves the destination`,
		[writePaused],
		function* ({ edit, entries, interrupt, stagedTexts, startPublication, text }) {
			if (operation === "replace") {
				yield* edit("fleet/review.md", "Reviewed source");
			}
			yield* startPublication("fleet/review.md", "Report bytes", operation === "replace" ? "Reviewed source" : undefined);
			expect(yield* stagedTexts("fleet")).toEqual(["Repor"]);

			yield* interrupt();

			yield* outcomes([
				["destination", () => text("fleet/review.md"), operation === "replace" ? "Reviewed source" : "missing"],
				["directory", () => entries("fleet"), operation === "replace" ? ["review.md"] : []],
			]);
		},
	);
}
