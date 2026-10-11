import { mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import type { FleetRecord } from "#model.ts";
import { prepared } from "#test/preparation.ts";

export function statusRecord(workId: string, stage: FleetRecord["stage"] = "executing"): FleetRecord {
	return {
		attempts: [],
		boardRevision: "synthetic-revision",
		cwd: "/synthetic-repository",
		preparation: prepared(),
		prompt: "Synthetic work instruction",
		stage,
		workId,
	};
}

export const blockedStatus = Effect.fn("FleetStory.blockedStatus")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const occupied = join(root, "fleet/status.md");
	yield* fs.makeDirectory(occupied, { recursive: true });
	return () => rmSync(occupied, { recursive: true });
});

export const statusFolder = Effect.fn("FleetStory.statusFolder")(function* (
	trait: "authoredTask" | "directory" | "file" | "occupied" = "authoredTask",
) {
	const fs = yield* FileSystem.FileSystem;
	const root = realpathSync(yield* fs.makeTempDirectoryScoped());
	const task = "---\nid: task.one\nstatus: planned\n---\n# Authored task\n";
	writeFileSync(join(root, "task.md"), task);
	const outside = realpathSync(yield* fs.makeTempDirectoryScoped());
	writeFileSync(join(outside, "status.md"), "Keep this source");
	if (trait === "directory") {
		symlinkSync(outside, join(root, "fleet"));
	} else if (trait === "file") {
		mkdirSync(join(root, "fleet"));
		symlinkSync(join(outside, "status.md"), join(root, "fleet/status.md"));
	} else if (trait === "occupied") {
		mkdirSync(join(root, "fleet"));
		writeFileSync(join(root, "fleet/status.md"), task);
	}
	return {
		outsideSource: () => readFileSync(join(outside, "status.md"), "utf8"),
		read: () => readFileSync(join(root, "fleet/status.md"), "utf8"),
		root,
		stat: () => statSync(join(root, "fleet/status.md")),
		task,
		taskSource: () => readFileSync(join(root, "task.md"), "utf8"),
	};
});
