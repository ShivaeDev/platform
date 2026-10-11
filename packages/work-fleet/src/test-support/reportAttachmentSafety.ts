import { spawnSync } from "node:child_process";
import { mkdir, symlink, truncate, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { REPORT_LIMITS } from "#reportLimits.ts";

export const reconstructedAttachment = Effect.fn("ReportStory.reconstructedAttachment")(function* (
	kind: "symlink" | "directory" | "fifo" | "escape" | "parent-symlink",
) {
	const host = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
	const folder = join(host, "scratch");
	yield* Effect.promise(() => mkdir(folder));
	yield* Effect.promise(() => writeFile(join(host, "secret.txt"), "synthetic host secret"));
	let name = "attachment";
	yield* Effect.promise(async () => {
		if (kind === "symlink") {
			await symlink(join(host, "secret.txt"), join(folder, name));
		} else if (kind === "directory") {
			await mkdir(join(folder, name));
		} else if (kind === "fifo") {
			if (spawnSync("mkfifo", [join(folder, name)]).status !== 0) {
				throw new Error("Could not create synthetic FIFO");
			}
		} else if (kind === "escape") {
			name = "../secret.txt";
		} else {
			await symlink(host, join(folder, "parent"));
			name = "parent/secret.txt";
		}
	});
	return { folder, name };
});

export const oversizedAttachments = Effect.fn("ReportStory.oversizedAttachments")(function* () {
	const folder = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
	yield* Effect.promise(async () => {
		for (const name of ["first", "second"]) {
			await writeFile(join(folder, name), "");
			await truncate(join(folder, name), REPORT_LIMITS.attachmentBytes / 2 + 1);
		}
	});
	return folder;
});
