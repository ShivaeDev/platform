import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { directoryNotifications } from "#test/directoryNotifications.ts";
import { changesUntil, rpcDocument, rpcNavigation, rpcPaths, rpcWatcher } from "#test/nativeRpc.ts";

boardStory.it(
	"delivers an edit, an added file and a removed root to a connected client",
	[projectFiles({ "notes/log.md": "# Before" })],
	function* ({ board, editFile, removeProject, watchProject }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		expect((yield* rpcWatcher(board)).watching).toBe(true);

		editFile("notes/log.md", "# Edited");
		expect(yield* changesUntil(events, "notes/log.md")).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "notes/log.md" }]),
		});
		expect((yield* rpcDocument(board, "/notes/log.md")).source).toBe("# Edited");

		editFile("notes/new.md", "# Added");
		expect(yield* changesUntil(events, "notes/new.md")).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "notes/new.md" }]),
		});
		expect((yield* rpcDocument(board, "/notes/new.md")).source).toBe("# Added");

		removeProject();
		let hint = yield* events.next();
		while (hint._tag !== "Resync") {
			hint = yield* events.next();
		}
		yield* eventually(
			Effect.flatMap(rpcWatcher(board), (state) => Effect.try(() => expect(state.watching).toBe(false))),
			{ times: 100 },
		);
		expect(yield* Effect.flip(rpcNavigation(board))).toMatchObject({ _tag: "InternalServerError" });
		yield* events.close();
	},
);

boardStory.it("announces removal of an empty workspace root to a connected client", [], function* ({ board, removeProject, watchProject }) {
	const events = yield* watchProject();
	expect(yield* events.next()).toEqual({ _tag: "Resync" });
	removeProject();
	expect(yield* events.next()).toEqual({ _tag: "Resync" });
	yield* eventually(
		Effect.flatMap(rpcWatcher(board), (state) => Effect.try(() => expect(state.watching).toBe(false))),
		{ times: 100 },
	);
	expect(yield* Effect.flip(rpcNavigation(board))).toMatchObject({ _tag: "InternalServerError" });
	yield* events.close();
});

const notifications = directoryNotifications();
const directoriesOnly = directoryNotifications(true);

boardStory.it(
	"completes reads after unchanged directory notifications with document and attachment extensions",
	[projectFiles({ "archive.md/log.md": "# Log", "images.png/plan.md": "# Plan" }), directoriesOnly.trait],
	function* ({ notes, board, watchProject }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		for (const directory of ["archive.md", "images.png"]) {
			yield* directoriesOnly.changed(directory);
			expect(yield* rpcPaths(board).pipe(Effect.timeout("1 second"))).toEqual(["/archive.md/log.md", "/images.png/plan.md"]);
			expect((yield* rpcDocument(board, "/archive.md/log.md").pipe(Effect.timeout("1 second"))).source).toBe("# Log");
		}
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		expect(directoriesOnly.watchedPaths()).toEqual([notes.root]);
		yield* events.close();
	},
);

boardStory.it(
	"announces a populated directory move when only the destination directory is reported",
	[projectFiles({ "drafts/log.md": "# Log", "drafts/nested/plan.md": "# Plan" }), directoriesOnly.trait],
	function* ({ notes, board, editFile, moveDirectory, watchProject }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		expect(directoriesOnly.watchedPaths()).toEqual([notes.root]);
		moveDirectory("drafts", "published");
		yield* directoriesOnly.changed("published");
		expect(yield* events.next()).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining(
				["drafts/log.md", "drafts/nested/plan.md", "published/log.md", "published/nested/plan.md"].map((id) => ({
					_tag: "Item",
					collection: "work-board/documents",
					id,
				})),
			),
		});
		expect(yield* rpcPaths(board)).toEqual(["/published/log.md", "/published/nested/plan.md"]);
		expect((yield* rpcDocument(board, "/published/nested/plan.md")).source).toBe("# Plan");
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		expect(directoriesOnly.watchedPaths()).toEqual([notes.root]);

		editFile("published/log.md", "# After the move");
		yield* directoriesOnly.changed("published");
		expect(yield* changesUntil(events, "published/log.md")).toMatchObject({ _tag: "Changed" });
		expect((yield* rpcDocument(board, "/published/log.md")).source).toBe("# After the move");
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		expect(directoriesOnly.watchedPaths()).toEqual([notes.root]);
		yield* events.close();
	},
);

boardStory.it(
	"keeps delivering edits when an existing directory is reported again",
	[projectFiles({ "notes/log.md": "# Before" }), notifications.trait],
	function* ({ notes, board, editFile, watchProject }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		yield* notifications.changed("notes");
		editFile("notes/log.md", "# After the directory notification");
		expect(yield* changesUntil(events, "notes/log.md")).toMatchObject({ _tag: "Changed" });
		expect((yield* rpcDocument(board, "/notes/log.md")).source).toBe("# After the directory notification");
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		expect(notifications.watchedPaths()).toEqual([notes.root]);
		yield* events.close();
	},
);
