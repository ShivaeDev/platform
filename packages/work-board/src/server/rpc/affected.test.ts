import "#test/liveDeliveryBoundary.ts";
import { Effect, PlatformError } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { interruptedDelivery } from "#test/interruptedDelivery.ts";

const graph = projectFiles({
	"nested/home.md": "---\nid: home\nrelationships:\n - kind: informs\n   target: old\n---\n# Home",
	"new.md": "---\nid: new\n---\n# New",
	"old.md": "---\nid: old\n---\n# Old",
	"other.md": "# Unrelated",
});
boardStory.it(
	"invalidates former and current dependencies, home aliases and both stable identities",
	[graph, boardHome("nested/home.md")],
	function* ({ watchProject, editFile }) {
		const events = yield* watchProject();
		yield* events.next();
		editFile("nested/home.md", "---\nid: renamed\nrelationships:\n - kind: informs\n   target: new\n---\n# Changed home");
		const hint = yield* events.changed("nested/home.md");
		expect(hint).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([
				{ _tag: "List", collection: "work-board/index" },
				{ _tag: "Item", collection: "work-board/documents", id: "" },
				{ _tag: "Item", collection: "work-board/documents", id: "nested/home.md" },
				{ _tag: "Item", collection: "work-board/documents", id: "old.md" },
				{ _tag: "Item", collection: "work-board/documents", id: "new.md" },
				{ _tag: "Item", collection: "work-board/identities", id: "home" },
				{ _tag: "Item", collection: "work-board/identities", id: "renamed" },
			]),
		});
		expect(JSON.stringify(hint)).not.toContain("other.md");
	},
);
boardStory.it(
	"follows board membership, evidence, attention targets and Markdown links",
	[
		projectFiles({
			"board.md": "---\nid: board\nitems: [task]\n---\n# Board",
			"note.md": "# Note\n\n[Read source](source.md)",
			"request.md":
				"---\nid: request\nattention:\n - id: review\n   kind: review\n   state: open\n   response_from: [maintainer]\n   reason: Read this\n   unblocks: [task#done]\n---\n# Request",
			"result.md": "---\nid: result\nevidence:\n - source: source.md\n   criterion: task#done\n---\n# Result",
			"source.md": "# Source",
			"task.md": "---\nid: task\ncriteria:\n - id: done\n   text: Complete\n---\n# Task",
		}),
	],
	function* ({ watchProject, editFile }) {
		const events = yield* watchProject();
		yield* events.next();
		editFile("source.md", "# Updated source");
		const hint = yield* events.changed("source.md");
		for (const file of ["board.md", "task.md", "result.md", "source.md", "request.md", "note.md"]) {
			expect(hint).toMatchObject({ _tag: "Changed", keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: file }]) });
		}
	},
);
boardStory.it(
	"refreshes every conflicting identity when a duplicate arrives and leaves",
	[projectFiles({ "first.md": "---\nid: same\n---\n# First" })],
	function* ({ watchProject, editFile, removeFile }) {
		const events = yield* watchProject();
		yield* events.next();
		editFile("duplicate.md", "---\nid: same\n---\n# Duplicate");
		for (const removing of [false, true]) {
			if (removing) {
				removeFile("duplicate.md");
			}
			expect(yield* events.changed("duplicate.md")).toMatchObject({
				_tag: "Changed",
				keys: expect.arrayContaining([
					{ _tag: "Item", collection: "work-board/identities", id: "same" },
					{ _tag: "Item", collection: "work-board/documents", id: "first.md" },
				]),
			});
		}
	},
);
boardStory.it(
	"invalidates managed sources when receipts or malformed history change",
	[
		projectFiles({
			"request.md":
				"---\nid: request\nkind: question\nscope: task\nurgency: whenever\nattention:\n - id: review\n   kind: decision\n   managed: true\n   state: open\n   response_from: [maintainer]\n   reason: Review\n   unblocks: [request]\n---\n# Request",
		}),
	],
	function* ({ watchProject, editFile }) {
		const events = yield* watchProject();
		yield* events.next();
		for (const [file, source] of [
			[
				"receipt.md",
				`---\nid: receipt\nkind: report\nrequest_receipt:\n question: request\n disposition: superseded\n recordedAt: 0\n reviewedRevision: ${"a".repeat(64)}\n---\n# Receipt`,
			],
			["responses/invalid.md", "---\nresponse: {}\n---\n# Invalid"],
		]) {
			if (!(file && source)) {
				throw new Error("Missing source");
			}
			editFile(file, source);
			expect(yield* events.changed(file)).toMatchObject({
				_tag: "Changed",
				keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "request.md" }]),
			});
		}
	},
);

boardStory.it(
	"reconciles fully when the workspace index is incomplete",
	[
		projectFiles({ "a.md": "# A", "b.md": "# B" }),
		boardFilesystem((fs) => ({
			...fs,
			readFileString: (file, options) =>
				file.endsWith("b.md")
					? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
					: fs.readFileString(file, options),
		})),
	],
	function* ({ watchProject, editFile }) {
		const events = yield* watchProject();
		yield* events.next();
		editFile("a.md", "# Changed A");
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
	},
);

boardStory.it(
	"reconciles when an edit is observed outside the announced paths",
	[projectFiles({ "note.md": "# Before" }), interruptedDelivery],
	function* ({ watchProject, omitNextPath, editFile }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		omitNextPath("note.md");
		editFile("note.md", "# Changed outside the announced paths");
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
	},
);
