import { Effect, PlatformError } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { escapingLink, outsideFiles } from "#test/servingTraits.ts";
import { workspaceFixture } from "#test/workspaceFixture.ts";

boardStory.it(
	"finds encoded paths and duplicate headings and bounds results",
	[
		projectFiles({ ...workspaceFixture(), "plans/home & more.md": "# Board\n\n## Evidence\n\nFirst.\n\n## Evidence\n\nUnique second phrase." }),
		boardHome("plans/home & more.md"),
	],
	function* ({ search, post }) {
		const found = yield* search("unique second phrase");
		expect(found.results[0]?.href).toBe("/plans/home%20%26%20more.md#heading-evidence-2");
		const common = yield* search("project note");
		expect(common.results.length).toBeGreaterThan(0);
		expect(common.results.length).toBeLessThanOrEqual(40);
		expect((yield* search("impossible-asdf")).total).toBe(0);
		expect(found.unavailable).toEqual([]);
		expect((yield* post("/_board/rpc", { host: "evil.example" })).status).toBe(403);
	},
);
boardStory.it(
	"invalidates cached text after edits, additions and deletions",
	[projectFiles({ "note.md": "# Note\n\nOld phrase." })],
	function* ({ search, editFile, removeFile, watchProject, waitUntil }) {
		const events = yield* watchProject();
		yield* events.next();
		const old = yield* search("old phrase");
		expect(old.results.map((result) => result.href)).toEqual(["/note.md"]);
		expect(old.total).toBe(old.results.length);
		editFile("note.md", "# Note\n\nFresh phrase.");
		yield* events.changed("note.md");
		yield* waitUntil(async () => {
			const fresh = await Effect.runPromise(search("fresh phrase"));
			expect(fresh.results.map((result) => result.href)).toEqual(["/note.md"]);
			expect(fresh.total).toBe(fresh.results.length);
		});
		expect((yield* search("old phrase")).total).toBe(0);
		editFile("new.md", "# New\n\nAdded phrase.");
		yield* events.changed("new.md");
		const added = yield* search("added phrase");
		expect(added.results.map((result) => result.href)).toEqual(["/new.md"]);
		expect(added.total).toBe(added.results.length);
		removeFile("new.md");
		yield* events.changed("new.md");
		expect((yield* search("added phrase")).total).toBe(0);
	},
);
boardStory.it(
	"excludes hidden and escaping sources and discloses unreadable files",
	[
		projectFiles({ ".hidden.md": "# Hidden secret", "note.md": "# Visible", "unreadable.md": "# Unreadable secret" }),
		outsideFiles({ "outside.md": "# Outside secret" }),
		escapingLink,
		boardFilesystem((fs) => ({
			...fs,
			readFileString: (file, options) =>
				file.endsWith("unreadable.md")
					? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
					: fs.readFileString(file, options),
		})),
	],
	function* ({ search }) {
		const found = yield* search("secret");
		expect(found.total).toBe(0);
		expect(found.unavailable).toEqual(["unreadable.md"]);
	},
);
