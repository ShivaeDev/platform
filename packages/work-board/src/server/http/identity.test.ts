import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, PlatformError } from "effect";
import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { identityFixture } from "#test/identityFixture.ts";
import { changesUntil, rpcSearch } from "#test/nativeRpc.ts";

const readingProject = [projectFiles(identityFixture()), boardHome("legacy.md")];

boardStory.it("serves item URLs with either trailing-slash form and reports unknown IDs", readingProject, function* ({ get }) {
	for (const slash of ["", "/"]) {
		const item = yield* get(`/_board/item/work.search${slash}`);
		expect(item.status).toBe(200);
		const missing = yield* get(`/_board/item/missing${slash}`);
		expect(missing.status).toBe(404);
	}
});

boardStory.it(
	"keeps identity URLs valid after heading edits and file renames and makes deletion explicit",
	readingProject,
	function* ({ notes, get, editFile, watchProject }) {
		const events = yield* watchProject();
		yield* events.next();
		try {
			expect((yield* get("/_board/item/work.search/")).status).toBe(200);
			editFile(
				"items/search & review.md",
				identityFixture()["items/search & review.md"]?.replace("# Search the workspace", "# Renamed heading") ?? "",
			);
			yield* changesUntil(events, "items/search & review.md");
			renameSync(join(notes.root, "items/search & review.md"), join(notes.root, "renamed.md"));
			yield* changesUntil(events, "renamed.md");
			const renamed = yield* get("/_board/item/work.search/");
			expect(renamed.status).toBe(200);
			rmSync(join(notes.root, "renamed.md"));
			yield* changesUntil(events, "renamed.md");
			const missing = yield* get("/_board/item/work.search/");
			expect(missing.status).toBe(404);
		} finally {
			yield* events.close();
		}
	},
);

boardStory.it(
	"returns a conflict for duplicate IDs and diagnoses references without choosing a source",
	readingProject,
	function* ({ get, editFile, watchProject }) {
		const events = yield* watchProject();
		yield* events.next();
		try {
			editFile("duplicate.md", "---\nid: work.search\n---\n# Another source");
			yield* changesUntil(events, "duplicate.md");
			const result = yield* get("/_board/item/work.search/");
			expect(result.status).toBe(409);
			expect((yield* get("/decision.md")).status).toBe(200);
			expect((yield* get("/items/search%20%26%20review.md")).status).toBe(200);
		} finally {
			yield* events.close();
		}
	},
);

boardStory.it("indexes declared IDs/status/owner and criteria at exact source locations", readingProject, function* ({ board }) {
	const body = yield* rpcSearch(board, "agent-navigation");
	expect(body.results[0]?.href).toBe("/_board/item/work.search/");
	expect(body.results[0]?.line).toBe(23);
	const criteria = yield* rpcSearch(board, "Escape returns focus");
	expect(criteria.results[0]?.href).toBe("/_board/item/work.search/");
	expect(criteria.results.find((result) => result.href.endsWith("#criterion-keyboard"))?.line).toBe(8);
	const prose = yield* rpcSearch(board, "Readable project prose");
	expect(prose.results[0]?.href).toBe("/_board/item/work.search/");
	expect(prose.results.find((result) => result.kind === "passage")?.line).toBe(25);
});

boardStory.it("does not claim unique identity when part of the workspace cannot be read", readingProject, function* ({ board, start, get }) {
	yield* board.stop();
	board = yield* start({
		home: "legacy.md",
		wrap: (fs) => ({
			...fs,
			readFileString: (file, options) =>
				file.endsWith("decision.md")
					? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
					: fs.readFileString(file, options),
		}),
	});
	const result = yield* get("/_board/item/work.search/");
	expect(result.status).toBe(503);
	const normal = yield* get("/items/search%20%26%20review.md");
	expect(normal.status).toBe(200);
});

boardStory.it(
	"rebuilds identities from files after a server restart without stored index data",
	readingProject,
	function* ({ board, notes, start, get }) {
		expect((yield* get("/_board/item/work.search/")).status).toBe(200);
		yield* board.stop();
		renameSync(join(notes.root, "items/search & review.md"), join(notes.root, "moved.md"));
		board = yield* start({ home: "legacy.md" });
		const result = yield* get("/_board/item/work.search/");
		expect(result.status).toBe(200);
	},
);

boardStory.it(
	"selects .md identities over colliding Markdown paths with either trailing-slash form",
	readingProject,
	function* ({ get, editFile, watchProject }) {
		const events = yield* watchProject();
		yield* events.next();
		try {
			editFile("_board/item/source.md", "# A regular file under the route prefix");
			yield* changesUntil(events, "_board/item/source.md");
			editFile("named.md", "---\nid: source.md\n---\n# An explicitly identified item");
			yield* changesUntil(events, "named.md");
			for (const url of ["/_board/item/source.md", "/_board/item/source.md/", "/_board/item/source%2Emd"]) {
				const item = yield* get(url);
				expect(item.status).toBe(200);
			}
		} finally {
			yield* events.close();
		}
	},
);

boardStory.it(
	"does not retarget an item URL when its source identity changes between index and page reads",
	readingProject,
	function* ({ board, start, get }) {
		yield* board.stop();
		let reads = 0;
		function selectedSource(file: string, source: string) {
			if (!file.endsWith("search & review.md")) {
				return source;
			}
			reads += 1;
			return reads > 1 ? source.replace("id: work.search", "id: work.replacement") : source;
		}
		board = yield* start({
			home: "legacy.md",
			wrap: (fs) => ({
				...fs,
				readFileString: (file, options) => fs.readFileString(file, options).pipe(Effect.map((source) => selectedSource(file, source))),
			}),
		});

		const result = yield* get("/_board/item/work.search/");
		expect(result.status).toBe(404);
	},
);
