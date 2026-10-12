import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, link, mkdir, open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { publication } from "@shivaedev/work-board/integration/publication.ts";
import { BoardFailure } from "#policy.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";

const { directoryPath, validateDirectory } = publication;

const MAX_BYTES = REPORT_LIMITS.attachmentBytes * 2 + 512 * 1024;
function hasCode(cause: unknown, code: string) {
	return cause instanceof Error && "code" in cause && cause.code === code;
}
async function readPayload(path: string) {
	const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK).catch((cause: unknown) => {
		if (!hasCode(cause, "ENOENT")) {
			throw cause;
		}
		return undefined;
	});
	if (file === undefined) {
		return undefined;
	}
	try {
		if (!(await file.stat()).isFile()) {
			throw new Error("Report payload must be a regular file");
		}
		const chunks: Uint8Array[] = [];
		let size = 0;
		for (;;) {
			const buffer = new Uint8Array(Math.min(64 * 1024, MAX_BYTES - size + 1));
			const { bytesRead } = await file.read(buffer);
			if (bytesRead === 0) {
				break;
			}
			size += bytesRead;
			if (size > MAX_BYTES) {
				throw new Error("Report payload exceeds size limit");
			}
			chunks.push(buffer.subarray(0, bytesRead));
		}
		await file.sync();
		return Buffer.concat(chunks).toString("utf8");
	} finally {
		await file.close();
	}
}
async function persist(directory: FileHandle, folder: string, name: string, content: string) {
	if (Buffer.byteLength(content) > MAX_BYTES) {
		throw new Error("Report payload exceeds size limit");
	}
	const temporary = `${folder}/.${randomUUID()}.tmp`;
	const file = await open(temporary, "wx", 0o600);
	try {
		try {
			await file.writeFile(content);
			await file.sync();
		} finally {
			await file.close();
		}
		await link(temporary, `${folder}/${name}`).catch((cause: unknown) => {
			if (!hasCode(cause, "EEXIST")) {
				throw cause;
			}
		});
		await directory.sync();
	} finally {
		await unlink(temporary);
	}
}
export function reportPayloadFile(root: string, itemId: string, content?: string) {
	return Effect.tryPromise({
		catch: () => new BoardFailure({ message: "Report publication payload could not be recovered or persisted; retry the same completed attempt" }),
		try: async () => {
			if (!/^fleet-report\.[a-f\d]+$/u.test(itemId)) {
				throw new Error("Invalid report identity");
			}
			const realRoot = await realpath(root);
			const workspace = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
			try {
				const base = directoryPath(workspace, realRoot);
				await validateDirectory(workspace, base, realRoot);
				await mkdir(`${base}/.fleet-reports`, { mode: 0o700 }).catch((cause: unknown) => {
					if (!hasCode(cause, "EEXIST")) {
						throw cause;
					}
				});
				await workspace.sync();
				const expected = join(realRoot, ".fleet-reports");
				const directory = await open(`${base}/.fleet-reports`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
				try {
					const folder = directoryPath(directory, expected);
					await validateDirectory(directory, folder, expected);
					await validateDirectory(workspace, base, realRoot);
					const name = `${itemId}.json`;
					if (content !== undefined) {
						await persist(directory, folder, name, content);
					}
					const payload = await readPayload(`${folder}/${name}`);
					await directory.sync();
					await validateDirectory(directory, folder, expected);
					await validateDirectory(workspace, base, realRoot);
					return payload;
				} finally {
					await directory.close();
				}
			} finally {
				await workspace.close();
			}
		},
	});
}
