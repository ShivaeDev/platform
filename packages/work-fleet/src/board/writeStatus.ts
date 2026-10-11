import { constants } from "node:fs";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { Effect } from "effect";
import { directoryPath, validateDirectory } from "@shivaedev/work-board/responses/publicationDirectory.ts";
import { STATUS_MARKER, statusMarkdown } from "#board/statusMarkdown.ts";
import type { FleetRecord } from "#model.ts";
import { BoardFailure } from "#policy.ts";

async function unchanged(folder: string, content: string): Promise<boolean> {
	const previous = await open(`${folder}/status.md`, constants.O_RDONLY | constants.O_NOFOLLOW).catch((cause: unknown) => {
		if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
			return undefined;
		}
		throw cause;
	});
	if (previous === undefined) {
		return false;
	}
	try {
		const source = await readFile(previous, "utf8");
		if (!source.startsWith(`${STATUS_MARKER}\n`)) {
			throw new Error("fleet/status.md contains authored content");
		}
		return source === content;
	} finally {
		await previous.close();
	}
}

export function writeStatus(root: string, realRoot: string, records: readonly FleetRecord[]) {
	return Effect.tryPromise({
		catch: () => new BoardFailure({ message: "Fleet status could not be recorded in fleet/status.md. Check local filesystem access." }),
		try: async () => {
			const content = statusMarkdown(records);
			const directory = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
			try {
				const base = directoryPath(directory, realRoot);
				await validateDirectory(directory, base, realRoot);
				await mkdir(`${base}/fleet`).catch((cause: unknown) => {
					if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST")) {
						throw cause;
					}
				});
				const target = await open(`${base}/fleet`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
				const folder = directoryPath(target, `${realRoot}/fleet`);
				const temporary = `${folder}/.status-${crypto.randomUUID()}.tmp`;
				try {
					await validateDirectory(target, folder, `${realRoot}/fleet`);
					if (await unchanged(folder, content)) {
						return;
					}
					const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
					try {
						await file.writeFile(content, "utf8");
						await file.sync();
					} finally {
						await file.close();
					}
					await validateDirectory(directory, base, realRoot);
					await validateDirectory(target, folder, `${realRoot}/fleet`);
					await rename(temporary, `${folder}/status.md`);
					await target.sync();
				} finally {
					await rm(temporary, { force: true });
					await target.close();
				}
			} finally {
				await directory.close();
			}
		},
	});
}
