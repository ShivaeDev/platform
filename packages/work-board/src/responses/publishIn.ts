import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, link, lstat, open, readFile, realpath, unlink } from "node:fs/promises";
import { ResponseFailed } from "#browser/responses/schema.ts";
import { directoryPath, publicationFailure, uncertain, validateDirectory } from "./publicationDirectory.ts";

function exists(cause: unknown) {
	return cause instanceof Error && "code" in cause && cause.code === "EEXIST";
}
async function linkOrReconcile(temporary: string, name: string, content: string): Promise<boolean> {
	try {
		await link(temporary, name);
		return true;
	} catch (cause) {
		if (!exists(cause)) {
			throw cause;
		}
	}
	const existing = await open(name, constants.O_RDONLY | constants.O_NOFOLLOW);
	let matched = false;
	try {
		if ((await readFile(existing, "utf8")) !== content) {
			throw new ResponseFailed({ code: "Conflict", message: "This identity already records different content; no file was replaced." });
		}
		matched = true;
		await existing.sync();
	} catch (cause) {
		if (matched) {
			throw uncertain(cause);
		}
		throw cause;
	} finally {
		await existing.close().catch((cause: unknown) => {
			if (matched) {
				throw uncertain(cause);
			}
			throw cause;
		});
	}
	return false;
}
export async function publishIn(
	target: FileHandle,
	root: string,
	realRoot: string,
	id: string,
	content: string,
	namespace: "responses" | "handoffs" = "responses",
) {
	const expected = `${realRoot}/${namespace}`;
	const folder = directoryPath(target, expected);
	const originalRoot = await lstat(root);
	async function validate() {
		await validateDirectory(target, folder, expected);
		const currentRoot = await lstat(root);
		if (
			!currentRoot.isDirectory()
			|| currentRoot.dev !== originalRoot.dev
			|| currentRoot.ino !== originalRoot.ino
			|| (await realpath(root)) !== realRoot
		) {
			throw new ResponseFailed({ code: "Conflict", message: "The write boundary changed." });
		}
	}
	await validate();
	const name = `${folder}/${id}.md`;
	const temporary = `${folder}/.${randomUUID()}.tmp`;
	let published = false;
	try {
		const file = await open(temporary, "wx", 0o600);
		try {
			await file.writeFile(content, "utf8");
			await file.sync();
		} finally {
			await file.close();
		}
		await validate();
		await linkOrReconcile(temporary, name, content);
		published = true;
		await target.sync();
		await validate();
	} catch (cause) {
		published ||= cause instanceof ResponseFailed && cause.code === "Uncertain";
		publicationFailure(cause, published);
	} finally {
		await validate().catch((cause: unknown) => publicationFailure(cause, published));
		await unlink(temporary).catch(() => undefined);
	}
}
