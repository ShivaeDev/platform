import { readFileSync } from "node:fs";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { boardDocuments } from "#board/documents.ts";
import { reportPayloadFile } from "#board/reportPayloadFile.ts";
import { linkedReportPayload } from "#test/linkedReportPayload.ts";

const ID = `fleet-report.${revisionOf("payload")}`;
it.live("atomically retains the first payload across concurrent writes and excludes it from Board sources", () =>
	Effect.gen(function* () {
		const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
		expect(yield* reportPayloadFile(root, ID)).toBeUndefined();
		const results = yield* Effect.all([reportPayloadFile(root, ID, "first"), reportPayloadFile(root, ID, "second")], { concurrency: "unbounded" });
		expect(results[0]).toBe(results[1]);
		expect(yield* reportPayloadFile(root, ID)).toBe(results[0]);
		expect(yield* reportPayloadFile(root, ID, "replacement")).toBe(results[0]);
		expect(yield* boardDocuments(root, root)).toEqual([]);
	}).pipe(Effect.provide(NodeServices.layer)),
);
for (const boundary of ["root", "directory", "file"]) {
	it.live(`refuses payload symlinks at the ${boundary} boundary`, () =>
		Effect.gen(function* () {
			const { externalFile, workspace } = yield* linkedReportPayload(boundary, ID);
			expect((yield* Effect.result(reportPayloadFile(workspace, ID)))._tag).toBe("Failure");
			expect((yield* Effect.result(reportPayloadFile(workspace, ID, "replacement")))._tag).toBe("Failure");
			expect(readFileSync(externalFile, "utf8")).toBe("private");
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
