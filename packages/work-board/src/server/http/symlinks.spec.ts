import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boardHome, boardStory } from "#test/boardStory.ts";
import { faultyWatch } from "#test/faults.ts";
import { linkedProject } from "#test/linkedProject.ts";
import { changesUntil, changesUntilShown, rpcDocument, rpcNavigation, rpcPaths, rpcSearch, rpcWatcher } from "#test/nativeRpc.ts";
import { referenceLink } from "#test/referenceLink.ts";

boardStory.it(
	"reads linked reference Markdown with logical links, search, aliases and cycle protection",
	[linkedProject, boardHome("plan.md")],
	function* ({ linked, notes: workspace, board, start, request }) {
		const { reference } = linked;
		yield* board.stop();
		referenceLink(workspace, "second-reference", reference.root);
		referenceLink(reference, "guide/loop", reference.root);
		referenceLink(reference, "workspace-loop", workspace.root);
		referenceLink(workspace, "broken", "missing-folder");
		board = yield* start({ home: "plan.md" });
		const html = yield* Effect.map(rpcDocument(board, "/reference/guide/start.md"), (data) => data.source);
		expect(html).toContain("Reference guide");
		expect(yield* rpcPaths(board)).toContain("/reference/guide/next.md");
		expect(yield* rpcPaths(board)).toContain("/second-reference/guide/start.md");
		const paths = (yield* rpcPaths(board)).join(" ");
		expect(paths).not.toContain("/loop/");
		expect(paths).not.toContain("workspace-loop/");
		expect(paths).not.toContain("private.md");
		expect(paths).not.toContain("secret.md");
		for (const path of [
			"/reference/.drafts/private.md",
			"/reference/node_modules/secret.md",
			"/reference/guide/loop/guide/start.md",
			"/reference/../guide/start.md",
		]) {
			expect((yield* request(path)).status).toBe(HttpStatus.fromLiteral("NotFound"));
		}
		const search = yield* rpcSearch(board, "Reference passage");
		expect(search.results).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ file: "reference/guide/start.md" }),
				expect.objectContaining({ file: "second-reference/guide/start.md" }),
			]),
		);
	},
);

boardStory.it(
	"selects the requested linked nested home at / and resolves its relative links",
	[linkedProject, boardHome("plan.md")],
	function* ({ linked, notes: workspace, board, start, request }) {
		const { reference } = linked;
		yield* board.stop();
		referenceLink(workspace, "a-reference", reference.root);
		board = yield* start({ home: "reference/guide/start.md" });
		yield* request("/");
		expect((yield* rpcNavigation(board)).home?.file).toBe("reference/guide/start.md");
		expect(yield* rpcPaths(board)).toContain("/reference/guide/next.md");
		expect((yield* rpcNavigation(board)).home?.file).not.toBe("a-reference/guide/start.md");
	},
);

boardStory.it(
	"watches external edits, additions, renames and removals using workspace-relative paths",
	[linkedProject, boardHome("plan.md")],
	function* ({ linked, search, watchingReady, board, request, watchProject }) {
		const { reference } = linked;
		const events = yield* watchProject();
		try {
			yield* watchingReady(events);
			yield* rpcSearch(board, "Reference passage");
			reference.write("guide/start.md", "# Reference guide\n\nUpdated linked passage.\n");
			const updated = search("Updated linked passage");
			yield* changesUntilShown(
				events,
				"reference/guide/start.md",
				Effect.map(updated, (found) => found.results.some((result) => result.file === "reference/guide/start.md")),
			);
			expect((yield* updated).results).toEqual(expect.arrayContaining([expect.objectContaining({ file: "reference/guide/start.md" })]));
			expect(yield* Effect.map(rpcDocument(board, "/reference/guide/start.md"), (data) => data.source)).toContain("Updated linked passage");
			expect((yield* rpcSearch(board, "Reference passage")).total).toBe(0);
			reference.write("guide/added.md", "# Added reference\n");
			yield* changesUntil(events, "reference/guide/added.md");
			expect((yield* request("/reference/guide/added.md")).status).toBe(HttpStatus.fromLiteral("OK"));
			renameSync(join(reference.root, "guide/added.md"), join(reference.root, "guide/moved.md"));
			yield* changesUntil(events, "reference/guide/moved.md");
			expect((yield* request("/reference/guide/added.md")).status).toBe(HttpStatus.fromLiteral("NotFound"));
			expect((yield* request("/reference/guide/moved.md")).status).toBe(HttpStatus.fromLiteral("OK"));
			rmSync(join(reference.root, "guide/moved.md"));
			yield* changesUntil(events, "reference/guide/moved.md");
			expect((yield* request("/reference/guide/moved.md")).status).toBe(HttpStatus.fromLiteral("NotFound"));
		} finally {
			yield* events.close();
		}
	},
);

