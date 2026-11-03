import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, link, lstat, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { Conflict, PreconditionFailed } from "@shivaedev/errors/taxonomy.ts";
import { PublicationUncertain } from "#rpc/rejections.ts";
import { directoryPath, publicationFailure, uncertain, validateDirectory } from "./publicationDirectory.ts";

function exists(cause: unknown) {
	return cause instanceof Error && "code" in cause && cause.code === "EEXIST";
}
async function linkOrReconcile(temporary: string, name: string, content: string | Uint8Array): Promise<void> {
	try {
		await link(temporary, name);
		return;
	} catch (cause) {
		if (!exists(cause)) {
			throw cause;
		}
	}
	const existing = await open(name, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	let matched = false;
	try {
		if (!((await existing.stat()).isFile() && Buffer.from(await readFile(existing)).equals(Buffer.from(content)))) {
			throw new Conflict({ message: "This identity already records different content; no file was replaced." });
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
}

async function checkSource(name: string, expectedSource: string) {
	const file = await open(name, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		if (!(await file.stat()).isFile() || (await readFile(file, "utf8")) !== expectedSource) {
			throw new PreconditionFailed({ message: "Source changed; no file was replaced." });
		}
	} finally {
		await file.close();
	}
}

export async function publishIn(
	target: FileHandle,
	root: string,
	realRoot: string,
	name: string,
	content: string | Uint8Array,
	directory: string,
	signal: AbortSignal,
	expectedSource?: string,
	validateParents: () => Promise<void> = async () => undefined,
) {
	const expected = directory === "" ? realRoot : `${realRoot}/${directory}`;
	const folder = directoryPath(target, expected);
	const originalRoot = await lstat(root);
	async function validate() {
		await validateParents();
		await validateDirectory(target, folder, expected);
		const currentRoot = await lstat(root);
		if (
			!currentRoot.isDirectory()
			|| currentRoot.dev !== originalRoot.dev
			|| currentRoot.ino !== originalRoot.ino
			|| (await realpath(root)) !== realRoot
		) {
			throw new Conflict({ message: "The write boundary changed." });
		}
	}
	await validate();
	const destination = `${folder}/${name}`;
	if (expectedSource !== undefined) {
		await checkSource(destination, expectedSource);
	}
	const temporary = `${folder}/.${randomUUID()}.tmp`;
	let published = false;
	try {
		const file = await open(temporary, "wx", 0o600);
		try {
			await file.writeFile(content, { encoding: "utf8", signal });
			await file.sync();
		} finally {
			await file.close();
		}
		await validate();
		if (expectedSource !== undefined) {
			await checkSource(destination, expectedSource);
		}
		signal.throwIfAborted();
		if (expectedSource === undefined) {
			await linkOrReconcile(temporary, destination, content);
		} else {
			await rename(temporary, destination);
		}
		published = true;
		await target.sync();
		await validate();
	} catch (cause) {
		published ||= cause instanceof PublicationUncertain;
		publicationFailure(cause, published);
	} finally {
		try {
			await validate().catch((cause: unknown) => publicationFailure(cause, published));
		} finally {
			await unlink(temporary).catch((cause: unknown) => {
				if (!(cause instanceof Error && "code" in cause && cause.code === "ENOENT")) {
					publicationFailure(cause, published);
				}
			});
		}
	}
}
