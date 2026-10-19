import { Effect } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardStory, projectFiles } from "#test/boardStory.ts";
import { directoryNotifications } from "#test/directoryNotifications.ts";
import { changesUntil, rpcDocument } from "#test/nativeRpc.ts";

for (const first of ["filesystem", "notifications"]) {
	const notifications = directoryNotifications(true);
	let reads = 0;
	const boundary = boardFilesystem((fs) => ({
		...fs,
		readFileString: (path, encoding) =>
			fs.readFileString(path, encoding).pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						reads += 1;
					}),
				),
			),
	}));
	boardStory.it(
		`composes filesystem boundaries when ${first} is applied first`,
		[projectFiles({ "notes/log.md": "# Before" }), ...(first === "filesystem" ? [boundary, notifications.trait] : [notifications.trait, boundary])],
		function* ({ board, editFile, watchProject }) {
			const events = yield* watchProject();
			expect(yield* events.next()).toEqual({ _tag: "Resync" });
			const before = reads;
			editFile("notes/log.md", "# After");
			yield* notifications.changed("notes/log.md");
			expect(yield* changesUntil(events, "notes/log.md")).toMatchObject({ _tag: "Changed" });
			expect((yield* rpcDocument(board, "/notes/log.md")).source).toBe("# After");
			expect(reads).toBeGreaterThan(before);
			const singleWatcher = 1;
			expect(notifications.watchStarts()).toBe(singleWatcher);
			yield* events.close();
		},
	);
}

const stopped = directoryNotifications(true);
boardStory.it("rejects notifications after the watcher stream stops", [stopped.trait], function* ({ stopBoards }) {
	yield* stopBoards();
	yield* Effect.promise(() => expect(Effect.runPromise(stopped.changed("notes"))).rejects.toThrow("No watcher stream is listening"));
});
