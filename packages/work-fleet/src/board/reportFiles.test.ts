import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { boardDocuments } from "#board/documents.ts";
import { reportFiles } from "#board/reportFiles.ts";
import { linkedReportBoundary } from "#test/linkedReportBoundary.ts";
import { BINARY_FILE } from "#test/reportAttachments.ts";

const ID = `fleet-report.${revisionOf("synthetic-report")}`;
const FILE = { bytes: BINARY_FILE, path: "capture.png" };
const NAME = `${revisionOf(FILE.path)}-${FILE.path}`;

it.live("keeps Markdown attachment bytes outside Board's source index", () =>
	Effect.gen(function* () {
		const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
		const bytes = new TextEncoder().encode("---\nid: synthetic.attachment\nkind: task\nfleet: approved\n---\n# Attachment\n");
		const path = "findings.md";
		const link = yield* reportFiles(root, ID, [{ bytes, path }]);
		expect(link).toContain("findings.md.attachment");
		expect(readFileSync(join(root, "responses", `${ID}.attachments`, `${revisionOf(path)}-${path}.attachment`))).toEqual(Buffer.from(bytes));
		expect(yield* boardDocuments(root, root)).toEqual([]);
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.live("reuses identical bytes after a lost acknowledgement and refuses replacement", () =>
	Effect.gen(function* () {
		const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
		const suffix = yield* reportFiles(root, ID, [FILE]);
		expect(yield* reportFiles(root, ID, [FILE])).toBe(suffix);
		expect(yield* reportFiles(root, ID, [{ ...FILE, bytes: Uint8Array.of(42) }]).pipe(Effect.flip)).toMatchObject({ _tag: "ReportFileFailure" });
		const folder = join(root, "responses", `${ID}.attachments`);
		expect(readdirSync(folder)).toEqual([NAME]);
		expect(readFileSync(join(folder, NAME))).toEqual(Buffer.from(BINARY_FILE));
	}).pipe(Effect.provide(NodeServices.layer)),
);

for (const boundary of ["root", "responses", "attachments", "file"]) {
	it.live(`refuses symlinks at the ${boundary} boundary`, () =>
		Effect.gen(function* () {
			const { outside, workspace } = yield* linkedReportBoundary(boundary, ID, NAME);
			expect(yield* reportFiles(workspace, ID, [FILE]).pipe(Effect.flip)).toMatchObject({ _tag: "ReportFileFailure" });
			expect(readdirSync(outside)).toEqual(boundary === "root" ? ["linked-root"] : []);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
