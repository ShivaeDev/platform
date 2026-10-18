import { readFileSync } from "node:fs";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { boardFileStory, payloadBoundary } from "#test/boardFileStory.ts";

const ID = `fleet-report.${revisionOf("payload")}`;
boardFileStory.it("atomically retains the first payload across concurrent writes and excludes it from Board sources", [], function* ({ files }) {
	expect(yield* files.payload(ID)).toBeUndefined();
	const results = yield* Effect.all([files.payload(ID, "first"), files.payload(ID, "second")], { concurrency: "unbounded" });
	expect(results[0]).toBe(results[1]);
	expect(yield* files.payload(ID)).toBe(results[0]);
	expect(yield* files.payload(ID, "replacement")).toBe(results[0]);
	expect(yield* files.documents()).toEqual([]);
});
for (const boundary of ["root", "directory", "file"]) {
	boardFileStory.it(`refuses payload symlinks at the ${boundary} boundary`, [payloadBoundary(boundary, ID)], function* ({ files }) {
		const { externalFile } = files;
		expect((yield* Effect.result(files.payload(ID)))._tag).toBe("Failure");
		expect((yield* Effect.result(files.payload(ID, "replacement")))._tag).toBe("Failure");
		expect(readFileSync(externalFile, "utf8")).toBe("private");
	});
}
