import { constants } from "node:fs";
import { chmod, open, readdir, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { expect, vi } from "vitest";
import { outsideResponseDirectory, responseDirectory, responseLink } from "#test/responseFiles.ts";
import { workspaceFiles, workspaceStory } from "#test/workspaceStory.ts";
import { publish } from "./publish.ts";
import { publishIn } from "./publishIn.ts";

workspaceStory.it(
	"never replaces a conflicting file or follows a destination symlink",
	[workspaceFiles({ "responses/response.a.md": "Other contribution" }, "the project has the stated publication files")],
	function* ({ notes, anotherFolder }) {
		const outside = yield* anotherFolder({ "reference.md": "Outside source" });
		expect((yield* Effect.flip(publish(notes.root, notes.root, "response.a", "New feedback"))).message).toContain("different content");
		expect(yield* Effect.promise(() => readFile(join(notes.root, "responses/response.a.md"), "utf8"))).toBe("Other contribution");
		responseLink(notes.root, "response.link.md", join(outside.root, "reference.md"));
		expect((yield* Effect.exit(publish(notes.root, notes.root, "response.link", "New feedback")))._tag).toBe("Failure");
		expect(yield* Effect.promise(() => readFile(join(outside.root, "reference.md"), "utf8"))).toBe("Outside source");
		expect((yield* Effect.promise(() => readdir(join(notes.root, "responses")))).filter((name) => name.endsWith(".tmp"))).toEqual([]);
	},
);

workspaceStory.it(
	"reports uncertainty after publication fails directory synchronization and safely reconciles the already-published identity",
	[workspaceFiles({}, "the project has the stated publication files")],
	function* ({ notes }) {
		responseDirectory(notes.root);
		const target = yield* Effect.promise(() => open(join(notes.root, "responses"), constants.O_RDONLY | constants.O_DIRECTORY));
		try {
			const fault = vi.spyOn(target, "sync").mockRejectedValueOnce(new Error("disk synchronization failed"));
			yield* Effect.promise(() =>
				expect(publishIn(target, notes.root, notes.root, "response.a", "Recorded feedback")).rejects.toMatchObject({ _tag: "PublicationUncertain" }),
			);
			expect(yield* Effect.promise(() => readFile(join(notes.root, "responses/response.a.md"), "utf8"))).toBe("Recorded feedback");
			fault.mockRejectedValueOnce(new Error("reconciliation synchronization failed"));
			yield* Effect.promise(() =>
				expect(publishIn(target, notes.root, notes.root, "response.a", "Recorded feedback")).rejects.toMatchObject({ _tag: "PublicationUncertain" }),
			);
			fault.mockRestore();
			yield* Effect.promise(() => publishIn(target, notes.root, notes.root, "response.a", "Recorded feedback"));
			expect(yield* Effect.promise(() => readdir(join(notes.root, "responses")))).toEqual(["response.a.md"]);
		} finally {
			yield* Effect.promise(() => target.close());
		}
	},
);

workspaceStory.it(
	"rejects permission failure before publication and cleans temporary files",
	[workspaceFiles({}, "the project has the stated publication files")],
	function* ({ notes }) {
		responseDirectory(notes.root);
		yield* Effect.promise(() => chmod(join(notes.root, "responses"), 0o500));
		try {
			expect((yield* Effect.flip(publish(notes.root, notes.root, "response.a", "Feedback"))).message).toContain("could not be recorded");
			expect(yield* Effect.promise(() => readdir(join(notes.root, "responses")))).toEqual([]);
		} finally {
			yield* Effect.promise(() => chmod(join(notes.root, "responses"), 0o700));
		}
	},
);

workspaceStory.it(
	"concurrent writers publish one winner and reconcile only identical content",
	[workspaceFiles({}, "the project has the stated publication files")],
	function* ({ notes }) {
		const attempts = yield* Effect.all(
			["First feedback", "Other feedback"].map((content) => Effect.exit(publish(notes.root, notes.root, "response.race", content))),
			{ concurrency: "unbounded" },
		);
		expect(attempts.filter(Exit.isSuccess)).toHaveLength(1);
		const saved = yield* Effect.promise(() => readFile(join(notes.root, "responses/response.race.md"), "utf8"));
		yield* Effect.all(
			Array.from({ length: 4 }, () => publish(notes.root, notes.root, "response.race", saved)),
			{ concurrency: "unbounded" },
		);
		expect(yield* Effect.promise(() => readdir(join(notes.root, "responses")))).toEqual(["response.race.md"]);
	},
);

workspaceStory.it(
	"rejects a replaced directory before publication and reports uncertainty after publication",
	[workspaceFiles({}, "the project has the stated publication files")],
	function* ({ notes, anotherFolder }) {
		const outside = yield* anotherFolder({});
		responseDirectory(notes.root);
		const target = yield* Effect.promise(() =>
			open(join(notes.root, "responses"), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW),
		);
		try {
			const sync = target.sync.bind(target);
			vi.spyOn(target, "sync").mockImplementationOnce(async () => {
				await sync();
				await rename(join(notes.root, "responses"), join(notes.root, "retained"));
				outsideResponseDirectory(notes.root, outside.root);
			});
			yield* Effect.promise(() =>
				expect(publishIn(target, notes.root, notes.root, "response.boundary", "Retained feedback")).rejects.toMatchObject({
					_tag: "PublicationUncertain",
				}),
			);
			expect(yield* Effect.promise(() => readFile(join(notes.root, "retained/response.boundary.md"), "utf8"))).toBe("Retained feedback");
			yield* Effect.promise(() =>
				expect(publishIn(target, notes.root, notes.root, "response.other", "Other feedback")).rejects.toMatchObject({ _tag: "Conflict" }),
			);
			expect(yield* Effect.promise(() => readdir(outside.root))).toEqual([]);
		} finally {
			yield* Effect.promise(() => target.close());
		}
	},
);

workspaceStory.it(
	"reports a boundary change detected during cleanup as uncertain without cleaning another directory",
	[workspaceFiles({}, "the project has the stated publication files")],
	function* ({ notes, anotherFolder }) {
		const outside = yield* anotherFolder({});
		responseDirectory(notes.root);
		const target = yield* Effect.promise(() =>
			open(join(notes.root, "responses"), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW),
		);
		try {
			const stat = target.stat.bind(target);
			let checks = 0;
			vi.spyOn(target, "stat").mockImplementation(async () => {
				checks += 1;
				if (checks === 4) {
					await rename(join(notes.root, "responses"), join(notes.root, "retained"));
					outsideResponseDirectory(notes.root, outside.root);
				}
				return stat();
			});
			yield* Effect.promise(() =>
				expect(publishIn(target, notes.root, notes.root, "response.cleanup", "Retained feedback")).rejects.toMatchObject({
					_tag: "PublicationUncertain",
				}),
			);
			expect(yield* Effect.promise(() => readFile(join(notes.root, "retained/response.cleanup.md"), "utf8"))).toBe("Retained feedback");
			expect(yield* Effect.promise(() => readdir(outside.root))).toEqual([]);
		} finally {
			yield* Effect.promise(() => target.close());
		}
	},
);