boardStory.it(
	"discovers newly linked folders and retargeted links without restarting the server",
	[linkedProject, boardHome("plan.md")],
	function* ({ linked, notes: workspace, search, rpc, watchingReady, request, watchProject }) {
		const { replacement } = linked;
		const events = yield* watchProject();
		const watcher = rpc((client) => client("work-board.watcher", undefined));
		try {
			yield* watchingReady(events);
			referenceLink(workspace, "new-reference", replacement.root);
			const newlyLinked = rpc((client) => client("work-board.document", { url: "/new-reference/guide/start.md" }));
			yield* changesUntilShown(
				events,
				"new-reference/guide/start.md",
				Effect.gen(function* () {
					const read = yield* newlyLinked;
					const status = yield* watcher;
					return status.watching && read.source.includes("Replacement guide");
				}).pipe(Effect.catchTag("NotFound", () => Effect.succeed(false))),
			);
			expect((yield* newlyLinked).source).toContain("Replacement guide");
			expect((yield* watcher).watching).toBe(true);
			replacement.write("guide/start.md", "# New live replacement\n");
			yield* changesUntil(events, "new-reference/guide/start.md");
			rmSync(join(workspace.root, "reference"));
			referenceLink(workspace, "reference", replacement.root);
			const retargetedDocument = rpc((client) => client("work-board.document", { url: "/reference/guide/start.md" }));
			yield* changesUntilShown(
				events,
				"reference/guide/start.md",
				Effect.gen(function* () {
					const read = yield* retargetedDocument;
					const status = yield* watcher;
					return status.watching && read.source.includes("New live replacement");
				}).pipe(Effect.catchTag("NotFound", () => Effect.succeed(false))),
			);
			expect((yield* retargetedDocument).source).toContain("New live replacement");
			expect((yield* watcher).watching).toBe(true);
			expect((yield* request("/reference/guide/next.md")).status).toBe(HttpStatus.fromLiteral("NotFound"));
			replacement.write("guide/start.md", "# Retargeted live reference\n");
			const retargeted = search("Retargeted live reference");
			yield* changesUntilShown(
				events,
				"reference/guide/start.md",
				Effect.map(retargeted, (found) => found.results.some((result) => result.file === "reference/guide/start.md")),
			);
			expect((yield* retargeted).results).toEqual(expect.arrayContaining([expect.objectContaining({ file: "reference/guide/start.md" })]));
		} finally {
			yield* events.close();
		}
	},
);

boardStory.it(
	"keeps escaping file links outside an explicitly included reference directory unreadable",
	[linkedProject, boardHome("plan.md")],
	function* ({ linked, board, start, request }) {
		const { reference, replacement } = linked;
		yield* board.stop();
		referenceLink(reference, "guide/leak.md", join(replacement.root, "guide/start.md"));
		board = yield* start({ home: "plan.md" });
		expect((yield* request("/reference/guide/leak.md")).status).toBe(HttpStatus.fromLiteral("NotFound"));
		expect(yield* Effect.map(rpcDocument(board, "/"), (data) => data.source)).not.toContain("leak.md");
		expect((yield* rpcSearch(board, "Replacement guide")).total).toBe(0);
	},
);

boardStory.it(
	"discloses a failed linked watch and catches up its index after recovery",
	[linkedProject, boardHome("plan.md")],
	function* ({ linked, watchingReady, board, start, watchProject }) {
		const { reference } = linked;
		yield* board.stop();
		const fault = faultyWatch();
		board = yield* start({ home: "plan.md", wrap: fault.wrap });
		const events = yield* watchProject();
		try {
			yield* watchingReady(events);
			yield* rpcSearch(board, "Reference passage");
			yield* fault.fail();
			yield* events.next();
			while ((yield* rpcWatcher(board)).watching) {
				yield* events.next();
			}
			reference.write("guide/start.md", "# Updated while watching unavailable\n");
			expect((yield* rpcSearch(board, "watching unavailable")).total).toBeGreaterThan(0);
			fault.heal();
			yield* watchingReady(events);
			expect((yield* rpcSearch(board, "Reference passage")).total).toBe(0);
		} finally {
			yield* events.close();
		}
	},
);

boardStory.it(
	"retains internal directory aliases alongside their original paths and watches their retargeting",
	[linkedProject, boardHome("plan.md")],
	function* ({ notes: workspace, watchingReady, board, start, watchProject }) {
		yield* board.stop();
		rmSync(join(workspace.root, "reference"));
		workspace.write("notes/start.md", "# Original internal note\n");
		workspace.write("other/start.md", "# Other internal note\n");
		referenceLink(workspace, "alias", "notes");
		board = yield* start({ home: "plan.md" });
		expect(yield* rpcPaths(board)).toContain("/notes/start.md");
		expect(yield* rpcPaths(board)).toContain("/alias/start.md");
		const events = yield* watchProject();
		try {
			yield* watchingReady(events);
			rmSync(join(workspace.root, "alias"));
			referenceLink(workspace, "alias", "other");
			yield* watchingReady(events);
			expect(yield* Effect.map(rpcDocument(board, "/alias/start.md"), (data) => data.source)).toContain("Other internal note");
			workspace.write("other/start.md", "# Updated internal note\n");
			yield* changesUntil(events, "alias/start.md");
			expect(yield* Effect.map(rpcDocument(board, "/alias/start.md"), (data) => data.source)).toContain("Updated internal note");
		} finally {
			yield* events.close();
		}
	},
);
