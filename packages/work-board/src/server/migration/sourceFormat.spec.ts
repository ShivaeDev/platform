import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationFormatFixture } from "#test/migrationFormatFixture.ts";

boardStory.it(
	"retains scalar styles, removes whole key lines and adds valid JSON properties inside JSON frontmatter",
	[projectFiles(migrationFormatFixture), deferredServing],
	function* ({ migrate, notes, start, rpc }) {
		migrate();
		function saved(file: string) {
			return readFileSync(join(notes.root, file), "utf8");
		}
		expect(saved("plain.md")).toBe(
			migrationFormatFixture["plain.md"]
				.replace("project", "goal")
				.replace("active", "ready")
				.replace("Claude", "claude")
				.replace("fleet-deliverable", "delivers")
				.replace("---\n# Plain", 'relationships: [{"kind":"replaces","target":"dropped"}]\n---\n# Plain'),
		);
		expect(saved("quoted.md")).toBe(
			migrationFormatFixture["quoted.md"]
				.replace("project", "goal")
				.replace("active", "ready")
				.replace("Claude", "claude")
				.replace("fleet-deliverable", "delivers"),
		);
		expect(saved("response.md")).toBe(migrationFormatFixture["response.md"].replace("kind: response\n", ""));
		expect(saved("dropped.md")).toBe(migrationFormatFixture["dropped.md"].replace("superseded\n", "dropped\n").replace("superseded_by: plain\n", ""));
		expect(JSON.parse(saved("json.md").split("---")[1] ?? "")).toMatchObject({
			delivers: "report",
			kind: "question",
			owner: "claude",
			scope: "task",
			status: "done",
			urgency: "whenever",
		});
		expect(migrate()).toBe("Changed 0 files and 0 fields.\n");
		yield* start();
		for (const file of Object.keys(migrationFormatFixture)) {
			const document = yield* rpc((client) => client("work-board.document", { url: `/${file}` }));
			expect(document.diagnostics).toEqual([]);
		}
	},
);
