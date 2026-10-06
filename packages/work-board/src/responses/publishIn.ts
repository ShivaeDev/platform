import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, link, open, readFile, realpath, unlink } from "node:fs/promises";
import { ResponseFailed } from "#browser/responses/schema.ts";

function uncertain(cause: unknown) {
	return new ResponseFailed({ cause, code: "Uncertain", message: "Publication may have completed. Re-read the record identity before retrying." });
}
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
	try {
		if ((await readFile(existing, "utf8")) !== content) {
			throw new ResponseFailed({ code: "Conflict", message: "This identity already records different content; no file was replaced." });
		}
	} finally {
		await existing.close();
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
	const folder = `/proc/self/fd/${target.fd}`;
	const expected = `${realRoot}/${namespace}`;
	async function validate() {
		if ((await realpath(folder)) !== expected || (await realpath(root)) !== realRoot) {
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
		if (published) {
			throw uncertain(cause);
		}
		throw cause;
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
}
