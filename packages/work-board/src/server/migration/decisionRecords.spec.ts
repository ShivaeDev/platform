import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { migrationDecisionFixture } from "#test/migrationDecisionFixture.ts";

boardStory.it(
	"keeps Fleet asks as task questions, takes answers from response records and promotes only maintainer rulings",
	[projectFiles(migrationDecisionFixture), deferredServing],
	function* ({ migrate, notes, start, rpc }) {
		migrate();
		for (const [file, source] of Object.entries(migrationDecisionFixture)) {
			const saved = readFileSync(join(notes.root, file), "utf8");
			function body(text: string) {
				return text.slice(text.indexOf("---", 3));
			}
			expect(body(saved)).toBe(body(source));
		}
		expect(readFileSync(join(notes.root, "responses/fleet.open.md"), "utf8")).not.toContain("answer:");
		expect(readFileSync(join(notes.root, "responses/fleet.deferred.md"), "utf8")).not.toContain("answer:");
		expect(migrate()).toBe("Changed 0 files and 0 fields.\n");
		yield* start();
		for (const id of ["fleet.open", "fleet.deferred", "unruled"]) {
			const document = yield* rpc((client) => client("work-board.document", { url: `/_board/item/${id}/` }));
			expect(document.diagnostics).toEqual([]);
			expect(document.metadata).toMatchObject({ kind: "question", scope: "task", status: "ready", urgency: "blocking" });
			expect(document.metadata.answer).toBeUndefined();
		}
		const answered = yield* rpc((client) => client("work-board.document", { url: "/_board/item/fleet.answered/" }));
		expect(answered.metadata).toMatchObject({ answer: "Use the current branch.\n", kind: "question", scope: "task", status: "done" });
		const inbox = yield* rpc((client) => client("work-board.inbox", undefined));
		expect(inbox.items.map((item) => item.id).sort()).toEqual(["task.deferred", "task.open", "unruled"]);
		const ruling = yield* rpc((client) => client("work-board.document", { url: "/_board/item/storage/" }));
		expect(ruling.metadata).toMatchObject({ answer: "# Storage ruling\n\nKeep PostgreSQL.\n", owner: "marvin", scope: "standing", status: "done" });
		const task = yield* rpc((client) => client("work-board.document", { url: "/task.md" }));
		expect(task.rulings).toEqual([{ answer: "# Storage ruling\n\nKeep PostgreSQL.\n", href: "/decisions/storage.md", title: "Storage ruling" }]);
		const library = yield* rpc((client) => client("work-board.library", { showFleet: true }));
		expect(library.files.some((entry) => entry.path.includes("answer.fleet."))).toBe(false);
	},
);
