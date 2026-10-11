import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, link, mkdir, open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { directoryPath, validateDirectory } from "@shivaedev/work-board/responses/publicationDirectory.ts";
import { reportFileName, reportLinks } from "#board/reportLinks.ts";
import type { ReportFile } from "#host/reportDiff.ts";
import { BoardFailure } from "#policy.ts";

function exists(cause: unknown) {
	return cause instanceof Error && "code" in cause && cause.code === "EEXIST";
}
async function ensureDirectory(path: string) {
	await mkdir(path, { mode: 0o700 }).catch((cause: unknown) => {
		if (!exists(cause)) {
			throw cause;
		}
	});
}
async function publishFile(directory: FileHandle, folder: string, name: string, bytes: Uint8Array) {
	const temporary = `${folder}/.${randomUUID()}.tmp`;
	const file = await open(temporary, "wx", 0o600);
	try {
		await file.writeFile(bytes);
		await file.sync();
	} finally {
		await file.close();
	}
	try {
		await link(temporary, `${folder}/${name}`).catch(async (cause: unknown) => {
			if (!exists(cause)) {
				throw cause;
			}
			const existing = await open(`${folder}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
			try {
				if (!((await existing.stat()).isFile() && Buffer.from(bytes).equals(await existing.readFile()))) {
					throw new Error("Attachment identity already contains different bytes");
				}
				await existing.sync();
			} finally {
				await existing.close();
			}
		});
		await directory.sync();
	} finally {
		await unlink(temporary);
	}
}

export function reportFiles(root: string, itemId: string, files: readonly ReportFile[]) {
	return Effect.tryPromise({
		catch: () => new BoardFailure({ message: "Report attachments could not be recorded beside the result; retry the same completed attempt" }),
		try: async () => {
			if (files.length === 0) {
				return "";
			}
			if (!/^fleet-report\.[a-f\d]+$/u.test(itemId)) {
				throw new Error("Invalid report identity");
			}
			const realRoot = await realpath(root);
			const workspace = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
			try {
				const base = directoryPath(workspace, realRoot);
				await validateDirectory(workspace, base, realRoot);
				await ensureDirectory(`${base}/responses`);
				await workspace.sync();
				const expectedResponses = join(realRoot, "responses");
				const responses = await open(`${base}/responses`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
				try {
					const parent = directoryPath(responses, expectedResponses);
					await validateDirectory(responses, parent, expectedResponses);
					const folderName = `${itemId}.attachments`;
					await ensureDirectory(`${parent}/${folderName}`);
					await responses.sync();
					const expected = join(expectedResponses, folderName);
					const directory = await open(`${parent}/${folderName}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
					try {
						const folder = directoryPath(directory, expected);
						for (const file of files) {
							await validateDirectory(workspace, base, realRoot);
							await validateDirectory(responses, parent, expectedResponses);
							await validateDirectory(directory, folder, expected);
							const name = reportFileName(file.path);
							await publishFile(directory, folder, name, file.bytes);
						}
						await validateDirectory(directory, folder, expected);
						await validateDirectory(workspace, base, realRoot);
						await validateDirectory(responses, parent, expectedResponses);
						return reportLinks(itemId, files);
					} finally {
						await directory.close();
					}
				} finally {
					await responses.close();
				}
			} finally {
				await workspace.close();
			}
		},
	});
}
